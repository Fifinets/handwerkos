// Quote service for HandwerkOS
// Handles CRUD operations and workflow transitions for quotes

import { supabase } from '@/integrations/supabase/client';
import { 
  apiCall, 
  createQuery, 
  validateInput,
  ApiError,
  API_ERROR_CODES 
} from '@/utils/api';
import {
  Quote,
  QuoteCreate,
  QuoteUpdate,
  QuoteCreateSchema,
  QuoteUpdateSchema,
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';
import { orderService } from './orderService';

export class QuoteService {
  
  // Get all quotes with pagination and filtering
  static async getQuotes(
    pagination?: PaginationQuery,
    filters?: {
      status?: Quote['status'];
      customer_id?: string;
      search?: string;
    }
  ): Promise<PaginationResponse<Quote>> {
    return apiCall(async () => {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          customers (
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
          `title.ilike.%${filters.search}%,` +
          `description.ilike.%${filters.search}%,` +
          `quote_number.ilike.%${filters.search}%`
        );
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
      
      const { data, count } = await createQuery<Quote>(query).executeWithCount();
      
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
    }, 'Get quotes');
  }
  
  // Get quote by ID
  static async getQuote(id: string): Promise<Quote> {
    return apiCall(async () => {
      const query = supabase
        .from('quotes')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email,
            address,
            city,
            postal_code
          )
        `)
        .eq('id', id);
      
      return createQuery<Quote>(query).executeSingle();
    }, `Get quote ${id}`);
  }
  
  // Create new quote
  static async createQuote(data: QuoteCreate): Promise<Quote> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(QuoteCreateSchema, data);
      
      // Calculate totals from items
      const items = validatedData.body?.items || [];
      const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
      const taxRate = validatedData.tax_rate || 19;
      const totalGross = totalNet * (1 + taxRate / 100);
      
      const quoteData = {
        ...validatedData,
        total_net: totalNet,
        total_gross: totalGross,
        status: 'draft' as const,
      };
      
      const query = supabase
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();
      
      const quote = await createQuery<Quote>(query).executeSingle();
      
      // Emit event for audit trail and notifications
      eventBus.emit('QUOTE_CREATED', {
        quote,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return quote;
    }, 'Create quote');
  }
  
  // Update existing quote
  static async updateQuote(id: string, data: QuoteUpdate): Promise<Quote> {
    return apiCall(async () => {
      // Get existing quote for validation
      const existingQuote = await this.getQuote(id);
      
      // Validate business rules
      if (existingQuote.status === 'accepted') {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Akzeptierte Angebote können nicht mehr bearbeitet werden.',
          { currentStatus: existingQuote.status }
        );
      }
      
      if (existingQuote.status === 'sent' && data.quote_number) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Angebotsnummer kann nach dem Versand nicht mehr geändert werden.',
          { currentStatus: existingQuote.status }
        );
      }
      
      // Validate input
      const validatedData = validateInput(QuoteUpdateSchema, data);
      
      // Recalculate totals if items changed
      if (validatedData.body?.items) {
        const items = validatedData.body.items;
        const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
        const taxRate = validatedData.tax_rate || existingQuote.tax_rate || 19;
        validatedData.total_net = totalNet;
        validatedData.total_gross = totalNet * (1 + taxRate / 100);
      }
      
      const query = supabase
        .from('quotes')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedQuote = await createQuery<Quote>(query).executeSingle();
      
      // Emit event for audit trail
      eventBus.emit('QUOTE_UPDATED', {
        quote: updatedQuote,
        previous_quote: existingQuote,
        changes: validatedData,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedQuote;
    }, `Update quote ${id}`);
  }
  
  // Send quote to customer
  static async sendQuote(id: string): Promise<Quote> {
    return apiCall(async () => {
      const existingQuote = await this.getQuote(id);
      
      // Validate quote can be sent
      if (existingQuote.status !== 'draft') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur Entwürfe können versendet werden.',
          { currentStatus: existingQuote.status }
        );
      }
      
      // Validate quote has required data
      if (!existingQuote.body?.items || existingQuote.body.items.length === 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Angebot muss mindestens eine Position enthalten.'
        );
      }
      
      if (!existingQuote.valid_until) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Gültigkeitsdatum ist erforderlich.'
        );
      }
      
      // Update status to 'sent' (this triggers quote numbering via database trigger)
      const updateData = {
        status: 'sent' as const,
        sent_at: new Date().toISOString(),
      };
      
      const query = supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const sentQuote = await createQuery<Quote>(query).executeSingle();
      
      // Emit event for notifications and PDF generation
      eventBus.emit('QUOTE_SENT', {
        quote: sentQuote,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return sentQuote;
    }, `Send quote ${id}`);
  }
  
  // Accept quote (creates order automatically)
  static async acceptQuote(id: string): Promise<{ quote: Quote; order: any }> {
    return apiCall(async () => {
      const existingQuote = await this.getQuote(id);
      
      // Validate quote can be accepted
      if (existingQuote.status !== 'sent') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur versendete Angebote können angenommen werden.',
          { currentStatus: existingQuote.status }
        );
      }
      
      // Check if quote is still valid
      if (existingQuote.valid_until && new Date(existingQuote.valid_until) < new Date()) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Das Angebot ist bereits abgelaufen.',
          { validUntil: existingQuote.valid_until }
        );
      }
      
      // Update quote status
      const updateData = {
        status: 'accepted' as const,
        accepted_at: new Date().toISOString(),
      };
      
      const query = supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const acceptedQuote = await createQuery<Quote>(query).executeSingle();
      
      // Create order automatically
      const order = await orderService.createOrderFromQuote(acceptedQuote);
      
      // Emit event for workflow automation
      eventBus.emit('QUOTE_ACCEPTED', {
        quote: acceptedQuote,
        order,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return { quote: acceptedQuote, order };
    }, `Accept quote ${id}`);
  }
  
  // Reject quote
  static async rejectQuote(id: string, reason?: string): Promise<Quote> {
    return apiCall(async () => {
      const existingQuote = await this.getQuote(id);
      
      // Validate quote can be rejected
      if (existingQuote.status !== 'sent') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur versendete Angebote können abgelehnt werden.',
          { currentStatus: existingQuote.status }
        );
      }
      
      const updateData = {
        status: 'rejected' as const,
        // Store rejection reason in description or metadata
        description: reason 
          ? `${existingQuote.description || ''}\n\nAblehnungsgrund: ${reason}`.trim()
          : existingQuote.description,
      };
      
      const query = supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const rejectedQuote = await createQuery<Quote>(query).executeSingle();
      
      // Emit event for notifications
      eventBus.emit('QUOTE_REJECTED', {
        quote: rejectedQuote,
        reason,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return rejectedQuote;
    }, `Reject quote ${id}`);
  }
  
  // Get quote statistics
  static async getQuoteStats(): Promise<{
    total: number;
    by_status: Record<Quote['status'], number>;
    total_value: Record<Quote['status'], number>;
    conversion_rate: number;
  }> {
    return apiCall(async () => {
      const query = supabase
        .from('quotes')
        .select('status, total_gross');
      
      const quotes = await createQuery<Quote>(query).execute();
      
      const stats = {
        total: quotes.length,
        by_status: {
          draft: 0,
          sent: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
        } as Record<Quote['status'], number>,
        total_value: {
          draft: 0,
          sent: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
        } as Record<Quote['status'], number>,
        conversion_rate: 0,
      };
      
      quotes.forEach(quote => {
        stats.by_status[quote.status]++;
        stats.total_value[quote.status] += quote.total_gross || 0;
      });
      
      // Calculate conversion rate (accepted / sent)
      const sentCount = stats.by_status.sent + stats.by_status.accepted + stats.by_status.rejected;
      if (sentCount > 0) {
        stats.conversion_rate = (stats.by_status.accepted / sentCount) * 100;
      }
      
      return stats;
    }, 'Get quote statistics');
  }
  
  // Delete quote (with safety checks)
  static async deleteQuote(id: string): Promise<void> {
    return apiCall(async () => {
      const existingQuote = await this.getQuote(id);
      
      // Only allow deletion of draft quotes
      if (existingQuote.status !== 'draft') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur Entwürfe können gelöscht werden.',
          { currentStatus: existingQuote.status }
        );
      }
      
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Emit event for audit trail
      eventBus.emit('QUOTE_DELETED', {
        quote: existingQuote,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
    }, `Delete quote ${id}`);
  }
  
  // Duplicate quote
  static async duplicateQuote(id: string): Promise<Quote> {
    return apiCall(async () => {
      const originalQuote = await this.getQuote(id);
      
      // Create new quote from original
      const duplicateData: QuoteCreate = {
        customer_id: originalQuote.customer_id,
        title: `${originalQuote.title} (Kopie)`,
        description: originalQuote.description,
        body: originalQuote.body,
        tax_rate: originalQuote.tax_rate,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      };
      
      return this.createQuote(duplicateData);
    }, `Duplicate quote ${id}`);
  }
}

// Export singleton instance
export const quoteService = QuoteService;