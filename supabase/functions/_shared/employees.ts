import type { SupabaseClient } from './supabase.ts';

export interface ActiveEmployee {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Pick any active employee for a company. Used by mutation tools
 * (create_offer, create_appointment, create_material_order) to assign
 * a default responsible person. The user is expected to edit the
 * assignment in the UI if needed — "egal welcher" per spec.
 *
 * Returns null if the company has no active employees.
 */
export async function getFirstActiveEmployee(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ActiveEmployee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, user_id, first_name, last_name')
    .eq('company_id', companyId)
    .eq('status', 'Aktiv')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as ActiveEmployee;
}
