// supabase/functions/notification-cron/checks/capacity.ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CheckResult, NotificationPayload } from '../lib/types.ts';
import { Recipient, getManagers } from '../lib/recipients.ts';

export async function checkCapacity(
  supabase: SupabaseClient, companyId: string, recipients: Recipient[]
): Promise<CheckResult> {
  const notifications: NotificationPayload[] = [];
  const managers = getManagers(recipients);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get company working hours settings
  const { data: settings } = await supabase
    .from('company_settings')
    .select('default_working_hours_start, default_working_hours_end, default_break_duration')
    .eq('company_id', companyId)
    .maybeSingle();

  const workStart = settings?.default_working_hours_start || '08:00';
  const workEnd = settings?.default_working_hours_end || '17:00';
  const breakMin = settings?.default_break_duration || 60;
  const [sh, sm] = workStart.split(':').map(Number);
  const [eh, em] = workEnd.split(':').map(Number);
  const dailyHours = (eh * 60 + em - sh * 60 - sm - breakMin) / 60;

  // Get active employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, user_id')
    .eq('company_id', companyId)
    .not('status', 'in', '("Inaktiv","Gekündigt")');

  if (!employees || employees.length === 0) return { notifications, checkName: 'capacity', itemsChecked: 0 };

  // Get active project assignments
  // Note: project_team_assignments has no company_id column.
  // We filter by company via the projects relation in JS below.
  // service_role bypasses RLS so we get all companies' data.
  const { data: assignments } = await supabase
    .from('project_team_assignments')
    .select('employee_id, start_date, end_date, is_active, project_id, projects(name, status, company_id)')
    .eq('is_active', true);

  // Get approved vacations
  const { data: vacations } = await supabase
    .from('vacation_requests')
    .select('employee_id, start_date, end_date, absence_type')
    .eq('company_id', companyId)
    .eq('status', 'approved');

  // Calculate current week (Mon-Sun)
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const companyAssignments = (assignments || []).filter(
    a => (a as any).projects?.company_id === companyId
  );

  // Check each employee
  for (const emp of employees) {
    const empAssignments = companyAssignments.filter(a => a.employee_id === emp.id);
    let assignedDaysThisWeek = 0;

    for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ds = d.toISOString().split('T')[0];

      // Count projects assigned this day
      let projectsToday = 0;
      for (const a of empAssignments) {
        const start = a.start_date || '2000-01-01';
        const end = a.end_date || '2099-12-31';
        if (ds >= start && ds <= end) projectsToday++;
      }

      // Check if on vacation/sick
      const onLeave = (vacations || []).some(
        v => v.employee_id === emp.id && ds >= v.start_date && ds <= v.end_date
      );

      if (projectsToday > 0 && !onLeave) assignedDaysThisWeek++;

      // Doppelbelegung = >100%
      if (projectsToday > 1) {
        for (const m of managers) {
          notifications.push({
            company_id: companyId, user_id: m.user_id,
            type: 'capacity_overloaded', category: 'capacity', priority: 'high',
            title: 'Mitarbeiter überlastet',
            message: `${emp.first_name} ${emp.last_name} hat ${projectsToday} Projekte am ${ds}`,
            action_url: '/planner', entity_type: 'employee', entity_id: emp.id,
            dedup_key: `capacity_overloaded:${emp.id}`,
          });
        }
        break; // One alert per employee per day
      }
    }

    // ArbZG check: >48h/week
    const weeklyHours = assignedDaysThisWeek * dailyHours;
    if (weeklyHours > 48) {
      for (const m of managers) {
        notifications.push({
          company_id: companyId, user_id: m.user_id,
          type: 'capacity_arbzg', category: 'capacity', priority: 'urgent',
          title: 'ArbZG-Verstoß droht',
          message: `${emp.first_name} ${emp.last_name} — ${weeklyHours.toFixed(0)}h/Woche geplant (max. 48h)`,
          action_url: '/planner', entity_type: 'employee', entity_id: emp.id,
          dedup_key: `capacity_arbzg:${emp.id}`,
        });
      }
    }
  }

  // Understaffed projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', companyId)
    .in('status', ['beauftragt', 'in_bearbeitung']);

  for (const project of (projects || [])) {
    const hasTeam = companyAssignments.some(a => a.project_id === project.id);
    if (!hasTeam) {
      for (const m of managers) {
        notifications.push({
          company_id: companyId, user_id: m.user_id,
          type: 'capacity_understaffed', category: 'capacity', priority: 'medium',
          title: 'Projekt ohne Team',
          message: `${project.name} — kein Mitarbeiter zugewiesen`,
          action_url: `/projects/${project.id}`, entity_type: 'project', entity_id: project.id,
          dedup_key: `capacity_understaffed:${project.id}`,
        });
      }
    }
  }

  // Bottleneck next week
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  let availableNextWeek = 0;
  for (const emp of employees) {
    const empAssignments = companyAssignments.filter(a => a.employee_id === emp.id);
    let hasGap = false;
    for (let d = new Date(nextMonday); d <= nextSunday; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ds = d.toISOString().split('T')[0];
      const assigned = empAssignments.some(a => {
        const start = a.start_date || '2000-01-01';
        const end = a.end_date || '2099-12-31';
        return ds >= start && ds <= end;
      });
      const onLeave = (vacations || []).some(
        v => v.employee_id === emp.id && ds >= v.start_date && ds <= v.end_date
      );
      if (!assigned && !onLeave) { hasGap = true; break; }
    }
    if (hasGap) availableNextWeek++;
  }

  if (employees.length > 0 && availableNextWeek / employees.length < 0.5) {
    for (const m of managers) {
      notifications.push({
        company_id: companyId, user_id: m.user_id,
        type: 'capacity_bottleneck', category: 'capacity', priority: 'high',
        title: 'Engpass nächste Woche',
        message: `Nur ${availableNextWeek} von ${employees.length} MA verfügbar`,
        action_url: '/planner', entity_type: 'company', entity_id: companyId,
        dedup_key: `capacity_bottleneck:week:${nextMonday.toISOString().split('T')[0]}`,
      });
    }
  }

  return { notifications, checkName: 'capacity', itemsChecked: employees.length };
}
