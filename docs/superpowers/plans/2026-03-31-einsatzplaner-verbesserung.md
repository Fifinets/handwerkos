# Einsatzplaner Verbesserung - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic PlannerModuleV2 (1,655 lines) into focused subcomponents and add Bulk-Assign, Replan, and Capacity-Check features for efficient Handwerksbetrieb scheduling.

**Architecture:** Extract hooks, utilities, and sub-components from PlannerModuleV2.tsx into `src/components/planner/`. Keep the old file as a thin re-export during migration. All new features use existing Supabase tables — no schema changes.

**Tech Stack:** React 18 + TypeScript, @tanstack/react-query, shadcn/ui, Tailwind CSS, Supabase client, date-fns with German locale.

---

## File Structure

### New files to create:
```
src/components/planner/
├── types.ts                        # Shared types (extracted from PlannerModuleV2)
├── constants.ts                    # Colors, styles constants
├── holidays.ts                     # German holiday computation
├── hooks/
│   ├── usePlannerData.ts           # React Query hooks for planner data
│   ├── useConflicts.ts             # Conflict detection logic
│   └── useUndoStack.ts             # Undo stack logic (incl. Ctrl+Z handler)
├── utils/
│   └── capacityUtils.ts            # Utilization, capacity, calendar event helpers
├── PlannerPage.tsx                 # Main layout shell (replaces PlannerModuleV2)
├── PlannerKPICards.tsx             # KPI row component
├── PlannerBanners.tsx              # Auto-assignment, idle, unstaffed banners
├── dialogs/
│   ├── SingleAssignDialog.tsx      # Existing assign dialog (extracted)
│   ├── BulkAssignDialog.tsx        # NEW: Multi-employee assignment
│   ├── ReplanDialog.tsx            # NEW: Team replan + sick replacement + project shift
│   └── CapacityCheckDialog.tsx     # NEW: Capacity check for new projects
```

**Note:** The sidebar, calendar grid, employee row, assignment bar, and drag-drop hook
remain inline in PlannerPage.tsx for now. They are candidates for future extraction once
the new features are stable. This keeps the refactoring scope manageable.

### Files to modify:
- `src/components/PlannerModuleV2.tsx` → Replace with re-export from new PlannerPage
- `src/hooks/useQueryKeys.ts` → Add planner query keys
- `src/pages/IndexV2.tsx` → No change needed (imports PlannerModuleV2 default export)

---

## Task 1: Extract types, constants, and holidays

**Files:**
- Create: `src/components/planner/types.ts`
- Create: `src/components/planner/constants.ts`
- Create: `src/components/planner/holidays.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// src/components/planner/types.ts
export interface Assignment {
  employee_id: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  role: string | null;
}

export interface PlannerProject {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
  project_team_assignments: Assignment[];
}

export interface PlannerEmployee {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  position: string | null;
}

export interface VacationRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  absence_type: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  type: string;
  project_id: string | null;
  assigned_employees: string[] | null;
}

export interface DragPayload {
  projectId: string;
  employeeId: string;
  originDate: string;
  assignmentStartDate: string;
  assignmentEndDate: string | null;
}

export interface UndoEntry {
  description: string;
  revert: () => Promise<void>;
}

export type EntryType = 'project' | 'vacation' | 'sick';
export type ViewMode = 'day' | 'week' | 'month';
export type UtilizationFilter = 'all' | 'overloaded' | 'available';
```

- [ ] **Step 2: Create constants.ts**

```typescript
// src/components/planner/constants.ts
import { EntryType } from './types';

export const PROJECT_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-500', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-500', dot: 'bg-emerald-500' },
  { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-500', dot: 'bg-orange-500' },
  { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-500', dot: 'bg-purple-500' },
  { bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-500', dot: 'bg-pink-500' },
  { bg: 'bg-teal-100', text: 'text-teal-900', border: 'border-teal-500', dot: 'bg-teal-500' },
  { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-500', dot: 'bg-amber-500' },
  { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-500', dot: 'bg-indigo-500' },
  { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-500', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100', text: 'text-cyan-900', border: 'border-cyan-500', dot: 'bg-cyan-500' },
] as const;

export type ProjectColor = typeof PROJECT_COLORS[number];

export const VACATION_COLOR = { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400', dot: 'bg-amber-400' } as const;
export const SICK_COLOR = { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-400', dot: 'bg-red-400' } as const;

export const ENTRY_TYPE_STYLES: Record<EntryType, { active: string; label: string }> = {
  project: { active: 'border-blue-500 bg-blue-50 text-blue-700', label: 'Projekt' },
  vacation: { active: 'border-amber-500 bg-amber-50 text-amber-700', label: 'Urlaub' },
  sick: { active: 'border-red-500 bg-red-50 text-red-700', label: 'Krank' },
};
```

- [ ] **Step 3: Create holidays.ts**

```typescript
// src/components/planner/holidays.ts
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getGermanHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const easter = computeEasterSunday(year);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const easterOffset = (days: number) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + days);
    return d;
  };

  holidays.set(`${year}-01-01`, 'Neujahr');
  holidays.set(`${year}-05-01`, 'Tag der Arbeit');
  holidays.set(`${year}-10-03`, 'Tag der Einheit');
  holidays.set(`${year}-12-25`, '1. Weihnachtstag');
  holidays.set(`${year}-12-26`, '2. Weihnachtstag');
  holidays.set(fmt(easterOffset(-2)), 'Karfreitag');
  holidays.set(fmt(easterOffset(1)), 'Ostermontag');
  holidays.set(fmt(easterOffset(39)), 'Himmelfahrt');
  holidays.set(fmt(easterOffset(50)), 'Pfingstmontag');
  holidays.set(fmt(easterOffset(60)), 'Fronleichnam');

  return holidays;
}
```

- [ ] **Step 4: Verify files compile**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in the new files (existing errors in other files are OK).

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/types.ts src/components/planner/constants.ts src/components/planner/holidays.ts
git commit -m "refactor(planner): extract types, constants, and holidays from PlannerModuleV2"
```

---

## Task 2: Extract usePlannerData hook

**Files:**
- Create: `src/components/planner/hooks/usePlannerData.ts`
- Modify: `src/hooks/useQueryKeys.ts` (add planner keys)

- [ ] **Step 1: Add planner query keys to useQueryKeys.ts**

Add after the employee keys section (around line 93):

```typescript
  // Planner keys
  plannerEmployees: (companyId: string) => ['planner', 'employees', companyId] as const,
  plannerProjects: (companyId: string) => ['planner', 'projects', companyId] as const,
  plannerVacations: (companyId: string) => ['planner', 'vacations', companyId] as const,
  plannerCalendarEvents: (companyId: string) => ['planner', 'calendar-events', companyId] as const,
```

- [ ] **Step 2: Create usePlannerData.ts**

```typescript
// src/components/planner/hooks/usePlannerData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';
import type { PlannerProject, PlannerEmployee, VacationRequest, CalendarEvent } from '../types';

export function usePlannerData() {
  const { companyId } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: QUERY_KEYS.plannerEmployees(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, status, position')
        .eq('company_id', companyId!)
        .not('status', 'in', '("Inaktiv","Gekündigt")');
      if (error) throw error;
      return (data || []) as PlannerEmployee[];
    },
    enabled: !!companyId,
  });

  const projectsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerProjects(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date, location, work_start_date, work_end_date, project_team_assignments(employee_id, is_active, start_date, end_date, role)')
        .eq('company_id', companyId!)
        .not('status', 'in', '("abgeschlossen","storniert")');
      if (error) throw error;
      return (data || []) as PlannerProject[];
    },
    enabled: !!companyId,
  });

  const vacationsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerVacations(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vacation_requests')
        .select('id, employee_id, start_date, end_date, status, reason, absence_type')
        .eq('company_id', companyId!)
        .eq('status', 'approved');
      if (error) throw error;
      return (data || []) as VacationRequest[];
    },
    enabled: !!companyId,
  });

  const calendarEventsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerCalendarEvents(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, start_date, end_date, start_time, end_time, type, project_id, assigned_employees')
        .eq('company_id', companyId!);
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!companyId,
  });

  const invalidateAll = () => {
    if (!companyId) return;
    queryClient.invalidateQueries({ queryKey: ['planner'] });
  };

  return {
    employees: employeesQuery.data || [],
    projects: projectsQuery.data || [],
    vacations: vacationsQuery.data || [],
    calendarEvents: calendarEventsQuery.data || [],
    isLoading: employeesQuery.isLoading || projectsQuery.isLoading || vacationsQuery.isLoading || calendarEventsQuery.isLoading,
    invalidateAll,
    companyId,
  };
}
```

- [ ] **Step 3: Verify files compile**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep -i "usePlannerData\|useQueryKeys"`
Expected: No errors in these files.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/hooks/usePlannerData.ts src/hooks/useQueryKeys.ts
git commit -m "refactor(planner): extract usePlannerData hook with React Query"
```

---

## Task 3: Extract useUndoStack and useConflicts hooks

**Files:**
- Create: `src/components/planner/hooks/useUndoStack.ts`
- Create: `src/components/planner/hooks/useConflicts.ts`
- Create: `src/components/planner/utils/capacityUtils.ts`

- [ ] **Step 1: Create useUndoStack.ts**

```typescript
// src/components/planner/hooks/useUndoStack.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UndoEntry } from '../types';

export function useUndoStack(onRevert: () => void) {
  const { toast } = useToast();
  const stackRef = useRef<UndoEntry[]>([]);
  const [count, setCount] = useState(0);

  const push = useCallback((entry: UndoEntry) => {
    stackRef.current = [...stackRef.current, entry];
    setCount(stackRef.current.length);
  }, []);

  const undo = useCallback(async () => {
    const entry = stackRef.current.pop();
    setCount(stackRef.current.length);
    if (!entry) return;
    try {
      await entry.revert();
      toast({ title: 'Rückgängig', description: entry.description });
      onRevert();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    }
  }, [toast, onRevert]);

  // Ctrl+Z keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  return { push, undo, count };
}
```

- [ ] **Step 2: Create useConflicts.ts**

```typescript
// src/components/planner/hooks/useConflicts.ts
import { useMemo } from 'react';
import { format } from 'date-fns';
import type { PlannerEmployee, PlannerProject, VacationRequest } from '../types';
import { getEmployeeDayAssignments, getAbsence } from '../utils/capacityUtils';

export function useConflicts(
  employees: PlannerEmployee[],
  projects: PlannerProject[],
  vacations: VacationRequest[],
  displayDays: Date[],
) {
  const conflicts = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const emp of employees) {
      const empConflicts = new Set<string>();
      for (const day of displayDays) {
        const ds = format(day, 'yyyy-MM-dd');
        const assignments = getEmployeeDayAssignments(projects, emp.id, day);
        const absence = getAbsence(vacations, emp.id, day);
        if (assignments.length > 1 || (assignments.length > 0 && absence)) {
          empConflicts.add(ds);
        }
      }
      if (empConflicts.size > 0) result.set(emp.id, empConflicts);
    }
    return result;
  }, [employees, projects, vacations, displayDays]);

  const totalCount = useMemo(() => {
    let c = 0;
    conflicts.forEach(dates => c += dates.size);
    return c;
  }, [conflicts]);

  return { conflicts, totalCount };
}
```

- [ ] **Step 3: Create capacityUtils.ts**

```typescript
// src/components/planner/utils/capacityUtils.ts
import { format, addDays } from 'date-fns';
import type { PlannerProject, PlannerEmployee, VacationRequest, CalendarEvent, Assignment } from '../types';

export function getEmployeeDayAssignments(
  projects: PlannerProject[],
  employeeId: string,
  day: Date,
): { project: PlannerProject; assignment: Assignment }[] {
  const dow = day.getDay();
  if (dow === 0 || dow === 6) return [];

  const dayStr = format(day, 'yyyy-MM-dd');
  const result: { project: PlannerProject; assignment: Assignment }[] = [];

  for (const project of projects) {
    const assignments = project.project_team_assignments?.filter(
      (a) => a.employee_id === employeeId && a.is_active,
    ) || [];

    for (const assignment of assignments) {
      const sDate = assignment.start_date || project.start_date;
      const eDate = assignment.end_date || project.end_date;
      if (sDate && dayStr < sDate) continue;
      if (eDate && dayStr > eDate) continue;
      result.push({ project, assignment });
    }
  }
  return result;
}

export function getAbsence(
  vacations: VacationRequest[],
  employeeId: string,
  day: Date,
): 'vacation' | 'sick' | null {
  const dayStr = format(day, 'yyyy-MM-dd');
  const match = vacations.find(
    (v) => v.employee_id === employeeId && dayStr >= v.start_date && dayStr <= v.end_date,
  );
  if (!match) return null;
  return match.absence_type === 'sick' ? 'sick' : 'vacation';
}

export function calculateUtilization(
  employee: PlannerEmployee,
  projects: PlannerProject[],
  displayDays: Date[],
  holidays: Map<string, string>,
): number {
  let workDays = 0;
  let assignedDays = 0;
  for (const day of displayDays) {
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const ds = format(day, 'yyyy-MM-dd');
    if (holidays.has(ds)) continue;
    workDays++;
    if (getEmployeeDayAssignments(projects, employee.id, day).length > 0) assignedDays++;
  }
  return workDays > 0 ? Math.round((assignedDays / workDays) * 100) : 0;
}

export function getAvailableEmployees(
  employees: PlannerEmployee[],
  projects: PlannerProject[],
  vacations: VacationRequest[],
  startDate: string,
  endDate: string,
  holidays: Map<string, string>,
): { employee: PlannerEmployee; availablePercent: number; currentProject: string | null }[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results: { employee: PlannerEmployee; availablePercent: number; currentProject: string | null }[] = [];

  for (const emp of employees) {
    let workDays = 0;
    let freeDays = 0;
    let currentProject: string | null = null;

    let current = new Date(start);
    while (current <= end) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        const ds = format(current, 'yyyy-MM-dd');
        if (!holidays.has(ds)) {
          workDays++;
          const assignments = getEmployeeDayAssignments(projects, emp.id, current);
          const absence = getAbsence(vacations, emp.id, current);
          if (assignments.length === 0 && !absence) {
            freeDays++;
          } else if (assignments.length > 0 && !currentProject) {
            currentProject = assignments[0].project.name;
          }
        }
      }
      current = addDays(current, 1);
    }

    results.push({
      employee: emp,
      availablePercent: workDays > 0 ? Math.round((freeDays / workDays) * 100) : 100,
      currentProject,
    });
  }

  return results.sort((a, b) => b.availablePercent - a.availablePercent);
}

export function getCalendarEventsForDay(
  calendarEvents: CalendarEvent[],
  employeeId: string,
  day: Date,
): CalendarEvent[] {
  const ds = format(day, 'yyyy-MM-dd');
  return calendarEvents.filter(ev => {
    if (ds < ev.start_date || ds > ev.end_date) return false;
    return ev.assigned_employees?.includes(employeeId) ?? false;
  });
}

export function getEmployeeConflictsForRange(
  projects: PlannerProject[],
  vacations: VacationRequest[],
  employeeId: string,
  startDate: string,
  endDate: string,
): string[] {
  const conflicts: string[] = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      const assignments = getEmployeeDayAssignments(projects, employeeId, current);
      const absence = getAbsence(vacations, employeeId, current);
      if (assignments.length > 0) {
        conflicts.push(`${format(current, 'dd.MM.')}: ${assignments.map(a => a.project.name).join(', ')}`);
      }
      if (absence) {
        conflicts.push(`${format(current, 'dd.MM.')}: ${absence === 'sick' ? 'Krank' : 'Urlaub'}`);
      }
    }
    current = addDays(current, 1);
  }
  return conflicts;
}
```

- [ ] **Step 4: Verify files compile**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep -E "useUndoStack|useConflicts|capacityUtils"`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/hooks/useUndoStack.ts src/components/planner/hooks/useConflicts.ts src/components/planner/utils/capacityUtils.ts
git commit -m "refactor(planner): extract undo, conflict, and capacity utils"
```

---

## Task 4: Extract KPI Cards and Banners

**Files:**
- Create: `src/components/planner/PlannerKPICards.tsx`
- Create: `src/components/planner/PlannerBanners.tsx`

- [ ] **Step 1: Create PlannerKPICards.tsx**

```typescript
// src/components/planner/PlannerKPICards.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Users, Palmtree, AlertTriangle } from "lucide-react";

function KpiCard({ icon: Icon, iconBg, iconColor, value, label }: {
  icon: any; iconBg: string; iconColor: string; value: string | number; label: string;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PlannerKPICardsProps {
  isLoading: boolean;
  projectCount: number;
  assignedCount: number;
  freeCount: number;
  vacationTodayCount: number;
  totalConflicts: number;
}

export function PlannerKPICards({ isLoading, projectCount, assignedCount, freeCount, vacationTodayCount, totalConflicts }: PlannerKPICardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <KpiCard icon={Briefcase} iconBg="bg-blue-50" iconColor="text-blue-600"
        value={isLoading ? '—' : projectCount} label="Aktive Projekte" />
      <KpiCard icon={Users} iconBg="bg-amber-50" iconColor="text-amber-600"
        value={isLoading ? '—' : assignedCount} label="Zugewiesene MA" />
      <KpiCard icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600"
        value={isLoading ? '—' : freeCount} label="Freie MA" />
      <KpiCard icon={Palmtree} iconBg="bg-amber-50" iconColor="text-amber-600"
        value={isLoading ? '—' : vacationTodayCount} label="Heute im Urlaub" />
      <KpiCard icon={AlertTriangle}
        iconBg={totalConflicts > 0 ? "bg-red-50" : "bg-slate-50"}
        iconColor={totalConflicts > 0 ? "text-red-600" : "text-slate-400"}
        value={isLoading ? '—' : totalConflicts} label="Konflikte" />
    </div>
  );
}
```

- [ ] **Step 2: Create PlannerBanners.tsx**

```typescript
// src/components/planner/PlannerBanners.tsx
import { Button } from "@/components/ui/button";
import { Zap, Briefcase, Users, Plus } from "lucide-react";
import type { PlannerProject, PlannerEmployee } from './types';

interface PlannerBannersProps {
  unplannedProjects: PlannerProject[];
  unstaffedProjects: PlannerProject[];
  idleEmployees: PlannerEmployee[];
  onAutoAssign: (project: PlannerProject) => void;
  onAssignForProject: (projectId: string) => void;
  onAssignEmployee: (employeeId: string) => void;
}

export function PlannerBanners({
  unplannedProjects,
  unstaffedProjects,
  idleEmployees,
  onAutoAssign,
  onAssignForProject,
  onAssignEmployee,
}: PlannerBannersProps) {
  return (
    <>
      {unplannedProjects.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {unplannedProjects.length} Projekt{unplannedProjects.length > 1 ? 'e' : ''} mit Team aber ohne Planer-Zeitraum
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unplannedProjects.map(p => {
                  const unplannedCount = p.project_team_assignments?.filter(a => a.is_active && !a.start_date).length || 0;
                  return (
                    <Button key={p.id} variant="outline" size="sm"
                      className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100 text-xs h-7"
                      onClick={() => onAutoAssign(p)}>
                      <Zap className="h-3 w-3 mr-1" />
                      {p.name} ({unplannedCount} MA)
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {unstaffedProjects.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                {unstaffedProjects.length} Projekt{unstaffedProjects.length > 1 ? 'e' : ''} ohne Mitarbeiter
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unstaffedProjects.map(p => (
                  <Button key={p.id} variant="outline" size="sm"
                    className="bg-white border-blue-300 text-blue-800 hover:bg-blue-100 text-xs h-7"
                    onClick={() => onAssignForProject(p.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {idleEmployees.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">
                {idleEmployees.length} Mitarbeiter ohne Einsatz diese Woche
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {idleEmployees.map(emp => (
                  <Button key={emp.id} variant="outline" size="sm"
                    className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-7"
                    onClick={() => onAssignEmployee(emp.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {emp.first_name} {emp.last_name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify files compile**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep -E "PlannerKPI|PlannerBanner"`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/PlannerKPICards.tsx src/components/planner/PlannerBanners.tsx
git commit -m "refactor(planner): extract KPI cards and banners components"
```

---

## Task 5: Extract SingleAssignDialog

**Files:**
- Create: `src/components/planner/dialogs/SingleAssignDialog.tsx`

- [ ] **Step 1: Create SingleAssignDialog.tsx**

Extract the assignment dialog from PlannerModuleV2 lines 1230-1332. This is the existing `showAssignDialog` Dialog component, extracted as a standalone component.

```typescript
// src/components/planner/dialogs/SingleAssignDialog.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PlannerProject, PlannerEmployee, EntryType } from '../types';
import { ENTRY_TYPE_STYLES } from '../constants';
import { getEmployeeDayAssignments, getAbsence } from '../utils/capacityUtils';
import type { VacationRequest } from '../types';

interface SingleAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: PlannerEmployee[];
  projects: PlannerProject[];
  vacations: VacationRequest[];
  companyId: string | null;
  prefillEmployeeId?: string;
  prefillProjectId?: string;
  prefillDate?: string;
  onSuccess: () => void;
}

export function SingleAssignDialog({
  open,
  onOpenChange,
  employees,
  projects,
  vacations,
  companyId,
  prefillEmployeeId = '',
  prefillProjectId = '',
  prefillDate = '',
  onSuccess,
}: SingleAssignDialogProps) {
  const { toast } = useToast();
  const [entryType, setEntryType] = useState<EntryType>('project');
  const [employeeId, setEmployeeId] = useState(prefillEmployeeId);
  const [projectId, setProjectId] = useState(prefillProjectId);
  const [startDate, setStartDate] = useState(prefillDate || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form state when dialog opens with new prefill values
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setEntryType('project');
      setEmployeeId(prefillEmployeeId);
      setProjectId(prefillProjectId);
      setStartDate(prefillDate || format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
    }
    onOpenChange(open);
  };

  const handleAssign = async () => {
    if (!employeeId) {
      toast({ title: 'Fehler', description: 'Bitte Mitarbeiter angeben.', variant: 'destructive' });
      return;
    }
    if (entryType !== 'project' && !startDate) {
      toast({ title: 'Fehler', description: 'Bitte Startdatum angeben.', variant: 'destructive' });
      return;
    }
    if (entryType === 'project' && !projectId) {
      toast({ title: 'Fehler', description: 'Bitte ein Projekt auswählen.', variant: 'destructive' });
      return;
    }

    // Conflict check
    if (startDate && employeeId) {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : start;
      const conflicts: string[] = [];
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const absence = getAbsence(vacations, employeeId, d);
        if (entryType === 'project') {
          const existing = getEmployeeDayAssignments(projects, employeeId, d);
          const otherProjects = existing.filter(a => a.project.id !== projectId);
          if (otherProjects.length > 0) {
            conflicts.push(`${format(d, 'dd.MM.')}: ${otherProjects.map(a => a.project.name).join(', ')}`);
          }
          if (absence) {
            conflicts.push(`${format(d, 'dd.MM.')}: ${absence === 'sick' ? 'Krank' : 'Urlaub'}`);
          }
        } else {
          const existing = getEmployeeDayAssignments(projects, employeeId, d);
          if (existing.length > 0) {
            conflicts.push(`${format(d, 'dd.MM.')}: ${existing.map(a => a.project.name).join(', ')}`);
          }
        }
      }
      if (conflicts.length > 0) {
        const msg = conflicts.length <= 3
          ? conflicts.join('\n')
          : `${conflicts.slice(0, 3).join('\n')}\n... und ${conflicts.length - 3} weitere`;
        if (!confirm(`Konflikt erkannt:\n${msg}\n\nTrotzdem zuweisen?`)) return;
      }
    }

    setSaving(true);
    try {
      if (entryType === 'vacation' || entryType === 'sick') {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : start;
        const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const { error } = await supabase.from('vacation_requests').insert({
          company_id: companyId,
          employee_id: employeeId,
          start_date: startDate,
          end_date: endDate || startDate,
          days_requested: days,
          status: 'approved',
          approved_at: new Date().toISOString(),
          absence_type: entryType,
          reason: entryType === 'sick' ? 'Krankmeldung' : null,
        });
        if (error) throw error;
        toast({ title: entryType === 'sick' ? 'Krankheitstage eingetragen' : 'Urlaub eingetragen' });
      } else {
        const { data: existing } = await supabase
          .from('project_team_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('employee_id', employeeId)
          .maybeSingle();

        const effectiveEndDate = endDate || startDate || null;
        if (existing) {
          const { error } = await supabase.from('project_team_assignments')
            .update({ start_date: startDate || null, end_date: effectiveEndDate, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
          toast({ title: 'Zuweisung aktualisiert' });
        } else {
          const { error } = await supabase.from('project_team_assignments')
            .insert({ project_id: projectId, employee_id: employeeId, start_date: startDate || null, end_date: effectiveEndDate, is_active: true, role: 'team_member' });
          if (error) throw error;
          toast({ title: 'Mitarbeiter zugewiesen' });
        }
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message || 'Speichern fehlgeschlagen.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectedProject = projects.find(p => p.id === projectId);
  const preBeauftragt = selectedProject && ['anfrage', 'besichtigung', 'angebot', 'angebot_versendet'].includes(selectedProject.status);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${entryType === 'sick' ? 'bg-red-50' : entryType === 'vacation' ? 'bg-amber-50' : 'bg-blue-50'}`}>
              <CalendarIcon className={`h-5 w-5 ${entryType === 'sick' ? 'text-red-600' : entryType === 'vacation' ? 'text-amber-600' : 'text-blue-600'}`} />
            </div>
            <DialogTitle>
              {entryType === 'sick' ? 'Krankheit eintragen' : entryType === 'vacation' ? 'Urlaub eintragen' : 'Mitarbeiter zuweisen'}
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {(['project', 'vacation', 'sick'] as EntryType[]).map(type => (
              <button key={type} onClick={() => setEntryType(type)}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  entryType === type ? ENTRY_TYPE_STYLES[type].active : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}>
                {ENTRY_TYPE_STYLES[type].label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Mitarbeiter *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entryType === 'project' && (
            <div className="space-y-2">
              <Label>Projekt *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Von {entryType !== 'project' ? '*' : ''}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bis</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {entryType === 'project' && !startDate && (
            <div className="rounded-lg p-3 text-sm bg-blue-50 border border-blue-200 text-blue-700">
              Ohne Datum wird der Mitarbeiter dem Team zugewiesen, aber noch nicht im Kalender eingeplant.
            </div>
          )}

          {entryType === 'project' && preBeauftragt && (
            <div className="rounded-lg p-3 text-sm bg-amber-50 border border-amber-200 text-amber-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Projekt ist noch nicht beauftragt (Status: {selectedProject!.status}). Zuweisung ist moeglich, aber der Auftrag ist noch nicht bestaetig.</span>
            </div>
          )}

          {entryType !== 'project' && (
            <div className={`rounded-lg p-3 text-sm ${entryType === 'sick' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
              {entryType === 'sick' ? 'Krankheitstage werden sofort als genehmigt eingetragen.' : 'Urlaub wird sofort als genehmigt eingetragen (Manager-Eintrag).'}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleAssign} disabled={saving}
            className={entryType === 'sick' ? 'bg-red-600 hover:bg-red-700' : entryType === 'vacation' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}>
            {saving ? 'Speichern...' : entryType === 'project' ? 'Zuweisen' : 'Eintragen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep "SingleAssignDialog"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/dialogs/SingleAssignDialog.tsx
git commit -m "refactor(planner): extract SingleAssignDialog component"
```

---

## Task 6: Create BulkAssignDialog (Phase 2)

**Files:**
- Create: `src/components/planner/dialogs/BulkAssignDialog.tsx`

- [ ] **Step 1: Create BulkAssignDialog.tsx**

```typescript
// src/components/planner/dialogs/BulkAssignDialog.tsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PlannerProject, PlannerEmployee, VacationRequest } from '../types';
import { getAvailableEmployees, getEmployeeConflictsForRange } from '../utils/capacityUtils';
import { getGermanHolidays } from '../holidays';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: PlannerEmployee[];
  projects: PlannerProject[];
  vacations: VacationRequest[];
  onSuccess: () => void;
  prefillProjectId?: string;
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  employees,
  projects,
  vacations,
  onSuccess,
  prefillProjectId = '',
}: BulkAssignDialogProps) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(prefillProjectId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [positionFilter, setPositionFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  // Auto-fill dates from selected project
  const selectedProject = projects.find(p => p.id === projectId);
  const effectiveStart = startDate || selectedProject?.work_start_date || selectedProject?.start_date || '';
  const effectiveEnd = endDate || selectedProject?.work_end_date || selectedProject?.end_date || '';

  // Update dates when project changes
  const handleProjectChange = (id: string) => {
    setProjectId(id);
    const proj = projects.find(p => p.id === id);
    if (proj) {
      setStartDate(proj.work_start_date || proj.start_date || '');
      setEndDate(proj.work_end_date || proj.end_date || '');
    }
    setSelectedEmployees(new Set());
  };

  // Get holidays for availability calculation
  const holidays = useMemo(() => {
    if (!effectiveStart) return new Map<string, string>();
    const year = new Date(effectiveStart).getFullYear();
    const all = new Map<string, string>();
    getGermanHolidays(year).forEach((v, k) => all.set(k, v));
    if (effectiveEnd) {
      const endYear = new Date(effectiveEnd).getFullYear();
      if (endYear !== year) getGermanHolidays(endYear).forEach((v, k) => all.set(k, v));
    }
    return all;
  }, [effectiveStart, effectiveEnd]);

  // Calculate availability for each employee
  const availabilityData = useMemo(() => {
    if (!effectiveStart || !effectiveEnd) return [];
    return getAvailableEmployees(employees, projects, vacations, effectiveStart, effectiveEnd, holidays);
  }, [employees, projects, vacations, effectiveStart, effectiveEnd, holidays]);

  // Unique positions for filter
  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.position) set.add(e.position); });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees
  const filteredAvailability = useMemo(() => {
    if (positionFilter === 'all') return availabilityData;
    return availabilityData.filter(a => a.employee.position === positionFilter);
  }, [availabilityData, positionFilter]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFree = () => {
    const freeIds = filteredAvailability
      .filter(a => a.availablePercent === 100)
      .map(a => a.employee.id);
    setSelectedEmployees(new Set(freeIds));
  };

  const handleBulkAssign = async () => {
    if (!projectId || selectedEmployees.size === 0) {
      toast({ title: 'Fehler', description: 'Bitte Projekt und mindestens einen Mitarbeiter wählen.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const promises = Array.from(selectedEmployees).map(async (empId) => {
        const { data: existing } = await supabase
          .from('project_team_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('employee_id', empId)
          .maybeSingle();

        if (existing) {
          return supabase.from('project_team_assignments')
            .update({ start_date: effectiveStart || null, end_date: effectiveEnd || null, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          return supabase.from('project_team_assignments')
            .insert({ project_id: projectId, employee_id: empId, start_date: effectiveStart || null, end_date: effectiveEnd || null, is_active: true, role: 'team_member' });
        }
      });

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        toast({ title: 'Teilweise Fehler', description: `${errors.length} von ${results.length} Zuweisungen fehlgeschlagen.`, variant: 'destructive' });
      } else {
        toast({ title: 'Team zugewiesen', description: `${selectedEmployees.size} Mitarbeiter zugewiesen.` });
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Active projects only
  const activeProjects = projects.filter(p => ['beauftragt', 'in_bearbeitung'].includes(p.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle>Team zuweisen</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Project selection */}
          <div className="space-y-2">
            <Label>Projekt *</Label>
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
              <SelectContent>
                {activeProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.location ? ` (${p.location})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Von</Label>
              <Input type="date" value={effectiveStart} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bis</Label>
              <Input type="date" value={effectiveEnd} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Position filter + select all */}
          <div className="flex items-center gap-2">
            {positions.length > 0 && (
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Positionen</SelectItem>
                  {positions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={selectAllFree}>
              Alle freien auswählen
            </Button>
            <Badge variant="outline" className="text-xs ml-auto">
              {selectedEmployees.size} ausgewählt
            </Badge>
          </div>

          {/* Employee list */}
          <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
            {filteredAvailability.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                {effectiveStart ? 'Keine Mitarbeiter gefunden.' : 'Bitte zuerst Projekt und Zeitraum wählen.'}
              </div>
            ) : (
              filteredAvailability.map(({ employee, availablePercent, currentProject }) => {
                const isSelected = selectedEmployees.has(employee.id);
                const colorClass = availablePercent === 100 ? 'text-emerald-600' : availablePercent > 0 ? 'text-amber-600' : 'text-red-600';
                const isExpanded = expandedConflicts.has(employee.id);
                const hasConflicts = availablePercent < 100;
                const conflicts = hasConflicts && isExpanded
                  ? getEmployeeConflictsForRange(projects, vacations, employee.id, effectiveStart, effectiveEnd)
                  : [];

                return (
                  <div key={employee.id} className={isSelected ? 'bg-blue-50/50' : ''}>
                    <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleEmployee(employee.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {employee.position || '—'}
                          {currentProject && <span className="ml-1">· aktuell: {currentProject}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${colorClass}`}>{availablePercent}% frei</span>
                        {hasConflicts && (
                          <button
                            type="button"
                            className="p-0.5 hover:bg-slate-200 rounded"
                            onClick={(e) => {
                              e.preventDefault();
                              setExpandedConflicts(prev => {
                                const next = new Set(prev);
                                if (next.has(employee.id)) next.delete(employee.id);
                                else next.add(employee.id);
                                return next;
                              });
                            }}
                          >
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          </button>
                        )}
                      </div>
                    </label>
                    {isExpanded && conflicts.length > 0 && (
                      <div className="px-10 pb-2 space-y-0.5">
                        {conflicts.slice(0, 10).map((c, i) => (
                          <div key={i} className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {c}
                          </div>
                        ))}
                        {conflicts.length > 10 && (
                          <div className="text-[11px] text-slate-500">… und {conflicts.length - 10} weitere</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleBulkAssign} disabled={saving || selectedEmployees.size === 0}
            className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Zuweisen...' : `${selectedEmployees.size} Mitarbeiter zuweisen`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep "BulkAssignDialog"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/dialogs/BulkAssignDialog.tsx
git commit -m "feat(planner): add BulkAssignDialog for multi-employee assignment"
```

---

## Task 7: Create ReplanDialog (Phase 3) — 3 Scenarios

**Files:**
- Create: `src/components/planner/dialogs/ReplanDialog.tsx`
- Create: `src/components/planner/dialogs/ProjectShiftDialog.tsx`

This task covers all 3 replan scenarios from the spec:
- **Szenario A**: Projekt abgeschlossen → Team auf neues Projekt (ReplanDialog)
- **Szenario B**: MA fällt aus → Ersatz-Vorschlag (ReplanDialog, mode='replacement')
- **Szenario C**: Projekt verschiebt sich → Alle Zuweisungen verschieben (ProjectShiftDialog)

- [ ] **Step 1: Create ReplanDialog.tsx (Szenario A + B)**

```typescript
// src/components/planner/dialogs/ReplanDialog.tsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, UserPlus } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PlannerProject, PlannerEmployee, VacationRequest } from '../types';
import { getAvailableEmployees } from '../utils/capacityUtils';
import { getGermanHolidays } from '../holidays';

type ReplanMode = 'team-transfer' | 'replacement';

interface ReplanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceProject: PlannerProject | null;
  employees: PlannerEmployee[];
  projects: PlannerProject[];
  vacations: VacationRequest[];
  onSuccess: () => void;
  /** Pre-set mode: 'replacement' when triggered from sick-leave banner */
  initialMode?: ReplanMode;
  /** Employee who fell out (Szenario B) */
  absentEmployeeId?: string;
}

export function ReplanDialog({
  open,
  onOpenChange,
  sourceProject,
  employees,
  projects,
  vacations,
  onSuccess,
  initialMode = 'team-transfer',
  absentEmployeeId,
}: ReplanDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<ReplanMode>(initialMode);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [replacementEmployeeId, setReplacementEmployeeId] = useState('');
  const [saving, setSaving] = useState(false);

  // Team members of the source project
  const teamMembers = useMemo(() => {
    if (!sourceProject) return [];
    const activeAssignments = sourceProject.project_team_assignments?.filter(a => a.is_active) || [];
    return activeAssignments
      .map(a => employees.find(e => e.id === a.employee_id))
      .filter((e): e is PlannerEmployee => !!e);
  }, [sourceProject, employees]);

  // Absent employee details
  const absentEmployee = useMemo(() => {
    if (!absentEmployeeId) return null;
    return employees.find(e => e.id === absentEmployeeId) || null;
  }, [absentEmployeeId, employees]);

  // Replacement suggestions: free employees sorted by same position first
  const replacementSuggestions = useMemo(() => {
    if (mode !== 'replacement' || !sourceProject || !absentEmployee) return [];
    const projectStart = sourceProject.work_start_date || sourceProject.start_date || '';
    const projectEnd = sourceProject.work_end_date || sourceProject.end_date || '';
    if (!projectStart) return [];

    const holidays = new Map<string, string>();
    const year = new Date(projectStart).getFullYear();
    getGermanHolidays(year).forEach((v, k) => holidays.set(k, v));

    const available = getAvailableEmployees(
      employees.filter(e => e.id !== absentEmployeeId),
      projects, vacations, projectStart, projectEnd || projectStart, holidays,
    );

    // Sort: same position first, then by availability
    return available
      .filter(a => a.availablePercent > 0)
      .sort((a, b) => {
        const aMatch = a.employee.position === absentEmployee.position ? 1 : 0;
        const bMatch = b.employee.position === absentEmployee.position ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return b.availablePercent - a.availablePercent;
      });
  }, [mode, sourceProject, absentEmployee, absentEmployeeId, employees, projects, vacations]);

  // Pre-select all team members when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setMode(initialMode);
      if (initialMode === 'team-transfer' && sourceProject) {
        setSelectedEmployees(new Set(teamMembers.map(e => e.id)));
      } else {
        setSelectedEmployees(new Set());
      }
      setTargetProjectId('');
      setStartDate('');
      setEndDate('');
      setReplacementEmployeeId('');
    }
    onOpenChange(isOpen);
  };

  // Auto-fill dates when target project changes
  const handleTargetChange = (id: string) => {
    setTargetProjectId(id);
    const proj = projects.find(p => p.id === id);
    if (proj) {
      setStartDate(proj.work_start_date || proj.start_date || '');
      setEndDate(proj.work_end_date || proj.end_date || '');
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Szenario A: Team Transfer
  const handleReplan = async () => {
    if (!sourceProject || !targetProjectId || selectedEmployees.size === 0) {
      toast({ title: 'Fehler', description: 'Bitte Zielprojekt und Mitarbeiter wählen.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const deactivatePromises = Array.from(selectedEmployees).map(empId =>
        supabase.from('project_team_assignments')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('project_id', sourceProject.id)
          .eq('employee_id', empId)
      );
      await Promise.all(deactivatePromises);

      const assignPromises = Array.from(selectedEmployees).map(async (empId) => {
        const { data: existing } = await supabase
          .from('project_team_assignments')
          .select('id')
          .eq('project_id', targetProjectId)
          .eq('employee_id', empId)
          .maybeSingle();

        if (existing) {
          return supabase.from('project_team_assignments')
            .update({ start_date: startDate || null, end_date: endDate || null, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          return supabase.from('project_team_assignments')
            .insert({ project_id: targetProjectId, employee_id: empId, start_date: startDate || null, end_date: endDate || null, is_active: true, role: 'team_member' });
        }
      });
      await Promise.all(assignPromises);

      const targetName = projects.find(p => p.id === targetProjectId)?.name || '';
      toast({ title: 'Team umgeplant', description: `${selectedEmployees.size} MA von "${sourceProject.name}" auf "${targetName}" umgeplant.` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Szenario B: Replacement
  const handleReplacement = async () => {
    if (!sourceProject || !replacementEmployeeId) {
      toast({ title: 'Fehler', description: 'Bitte Ersatz-Mitarbeiter wählen.', variant: 'destructive' });
      return;
    }

    const projStart = sourceProject.work_start_date || sourceProject.start_date || '';
    const projEnd = sourceProject.work_end_date || sourceProject.end_date || '';

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('project_team_assignments')
        .select('id')
        .eq('project_id', sourceProject.id)
        .eq('employee_id', replacementEmployeeId)
        .maybeSingle();

      if (existing) {
        await supabase.from('project_team_assignments')
          .update({ start_date: projStart || null, end_date: projEnd || null, is_active: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('project_team_assignments')
          .insert({ project_id: sourceProject.id, employee_id: replacementEmployeeId, start_date: projStart || null, end_date: projEnd || null, is_active: true, role: 'team_member' });
      }

      const rep = employees.find(e => e.id === replacementEmployeeId);
      toast({ title: 'Ersatz eingesetzt', description: `${rep?.first_name} ${rep?.last_name} als Ersatz auf "${sourceProject.name}" eingesetzt.` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const targetProjects = projects.filter(p =>
    p.id !== sourceProject?.id && ['beauftragt', 'in_bearbeitung'].includes(p.status)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mode === 'replacement' ? 'bg-red-50' : 'bg-amber-50'}`}>
              {mode === 'replacement'
                ? <UserPlus className="h-5 w-5 text-red-600" />
                : <ArrowRight className="h-5 w-5 text-amber-600" />}
            </div>
            <DialogTitle>{mode === 'replacement' ? 'Ersatz einsetzen' : 'Team umplanen'}</DialogTitle>
          </div>
        </DialogHeader>

        {sourceProject && (
          <div className="space-y-4 py-2">
            {/* Mode tabs (only show if not pre-set) */}
            {!absentEmployeeId && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as ReplanMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="team-transfer" className="flex-1 text-xs">Team umplanen</TabsTrigger>
                  <TabsTrigger value="replacement" className="flex-1 text-xs">Ersatz finden</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Source info */}
            <div className="rounded-lg p-3 bg-slate-50 border">
              <p className="text-sm text-slate-600">
                Projekt: <span className="font-medium text-slate-900">{sourceProject.name}</span>
              </p>
              {mode === 'replacement' && absentEmployee && (
                <p className="text-sm text-red-600 mt-1">
                  {absentEmployee.first_name} {absentEmployee.last_name} fällt aus
                  {absentEmployee.position && <span className="text-slate-500"> ({absentEmployee.position})</span>}
                </p>
              )}
              {mode === 'team-transfer' && (
                <p className="text-xs text-slate-500 mt-1">{teamMembers.length} Mitarbeiter im Team</p>
              )}
            </div>

            {mode === 'team-transfer' ? (
              <>
                {/* Szenario A: Team Transfer UI */}
                <div className="space-y-2">
                  <Label>Auf Projekt umplanen *</Label>
                  <Select value={targetProjectId} onValueChange={handleTargetChange}>
                    <SelectTrigger><SelectValue placeholder="Zielprojekt wählen" /></SelectTrigger>
                    <SelectContent>
                      {targetProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.location ? ` (${p.location})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Von</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bis</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Mitarbeiter umplanen</Label>
                    <Badge variant="outline" className="text-xs">{selectedEmployees.size} ausgewählt</Badge>
                  </div>
                  <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                    {teamMembers.map(emp => (
                      <label key={emp.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                        <Checkbox checked={selectedEmployees.has(emp.id)} onCheckedChange={() => toggleEmployee(emp.id)} />
                        <div>
                          <div className="text-sm font-medium text-slate-800">{emp.first_name} {emp.last_name}</div>
                          <div className="text-xs text-slate-500">{emp.position || '—'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Szenario B: Replacement UI */}
                <div>
                  <Label className="text-xs text-slate-500 mb-2 block">
                    Verfügbare Ersatz-Mitarbeiter
                    {absentEmployee?.position && <span> (gleiche Position "{absentEmployee.position}" zuerst)</span>}
                  </Label>
                  <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                    {replacementSuggestions.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 text-center">Keine verfügbaren Mitarbeiter gefunden.</div>
                    ) : (
                      replacementSuggestions.map(({ employee, availablePercent }) => {
                        const isSelected = replacementEmployeeId === employee.id;
                        const samePosition = employee.position === absentEmployee?.position;
                        return (
                          <label key={employee.id}
                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                            <input type="radio" name="replacement" checked={isSelected}
                              onChange={() => setReplacementEmployeeId(employee.id)}
                              className="accent-blue-600" />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-800">
                                {employee.first_name} {employee.last_name}
                                {samePosition && <Badge className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-0">Gleiche Position</Badge>}
                              </div>
                              <div className="text-xs text-slate-500">{employee.position || '—'}</div>
                            </div>
                            <span className={`text-xs font-medium ${availablePercent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {availablePercent}% frei
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          {mode === 'team-transfer' ? (
            <Button onClick={handleReplan} disabled={saving || selectedEmployees.size === 0 || !targetProjectId}
              className="bg-amber-600 hover:bg-amber-700">
              {saving ? 'Umplanen...' : `${selectedEmployees.size} MA umplanen`}
            </Button>
          ) : (
            <Button onClick={handleReplacement} disabled={saving || !replacementEmployeeId}
              className="bg-red-600 hover:bg-red-700">
              {saving ? 'Einsetzen...' : 'Als Ersatz einsetzen'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create ProjectShiftDialog.tsx (Szenario C)**

```typescript
// src/components/planner/dialogs/ProjectShiftDialog.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { format, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PlannerProject, PlannerEmployee } from '../types';
import { getEmployeeDayAssignments } from '../utils/capacityUtils';

interface ProjectShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PlannerProject | null;
  allProjects: PlannerProject[];
  employees: PlannerEmployee[];
  onSuccess: () => void;
}

export function ProjectShiftDialog({
  open,
  onOpenChange,
  project,
  allProjects,
  employees,
  onSuccess,
}: ProjectShiftDialogProps) {
  const { toast } = useToast();
  const [shiftDays, setShiftDays] = useState(7);
  const [saving, setSaving] = useState(false);

  if (!project) return null;

  const activeAssignments = project.project_team_assignments?.filter(a => a.is_active) || [];

  // Preview: show what dates will change to
  const preview = activeAssignments.map(a => {
    const emp = employees.find(e => e.id === a.employee_id);
    const newStart = a.start_date ? format(addDays(new Date(a.start_date), shiftDays), 'dd.MM.yyyy', { locale: de }) : '—';
    const newEnd = a.end_date ? format(addDays(new Date(a.end_date), shiftDays), 'dd.MM.yyyy', { locale: de }) : 'offen';
    return { emp, newStart, newEnd };
  });

  // Check conflicts after shift
  const conflicts: string[] = [];
  for (const a of activeAssignments) {
    if (!a.start_date) continue;
    const newStart = addDays(new Date(a.start_date), shiftDays);
    const newEnd = a.end_date ? addDays(new Date(a.end_date), shiftDays) : newStart;
    // Check if this employee has OTHER assignments in the new range
    const otherProjects = allProjects.filter(p => p.id !== project.id);
    const empAssignments = getEmployeeDayAssignments(otherProjects, a.employee_id, newStart);
    if (empAssignments.length > 0) {
      const emp = employees.find(e => e.id === a.employee_id);
      conflicts.push(`${emp?.first_name} ${emp?.last_name}: Konflikt mit ${empAssignments[0].project.name}`);
    }
  }

  const handleShift = async () => {
    if (conflicts.length > 0) {
      if (!confirm(`${conflicts.length} Konflikte erkannt:\n${conflicts.join('\n')}\n\nTrotzdem verschieben?`)) return;
    }

    setSaving(true);
    try {
      const promises = activeAssignments.map(a => {
        const newStart = a.start_date ? format(addDays(new Date(a.start_date), shiftDays), 'yyyy-MM-dd') : null;
        const newEnd = a.end_date ? format(addDays(new Date(a.end_date), shiftDays), 'yyyy-MM-dd') : null;
        return supabase.from('project_team_assignments')
          .update({ start_date: newStart, end_date: newEnd, updated_at: new Date().toISOString() })
          .eq('project_id', project.id)
          .eq('employee_id', a.employee_id)
          .eq('is_active', true);
      });
      await Promise.all(promises);

      toast({ title: 'Projekt verschoben', description: `"${project.name}" um ${shiftDays} Tage verschoben (${activeAssignments.length} Zuweisungen).` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
            </div>
            <DialogTitle>Projekt verschieben</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg p-3 bg-slate-50 border">
            <p className="text-sm font-medium text-slate-900">{project.name}</p>
            <p className="text-xs text-slate-500 mt-1">{activeAssignments.length} aktive Zuweisungen</p>
          </div>

          <div className="space-y-2">
            <Label>Verschieben um (Tage)</Label>
            <Input type="number" value={shiftDays} onChange={e => setShiftDays(parseInt(e.target.value) || 0)} />
            <p className="text-xs text-slate-500">Positiv = nach hinten, Negativ = nach vorne</p>
          </div>

          {/* Preview */}
          {shiftDays !== 0 && (
            <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
              {preview.map(({ emp, newStart, newEnd }, i) => (
                <div key={i} className="p-2 text-sm flex justify-between">
                  <span className="text-slate-700">{emp?.first_name} {emp?.last_name}</span>
                  <span className="text-slate-500 text-xs">{newStart} – {newEnd}</span>
                </div>
              ))}
            </div>
          )}

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div className="rounded-lg p-3 bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
                <AlertTriangle className="h-4 w-4" /> {conflicts.length} Konflikte
              </div>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-red-600">{c}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleShift} disabled={saving || shiftDays === 0}
            className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? 'Verschieben...' : `Um ${shiftDays} Tage verschieben`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify both files compile**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep -E "ReplanDialog|ProjectShiftDialog"`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/dialogs/ReplanDialog.tsx src/components/planner/dialogs/ProjectShiftDialog.tsx
git commit -m "feat(planner): add ReplanDialog (team transfer + replacement) and ProjectShiftDialog"
```

---

## Task 8: Create CapacityCheckDialog (Phase 3)

**Files:**
- Create: `src/components/planner/dialogs/CapacityCheckDialog.tsx`

- [ ] **Step 1: Create CapacityCheckDialog.tsx**

```typescript
// src/components/planner/dialogs/CapacityCheckDialog.tsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle, CheckCircle } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import type { PlannerProject, PlannerEmployee, VacationRequest } from '../types';
import { getAvailableEmployees } from '../utils/capacityUtils';
import { getGermanHolidays } from '../holidays';

interface CapacityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: PlannerEmployee[];
  projects: PlannerProject[];
  vacations: VacationRequest[];
  onOpenBulkAssign: (projectId?: string) => void;
}

interface WeekCapacity {
  weekLabel: string;
  available: number;
  needed: number;
  isBottleneck: boolean;
}

export function CapacityCheckDialog({
  open,
  onOpenChange,
  employees,
  projects,
  vacations,
  onOpenBulkAssign,
}: CapacityCheckDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [neededCount, setNeededCount] = useState(1);
  const [positionFilter, setPositionFilter] = useState('all');

  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.position) set.add(e.position); });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (positionFilter === 'all') return employees;
    return employees.filter(e => e.position === positionFilter);
  }, [employees, positionFilter]);

  // Holidays for the range
  const holidays = useMemo(() => {
    if (!startDate) return new Map<string, string>();
    const all = new Map<string, string>();
    const startYear = new Date(startDate).getFullYear();
    getGermanHolidays(startYear).forEach((v, k) => all.set(k, v));
    if (endDate) {
      const endYear = new Date(endDate).getFullYear();
      if (endYear !== startYear) getGermanHolidays(endYear).forEach((v, k) => all.set(k, v));
    }
    return all;
  }, [startDate, endDate]);

  // Week-by-week capacity analysis
  const weeklyCapacity = useMemo((): WeekCapacity[] => {
    if (!startDate || !endDate) return [];
    const weeks: WeekCapacity[] = [];
    let current = startOfWeek(new Date(startDate), { weekStartsOn: 1 });
    const end = new Date(endDate);

    while (current <= end) {
      const wEnd = endOfWeek(current, { weekStartsOn: 1 });
      const wStartStr = format(current, 'yyyy-MM-dd');
      const wEndStr = format(wEnd > end ? end : wEnd, 'yyyy-MM-dd');

      const availability = getAvailableEmployees(filteredEmployees, projects, vacations, wStartStr, wEndStr, holidays);
      const fullyAvailable = availability.filter(a => a.availablePercent === 100).length;

      weeks.push({
        weekLabel: `KW ${format(current, 'ww', { locale: de })}`,
        available: fullyAvailable,
        needed: neededCount,
        isBottleneck: fullyAvailable < neededCount,
      });

      current = addDays(wEnd, 1);
    }
    return weeks;
  }, [startDate, endDate, filteredEmployees, projects, vacations, holidays, neededCount]);

  // Available employees for full range
  const availableForRange = useMemo(() => {
    if (!startDate || !endDate) return [];
    return getAvailableEmployees(filteredEmployees, projects, vacations, startDate, endDate, holidays);
  }, [filteredEmployees, projects, vacations, startDate, endDate, holidays]);

  const hasBottleneck = weeklyCapacity.some(w => w.isBottleneck);
  const fullyAvailableCount = availableForRange.filter(a => a.availablePercent === 100).length;

  // Max bar width for visualization
  const maxCount = Math.max(neededCount, ...weeklyCapacity.map(w => w.available), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
            </div>
            <DialogTitle>Kapazität prüfen</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Von *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bis *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Benötigte MA</Label>
              <Input type="number" min={1} value={neededCount} onChange={e => setNeededCount(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Positionen</SelectItem>
                  {positions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          {startDate && endDate && (
            <>
              {/* Summary */}
              <div className={`rounded-lg p-3 border ${hasBottleneck ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2">
                  {hasBottleneck ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`text-sm font-medium ${hasBottleneck ? 'text-red-800' : 'text-emerald-800'}`}>
                    {hasBottleneck
                      ? `Engpass: ${weeklyCapacity.filter(w => w.isBottleneck).length} Wochen mit zu wenig Kapazität`
                      : `Kapazität reicht: ${fullyAvailableCount} MA über gesamten Zeitraum verfügbar`}
                  </span>
                </div>
              </div>

              {/* Week bars */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Wochenübersicht</Label>
                <div className="space-y-1.5">
                  {weeklyCapacity.map((week, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-12 flex-shrink-0">{week.weekLabel}</span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full ${week.isBottleneck ? 'bg-red-400' : 'bg-emerald-400'}`}
                          style={{ width: `${(week.available / maxCount) * 100}%` }}
                        />
                        {/* Needed line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-600"
                          style={{ left: `${(week.needed / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-8 text-right ${week.isBottleneck ? 'text-red-600' : 'text-emerald-600'}`}>
                        {week.available}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">Grün = verfügbar | Schwarze Linie = benötigt ({neededCount})</p>
              </div>

              {/* Available employees list */}
              <div>
                <Label className="text-xs text-slate-500">Verfügbare Mitarbeiter ({fullyAvailableCount})</Label>
                <div className="border rounded-lg divide-y max-h-[150px] overflow-y-auto mt-1">
                  {availableForRange.filter(a => a.availablePercent > 0).slice(0, 20).map(({ employee, availablePercent }) => (
                    <div key={employee.id} className="flex items-center justify-between p-2 text-sm">
                      <span className="font-medium text-slate-800">{employee.first_name} {employee.last_name}</span>
                      <Badge variant="outline" className={`text-xs ${availablePercent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {availablePercent}% frei
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* 48h ArbZG warning */}
              {neededCount > filteredEmployees.length && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Achtung: Mehr MA benötigt als verfügbar. Beachten Sie die 48h-Wochengrenze (ArbZG 2026).</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
          {startDate && endDate && fullyAvailableCount > 0 && (
            <Button onClick={() => { onOpenChange(false); onOpenBulkAssign(); }}
              className="bg-blue-600 hover:bg-blue-700">
              Verfügbare MA zuweisen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | grep "CapacityCheckDialog"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/dialogs/CapacityCheckDialog.tsx
git commit -m "feat(planner): add CapacityCheckDialog for resource planning"
```

---

## Task 9: Assemble PlannerPage and wire everything together

**Files:**
- Create: `src/components/planner/PlannerPage.tsx`
- Modify: `src/components/PlannerModuleV2.tsx` (replace with re-export)

- [ ] **Step 1: Create PlannerPage.tsx**

This is the main shell. It replaces PlannerModuleV2 by:
- Using `usePlannerData()` instead of manual `loadData()`
- Using `useUndoStack()` instead of inline undo logic
- Using `useConflicts()` instead of inline conflict computation
- Importing all extracted components and new dialogs
- Adding "Team zuweisen" and "Kapazität prüfen" buttons in the header

The calendar grid, employee rows, sidebar, and drag-drop logic are copied from the original
PlannerModuleV2 (lines 928-1335 for sidebar+grid, lines 1357-1653 for EmployeeRow) since
they stay inline for now. The implementing agent MUST copy those sections and only replace
state/data references with the new hook calls.

**The skeleton below shows all imports, state, hooks, and the JSX structure with
placeholders marking where the original JSX blocks go. The agent fills those from
the original PlannerModuleV2.tsx.**

```typescript
// src/components/planner/PlannerPage.tsx
import React, { useState, useMemo, useCallback, DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar as CalendarIcon, Users, Briefcase, Plus, ChevronLeft, ChevronRight,
  Search, Palmtree, X, AlertTriangle, Eye, Zap, Undo2, BarChart3, RefreshCw,
} from "lucide-react";
import {
  addDays, addMonths, format, startOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, subDays, subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Extracted modules
import type { PlannerProject, PlannerEmployee, DragPayload, EntryType, ViewMode, UtilizationFilter } from './types';
import { PROJECT_COLORS, VACATION_COLOR, SICK_COLOR, ENTRY_TYPE_STYLES } from './constants';
import { getGermanHolidays } from './holidays';
import { usePlannerData } from './hooks/usePlannerData';
import { useUndoStack } from './hooks/useUndoStack';
import { useConflicts } from './hooks/useConflicts';
import { calculateUtilization, getEmployeeDayAssignments, getAbsence, getCalendarEventsForDay } from './utils/capacityUtils';
import { PlannerKPICards } from './PlannerKPICards';
import { PlannerBanners } from './PlannerBanners';
import { SingleAssignDialog } from './dialogs/SingleAssignDialog';
import { BulkAssignDialog } from './dialogs/BulkAssignDialog';
import { ReplanDialog } from './dialogs/ReplanDialog';
import { CapacityCheckDialog } from './dialogs/CapacityCheckDialog';

export function PlannerPage() {
  const { toast } = useToast();

  // ── Data from React Query ──────────────────────────────────
  const {
    employees, projects, vacations, calendarEvents,
    isLoading, invalidateAll,
  } = usePlannerData();

  // ── View state ─────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [searchTerm, setSearchTerm] = useState('');

  // ── Filter state ───────────────────────────────────────────
  const [filterProjectId, setFilterProjectId] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [filterUtilization, setFilterUtilization] = useState<UtilizationFilter>('all');

  // ── Dialog state (existing) ────────────────────────────────
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');

  // ── Dialog state (NEW) ────────────────────────────────────
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showReplan, setShowReplan] = useState(false);
  const [replanProject, setReplanProject] = useState<PlannerProject | null>(null);
  const [showCapacityCheck, setShowCapacityCheck] = useState(false);

  // ── Drag & drop state ──────────────────────────────────────
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<{ employeeId: string; date: string } | null>(null);

  // ── Hooks ──────────────────────────────────────────────────
  const { pushUndo, handleUndo, undoCount } = useUndoStack();

  // ── Display days ───────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const displayDays = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const mStart = startOfMonth(currentDate);
    const mEnd = endOfMonth(currentDate);
    return eachDayOfInterval({ start: mStart, end: mEnd });
  }, [currentDate, viewMode, weekStart]);

  const isMonth = viewMode === 'month';

  // ── Holidays ───────────────────────────────────────────────
  const holidays = useMemo(() => {
    const years = new Set(displayDays.map(d => d.getFullYear()));
    const all = new Map<string, string>();
    years.forEach(y => getGermanHolidays(y).forEach((v, k) => all.set(k, v)));
    return all;
  }, [displayDays]);

  // ── Conflicts (from extracted hook) ────────────────────────
  const { employeeConflicts, totalConflictCount } = useConflicts(
    employees, projects, vacations, displayDays
  );

  // ── Color map ──────────────────────────────────────────────
  const projectColorMap = useMemo(() => {
    const map = new Map<string, typeof PROJECT_COLORS[0]>();
    projects.forEach((p, i) => map.set(p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]));
    return map;
  }, [projects]);

  // ── Utilization per employee ───────────────────────────────
  const employeeUtilization = useMemo(() => {
    const result = new Map<string, number>();
    for (const emp of employees) {
      result.set(emp.id, calculateUtilization(projects, vacations, emp.id, displayDays, holidays));
    }
    return result;
  }, [employees, projects, vacations, displayDays, holidays]);

  // ── KPI data ───────────────────────────────────────────────
  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach(p => {
      p.project_team_assignments?.forEach(a => { if (a.is_active) ids.add(a.employee_id); });
    });
    return ids;
  }, [projects]);

  const vacationTodayCount = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const ids = new Set<string>();
    vacations.forEach(v => { if (today >= v.start_date && today <= v.end_date) ids.add(v.employee_id); });
    return ids.size;
  }, [vacations]);

  // ── Unique positions ───────────────────────────────────────
  const uniquePositions = useMemo(() => {
    const positions = new Set<string>();
    employees.forEach(e => { if (e.position) positions.add(e.position); });
    return Array.from(positions).sort();
  }, [employees]);

  // ── Filtered employees ─────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(emp =>
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term) ||
        (emp.position || '').toLowerCase().includes(term)
      );
    }
    if (filterProjectId !== 'all') {
      const project = projects.find(p => p.id === filterProjectId);
      if (project) {
        const empIds = new Set(project.project_team_assignments?.filter(a => a.is_active).map(a => a.employee_id) || []);
        result = result.filter(e => empIds.has(e.id));
      }
    }
    if (filterPosition !== 'all') result = result.filter(e => e.position === filterPosition);
    if (filterUtilization === 'overloaded') result = result.filter(e => (employeeUtilization.get(e.id) || 0) > 100);
    else if (filterUtilization === 'available') result = result.filter(e => (employeeUtilization.get(e.id) || 0) < 80);
    return result;
  }, [employees, searchTerm, filterProjectId, filterPosition, filterUtilization, projects, employeeUtilization]);

  // ── Navigation ─────────────────────────────────────────────
  const navigatePrevious = () => {
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subDays(currentDate, 7));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const navigateNext = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const formattedDateRange = () => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, dd. MMMM yyyy', { locale: de });
    if (viewMode === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = addDays(s, 6);
      return `${format(s, 'dd. MMM', { locale: de })} – ${format(e, 'dd. MMM yyyy', { locale: de })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: de });
  };

  // ── Open assign dialog helpers ─────────────────────────────
  const openAssignDialog = (prefillEmployeeId?: string, prefillDate?: Date) => {
    setAssignEmployeeId(prefillEmployeeId || '');
    setAssignStartDate(prefillDate ? format(prefillDate, 'yyyy-MM-dd') : '');
    setAssignEndDate('');
    setAssignProjectId('');
    setShowAssignDialog(true);
  };

  const openAssignForProject = (projectId: string) => {
    setAssignProjectId(projectId);
    setAssignEmployeeId('');
    setAssignStartDate('');
    setAssignEndDate('');
    setShowAssignDialog(true);
  };

  // ── Open replan for a project ──────────────────────────────
  const openReplanForProject = (project: PlannerProject) => {
    setReplanProject(project);
    setShowReplan(true);
  };

  // ── Auto-assignment handler (from original) ────────────────
  const handleAutoAssign = async (project: PlannerProject) => {
    const team = project.project_team_assignments?.filter(a => a.is_active && !a.start_date) || [];
    if (team.length === 0) return;
    const startDate = project.work_start_date || project.start_date || format(new Date(), 'yyyy-MM-dd');
    const endDate = project.work_end_date || project.end_date || null;
    try {
      for (const member of team) {
        await supabase
          .from('project_team_assignments')
          .update({ start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
          .eq('project_id', project.id)
          .eq('employee_id', member.employee_id);
      }
      toast({ title: 'Auto-Planung', description: `${team.length} Mitarbeiter für "${project.name}" eingeplant.` });
      invalidateAll();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    }
  };

  // ── Grid helpers ───────────────────────────────────────────
  const gridStyle: React.CSSProperties = isMonth
    ? { display: 'grid', gridTemplateColumns: `repeat(${displayDays.length}, minmax(0, 1fr))` }
    : {};
  const gridClass = isMonth ? '' : (viewMode === 'day' ? 'grid grid-cols-1' : 'grid grid-cols-7');

  // ── Drag-drop handlers ─────────────────────────────────────
  // Copy handleDragStart, handleDragOver, handleDrop, handleDragEnd from original
  // PlannerModuleV2.tsx lines 694-801, replacing `loadData()` with `invalidateAll()`
  // and using `pushUndo()` instead of `undoStackRef`.

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header — NEW: Added "Team zuweisen" and "Kapazität prüfen" buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ressourcenplanung</h1>
          <p className="text-sm text-slate-500 mt-1">Verwalten Sie Personal, Fahrzeuge und Geräte für Ihre Projekte.</p>
        </div>
        <div className="flex items-center gap-2">
          {undoCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleUndo} className="text-slate-600">
              <Undo2 className="h-4 w-4 mr-1" /> Rückgängig
              <kbd className="ml-1.5 text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-400">Ctrl+Z</kbd>
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowCapacityCheck(true)}>
            <BarChart3 className="h-4 w-4 mr-2" /> Kapazität prüfen
          </Button>
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={() => setShowBulkAssign(true)}>
            <Users className="h-4 w-4 mr-2" /> Team zuweisen
          </Button>
          <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => openAssignDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Neuer Eintrag
          </Button>
        </div>
      </div>

      {/* KPI Row — extracted component */}
      <PlannerKPICards
        projectCount={projects.length}
        assignedCount={assignedEmployeeIds.size}
        freeCount={Math.max(0, employees.length - assignedEmployeeIds.size)}
        vacationTodayCount={vacationTodayCount}
        conflictCount={totalConflictCount}
        isLoading={isLoading}
      />

      {/* Banners — extracted component */}
      <PlannerBanners
        projects={projects}
        employees={filteredEmployees}
        currentDate={currentDate}
        onAutoAssign={handleAutoAssign}
        onOpenAssignForProject={openAssignForProject}
        onOpenAssignDialog={openAssignDialog}
      />

      {/* Main content: Sidebar + Calendar Grid */}
      {/* Copy the sidebar (lines 928-1098 of original) and calendar grid (lines 1098-1335) */}
      {/* from PlannerModuleV2.tsx. Replace references: */}
      {/*   - `loadData()` → `invalidateAll()` */}
      {/*   - `getEmployeeDayAssignments(empId, day)` → `getEmployeeDayAssignments(projects, empId, day)` */}
      {/*   - `getAbsence(empId, day)` → `getAbsence(vacations, empId, day)` */}
      {/*   - `getCalendarEventsForDay(empId, day)` → `getCalendarEventsForDay(calendarEvents, empId, day)` */}
      {/*   - Undo: `undoStackRef.current.push(...)` → `pushUndo(...)` */}
      {/*   - Add context menu "Team umplanen" on project bars: `openReplanForProject(project)` */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* LEFT SIDEBAR — copy from original lines 929-1098 */}
        {/* ... search, project filter, position filter, utilization filter, employee list, legend ... */}

        {/* CALENDAR GRID — copy from original lines 1098-1335 */}
        {/* Includes: navigation bar, view tabs, day headers, employee rows */}
        {/* For each project bar, add a tooltip action: */}
        {/*   <button onClick={() => openReplanForProject(project)}>Team umplanen</button> */}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}
      <SingleAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        employees={employees}
        projects={projects}
        vacations={vacations}
        prefillEmployeeId={assignEmployeeId}
        prefillProjectId={assignProjectId}
        prefillStartDate={assignStartDate}
        prefillEndDate={assignEndDate}
        onSuccess={invalidateAll}
        pushUndo={pushUndo}
      />

      <BulkAssignDialog
        open={showBulkAssign}
        onOpenChange={setShowBulkAssign}
        employees={employees}
        projects={projects}
        vacations={vacations}
        onSuccess={invalidateAll}
      />

      <ReplanDialog
        open={showReplan}
        onOpenChange={setShowReplan}
        sourceProject={replanProject}
        employees={employees}
        projects={projects}
        vacations={vacations}
        onSuccess={invalidateAll}
      />

      <CapacityCheckDialog
        open={showCapacityCheck}
        onOpenChange={setShowCapacityCheck}
        employees={employees}
        projects={projects}
        vacations={vacations}
        onOpenBulkAssign={() => setShowBulkAssign(true)}
      />
    </div>
  );
}
```

**Critical implementation notes for the agent:**
1. Copy sidebar JSX (original lines 929-1098) into the `{/* LEFT SIDEBAR */}` placeholder
2. Copy calendar grid + employee rows (original lines 1098-1335 + 1357-1653) into the `{/* CALENDAR GRID */}` placeholder
3. Replace all `loadData()` calls with `invalidateAll()`
4. Replace `getEmployeeDayAssignments(empId, day)` → `getEmployeeDayAssignments(projects, empId, day)` (now takes projects as first arg)
5. Replace `getAbsence(empId, day)` → `getAbsence(vacations, empId, day)` (now takes vacations as first arg)
6. Replace `getCalendarEventsForDay(empId, day)` → `getCalendarEventsForDay(calendarEvents, empId, day)`
7. Replace `undoStackRef.current.push(entry)` → `pushUndo(entry)`
8. Copy drag-drop handlers (original lines 694-801) with same replacements
9. On each project assignment bar tooltip, add: `<button onClick={() => openReplanForProject(project)} className="text-xs text-blue-600 hover:underline">Team umplanen</button>`

- [ ] **Step 2: Replace PlannerModuleV2.tsx with re-export**

Replace the entire content of `src/components/PlannerModuleV2.tsx` with:

```typescript
// Re-export from new planner module for backwards compatibility
export { PlannerPage as default } from './planner/PlannerPage';
```

This ensures `IndexV2.tsx` keeps working without changes since it imports the default export.

- [ ] **Step 3: Verify the app compiles and loads**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty 2>&1 | tail -5`
Then check browser at http://localhost:8080 → navigate to Planer.

- [ ] **Step 4: Smoke test all existing features**

Verify in browser:
- Calendar renders with day/week/month views
- Employee rows show with utilization bars
- Drag-drop works in week view
- Single assignment dialog opens and saves
- KPI cards show correct numbers
- Banners appear for unplanned/unstaffed/idle

- [ ] **Step 5: Test new features**

Verify in browser:
- "Team zuweisen" button opens BulkAssignDialog
- Multi-select employees and assign to project works
- "Kapazität prüfen" opens CapacityCheckDialog with week bars
- Right-click or context action on project bar opens ReplanDialog

- [ ] **Step 6: Commit**

```bash
git add src/components/planner/PlannerPage.tsx src/components/PlannerModuleV2.tsx
git commit -m "feat(planner): assemble PlannerPage with bulk-assign, replan, and capacity-check"
```

---

## Task 10: Final cleanup and integration test

**Files:**
- Verify: All files in `src/components/planner/`
- Verify: `src/components/PlannerModuleV2.tsx` (re-export)

- [ ] **Step 1: Run TypeScript check**

Run: `cd C:/Users/filip/HandwerkOS && npx tsc --noEmit --pretty`
Expected: No new errors introduced.

- [ ] **Step 2: Run linter**

Run: `cd C:/Users/filip/HandwerkOS && npm run lint 2>&1 | tail -20`
Fix any lint errors in new files.

- [ ] **Step 3: Run existing tests**

Run: `cd C:/Users/filip/HandwerkOS && npm run test -- --run 2>&1 | tail -20`
Expected: No test regressions.

- [ ] **Step 4: Full integration smoke test**

Open http://localhost:8080 and test all planner scenarios:

1. Navigate to Planer
2. Switch between Tag/Woche/Monat views
3. Click "+ Neuer Eintrag" → assign a single employee
4. Click "Team zuweisen" → select project → check multiple employees → assign
5. Click "Kapazität prüfen" → enter date range → verify week bars
6. Drag an assignment bar to different date
7. Drag assignment to different employee
8. Ctrl+Z to undo
9. Test auto-assignment banners
10. Test filters (search, project, position, utilization)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(planner): complete Einsatzplaner refactoring with bulk-assign, replan, and capacity-check

Phase 1: Refactored monolithic PlannerModuleV2 (1655 lines) into focused subcomponents
Phase 2: Added BulkAssignDialog for multi-employee project assignment
Phase 3: Added ReplanDialog and CapacityCheckDialog for team reallocation and resource planning"
```
