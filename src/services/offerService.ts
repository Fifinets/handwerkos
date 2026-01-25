// Offer service for HandwerkOS
// Handles CRUD operations and workflow transitions for offers (Angebote)
// Uses the new offers, offer_targets, offer_items tables

import { supabase } from '@/integrations/supabase/client';
import {
  apiCall,
  createQuery,
  ApiError,
  API_ERROR_CODES
} from '@/utils/api';
import {
  Offer,
  OfferCreate,
  OfferUpdate,
  OfferItem,
  OfferItemCreate,
  OfferItemUpdate,
  OfferTarget,
  OfferTargetCreate,
  OfferTargetUpdate,
  OfferWithRelations,
  OfferFilter,
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';

export class OfferService {

  // ============================================================================
  // OFFER CRUD
  // ============================================================================

  // Get all offers with pagination and filtering
  static async getOffers(
    pagination?: PaginationQuery,
    filters?: OfferFilter
  ): Promise<PaginationResponse<Offer>> {
    return apiCall(async () => {
      let query = supabase
        .from('offers')
        .select(`
          *,
          customers (
            id,
            company_name,
            contact_person,
            email
          )
        `, { count: 'exact' });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.search) {
        query = query.or(
          `offer_number.ilike.%${filters.search}%,` +
          `project_name.ilike.%${filters.search}%,` +
          `customer_name.ilike.%${filters.search}%`
        );
      }

      if (filters?.from_date) {
        query = query.gte('offer_date', filters.from_date);
      }

      if (filters?.to_date) {
        query = query.lte('offer_date', filters.to_date);
      }

      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'created_at', {
            ascending: pagination.sort_order === 'asc'
          });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, count } = await createQuery<Offer>(query).executeWithCount();

      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 20)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, 'Get offers');
  }

  // Get offer by ID with relations
  static async getOffer(id: string): Promise<OfferWithRelations> {
    return apiCall(async () => {
      // Get offer
      const offerQuery = supabase
        .from('offers')
        .select(`
          *,
          customers (
            id,
            company_name,
            contact_person,
            email,
            address,
            city,
            postal_code
          )
        `)
        .eq('id', id)
        .single();

      const { data: offer, error: offerError } = await offerQuery;
      if (offerError) throw offerError;

      // Get targets
      const { data: targets } = await supabase
        .from('offer_targets')
        .select('*')
        .eq('offer_id', id)
        .single();

      // Get items
      const { data: items } = await supabase
        .from('offer_items')
        .select('*')
        .eq('offer_id', id)
        .order('position_number', { ascending: true });

      return {
        ...offer,
        targets: targets || undefined,
        items: items || [],
      } as OfferWithRelations;
    }, `Get offer ${id}`);
  }

  // Create new offer with targets using DB function
  static async createOffer(
    data: OfferCreate,
    targets?: OfferTargetCreate,
    items?: OfferItemCreate[]
  ): Promise<OfferWithRelations> {
    return apiCall(async () => {
      // Use the DB function to create offer with targets
      const { data: offerId, error: createError } = await supabase.rpc(
        'create_offer_with_targets',
        {
          p_company_id: (await this.getCompanyId()),
          p_customer_id: data.customer_id,
          p_customer_name: data.customer_name,
          p_project_name: data.project_name,
          p_customer_address: data.customer_address || null,
          p_project_location: data.project_location || null,
          p_planned_hours: targets?.planned_hours_total || null,
          p_internal_hourly_rate: targets?.internal_hourly_rate || null,
          p_target_start_date: targets?.target_start_date || null,
          p_target_end_date: targets?.target_end_date || null,
          p_project_manager_id: targets?.project_manager_id || null,
        }
      );

      if (createError) throw createError;

      // Update offer with additional fields
      if (data.valid_until || data.payment_terms || data.notes) {
        await supabase
          .from('offers')
          .update({
            valid_until: data.valid_until,
            contact_person: data.contact_person,
            customer_reference: data.customer_reference,
            execution_period_text: data.execution_period_text,
            execution_notes: data.execution_notes,
            payment_terms: data.payment_terms,
            skonto_percent: data.skonto_percent,
            skonto_days: data.skonto_days,
            terms_text: data.terms_text,
            warranty_text: data.warranty_text,
            notes: data.notes,
            created_by: data.created_by,
          })
          .eq('id', offerId);
      }

      // Update targets with additional fields
      if (targets && (targets.billable_hourly_rate || targets.planned_material_cost_total || targets.complexity)) {
        await supabase
          .from('offer_targets')
          .update({
            billable_hourly_rate: targets.billable_hourly_rate,
            planned_material_cost_total: targets.planned_material_cost_total,
            planned_other_cost: targets.planned_other_cost,
            complexity: targets.complexity,
          })
          .eq('offer_id', offerId);
      }

      // Add items if provided
      if (items && items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          offer_id: offerId,
          position_number: item.position_number || index + 1,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price_net: item.unit_price_net,
          vat_rate: item.vat_rate,
          item_type: item.item_type,
          is_optional: item.is_optional || false,
          planned_hours_item: item.planned_hours_item,
          material_purchase_cost: item.material_purchase_cost,
          internal_notes: item.internal_notes,
        }));

        const { error: itemsError } = await supabase
          .from('offer_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      const offer = await this.getOffer(offerId);

      // Emit event
      eventBus.emit('OFFER_CREATED', {
        offer,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return offer;
    }, 'Create offer');
  }

  // Update existing offer
  static async updateOffer(id: string, data: OfferUpdate): Promise<Offer> {
    return apiCall(async () => {
      const existingOffer = await this.getOffer(id);

      // Check if locked
      if (existingOffer.is_locked) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Dieses Angebot ist gesperrt und kann nicht bearbeitet werden.',
          { currentStatus: existingOffer.status }
        );
      }

      const query = supabase
        .from('offers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      const { data: updatedOffer, error } = await query;
      if (error) throw error;

      eventBus.emit('OFFER_UPDATED', {
        offer: updatedOffer,
        previous_offer: existingOffer,
        changes: data,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return updatedOffer;
    }, `Update offer ${id}`);
  }

  // Delete offer (only drafts)
  static async deleteOffer(id: string): Promise<void> {
    return apiCall(async () => {
      const existingOffer = await this.getOffer(id);

      if (existingOffer.status !== 'draft') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur Entwürfe können gelöscht werden.',
          { currentStatus: existingOffer.status }
        );
      }

      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      eventBus.emit('OFFER_DELETED', {
        offer: existingOffer,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
    }, `Delete offer ${id}`);
  }

  // ============================================================================
  // OFFER ITEMS
  // ============================================================================

  static async getOfferItems(offerId: string): Promise<OfferItem[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('offer_items')
        .select('*')
        .eq('offer_id', offerId)
        .order('position_number', { ascending: true });

      if (error) throw error;
      return data || [];
    }, `Get offer items ${offerId}`);
  }

  static async addOfferItem(offerId: string, item: OfferItemCreate): Promise<OfferItem> {
    return apiCall(async () => {
      // Check if offer is locked
      const offer = await this.getOffer(offerId);
      if (offer.is_locked) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Positionen eines gesperrten Angebots können nicht geändert werden.'
        );
      }

      // Get next position number
      const { data: existingItems } = await supabase
        .from('offer_items')
        .select('position_number')
        .eq('offer_id', offerId)
        .order('position_number', { ascending: false })
        .limit(1);

      const nextPosition = existingItems && existingItems.length > 0
        ? existingItems[0].position_number + 1
        : 1;

      const { data, error } = await supabase
        .from('offer_items')
        .insert({
          offer_id: offerId,
          position_number: item.position_number || nextPosition,
          ...item,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }, `Add offer item`);
  }

  static async updateOfferItem(itemId: string, data: OfferItemUpdate): Promise<OfferItem> {
    return apiCall(async () => {
      const { data: updatedItem, error } = await supabase
        .from('offer_items')
        .update(data)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return updatedItem;
    }, `Update offer item ${itemId}`);
  }

  static async deleteOfferItem(itemId: string): Promise<void> {
    return apiCall(async () => {
      const { error } = await supabase
        .from('offer_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    }, `Delete offer item ${itemId}`);
  }

  // ============================================================================
  // OFFER TARGETS
  // ============================================================================

  static async getOfferTargets(offerId: string): Promise<OfferTarget | null> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('offer_targets')
        .select('*')
        .eq('offer_id', offerId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    }, `Get offer targets ${offerId}`);
  }

  static async updateOfferTargets(offerId: string, data: OfferTargetUpdate): Promise<OfferTarget> {
    return apiCall(async () => {
      // Check if offer is locked
      const offer = await this.getOffer(offerId);
      if (offer.is_locked) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Zielwerte eines gesperrten Angebots können nicht geändert werden.'
        );
      }

      const { data: updatedTargets, error } = await supabase
        .from('offer_targets')
        .update(data)
        .eq('offer_id', offerId)
        .select()
        .single();

      if (error) throw error;
      return updatedTargets;
    }, `Update offer targets ${offerId}`);
  }

  // ============================================================================
  // WORKFLOW OPERATIONS
  // ============================================================================

  // Send offer to customer (locks the offer)
  static async sendOffer(id: string): Promise<Offer> {
    return apiCall(async () => {
      const existingOffer = await this.getOffer(id);

      if (existingOffer.status !== 'draft') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur Entwürfe können versendet werden.',
          { currentStatus: existingOffer.status }
        );
      }

      // Check if offer has items
      if (!existingOffer.items || existingOffer.items.length === 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Angebot muss mindestens eine Position enthalten.'
        );
      }

      // Update status (triggers snapshot creation via DB trigger)
      const { data: sentOffer, error } = await supabase
        .from('offers')
        .update({ status: 'sent' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      eventBus.emit('OFFER_SENT', {
        offer: sentOffer,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return sentOffer;
    }, `Send offer ${id}`);
  }

  // Accept offer and create project using DB function
  static async acceptOffer(
    id: string,
    acceptedBy?: string,
    acceptanceNote?: string
  ): Promise<{ offer: Offer; projectId: string }> {
    return apiCall(async () => {
      const existingOffer = await this.getOffer(id);

      if (existingOffer.status !== 'draft' && existingOffer.status !== 'sent') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur Entwürfe oder versendete Angebote können angenommen werden.',
          { currentStatus: existingOffer.status }
        );
      }

      // Check targets
      if (!existingOffer.targets?.planned_hours_total || existingOffer.targets.planned_hours_total <= 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Geplante Stunden müssen größer als 0 sein.'
        );
      }

      if (!existingOffer.targets?.target_end_date) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Ziel-Enddatum ist erforderlich.'
        );
      }

      // Use DB function to accept and create project
      const { data: projectId, error } = await supabase.rpc(
        'accept_offer_and_create_project',
        {
          p_offer_id: id,
          p_accepted_by: acceptedBy || null,
          p_acceptance_note: acceptanceNote || null,
        }
      );

      if (error) throw error;

      // Get updated offer
      const acceptedOffer = await this.getOffer(id);

      eventBus.emit('OFFER_ACCEPTED', {
        offer: acceptedOffer,
        projectId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return { offer: acceptedOffer as Offer, projectId };
    }, `Accept offer ${id}`);
  }

  // Reject offer
  static async rejectOffer(id: string, reason?: string): Promise<Offer> {
    return apiCall(async () => {
      const existingOffer = await this.getOffer(id);

      if (existingOffer.status !== 'sent') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur versendete Angebote können abgelehnt werden.',
          { currentStatus: existingOffer.status }
        );
      }

      const { data: rejectedOffer, error } = await supabase
        .from('offers')
        .update({
          status: 'rejected',
          acceptance_note: reason || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      eventBus.emit('OFFER_REJECTED', {
        offer: rejectedOffer,
        reason,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return rejectedOffer;
    }, `Reject offer ${id}`);
  }

  // Cancel offer
  static async cancelOffer(id: string): Promise<Offer> {
    return apiCall(async () => {
      const { data: cancelledOffer, error } = await supabase
        .from('offers')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      eventBus.emit('OFFER_CANCELLED', {
        offer: cancelledOffer,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      return cancelledOffer;
    }, `Cancel offer ${id}`);
  }

  // ============================================================================
  // CALCULATIONS
  // ============================================================================

  // Calculate totals using DB function
  static async calculateTotals(offerId: string): Promise<{
    subtotal_net: number;
    discount_percent: number;
    discount_amount: number;
    net_total: number;
    vat_rate: number;
    vat_amount: number;
    gross_total: number;
  }> {
    return apiCall(async () => {
      const { data, error } = await supabase.rpc(
        'calculate_offer_totals',
        { p_offer_id: offerId }
      );

      if (error) throw error;
      return data[0];
    }, `Calculate offer totals ${offerId}`);
  }

  // Calculate target totals using DB function
  static async calculateTargetTotals(offerId: string): Promise<{
    planned_hours: number;
    planned_labor_cost: number;
    planned_material_cost: number;
    planned_other_cost: number;
    total_planned_cost: number;
    target_revenue: number;
    target_margin: number;
  }> {
    return apiCall(async () => {
      const { data, error } = await supabase.rpc(
        'calculate_offer_target_totals',
        { p_offer_id: offerId }
      );

      if (error) throw error;
      return data[0];
    }, `Calculate offer target totals ${offerId}`);
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  static async getOfferStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    total_value: Record<string, number>;
    conversion_rate: number;
  }> {
    return apiCall(async () => {
      const { data: offers, error } = await supabase
        .from('offers')
        .select('status, snapshot_gross_total');

      if (error) throw error;

      const stats = {
        total: offers?.length || 0,
        by_status: {
          draft: 0,
          sent: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
          cancelled: 0,
        } as Record<string, number>,
        total_value: {
          draft: 0,
          sent: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
          cancelled: 0,
        } as Record<string, number>,
        conversion_rate: 0,
      };

      offers?.forEach(offer => {
        stats.by_status[offer.status]++;
        stats.total_value[offer.status] += offer.snapshot_gross_total || 0;
      });

      const sentCount = stats.by_status.sent + stats.by_status.accepted + stats.by_status.rejected;
      if (sentCount > 0) {
        stats.conversion_rate = (stats.by_status.accepted / sentCount) * 100;
      }

      return stats;
    }, 'Get offer statistics');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private static async getCompanyId(): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');

    // Try to get company_id from profiles first (like projectService)
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.user.id)
      .single();

    if (profile?.company_id) {
      return profile.company_id;
    }

    // Fallback: try employees table
    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.user.id)
      .single();

    if (employee?.company_id) {
      return employee.company_id;
    }

    // Last resort: use default company ID (like projectService)
    // This allows the app to work even without full company setup
    return '00000000-0000-0000-0000-000000000000';
  }

  // Duplicate offer
  static async duplicateOffer(id: string): Promise<OfferWithRelations> {
    return apiCall(async () => {
      const original = await this.getOffer(id);

      // Create new offer with same data
      const newOffer = await this.createOffer(
        {
          customer_id: original.customer_id,
          customer_name: original.customer_name,
          customer_address: original.customer_address || undefined,
          contact_person: original.contact_person || undefined,
          project_name: `${original.project_name} (Kopie)`,
          project_location: original.project_location || undefined,
          valid_until: undefined, // Reset validity
          payment_terms: original.payment_terms || undefined,
          notes: original.notes || undefined,
        },
        original.targets ? {
          planned_hours_total: original.targets.planned_hours_total || undefined,
          internal_hourly_rate: original.targets.internal_hourly_rate || undefined,
          billable_hourly_rate: original.targets.billable_hourly_rate || undefined,
          planned_material_cost_total: original.targets.planned_material_cost_total || undefined,
          planned_other_cost: original.targets.planned_other_cost || undefined,
          complexity: original.targets.complexity,
          project_manager_id: original.targets.project_manager_id || undefined,
        } : undefined,
        original.items?.map(item => ({
          position_number: item.position_number,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price_net: item.unit_price_net,
          vat_rate: item.vat_rate,
          item_type: item.item_type,
          is_optional: item.is_optional,
          planned_hours_item: item.planned_hours_item || undefined,
          material_purchase_cost: item.material_purchase_cost || undefined,
          internal_notes: item.internal_notes || undefined,
        }))
      );

      return newOffer;
    }, `Duplicate offer ${id}`);
  }
}

// Export singleton instance
export const offerService = new OfferService();
