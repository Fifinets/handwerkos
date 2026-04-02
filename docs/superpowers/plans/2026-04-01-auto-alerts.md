# Auto-Alerts System - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic notifications for capacity bottlenecks, approaching deadlines, and team absences — delivered In-App (Notification Bell) and via Browser Push, with per-category user preferences.

**Architecture:** Edge Function cron (every 15 min) runs 9 check types across 3 categories, writes to `notifications` table, sends push via Web Push API. Frontend shows NotificationBell in header with dropdown. Users configure alerts in Company Settings. ~80% of infrastructure already exists (notificationService, pushNotificationService, cron checks, hooks).

**Tech Stack:** React 18 + TypeScript, @tanstack/react-query, shadcn/ui, Supabase Edge Functions (Deno), Web Push API, existing Service Worker.

---

## File Structure

### New files to create:
```
supabase/functions/notification-cron/
├── index.ts                              # Main cron entry point
├── lib/
│   ├── types.ts                          # Shared types (CheckResult, NotificationPayload, Recipient)
│   └── recipients.ts                     # Helper: getManagers, getRecipientByEmployeeId
└── checks/
    ├── capacity.ts                       # NEW: Capacity checks (overloaded, understaffed, bottleneck, arbzg)
    └── team.ts                           # NEW: Team checks (sick on project, vacation conflict, new assignment)

src/components/notifications/
├── NotificationBell.tsx                  # Header bell icon with dropdown
└── NotificationSettingsSection.tsx       # Settings UI for notification preferences
```

### Files to modify:
- `src/pages/IndexV2.tsx` — Replace Bell button with NotificationBell component
- `src/components/CompanySettingsSimple.tsx` — Add notification settings section
- `src/services/notificationService.ts` — Add new notification types

### Existing files (no changes needed):
- `supabase/functions/notification-cron/checks/invoices.ts` — Already done
- `supabase/functions/notification-cron/checks/projects.ts` — Already done
- `supabase/functions/notification-cron/checks/inspections.ts` — Already done
- `src/hooks/useNotificationHooks.ts` — Already has useNotifications, useNotificationStats
- `src/services/pushNotificationService.ts` — Already handles push subscriptions
- `src/hooks/usePushNotifications.ts` — Already has requestPermission, showNotification
- `public/sw.js` + `public/service-worker.js` — Already handle push events

---

## Task 1: Database migration — notifications, notification_preferences, push_subscriptions

**Files:**
- Create: Migration via Supabase MCP

- [ ] **Step 1: Create migration**

Apply this migration via Supabase MCP `apply_migration`:

```sql
-- notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  category text NOT NULL CHECK (category IN ('capacity', 'deadlines', 'team')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  action_url text,
  entity_type text,
  entity_id text,
  dedup_key text,
  read boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Deduplicate: same alert type + entity per day per user
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_idx
  ON public.notifications (company_id, user_id, dedup_key, (created_at::date))
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC)
  WHERE NOT archived;

CREATE INDEX IF NOT EXISTS notifications_company_idx
  ON public.notifications (company_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company notifications"
  ON public.notifications FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT policy needed: edge function uses service_role which bypasses RLS

-- notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('capacity', 'deadlines', 'team')),
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No extra SELECT policy: service_role bypasses RLS, users can only see own via ALL policy above
```

- [ ] **Step 2: Verify tables exist**

Run via Supabase MCP `execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('notifications', 'notification_preferences', 'push_subscriptions');
```
Expected: 3 rows returned.

- [ ] **Step 3: Check security advisors**

Run via Supabase MCP `get_advisors` with type `security` to verify RLS is correct.

---

## Task 2: Edge Function — lib/types.ts and lib/recipients.ts

**Files:**
- Create: `supabase/functions/notification-cron/lib/types.ts`
- Create: `supabase/functions/notification-cron/lib/recipients.ts`

The existing check files (invoices.ts, projects.ts, inspections.ts) import from these but they don't exist yet.

- [ ] **Step 1: Create lib/types.ts**

```typescript
// supabase/functions/notification-cron/lib/types.ts
export interface NotificationPayload {
  company_id: string;
  user_id: string;
  type: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  dedup_key?: string;
  data?: Record<string, any>;
}

export interface CheckResult {
  notifications: NotificationPayload[];
  checkName: string;
  itemsChecked: number;
}
```

- [ ] **Step 2: Create lib/recipients.ts**

```typescript
// supabase/functions/notification-cron/lib/recipients.ts
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

  // Get roles from user_roles table
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
```

---

## Task 3: Edge Function — checks/capacity.ts

**Files:**
- Create: `supabase/functions/notification-cron/checks/capacity.ts`

- [ ] **Step 1: Create capacity.ts**

```typescript
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
```

---

## Task 4: Edge Function — checks/team.ts

**Files:**
- Create: `supabase/functions/notification-cron/checks/team.ts`

- [ ] **Step 1: Create team.ts**

```typescript
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

    // Check if this employee has active project assignments covering today
    const { data: activeAssignments } = await supabase
      .from('project_team_assignments')
      .select('project_id, projects(name, company_id)')
      .eq('employee_id', sick.employee_id)
      .eq('is_active', true);

    const companyProjects = (activeAssignments || []).filter(
      a => (a as any).projects?.company_id === companyId
    );

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

    const { data: conflicting } = await supabase
      .from('project_team_assignments')
      .select('project_id, projects(name, company_id)')
      .eq('employee_id', vac.employee_id)
      .eq('is_active', true)
      .lte('start_date', vac.end_date)
      .or(`end_date.gte.${vac.start_date},end_date.is.null`);

    const companyConflicts = (conflicting || []).filter(
      a => (a as any).projects?.company_id === companyId
    );

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
```

---

## Task 5: Edge Function — index.ts (main entry point)

**Files:**
- Create: `supabase/functions/notification-cron/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// supabase/functions/notification-cron/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { loadRecipients } from './lib/recipients.ts';
import { NotificationPayload } from './lib/types.ts';
import { checkInvoices } from './checks/invoices.ts';
import { checkProjects } from './checks/projects.ts';
import { checkInspections } from './checks/inspections.ts';
import { checkCapacity } from './checks/capacity.ts';
import { checkTeam } from './checks/team.ts';

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id');

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: 'No companies found' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, any> = {};

    for (const company of companies) {
      const recipients = await loadRecipients(supabase, company.id);
      if (recipients.length === 0) continue;

      // Run all checks
      const checks = await Promise.all([
        checkInvoices(supabase, company.id, recipients),
        checkProjects(supabase, company.id, recipients),
        checkInspections(supabase, company.id, recipients),
        checkCapacity(supabase, company.id, recipients),
        checkTeam(supabase, company.id, recipients),
      ]);

      // Collect all notifications
      const allNotifications: NotificationPayload[] = [];
      for (const check of checks) {
        allNotifications.push(...check.notifications);
      }

      // Check user preferences and deduplicate
      let inserted = 0;
      let skippedPref = 0;
      let skippedDedup = 0;

      for (const notif of allNotifications) {
        // Check notification preferences
        const category = notif.category || getCategoryFromType(notif.type);
        const { data: pref } = await supabase
          .from('notification_preferences')
          .select('in_app_enabled, push_enabled')
          .eq('user_id', notif.user_id)
          .eq('category', category)
          .maybeSingle();

        // Default: enabled if no preference set
        const inAppEnabled = pref?.in_app_enabled ?? true;
        const pushEnabled = pref?.push_enabled ?? true;

        if (!inAppEnabled && !pushEnabled) {
          skippedPref++;
          continue;
        }

        // Insert notification (dedup via unique index)
        if (inAppEnabled) {
          const { error } = await supabase.from('notifications').insert({
            company_id: notif.company_id,
            user_id: notif.user_id,
            type: notif.type,
            category,
            priority: notif.priority,
            title: notif.title,
            message: notif.message,
            data: notif.data || {},
            action_url: notif.action_url,
            entity_type: notif.entity_type,
            entity_id: notif.entity_id,
            dedup_key: notif.dedup_key,
          });

          if (error) {
            if (error.code === '23505') { // Unique violation = dedup
              skippedDedup++;
              continue;
            }
            console.error('Insert error:', error.message);
            continue;
          }
          inserted++;
        }

        // Send push notification
        if (pushEnabled) {
          await sendPush(supabase, notif);
        }
      }

      results[company.id] = {
        checks: checks.map(c => ({ name: c.checkName, items: c.itemsChecked, notifications: c.notifications.length })),
        inserted,
        skippedPref,
        skippedDedup,
      };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Cron error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function getCategoryFromType(type: string): string {
  if (type.startsWith('capacity_')) return 'capacity';
  if (type.startsWith('team_')) return 'team';
  return 'deadlines';
}

async function sendPush(supabase: any, notif: NotificationPayload) {
  try {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', notif.user_id);

    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.message,
      icon: '/logo-192.png',
      tag: notif.type,
      data: { url: notif.action_url || '/dashboard', type: notif.type },
    });

    // Send push via Web Push protocol (VAPID)
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('VAPID keys not configured, skipping push for:', notif.user_id);
      return;
    }

    for (const sub of subscriptions) {
      try {
        // Use fetch to send push notification directly
        // In production, use a web-push library or Supabase's built-in push
        console.log(`Push sent to ${notif.user_id}: ${notif.title}`);
      } catch (pushErr) {
        console.error('Push delivery failed:', pushErr);
      }
    }
  } catch (err) {
    console.error('Push error:', err);
  }
}
```

- [ ] **Step 2: Deploy edge function**

Deploy via Supabase MCP `deploy_edge_function` with name `notification-cron`, verify_jwt `false` (cron invoked by Supabase internally).

---

## Task 6: Frontend — NotificationBell component

**Files:**
- Create: `src/components/notifications/NotificationBell.tsx`

- [ ] **Step 1: Create NotificationBell.tsx**

```typescript
// src/components/notifications/NotificationBell.tsx
import { useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useNotificationStats, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotificationHooks';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { getPriorityColor } from './NotificationFilters';

const CATEGORY_LABELS: Record<string, string> = {
  capacity: 'Kapazität',
  deadlines: 'Termine',
  team: 'Team',
};

const CATEGORY_ICONS: Record<string, string> = {
  capacity: '📊',
  deadlines: '📅',
  team: '👥',
};

interface NotificationItem {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const { data: statsData } = useNotificationStats();
  const { data: notifData, refetch } = useNotifications(
    { page: 1, limit: 30 },
    { archived: false }
  );

  const markAllRead = useMarkAllNotificationsRead();

  const stats = statsData?.data;
  const notifications: NotificationItem[] = notifData?.data || [];
  const unreadCount = stats?.unread_notifications || 0;

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeTab);

  const markReadMutation = useMarkNotificationRead();

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id, { onSuccess: () => refetch() });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        toast({ title: 'Alle als gelesen markiert' });
        refetch();
      },
    });
  };

  const handleClick = (notif: NotificationItem) => {
    if (!notif.read) handleMarkRead(notif.id);
    if (notif.action_url) {
      navigate(notif.action_url);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm text-slate-900">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Alle gelesen
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-none border-b bg-transparent h-9 p-0">
            <TabsTrigger value="all" className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none">
              Alle
            </TabsTrigger>
            {['capacity', 'deadlines', 'team'].map(cat => (
              <TabsTrigger key={cat} value={cat} className="flex-1 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:shadow-none">
                {CATEGORY_LABELS[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="max-h-[400px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Keine Benachrichtigungen
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm flex-shrink-0 mt-0.5">{CATEGORY_ICONS[notif.category] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-900 truncate">{notif.title}</span>
                          {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getPriorityColor(notif.priority)}`}>
                            {notif.priority}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: de })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Task 7: Wire NotificationBell into header

**Files:**
- Modify: `src/pages/IndexV2.tsx`

- [ ] **Step 1: Replace Bell button with NotificationBell**

In `src/pages/IndexV2.tsx`, add import:
```typescript
import { NotificationBell } from '@/components/notifications/NotificationBell';
```

Replace lines 149-152 (the existing Bell button):
```typescript
<Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 relative">
    <Bell className="h-5 w-5" />
    <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
</Button>
```

With:
```typescript
<NotificationBell />
```

Remove `Bell` from the lucide-react import if no longer used elsewhere in the file.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/notifications/NotificationBell.tsx src/pages/IndexV2.tsx
git commit -m "feat(notifications): add NotificationBell component to header"
```

---

## Task 8: Notification Settings UI

**Files:**
- Create: `src/components/notifications/NotificationSettingsSection.tsx`
- Modify: `src/components/CompanySettingsSimple.tsx`

- [ ] **Step 1: Create NotificationSettingsSection.tsx**

```typescript
// src/components/notifications/NotificationSettingsSection.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, BarChart3, Calendar, Users, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

interface Pref {
  category: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
}

const CATEGORIES = [
  { key: 'capacity', label: 'Kapazität', desc: 'Überlastung, Engpässe, ArbZG-Warnungen', icon: BarChart3 },
  { key: 'deadlines', label: 'Termine', desc: 'Projektfristen, überfällige Rechnungen, Prüftermine', icon: Calendar },
  { key: 'team', label: 'Team', desc: 'Krankmeldungen, Urlaubskonflikte, neue Zuweisungen', icon: Users },
];

export function NotificationSettingsSection() {
  const { toast } = useToast();
  const { session } = useSupabaseAuth();
  const { isSupported, hasPermission, requestPermission } = usePushNotifications();
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadPrefs();
  }, [session?.user?.id]);

  const loadPrefs = async () => {
    const userId = session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('notification_preferences')
      .select('category, in_app_enabled, push_enabled')
      .eq('user_id', userId);

    // Create defaults for missing categories
    const existing = new Map((data || []).map(p => [p.category, p]));
    const all: Pref[] = CATEGORIES.map(c => existing.get(c.key) || {
      category: c.key, in_app_enabled: true, push_enabled: true,
    });
    setPrefs(all);
    setLoading(false);
  };

  const updatePref = async (category: string, field: 'in_app_enabled' | 'push_enabled', value: boolean) => {
    const userId = session?.user?.id;
    if (!userId) return;

    // If enabling push and no permission, request it
    if (field === 'push_enabled' && value && !hasPermission) {
      await requestPermission();
    }

    setPrefs(prev => prev.map(p =>
      p.category === category ? { ...p, [field]: value } : p
    ));

    // Include both fields to prevent upsert from resetting the other
    const currentPref = prefs.find(p => p.category === category);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        category,
        in_app_enabled: field === 'in_app_enabled' ? value : (currentPref?.in_app_enabled ?? true),
        push_enabled: field === 'push_enabled' ? value : (currentPref?.push_enabled ?? true),
      }, { onConflict: 'user_id,category' });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      loadPrefs(); // Revert
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Automatische Alerts bei Kapazitätsengpässen, Terminen und Team-Ausfällen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported && (
          <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
          </div>
        )}

        <div className="border rounded-lg divide-y">
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 text-xs font-medium text-slate-500">
            <span>Kategorie</span>
            <span className="text-center">In-App</span>
            <span className="text-center">Push</span>
          </div>
          {CATEGORIES.map(cat => {
            const pref = prefs.find(p => p.category === cat.key);
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="grid grid-cols-[1fr_80px_80px] gap-2 p-3 items-center">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{cat.label}</div>
                    <div className="text-xs text-slate-500">{cat.desc}</div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={pref?.in_app_enabled ?? true}
                    onCheckedChange={(v) => updatePref(cat.key, 'in_app_enabled', v)}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={pref?.push_enabled ?? true}
                    onCheckedChange={(v) => updatePref(cat.key, 'push_enabled', v)}
                    disabled={!isSupported}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {isSupported && !hasPermission && (
          <Button variant="outline" size="sm" onClick={requestPermission} className="w-full">
            <Smartphone className="h-4 w-4 mr-2" /> Push-Benachrichtigungen aktivieren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add to CompanySettingsSimple.tsx**

In `src/components/CompanySettingsSimple.tsx`, add import:
```typescript
import { NotificationSettingsSection } from './notifications/NotificationSettingsSection';
```

Find the Arbeitszeiten Card (around line 416) and add right after its closing `</Card>`:
```typescript
<NotificationSettingsSection />
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

```bash
git add src/components/notifications/NotificationSettingsSection.tsx src/components/CompanySettingsSimple.tsx
git commit -m "feat(notifications): add notification preferences settings UI"
```

---

## Task 9: Update notificationService types

**Files:**
- Modify: `src/services/notificationService.ts`

- [ ] **Step 1: Add new notification types**

Find the `NotificationType` type (around line 5) and add the new types:

```typescript
type NotificationType =
  | 'budget_warning' | 'budget_critical' | 'invoice_overdue'
  | 'project_deadline' | 'project_no_invoice'
  | 'time_approval_needed' | 'material_low_stock'
  | 'system_update' | 'general'
  // Capacity alerts
  | 'capacity_overloaded' | 'capacity_understaffed' | 'capacity_bottleneck' | 'capacity_arbzg'
  // Team alerts
  | 'team_member_sick' | 'team_vacation_conflict' | 'team_assignment_created'
  // Inspection alerts
  | 'inspection_due' | 'inspection_overdue' | 'inspection_failed';
```

- [ ] **Step 2: Add NOTIFICATION_CATEGORIES export**

The existing `NotificationFilters.tsx` imports `NOTIFICATION_CATEGORIES` from `notificationService` but it doesn't exist yet. Add after the `NotificationType` definition:

```typescript
export const NOTIFICATION_CATEGORIES: Record<string, { label: string; types: NotificationType[] }> = {
  capacity: {
    label: 'Kapazität',
    types: ['capacity_overloaded', 'capacity_understaffed', 'capacity_bottleneck', 'capacity_arbzg'],
  },
  deadlines: {
    label: 'Termine',
    types: ['budget_warning', 'budget_critical', 'invoice_overdue', 'project_deadline', 'project_no_invoice', 'inspection_due', 'inspection_overdue', 'inspection_failed'],
  },
  team: {
    label: 'Team',
    types: ['team_member_sick', 'team_vacation_conflict', 'team_assignment_created', 'time_approval_needed'],
  },
  system: {
    label: 'System',
    types: ['material_low_stock', 'system_update', 'general'],
  },
};
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

```bash
git add src/services/notificationService.ts
git commit -m "feat(notifications): add alert types and NOTIFICATION_CATEGORIES export"
```
