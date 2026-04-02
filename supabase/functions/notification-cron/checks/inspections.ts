import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CheckResult, NotificationPayload } from '../lib/types.ts';
import { Recipient, getManagers, getRecipientByEmployeeId } from '../lib/recipients.ts';

export async function checkInspections(
  supabase: SupabaseClient,
  companyId: string,
  recipients: Recipient[]
): Promise<CheckResult> {
  const notifications: NotificationPayload[] = [];
  const today = new Date();
  const managers = getManagers(recipients);

  // 1. Get active schedules with device info
  const { data: schedules } = await supabase
    .from('inspection_schedules')
    .select('id, device_id, next_due_date, reminder_days_before')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .not('next_due_date', 'is', null);

  if (!schedules) return { notifications, checkName: 'inspections', itemsChecked: 0 };

  const deviceIds = schedules.map((s: any) => s.device_id);
  const { data: devices } = await supabase
    .from('inspection_devices')
    .select('id, name, assigned_employee_id')
    .in('id', deviceIds);
  const deviceMap = new Map((devices || []).map((d: any) => [d.id, d]));

  for (const schedule of schedules) {
    const dueDate = new Date(schedule.next_due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const device = deviceMap.get(schedule.device_id) || { name: 'Unbekannt', assigned_employee_id: null };
    const reminderDays: number[] = schedule.reminder_days_before || [30, 14, 7, 1];

    if (daysUntilDue < 0) {
      // OVERDUE
      const overdueRecipients: string[] = [];
      if (device.assigned_employee_id) {
        const assignee = getRecipientByEmployeeId(recipients, device.assigned_employee_id);
        if (assignee) overdueRecipients.push(assignee.user_id);
      }
      for (const m of managers) {
        if (!overdueRecipients.includes(m.user_id)) overdueRecipients.push(m.user_id);
      }
      for (const userId of overdueRecipients) {
        notifications.push({
          company_id: companyId, user_id: userId, type: 'inspection_overdue', priority: 'high',
          title: 'Prüfung überfällig',
          message: `${device.name} — seit ${Math.abs(daysUntilDue)} Tagen überfällig`,
          action_url: `/inspections?device=${schedule.device_id}`,
          entity_type: 'inspection_device', entity_id: schedule.device_id,
          dedup_key: `inspection_overdue:${schedule.device_id}`,
        });
      }
    } else {
      // Check reminder thresholds
      const matchedThreshold = reminderDays.find((d) => daysUntilDue <= d);
      if (matchedThreshold !== undefined) {
        const assigneeUserId = device.assigned_employee_id
          ? getRecipientByEmployeeId(recipients, device.assigned_employee_id)?.user_id
          : null;
        const targetUserId = assigneeUserId || managers[0]?.user_id;
        if (targetUserId) {
          notifications.push({
            company_id: companyId, user_id: targetUserId, type: 'inspection_due', priority: 'medium',
            title: 'Prüffrist läuft ab',
            message: `${device.name} — fällig in ${daysUntilDue} Tagen (${schedule.next_due_date})`,
            action_url: `/inspections?device=${schedule.device_id}`,
            entity_type: 'inspection_device', entity_id: schedule.device_id,
            dedup_key: `inspection_due:${schedule.device_id}:${matchedThreshold}d`,
          });
        }
      }
    }
  }

  // 2. Failed protocols (last 7 days)
  const { data: failedProtocols } = await supabase
    .from('inspection_protocols')
    .select('id, device_id, overall_result, inspection_date')
    .eq('company_id', companyId)
    .eq('is_finalized', true)
    .eq('overall_result', 'fail')
    .gte('inspection_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  for (const protocol of (failedProtocols || [])) {
    const device = deviceMap.get(protocol.device_id) || { name: 'Unbekannt' };
    for (const m of managers) {
      notifications.push({
        company_id: companyId, user_id: m.user_id, type: 'inspection_failed', priority: 'urgent',
        title: 'Gerät durchgefallen',
        message: `${(device as any).name} — Prüfung nicht bestanden (${protocol.inspection_date})`,
        action_url: `/inspections/protocols/${protocol.id}`,
        entity_type: 'inspection_protocol', entity_id: protocol.id,
        dedup_key: `inspection_failed:${protocol.id}`,
      });
    }
  }

  return { notifications, checkName: 'inspections', itemsChecked: schedules.length };
}
