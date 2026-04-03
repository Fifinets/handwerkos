import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CheckResult, NotificationPayload } from '../lib/types.ts';
import { Recipient, getManagers } from '../lib/recipients.ts';

export async function checkInvoices(
  supabase: SupabaseClient, companyId: string, recipients: Recipient[]
): Promise<CheckResult> {
  const notifications: NotificationPayload[] = [];
  const managers = getManagers(recipients);
  const todayStr = new Date().toISOString().split('T')[0];

  // Load company settings for reminder day thresholds
  const { data: settings } = await supabase
    .from('company_settings')
    .select('auto_reminders_enabled, reminder_days_1, reminder_days_2, reminder_days_3')
    .eq('company_id', companyId)
    .maybeSingle();
  const days1 = settings?.reminder_days_1 || 3;
  const days2 = settings?.reminder_days_2 || 14;
  const days3 = settings?.reminder_days_3 || 28;
  const autoSend = settings?.auto_reminders_enabled || false;

  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, due_date, amount, customer_id, reminder_level, customers(name)')
    .eq('company_id', companyId)
    .not('status', 'in', '("paid","void","cancelled")')
    .lt('due_date', todayStr);

  if (!overdueInvoices) return { notifications, checkName: 'invoices', itemsChecked: 0 };

  const reminderLabels: Record<number, string> = {
    1: 'Zahlungserinnerung',
    2: '1. Mahnung',
    3: '2. Mahnung',
  };

  for (const invoice of overdueInvoices) {
    const daysOverdue = Math.ceil(
      (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    const customerName = (invoice as any).customers?.name || 'Unbekannt';

    // Determine new reminder level based on days overdue
    let newLevel = 0;
    if (daysOverdue >= days3) newLevel = 3;
    else if (daysOverdue >= days2) newLevel = 2;
    else if (daysOverdue >= days1) newLevel = 1;

    const currentLevel = (invoice as any).reminder_level || 0;
    const levelIncreased = newLevel > currentLevel;

    // Update reminder_level on the invoice if it increased
    if (levelIncreased) {
      await supabase.from('invoices').update({
        reminder_level: newLevel,
        updated_at: new Date().toISOString(),
      }).eq('id', invoice.id);
    }

    // Existing overdue notification
    for (const m of managers) {
      notifications.push({
        company_id: companyId, user_id: m.user_id, type: 'invoice_overdue', priority: 'high',
        title: 'Rechnung überfällig',
        message: `${invoice.invoice_number} — ${customerName} — seit ${daysOverdue} Tagen`,
        action_url: `/invoices/${invoice.id}`, entity_type: 'invoice', entity_id: invoice.id,
        dedup_key: `invoice_overdue:${invoice.id}`,
      });
    }

    // Send reminder notification when level just increased and auto-reminders are on
    if (autoSend && levelIncreased && newLevel > 0) {
      const label = reminderLabels[newLevel] || `Mahnstufe ${newLevel}`;
      for (const m of managers) {
        notifications.push({
          company_id: companyId, user_id: m.user_id, type: 'invoice_reminder', priority: 'high',
          title: label,
          message: `${invoice.invoice_number} — ${customerName} — ${label} (${daysOverdue} Tage überfällig)`,
          action_url: `/invoices/${invoice.id}`, entity_type: 'invoice', entity_id: invoice.id,
          dedup_key: `invoice_reminder:${invoice.id}:${newLevel}`,
        });
      }
    }
  }

  return { notifications, checkName: 'invoices', itemsChecked: overdueInvoices.length };
}
