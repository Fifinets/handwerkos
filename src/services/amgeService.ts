// AMGE-Kalkulator Service
// CRUD operations for Verrechnungslohn calculations

import { supabase } from '@/integrations/supabase/client';
import { ApiError } from '@/utils/api';
import type { AMGECalculation, AMGEFormData } from '@/types/amge';
import { eventBus } from './eventBus';

export class AMGEService {

  // Get all AMGE calculations for the company
  static async getCalculations(): Promise<AMGECalculation[]> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('amge_calculations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw new ApiError('QUERY_ERROR', `Fehler beim Laden der AMGE-Kalkulationen: ${error.message}`);
    return (data || []) as AMGECalculation[];
  }

  // Get single calculation by ID
  static async getCalculation(id: string): Promise<AMGECalculation> {
    const { data, error } = await supabase
      .from('amge_calculations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new ApiError('QUERY_ERROR', `AMGE-Kalkulation nicht gefunden: ${error.message}`);
    return data as AMGECalculation;
  }

  // Get the currently active calculation
  static async getActiveCalculation(): Promise<AMGECalculation | null> {
    const companyId = await this.getCompanyId();

    const { data, error } = await supabase
      .from('amge_calculations')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new ApiError('QUERY_ERROR', `Fehler: ${error.message}`);
    return data as AMGECalculation | null;
  }

  // Create new calculation
  static async createCalculation(formData: AMGEFormData): Promise<AMGECalculation> {
    const companyId = await this.getCompanyId();

    const insertData = {
      company_id: companyId,
      ...formData,
    };

    const { data, error } = await supabase
      .from('amge_calculations')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new ApiError('QUERY_ERROR', `Fehler beim Erstellen: ${error.message}`);

    eventBus.emit('AMGE_CREATED', { calculation: data });
    return data as AMGECalculation;
  }

  // Update existing calculation
  static async updateCalculation(id: string, formData: Partial<AMGEFormData>): Promise<AMGECalculation> {
    const { data, error } = await supabase
      .from('amge_calculations')
      .update(formData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new ApiError('QUERY_ERROR', `Fehler beim Aktualisieren: ${error.message}`);

    eventBus.emit('AMGE_UPDATED', { calculation: data });
    return data as AMGECalculation;
  }

  // Delete calculation
  static async deleteCalculation(id: string): Promise<void> {
    const { error } = await supabase
      .from('amge_calculations')
      .delete()
      .eq('id', id);

    if (error) throw new ApiError('QUERY_ERROR', `Fehler beim Löschen: ${error.message}`);
    eventBus.emit('AMGE_DELETED', { id });
  }

  // Set a calculation as the active one (deactivate others)
  static async setActive(id: string): Promise<AMGECalculation> {
    const companyId = await this.getCompanyId();

    // Deactivate all others
    await supabase
      .from('amge_calculations')
      .update({ is_active: false })
      .eq('company_id', companyId);

    // Activate selected
    const { data, error } = await supabase
      .from('amge_calculations')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new ApiError('QUERY_ERROR', `Fehler: ${error.message}`);
    return data as AMGECalculation;
  }

  // Helper: Get company ID from current user
  private static async getCompanyId(): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new ApiError('UNAUTHORIZED', 'Nicht angemeldet');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.user.id)
      .single();

    if (profile?.company_id) return profile.company_id;

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.user.id)
      .single();

    if (employee?.company_id) return employee.company_id;

    return '00000000-0000-0000-0000-000000000000';
  }
}

export const amgeService = new AMGEService();
