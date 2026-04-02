import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CheckResult, NotificationPayload } from '../lib/types.ts';
import { Recipient, getManagers } from '../lib/recipients.ts';

export async function checkInvoices(
  supabase: SupabaseClient, companyId: string, recipients: Recipient[]
): Promise<CheckResult> {
  const notifications: NotificationPayload[] = [];
  const managers = getManagers(recipients);
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, due_date, amount, customer_id, customers(name)')
    .eq('company_id', companyId)
    .not('status', 'in', '("paid","void","cancelled")')
    .lt('due_date', todayStr);

  if (!overdueInvoices) return { notifications, checkName: 'invoices', itemsChecked: 0 };

  for (const invoice of overdueInvoices) {
    const daysOverdue = Math.ceil(
      (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const customerName = (invoice as any).customers?.name || 'Unbekannt';
    for (const m of managers) {
      notifications.push({
        company_id: companyId, user_id: m.user_id, type: 'invoice_overdue', priority: 'high',
        title: 'Rechnung überfällig',
        message: `${invoice.invoice_number} — ${customerName} — seit ${daysOverdue} Tagen`,
        action_url: `/invoices/${invoice.id}`, entity_type: 'invoice', entity_id: invoice.id,
        dedup_key: `invoice_overdue:${invoice.id}`,
      });
    }
  }

  return { notifications, checkName: 'invoices', itemsChecked: overdueInvoices.length };
}
