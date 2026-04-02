import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CheckResult, NotificationPayload } from '../lib/types.ts';
import { Recipient, getManagers, getRecipientByEmployeeId } from '../lib/recipients.ts';

const COST_WARNING_PCT = 1.05;
const COST_CRITICAL_PCT = 1.15;
const DEADLINE_DAYS = 7;

export async function checkProjects(
  supabase: SupabaseClient, companyId: string, recipients: Recipient[]
): Promise<CheckResult> {
  const notifications: NotificationPayload[] = [];
  const managers = getManagers(recipients);
  const today = new Date();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, status, budget_planned, budget_actual, planned_end_date, project_manager_id')
    .eq('company_id', companyId)
    .in('status', ['in_bearbeitung', 'beauftragt', 'abgeschlossen']);

  if (!projects) return { notifications, checkName: 'projects', itemsChecked: 0 };

  for (const project of projects) {
    if (project.status === 'in_bearbeitung' && project.budget_planned && project.budget_planned > 0) {
      const ratio = (project.budget_actual || 0) / project.budget_planned;
      if (ratio >= COST_CRITICAL_PCT) {
        for (const m of managers) {
          notifications.push({
            company_id: companyId, user_id: m.user_id, type: 'budget_critical', priority: 'high',
            title: 'Projekt über Budget',
            message: `${project.name} — ${Math.round((ratio - 1) * 100)}% über Budget`,
            action_url: `/projects/${project.id}`, entity_type: 'project', entity_id: project.id,
            dedup_key: `budget_critical:${project.id}`,
          });
        }
      } else if (ratio >= COST_WARNING_PCT) {
        for (const m of managers) {
          notifications.push({
            company_id: companyId, user_id: m.user_id, type: 'budget_warning', priority: 'medium',
            title: 'Projekt-Budget Warnung',
            message: `${project.name} — ${Math.round((ratio - 1) * 100)}% über Budget`,
            action_url: `/projects/${project.id}`, entity_type: 'project', entity_id: project.id,
            dedup_key: `budget_warning:${project.id}`,
          });
        }
      }
    }

    if (project.status === 'in_bearbeitung' && project.planned_end_date) {
      const endDate = new Date(project.planned_end_date);
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft >= 0 && daysLeft <= DEADLINE_DAYS) {
        const deadlineRecipients: string[] = [];
        if (project.project_manager_id) {
          const pm = getRecipientByEmployeeId(recipients, project.project_manager_id);
          if (pm) deadlineRecipients.push(pm.user_id);
        }
        for (const m of managers) {
          if (!deadlineRecipients.includes(m.user_id)) deadlineRecipients.push(m.user_id);
        }
        for (const userId of deadlineRecipients) {
          notifications.push({
            company_id: companyId, user_id: userId, type: 'project_deadline', priority: 'medium',
            title: 'Projektfrist läuft ab',
            message: `${project.name} — noch ${daysLeft} Tage (${project.planned_end_date})`,
            action_url: `/projects/${project.id}`, entity_type: 'project', entity_id: project.id,
            dedup_key: `project_deadline:${project.id}`,
          });
        }
      }
    }

    if (project.status === 'abgeschlossen') {
      const { count } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id);
      if (count === 0) {
        for (const m of managers) {
          notifications.push({
            company_id: companyId, user_id: m.user_id, type: 'project_no_invoice', priority: 'medium',
            title: 'Projekt ohne Rechnung',
            message: `${project.name} — abgeschlossen aber keine Rechnung erstellt`,
            action_url: `/projects/${project.id}`, entity_type: 'project', entity_id: project.id,
            dedup_key: `project_no_invoice:${project.id}`,
          });
        }
      }
    }
  }

  return { notifications, checkName: 'projects', itemsChecked: projects.length };
}
