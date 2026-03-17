import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

// ============================================================================
// TYPES matching our DB schema
// ============================================================================

export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  item_type: 'material' | 'photo';
  material_name: string | null;
  material_quantity: number | null;
  material_unit: string | null;
  unit_price: number | null;
  photo_url: string | null;
  photo_caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface DeliveryNote {
  id: string;
  company_id: string;
  project_id: string;
  customer_id: string | null;
  employee_id: string;
  delivery_note_number: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  description: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'invoiced';
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  signature_data: string | null;
  signature_name: string | null;
  signed_at: string | null;
  additional_employee_ids: string[] | null;
  created_at: string;
  updated_at: string;
  // Relations
  project?: { id: string; name: string } | null;
  employee?: { id: string; first_name: string; last_name: string; hourly_wage?: number } | null;
  delivery_note_items?: DeliveryNoteItem[];
}

export interface DeliveryNoteCreateData {
  project_id: string;
  customer_id?: string;
  work_date: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  description: string;
  signature_data?: string;
  signature_name?: string;
  additional_employee_ids?: string[];
}

export interface DeliveryNoteItemCreateData {
  item_type: 'material' | 'photo';
  material_name?: string;
  material_quantity?: number;
  material_unit?: string;
  unit_price?: number;
  photo_url?: string;
  photo_caption?: string;
  sort_order?: number;
}

export interface DeliveryNoteFilters {
  employee_id?: string;
  project_id?: string;
  status?: string | string[];
  work_date_from?: string;
  work_date_to?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export const useDeliveryNotes = () => {
  const { companyId, user, isManager } = useSupabaseAuth();
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get employee ID for current user
  const getEmployeeId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    return data?.id ?? null;
  }, [user]);

  // -------------------------------------------------------------------------
  // FETCH
  // -------------------------------------------------------------------------

  const fetchDeliveryNotes = useCallback(async (filters?: DeliveryNoteFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('delivery_notes')
        .select(`
          *,
          project:projects(id, name),
          employee:employees!employee_id(id, first_name, last_name, hourly_wage),
          delivery_note_items(*)
        `)
        .eq('company_id', companyId)
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });

      // For non-managers: only show own delivery notes
      if (!isManager) {
        const employeeId = await getEmployeeId();
        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        }
      }

      // Apply optional filters
      if (filters?.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      if (filters?.work_date_from) {
        query = query.gte('work_date', filters.work_date_from);
      }
      if (filters?.work_date_to) {
        query = query.lte('work_date', filters.work_date_to);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setDeliveryNotes((data as DeliveryNote[]) || []);
    } catch (err: any) {
      console.error('Error fetching delivery notes:', err);
      setError(err.message);
      setDeliveryNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, isManager, getEmployeeId]);

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  const createDeliveryNote = useCallback(async (data: DeliveryNoteCreateData): Promise<DeliveryNote | null> => {
    if (!companyId) return null;

    const employeeId = await getEmployeeId();
    if (!employeeId) {
      toast.error('Mitarbeiter-Profil nicht gefunden');
      return null;
    }

    const { data: result, error: insertError } = await supabase
      .from('delivery_notes')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        project_id: data.project_id,
        customer_id: data.customer_id || null,
        work_date: data.work_date,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        break_minutes: data.break_minutes ?? 0,
        description: data.description,
        status: 'draft',
        signature_data: data.signature_data || null,
        signature_name: data.signature_name || null,
        signed_at: data.signature_data ? new Date().toISOString() : null,
        additional_employee_ids: data.additional_employee_ids || [],
      })
      .select(`*, project:projects(id, name), employee:employees!employee_id(id, first_name, last_name, hourly_wage), delivery_note_items(*)`)
      .single();

    if (insertError) {
      console.error('Error creating delivery note:', insertError);
      toast.error(`Lieferschein konnte nicht erstellt werden: ${insertError.message}`);
      return null;
    }

    toast.success('Lieferschein als Entwurf gespeichert');
    setDeliveryNotes(prev => [result as DeliveryNote, ...prev]);
    return result as DeliveryNote;
  }, [companyId, getEmployeeId]);

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  const updateDeliveryNote = useCallback(async (id: string, data: Partial<DeliveryNoteCreateData>): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('delivery_notes')
      .update({
        ...(data.work_date !== undefined && { work_date: data.work_date }),
        ...(data.start_time !== undefined && { start_time: data.start_time }),
        ...(data.end_time !== undefined && { end_time: data.end_time }),
        ...(data.break_minutes !== undefined && { break_minutes: data.break_minutes }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.project_id !== undefined && { project_id: data.project_id }),
        ...(data.customer_id !== undefined && { customer_id: data.customer_id }),
        ...(data.additional_employee_ids !== undefined && { additional_employee_ids: data.additional_employee_ids }),
      })
      .eq('id', id)
      .eq('status', 'draft'); // Only draft can be updated

    if (updateError) {
      console.error('Error updating delivery note:', updateError);
      toast.error('Lieferschein konnte nicht aktualisiert werden');
      return false;
    }

    await fetchDeliveryNotes();
    return true;
  }, [fetchDeliveryNotes]);

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------

  const deleteDeliveryNote = useCallback(async (id: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('delivery_notes')
      .delete()
      .eq('id', id)
      .eq('status', 'draft');

    if (deleteError) {
      console.error('Error deleting delivery note:', deleteError);
      toast.error('Lieferschein konnte nicht gelöscht werden');
      return false;
    }

    toast.success('Lieferschein gelöscht');
    setDeliveryNotes(prev => prev.filter(n => n.id !== id));
    return true;
  }, []);

  // -------------------------------------------------------------------------
  // ITEMS
  // -------------------------------------------------------------------------

  const addItem = useCallback(async (noteId: string, item: DeliveryNoteItemCreateData): Promise<DeliveryNoteItem | null> => {
    const { data, error: insertError } = await supabase
      .from('delivery_note_items')
      .insert({
        delivery_note_id: noteId,
        item_type: item.item_type,
        material_name: item.material_name || null,
        material_quantity: item.material_quantity || null,
        material_unit: item.material_unit || null,
        unit_price: item.unit_price || null,
        photo_url: item.photo_url || null,
        photo_caption: item.photo_caption || null,
        sort_order: item.sort_order ?? 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding item:', insertError);
      toast.error('Position konnte nicht hinzugefügt werden');
      return null;
    }

    // Update local state
    setDeliveryNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, delivery_note_items: [...(n.delivery_note_items || []), data as DeliveryNoteItem] }
        : n
    ));

    return data as DeliveryNoteItem;
  }, []);

  const removeItem = useCallback(async (itemId: string, noteId: string): Promise<boolean> => {
    const { error: deleteError } = await supabase
      .from('delivery_note_items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error('Error removing item:', deleteError);
      toast.error('Position konnte nicht entfernt werden');
      return false;
    }

    setDeliveryNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, delivery_note_items: (n.delivery_note_items || []).filter(i => i.id !== itemId) }
        : n
    ));

    return true;
  }, []);

  // -------------------------------------------------------------------------
  // STATUS TRANSITIONS
  // -------------------------------------------------------------------------

  const submitForApproval = useCallback(async (noteId: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('delivery_notes')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('status', 'draft');

    if (updateError) {
      console.error('Error submitting delivery note:', updateError);
      toast.error('Einreichen fehlgeschlagen');
      return false;
    }

    toast.success('Lieferschein eingereicht');
    setDeliveryNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, status: 'submitted', submitted_at: new Date().toISOString() } : n
    ));
    return true;
  }, []);

  const approve = useCallback(async (noteId: string): Promise<boolean> => {
    const employeeId = await getEmployeeId();

    const { error: updateError } = await supabase
      .from('delivery_notes')
      .update({
        status: 'approved',
        approved_by: employeeId,
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', noteId)
      .eq('status', 'submitted');

    if (updateError) {
      console.error('Error approving delivery note:', updateError);
      toast.error('Freigabe fehlgeschlagen');
      return false;
    }

    toast.success('Lieferschein freigegeben');
    setDeliveryNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, status: 'approved', approved_at: new Date().toISOString() } : n
    ));
    return true;
  }, [getEmployeeId]);

  const reject = useCallback(async (noteId: string, reason: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('delivery_notes')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', noteId)
      .eq('status', 'submitted');

    if (updateError) {
      console.error('Error rejecting delivery note:', updateError);
      toast.error('Ablehnung fehlgeschlagen');
      return false;
    }

    toast.success('Lieferschein abgelehnt');
    setDeliveryNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, status: 'rejected', rejection_reason: reason } : n
    ));
    return true;
  }, []);

  const signDeliveryNote = useCallback(async (
    noteId: string,
    signatureData: string,
    signerName: string,
  ): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('delivery_notes')
      .update({
        signature_data: signatureData,
        signature_name: signerName,
        signed_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (updateError) {
      console.error('Error signing delivery note:', updateError);
      toast.error('Unterschrift konnte nicht gespeichert werden');
      return false;
    }

    toast.success('Unterschrift gespeichert');
    setDeliveryNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, signature_data: signatureData, signature_name: signerName, signed_at: new Date().toISOString() }
        : n
    ));
    return true;
  }, []);

  // -------------------------------------------------------------------------
  // FETCH SINGLE
  // -------------------------------------------------------------------------

  const fetchDeliveryNote = useCallback(async (id: string): Promise<DeliveryNote | null> => {
    const { data, error: fetchError } = await supabase
      .from('delivery_notes')
      .select(`
        *,
        project:projects(id, name),
        employee:employees!employee_id(id, first_name, last_name, hourly_wage),
        delivery_note_items(*)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching delivery note:', fetchError);
      return null;
    }

    return data as DeliveryNote;
  }, []);

  return {
    deliveryNotes,
    isLoading,
    error,
    fetchDeliveryNotes,
    fetchDeliveryNote,
    createDeliveryNote,
    updateDeliveryNote,
    deleteDeliveryNote,
    addItem,
    removeItem,
    submitForApproval,
    approve,
    reject,
    signDeliveryNote,
  };
};
