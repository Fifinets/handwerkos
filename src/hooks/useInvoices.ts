// Hook for managing invoices (Rechnungen)
// Provides CRUD operations and item management

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  Invoice,
  InvoiceCreate,
  InvoiceUpdate,
  InvoiceWithRelations,
  InvoiceItem,
  InvoiceItemCreate,
  InvoiceFilter,
  InvoiceStatus,
} from '@/types';

interface UseInvoicesOptions {
  projectId?: string;
  customerId?: string;
  autoFetch?: boolean;
}

interface UseInvoicesReturn {
  // Data
  invoices: InvoiceWithRelations[];
  currentInvoice: InvoiceWithRelations | null;
  isLoading: boolean;
  error: Error | null;

  // CRUD
  fetchInvoices: (filter?: InvoiceFilter) => Promise<void>;
  fetchInvoice: (id: string) => Promise<InvoiceWithRelations | null>;
  createInvoice: (data: InvoiceCreate) => Promise<Invoice | null>;
  updateInvoice: (id: string, data: InvoiceUpdate) => Promise<Invoice | null>;
  deleteInvoice: (id: string) => Promise<boolean>;

  // Items
  addItem: (invoiceId: string, item: InvoiceItemCreate) => Promise<InvoiceItem | null>;
  updateItem: (itemId: string, item: Partial<InvoiceItemCreate>) => Promise<InvoiceItem | null>;
  removeItem: (itemId: string) => Promise<boolean>;
  reorderItems: (invoiceId: string, itemIds: string[]) => Promise<boolean>;

  // Workflow
  send: (id: string) => Promise<boolean>;
  markPaid: (id: string, paidAt?: string) => Promise<boolean>;
  markOverdue: (id: string) => Promise<boolean>;
  void: (id: string) => Promise<boolean>;
  cancel: (id: string) => Promise<boolean>;

  // Helpers
  canEdit: (invoice: Invoice) => boolean;
  canSend: (invoice: Invoice) => boolean;
  syncTotals: (id: string) => Promise<boolean>;
  getOverdueInvoices: () => Promise<InvoiceWithRelations[]>;
}

export function useInvoices(options: UseInvoicesOptions = {}): UseInvoicesReturn {
  const { projectId, customerId } = options;
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ============================================================================
  // FETCH
  // ============================================================================

  const fetchInvoices = useCallback(async (filter?: InvoiceFilter) => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          items:invoice_items(*),
          customer:customers(id, company_name, contact_person, address, postal_code, city),
          project:projects(id, name)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (projectId || filter?.project_id) {
        query = query.eq('project_id', projectId || filter?.project_id);
      }

      if (customerId || filter?.customer_id) {
        query = query.eq('customer_id', customerId || filter?.customer_id);
      }

      if (filter?.status) {
        if (Array.isArray(filter.status)) {
          query = query.in('status', filter.status);
        } else {
          query = query.eq('status', filter.status);
        }
      }

      if (filter?.invoice_type) {
        query = query.eq('invoice_type', filter.invoice_type);
      }

      if (filter?.from_date) {
        query = query.gte('created_at', filter.from_date);
      }

      if (filter?.to_date) {
        query = query.lte('created_at', filter.to_date);
      }

      if (filter?.search) {
        query = query.or(`invoice_number.ilike.%${filter.search}%,title.ilike.%${filter.search}%`);
      }

      if (filter?.overdue_only) {
        query = query.eq('status', 'overdue');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setInvoices((data as InvoiceWithRelations[]) || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch invoices');
      setError(error);
      toast({
        title: 'Fehler',
        description: 'Rechnungen konnten nicht geladen werden',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, customerId, toast]);

  const fetchInvoice = useCallback(async (id: string): Promise<InvoiceWithRelations | null> => {
    setIsLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          items:invoice_items(*),
          customer:customers(id, company_name, contact_person, address, postal_code, city),
          project:projects(id, name)
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const result = data as InvoiceWithRelations;
      setCurrentInvoice(result);
      return result;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Rechnung konnte nicht geladen werden',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // ============================================================================
  // CREATE / UPDATE / DELETE
  // ============================================================================

  const createInvoice = useCallback(async (data: InvoiceCreate): Promise<Invoice | null> => {
    setIsLoading(true);

    try {
      // Get company_id from session
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      // Generate invoice number
      const { data: invoiceNumber } = await supabase
        .rpc('generate_invoice_number', { p_company_id: profile?.company_id });

      const { data: result, error: createError } = await supabase
        .from('invoices')
        .insert({
          ...data,
          company_id: profile?.company_id,
          invoice_number: invoiceNumber || `RE-${Date.now()}`,
          status: 'draft',
          is_locked: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'Erfolg',
        description: `Rechnung ${invoiceNumber} erstellt`,
      });

      await fetchInvoices();

      return result as Invoice;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rechnung konnte nicht erstellt werden';
      toast({
        title: 'Fehler',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvoices, toast]);

  const updateInvoice = useCallback(async (
    id: string,
    data: InvoiceUpdate
  ): Promise<Invoice | null> => {
    setIsLoading(true);

    try {
      const { data: result, error: updateError } = await supabase
        .from('invoices')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      toast({
        title: 'Erfolg',
        description: 'Rechnung aktualisiert',
      });

      await fetchInvoices();

      return result as Invoice;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rechnung konnte nicht aktualisiert werden';
      toast({
        title: 'Fehler',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvoices, toast]);

  const deleteInvoice = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast({
        title: 'Erfolg',
        description: 'Rechnung gelöscht',
      });

      await fetchInvoices();

      return true;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Rechnung konnte nicht gelöscht werden (möglicherweise bereits versendet)',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvoices, toast]);

  // ============================================================================
  // ITEMS
  // ============================================================================

  const addItem = useCallback(async (
    invoiceId: string,
    item: InvoiceItemCreate
  ): Promise<InvoiceItem | null> => {
    try {
      // Get next position number
      const { data: existingItems } = await supabase
        .from('invoice_items')
        .select('position_number')
        .eq('invoice_id', invoiceId)
        .order('position_number', { ascending: false })
        .limit(1);

      const nextPosition = (existingItems?.[0]?.position_number || 0) + 1;

      const { data, error: insertError } = await supabase
        .from('invoice_items')
        .insert({
          invoice_id: invoiceId,
          position_number: item.position_number || nextPosition,
          ...item,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Sync totals
      await syncTotals(invoiceId);

      // Refresh current invoice
      if (currentInvoice?.id === invoiceId) {
        await fetchInvoice(invoiceId);
      }

      return data as InvoiceItem;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Position konnte nicht hinzugefügt werden',
        variant: 'destructive',
      });
      return null;
    }
  }, [currentInvoice, fetchInvoice, toast]);

  const updateItem = useCallback(async (
    itemId: string,
    item: Partial<InvoiceItemCreate>
  ): Promise<InvoiceItem | null> => {
    try {
      const { data, error: updateError } = await supabase
        .from('invoice_items')
        .update(item)
        .eq('id', itemId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Sync totals
      const { data: invoiceItem } = await supabase
        .from('invoice_items')
        .select('invoice_id')
        .eq('id', itemId)
        .single();

      if (invoiceItem?.invoice_id) {
        await syncTotals(invoiceItem.invoice_id);
      }

      return data as InvoiceItem;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Position konnte nicht aktualisiert werden',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const removeItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      // Get invoice_id before delete
      const { data: item } = await supabase
        .from('invoice_items')
        .select('invoice_id')
        .eq('id', itemId)
        .single();

      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      // Sync totals
      if (item?.invoice_id) {
        await syncTotals(item.invoice_id);
      }

      return true;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Position konnte nicht gelöscht werden',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const reorderItems = useCallback(async (
    invoiceId: string,
    itemIds: string[]
  ): Promise<boolean> => {
    try {
      // Update position numbers
      const updates = itemIds.map((id, index) =>
        supabase
          .from('invoice_items')
          .update({ position_number: index + 1 })
          .eq('id', id)
      );

      await Promise.all(updates);

      return true;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Reihenfolge konnte nicht aktualisiert werden',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // ============================================================================
  // WORKFLOW
  // ============================================================================

  const send = useCallback(async (id: string): Promise<boolean> => {
    return !!(await updateInvoice(id, { status: 'sent' as InvoiceStatus }));
  }, [updateInvoice]);

  const markPaid = useCallback(async (id: string, paidAt?: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: paidAt || new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast({
        title: 'Zahlung erfasst',
        description: 'Rechnung wurde als bezahlt markiert',
      });

      await fetchInvoices();
      return true;
    } catch (err) {
      toast({
        title: 'Fehler',
        description: 'Zahlungsstatus konnte nicht aktualisiert werden',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvoices, toast]);

  const markOverdue = useCallback(async (id: string): Promise<boolean> => {
    return !!(await updateInvoice(id, { status: 'overdue' as InvoiceStatus }));
  }, [updateInvoice]);

  const voidInvoice = useCallback(async (id: string): Promise<boolean> => {
    return !!(await updateInvoice(id, { status: 'void' as InvoiceStatus }));
  }, [updateInvoice]);

  const cancel = useCallback(async (id: string): Promise<boolean> => {
    return !!(await updateInvoice(id, { status: 'cancelled' as InvoiceStatus }));
  }, [updateInvoice]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const canEdit = useCallback((invoice: Invoice): boolean => {
    return invoice.status === 'draft' && !invoice.is_locked;
  }, []);

  const canSend = useCallback((invoice: Invoice): boolean => {
    return invoice.status === 'draft' &&
           (invoice.net_amount || 0) > 0;
  }, []);

  const syncTotals = useCallback(async (id: string): Promise<boolean> => {
    try {
      await supabase.rpc('sync_invoice_totals', { p_invoice_id: id });
      return true;
    } catch {
      return false;
    }
  }, []);

  const getOverdueInvoices = useCallback(async (): Promise<InvoiceWithRelations[]> => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          items:invoice_items(*),
          customer:customers(id, company_name, contact_person),
          project:projects(id, name)
        `)
        .eq('status', 'sent')
        .lt('due_date', today);

      if (fetchError) throw fetchError;

      return (data as InvoiceWithRelations[]) || [];
    } catch {
      return [];
    }
  }, []);

  return {
    invoices,
    currentInvoice,
    isLoading,
    error,
    fetchInvoices,
    fetchInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    send,
    markPaid,
    markOverdue,
    void: voidInvoice,
    cancel,
    canEdit,
    canSend,
    syncTotals,
    getOverdueInvoices,
  };
}
