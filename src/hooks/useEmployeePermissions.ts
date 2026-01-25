// Employee Permission System
// - employee: Nur eigene Daten, außer explizite Freigaben
// - manager: Operative Rechte (approve, edit_all), KEINE kaufmännischen Rechte ohne Grant

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

// Definierte Freigaben - KEINE NEUEN ERFINDEN
export type Permission =
  | 'delivery_note.edit_all'    // Alle Lieferscheine bearbeiten
  | 'delivery_note.approve'     // Lieferscheine freigeben
  | 'timesheet.edit_all'        // Alle Zeiteinträge bearbeiten
  | 'project.status.change'     // Projektstatus ändern
  | 'prices.view'               // Preise/Margen sehen (kaufmännisch)
  | 'invoices.view';            // Rechnungen sehen (kaufmännisch)

// Operative Rechte die Manager standardmäßig hat
const MANAGER_DEFAULT_PERMISSIONS: Permission[] = [
  'delivery_note.edit_all',
  'delivery_note.approve',
  'timesheet.edit_all',
  'project.status.change',
];

// Kaufmännische Rechte - NUR per expliziter Freigabe
const COMMERCIAL_PERMISSIONS: Permission[] = [
  'prices.view',
  'invoices.view',
];

export interface CurrentEmployee {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'employee' | 'manager';
  grants: Permission[];
  company_id: string;
}

export interface DeliveryNoteForPermission {
  id: string;
  created_by_employee_id?: string | null;
  created_by?: string | null;
  status: string;
}

export interface TimesheetForPermission {
  id: string;
  employee_id: string;
  status?: string;
}

export function useEmployeePermissions() {
  const { user } = useSupabaseAuth();
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current employee with grants
  useEffect(() => {
    async function fetchEmployee() {
      if (!user?.id) {
        setEmployee(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .rpc('get_current_employee_with_grants');

        if (fetchError) {
          // Fallback: Direct query if RPC doesn't exist yet
          const { data: empData, error: empError } = await supabase
            .from('employees')
            .select('id, user_id, first_name, last_name, email, role, grants, company_id')
            .eq('user_id', user.id)
            .single();

          if (empError) throw empError;

          setEmployee({
            ...empData,
            role: (empData.role as 'employee' | 'manager') || 'employee',
            grants: (empData.grants as Permission[]) || [],
          });
        } else if (data && data.length > 0) {
          const emp = data[0];
          setEmployee({
            id: emp.id,
            user_id: emp.user_id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            email: emp.email,
            role: (emp.role as 'employee' | 'manager') || 'employee',
            grants: (emp.grants as Permission[]) || [],
            company_id: emp.company_id,
          });
        }
      } catch (err) {
        console.error('Error fetching employee permissions:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEmployee();
  }, [user?.id]);

  const isManager = employee?.role === 'manager';
  const grants = employee?.grants || [];

  /**
   * Prüft ob der aktuelle Benutzer eine bestimmte Berechtigung hat
   *
   * Logik:
   * - Kaufmännische Rechte (prices.view, invoices.view): NUR per expliziter Freigabe
   * - Operative Rechte: Manager hat sie standardmäßig, Employee nur per Freigabe
   */
  const can = useCallback((permission: Permission): boolean => {
    if (!employee) return false;

    // Kaufmännische Rechte: NUR per expliziter Freigabe (auch für Manager!)
    if (COMMERCIAL_PERMISSIONS.includes(permission)) {
      return grants.includes(permission);
    }

    // Operative Rechte: Manager hat sie standardmäßig
    if (isManager && MANAGER_DEFAULT_PERMISSIONS.includes(permission)) {
      return true;
    }

    // Employee: Nur per expliziter Freigabe
    return grants.includes(permission);
  }, [employee, isManager, grants]);

  /**
   * Kann der Benutzer diesen Lieferschein bearbeiten?
   *
   * Logik:
   * - Manager: Immer (operative Berechtigung)
   * - Mit delivery_note.edit_all: draft ODER rejected
   * - Ohne Grant: Nur eigene Entwürfe (draft)
   */
  const canEditDeliveryNote = useCallback((note: DeliveryNoteForPermission): boolean => {
    if (!employee) return false;

    // Manager kann alle bearbeiten
    if (isManager) return true;

    // Mit edit_all Grant: draft oder rejected
    if (can('delivery_note.edit_all')) {
      return note.status === 'draft' || note.status === 'rejected';
    }

    // Ohne Grant: Nur eigene Entwürfe
    const isOwn = note.created_by_employee_id === employee.id ||
                  note.created_by === employee.user_id;
    return isOwn && note.status === 'draft';
  }, [employee, isManager, can]);

  /**
   * Kann der Benutzer Lieferscheine freigeben?
   */
  const canApproveDeliveryNote = useCallback((): boolean => {
    if (!employee) return false;
    return isManager || can('delivery_note.approve');
  }, [employee, isManager, can]);

  /**
   * Kann der Benutzer diesen Zeiteintrag bearbeiten?
   */
  const canEditTimesheet = useCallback((entry: TimesheetForPermission): boolean => {
    if (!employee) return false;

    // Manager kann alle bearbeiten
    if (isManager) return true;

    // Mit edit_all Grant
    if (can('timesheet.edit_all')) return true;

    // Ohne Grant: Nur eigene
    return entry.employee_id === employee.id;
  }, [employee, isManager, can]);

  /**
   * Kann der Benutzer den Projektstatus ändern?
   */
  const canChangeProjectStatus = useCallback((): boolean => {
    if (!employee) return false;
    return isManager || can('project.status.change');
  }, [employee, isManager, can]);

  /**
   * Kann der Benutzer Preise/Margen sehen?
   * NUR per expliziter Freigabe - auch Manager braucht Grant!
   */
  const canViewPrices = useCallback((): boolean => {
    return can('prices.view');
  }, [can]);

  /**
   * Kann der Benutzer Rechnungen sehen?
   * NUR per expliziter Freigabe - auch Manager braucht Grant!
   */
  const canViewInvoices = useCallback((): boolean => {
    return can('invoices.view');
  }, [can]);

  /**
   * Lieferschein einreichen - nur Ersteller
   */
  const canSubmitDeliveryNote = useCallback((note: DeliveryNoteForPermission): boolean => {
    if (!employee) return false;
    const isOwn = note.created_by_employee_id === employee.id ||
                  note.created_by === employee.user_id;
    return isOwn && note.status === 'draft';
  }, [employee]);

  return {
    employee,
    isLoading,
    error,
    isManager,
    grants,

    // Permission checks
    can,
    canEditDeliveryNote,
    canApproveDeliveryNote,
    canEditTimesheet,
    canChangeProjectStatus,
    canViewPrices,
    canViewInvoices,
    canSubmitDeliveryNote,
  };
}

export default useEmployeePermissions;
