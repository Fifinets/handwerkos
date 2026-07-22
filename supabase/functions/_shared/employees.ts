import type { SupabaseClient } from './supabase.ts';

export interface ActiveEmployee {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

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
