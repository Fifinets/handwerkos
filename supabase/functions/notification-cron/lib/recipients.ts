import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export interface Recipient {
  user_id: string;
  employee_id: string;
  role: string;
  first_name: string;
  last_name: string;
}

export function getManagers(recipients: Recipient[]): Recipient[] {
  return recipients.filter(r => r.role === 'manager');
}

export function getRecipientByEmployeeId(recipients: Recipient[], employeeId: string): Recipient | undefined {
  return recipients.find(r => r.employee_id === employeeId);
}

export async function loadRecipients(supabase: SupabaseClient, companyId: string): Promise<Recipient[]> {
  const { data: employees } = await supabase
    .from('employees')
    .select('id, user_id, first_name, last_name')
    .eq('company_id', companyId)
    .not('user_id', 'is', null)
    .not('status', 'in', '("Inaktiv","Gekündigt")');

  if (!employees || employees.length === 0) return [];

  const userIds = employees.map(e => e.user_id!).filter(Boolean);
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', userIds);

  const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

  return employees.map(e => ({
    user_id: e.user_id!,
    employee_id: e.id,
    role: roleMap.get(e.user_id!) || 'employee',
    first_name: e.first_name,
    last_name: e.last_name,
  }));
}
