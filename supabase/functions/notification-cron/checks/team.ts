// supabase/functions/notification-cron/checks/team.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CheckResult, NotificationPayload } from '../lib/types.ts';
import { Recipient, getManagers, getRecipientByEmployeeId } from '../lib/recipients.ts';

export async function checkTeam(
  supabase: SupabaseClient, companyId: string, recipients: Recipient[]
): Promise<CheckResult> {
  const notifications: NotificationPayload[] = [];
  const managers = getManagers(recipients);
  const todayStr = new Date().toISOString().split('T')[0];
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Batch-load all active assignments for this company
  const { data: allAssignments } = await supabase
    .from('project_team_assignments')
    .select('employee_id, project_id, start_date, end_date, is_active, projects(name, company_id)')
    .eq('is_active', true);

  const companyAssignments = (allAssignments || []).filter(
    a => (a as any).projects?.company_id === companyId
  );

  // 1. Sick employees on active projects
  const { data: sickToday } = await supabase
    .from('vacation_requests')
    .select('employee_id, employees(first_name, last_name)')
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .eq('absence_type', 'sick')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  for (const sick of (sickToday || [])) {
    const emp = (sick as any).employees;
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Mitarbeiter';

    // Filter batch-loaded assignments for this employee
    const companyProjects = companyAssignments.filter(a => a.employee_id === sick.employee_id);

    for (const assignment of companyProjects) {
      const projName = (assignment as any).projects?.name || 'Projekt';
      for (const m of managers) {
        notifications.push({
          company_id: companyId, user_id: m.user_id,
          type: 'team_member_sick', category: 'team', priority: 'high',
          title: 'Mitarbeiter krank',
          message: `${empName} krank — zugewiesen auf "${projName}"`,
          action_url: '/planner', entity_type: 'employee', entity_id: sick.employee_id,
          dedup_key: `team_member_sick:${sick.employee_id}`,
        });
      }
      break; // One alert per sick employee
    }
  }

  // 2. Vacation conflicts with project assignments
  const { data: upcomingVacations } = await supabase
    .from('vacation_requests')
    .select('employee_id, start_date, end_date, employees(first_name, last_name)')
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .neq('absence_type', 'sick')
    .gte('start_date', todayStr);

  for (const vac of (upcomingVacations || [])) {
    const emp = (vac as any).employees;
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Mitarbeiter';

    // Filter batch-loaded assignments for date overlap with vacation
    const companyConflicts = companyAssignments.filter(a => {
      if (a.employee_id !== vac.employee_id) return false;
      const start = a.start_date || '2000-01-01';
      const end = a.end_date || '2099-12-31';
      return start <= vac.end_date && end >= vac.start_date;
    });

    if (companyConflicts.length > 0) {
      const projName = (companyConflicts[0] as any).projects?.name || 'Projekt';
      for (const m of managers) {
        notifications.push({
          company_id: companyId, user_id: m.user_id,
          type: 'team_vacation_conflict', category: 'team', priority: 'medium',
          title: 'Urlaubskonflikt',
          message: `${empName} hat Urlaub ${vac.start_date} – ${vac.end_date}, aber ist auf "${projName}" zugewiesen`,
          action_url: '/planner', entity_type: 'employee', entity_id: vac.employee_id,
          dedup_key: `team_vacation_conflict:${vac.employee_id}:${vac.start_date}`,
        });
      }
    }
  }

  // 3. New assignments (last 15 minutes)
  const { data: newAssignments } = await supabase
    .from('project_team_assignments')
    .select('employee_id, project_id, projects(name, company_id), created_at')
    .eq('is_active', true)
    .gte('created_at', fifteenMinAgo);

  for (const assignment of (newAssignments || [])) {
    if ((assignment as any).projects?.company_id !== companyId) continue;
    const projName = (assignment as any).projects?.name || 'Projekt';
    const recipient = getRecipientByEmployeeId(recipients, assignment.employee_id);
    if (recipient) {
      notifications.push({
        company_id: companyId, user_id: recipient.user_id,
        type: 'team_assignment_created', category: 'team', priority: 'low',
        title: 'Neue Projektzuweisung',
        message: `Du wurdest "${projName}" zugewiesen`,
        action_url: '/planner', entity_type: 'project', entity_id: assignment.project_id,
        dedup_key: `team_assignment:${assignment.employee_id}:${assignment.project_id}`,
      });
    }
  }

  return { notifications, checkName: 'team', itemsChecked: (sickToday?.length || 0) + (upcomingVacations?.length || 0) + (newAssignments?.length || 0) };
}
