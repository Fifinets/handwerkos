# Workflow-Termine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add appointment scheduling to the project workflow pipeline — Besichtigung gets date/time/employee, In Arbeit gets start/end dates, both display under the workflow bar and as editable cards in the Details tab.

**Architecture:** New columns on `projects` table for appointments. A single `WorkflowStatusDialog` handles all status transitions with contextual appointment fields. The existing workflow bar gains a date annotation row. Calendar events auto-sync for Besichtigung via a FK on `projects`.

**Tech Stack:** React 18, TypeScript, Supabase (PostgREST), shadcn/ui, Tailwind CSS, date-fns (de locale)

**Spec:** `docs/superpowers/specs/2026-03-22-workflow-termine-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260322100000_workflow_termine.sql` | Create | DB migration: new columns + data migration |
| `src/types/project.ts` | Modify | Update `ProjectStatus`, `PROJECT_STATUS_CONFIG`, add `WORKFLOW_STAGES` |
| `src/types/core.ts` | Modify | Note: Zod schema already includes new statuses, no change needed |
| `src/components/WorkflowStatusDialog.tsx` | Create | Status change dialog with contextual appointment fields |
| `src/components/ProjectDetailView.tsx` | Modify | Enhanced workflow bar + Termine section in Details tab |
| `src/components/ProjectModuleV2.tsx` | Modify | Update status filter/color/counts references |
| `src/components/projects/StatusList.tsx` | Modify | Update `StatusCounts` type |
| `src/components/projects/ProjectRow.tsx` | Modify | Update hardcoded status type |
| `src/services/WorkflowService.ts` | Modify | Replace `geplant`/`in_planung` references |
| `src/services/projectService.ts` | Modify | Replace `geplant` references |
| `src/services/projectKPIService.ts` | Modify | Replace `geplant` status weight |
| `src/components/AddProjectDialog.tsx` | Modify | Simplify status options |
| `src/components/AddOrderDialog.tsx` | Modify | Replace `in_planung` status |
| `src/components/ExecutiveDashboardV2.tsx` | Modify | Replace `geplant` filter |
| `src/components/ReportsModuleV2.tsx` | Modify | Replace `in_planung`/`abnahme` mappings |
| `src/components/ProjectDetailDialogWithTasks.tsx` | Modify | Replace `geplant` references |
| `src/components/delivery-notes/DeliveryNoteForm.tsx` | Modify | Replace `geplant` query filter |
| `src/components/mobile/TodayScreen.tsx` | Modify | Replace `geplant` display |
| `src/utils/emailTemplates.ts` | Modify | Replace `geplant` color mapping |
| `src/components/emails/CustomerProjectDialog.tsx` | Modify | Replace `geplant` status |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260322100000_workflow_termine.sql`

- [x] **Step 1: Write the migration file**

```sql
-- 1. New appointment columns on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS besichtigung_date DATE,
  ADD COLUMN IF NOT EXISTS besichtigung_time_start TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_time_end TIME,
  ADD COLUMN IF NOT EXISTS besichtigung_employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS besichtigung_calendar_event_id UUID,
  ADD COLUMN IF NOT EXISTS work_start_date DATE,
  ADD COLUMN IF NOT EXISTS work_end_date DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Link calendar_events to projects
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- 3. FK for besichtigung_calendar_event_id (after calendar_events.project_id exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_besichtigung_calendar_event_id_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_besichtigung_calendar_event_id_fkey
      FOREIGN KEY (besichtigung_calendar_event_id) REFERENCES calendar_events(id);
  END IF;
END $$;

-- 4. Migrate status data: geplant → beauftragt
UPDATE projects SET status = 'beauftragt' WHERE status = 'geplant';
UPDATE projects SET status = 'in_bearbeitung' WHERE status = 'in_planung';
UPDATE projects SET status = 'abgeschlossen' WHERE status = 'abnahme';

-- 5. Back-fill completed_at for existing completed projects
UPDATE projects SET completed_at = updated_at WHERE status = 'abgeschlossen' AND completed_at IS NULL;

-- 6. Index for calendar event project lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON calendar_events(project_id);
```

- [x] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applied successfully.

- [x] **Step 3: Regenerate Supabase types**

Run: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`
Expected: Updated types file with new columns on `projects` and `calendar_events`.

- [x] **Step 4: Commit**

```bash
git add supabase/migrations/20260322100000_workflow_termine.sql src/integrations/supabase/types.ts
git commit -m "feat: add workflow-termine DB columns and migrate geplant status"
```

---

### Task 2: Update Type Definitions

**Files:**
- Modify: `src/types/project.ts` (lines 6, 298-346)
- Modify: `src/types/core.ts` (lines 137-141)

- [x] **Step 1: Update ProjectStatus type**

In `src/types/project.ts` line 6, replace:
```typescript
export type ProjectStatus = 'anfrage' | 'besichtigung' | 'geplant' | 'in_bearbeitung' | 'abgeschlossen';
```
With:
```typescript
export type ProjectStatus = 'anfrage' | 'besichtigung' | 'angebot' | 'beauftragt' | 'in_bearbeitung' | 'abgeschlossen';

export const WORKFLOW_STAGES: ProjectStatus[] = [
  'anfrage', 'besichtigung', 'angebot', 'beauftragt', 'in_bearbeitung', 'abgeschlossen'
];
```

- [x] **Step 2: Update PROJECT_STATUS_CONFIG**

Replace the entire `PROJECT_STATUS_CONFIG` (lines 298-346) with:

```typescript
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}> = {
  anfrage: {
    label: 'Anfrage',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: '📋',
    description: 'Projekt-Anfrage eingegangen',
  },
  besichtigung: {
    label: 'Besichtigung',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: '🔍',
    description: 'Besichtigungstermin vereinbaren',
  },
  angebot: {
    label: 'Angebot',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: '📄',
    description: 'Angebot erstellen und versenden',
  },
  beauftragt: {
    label: 'Beauftragt',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: '✅',
    description: 'Auftrag erteilt',
  },
  in_bearbeitung: {
    label: 'In Arbeit',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: '🔨',
    description: 'Projekt läuft aktiv',
  },
  abgeschlossen: {
    label: 'Fertig',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: '🏁',
    description: 'Projekt ist abgeschlossen',
  },
};
```

Note: `nextStates` removed — `WORKFLOW_STAGES` defines the linear order.

- [x] **Step 3: Update Zod schema in core.ts**

In `src/types/core.ts`, the `ProjectCreateSchema` status enum already includes `angebot`, `beauftragt` etc. No change needed to the Zod schema.

- [x] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Compilation errors in files that reference `geplant` (to be fixed in subsequent tasks).

- [x] **Step 5: Commit**

```bash
git add src/types/project.ts src/types/core.ts
git commit -m "feat: update ProjectStatus type to 6-stage workflow"
```

---

### Task 3: Update Status References Across Codebase

This task replaces all `geplant`, `in_planung`, and `abnahme` references. The DB migration already moved the data — this updates the code.

**Status mapping:**
- `geplant` → `beauftragt`
- `in_planung` → `in_bearbeitung` (or `beauftragt` where it means "assigned")
- `abnahme` → `abgeschlossen`

**Files:**
- Modify: `src/components/ProjectModuleV2.tsx`
- Modify: `src/components/projects/StatusList.tsx`
- Modify: `src/components/projects/ProjectRow.tsx`
- Modify: `src/services/WorkflowService.ts`
- Modify: `src/services/projectService.ts`
- Modify: `src/services/projectKPIService.ts`
- Modify: `src/components/AddProjectDialog.tsx`
- Modify: `src/components/AddOrderDialog.tsx`
- Modify: `src/components/ExecutiveDashboardV2.tsx`
- Modify: `src/components/ReportsModuleV2.tsx`
- Modify: `src/components/ProjectDetailDialogWithTasks.tsx`
- Modify: `src/components/delivery-notes/DeliveryNoteForm.tsx`
- Modify: `src/components/mobile/TodayScreen.tsx`
- Modify: `src/components/emails/CustomerProjectDialog.tsx`
- Modify: `src/utils/emailTemplates.ts`
- Modify: `src/components/ProjectDetailView.tsx`

- [x] **Step 1: Fix ProjectModuleV2 — status colors, counts, filters**

In `src/components/ProjectModuleV2.tsx`:

a) In `getStatusColor`: remove `case 'geplant':` and `case 'in_planung':` (both fall through to indigo — `beauftragt` already has purple, which is correct). Remove `case 'abnahme':` (data migrated to `abgeschlossen`).

b) Update `statusCounts` object: replace `geplant: number` with `angebot: number` and `beauftragt: number`. Remove `in_planung` and `abnahme` if present.

c) Update status filter dropdown: remove `geplant`, `in_planung`, `abnahme` options. Ensure `angebot` and `beauftragt` are present.

- [x] **Step 2: Fix StatusList type**

In `src/components/projects/StatusList.tsx`, update `StatusCounts`:
```typescript
export type StatusCounts = {
  anfrage: number;
  besichtigung: number;
  angebot: number;
  beauftragt: number;
  in_bearbeitung: number;
  abgeschlossen: number;
};
```

- [x] **Step 3: Fix ProjectRow type**

In `src/components/projects/ProjectRow.tsx`, update the hardcoded status type (line ~9):
Replace `"anfrage" | "besichtigung" | "geplant" | "in_bearbeitung" | "abgeschlossen"` with:
```typescript
import { ProjectStatus } from '@/types/project';
// Then use ProjectStatus instead of the inline union
```

- [x] **Step 4: Fix WorkflowService**

In `src/services/WorkflowService.ts`:
- `status: 'geplant'` → `status: 'beauftragt'`
- `.in('status', ['geplant', 'in_bearbeitung'])` → `.in('status', ['angebot', 'beauftragt', 'in_bearbeitung'])`

- [x] **Step 5: Fix projectService and projectKPIService**

In `src/services/projectService.ts`: replace all `'geplant'` → `'beauftragt'`.
In `src/services/projectKPIService.ts`: replace `'geplant'` status weight → `'beauftragt'`.

- [x] **Step 6: Simplify AddProjectDialog status options**

In `src/components/AddProjectDialog.tsx`, replace the Select options:
```typescript
<SelectItem value="anfrage">Anfrage</SelectItem>
<SelectItem value="besichtigung">Besichtigung</SelectItem>
<SelectItem value="angebot">Angebot</SelectItem>
<SelectItem value="beauftragt">Beauftragt</SelectItem>
<SelectItem value="in_bearbeitung">In Arbeit</SelectItem>
<SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
<SelectItem value="storniert">Storniert</SelectItem>
```

- [x] **Step 7: Fix AddOrderDialog**

In `src/components/AddOrderDialog.tsx`: replace `'in_planung'` → `'beauftragt'`.

- [x] **Step 8: Fix remaining components**

Apply the same `geplant` → `beauftragt`, `in_planung` → `in_bearbeitung`, `abnahme` → `abgeschlossen` mapping in:
- `src/components/ExecutiveDashboardV2.tsx` — status filter
- `src/components/ReportsModuleV2.tsx` — status mappings
- `src/components/ProjectDetailDialogWithTasks.tsx` — status references
- `src/components/delivery-notes/DeliveryNoteForm.tsx` — query filter
- `src/components/mobile/TodayScreen.tsx` — status display
- `src/components/emails/CustomerProjectDialog.tsx` — status setting
- `src/utils/emailTemplates.ts` — status color mapping
- `src/components/ProjectDetailView.tsx` — fallback config lookup (change `PROJECT_STATUS_CONFIG.geplant` fallback to `PROJECT_STATUS_CONFIG.anfrage`)

- [x] **Step 9: Search for any remaining references**

Run: `grep -rn "geplant\|in_planung\|abnahme" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "\.d\.ts"`
Fix any remaining references. Note: `src/types/core.ts` Zod schema intentionally keeps all values for backward compatibility.

- [x] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [x] **Step 11: Commit**

```bash
git add src/
git commit -m "refactor: replace geplant/in_planung/abnahme with 6-stage workflow across codebase"
```

---

### Task 4: Create WorkflowStatusDialog

**Files:**
- Create: `src/components/WorkflowStatusDialog.tsx`

- [x] **Step 1: Create the dialog component**

```typescript
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import { PROJECT_STATUS_CONFIG, type ProjectStatus } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkflowStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  companyId: string;
  // Status change mode
  targetStatus?: ProjectStatus;
  // Edit appointment mode (no status change)
  editMode?: 'besichtigung' | 'in_bearbeitung';
  // Current values for pre-filling
  currentValues?: {
    besichtigung_date?: string | null;
    besichtigung_time_start?: string | null;
    besichtigung_time_end?: string | null;
    besichtigung_employee_id?: string | null;
    besichtigung_calendar_event_id?: string | null;
    work_start_date?: string | null;
    work_end_date?: string | null;
  };
  employees: { id: string; first_name: string; last_name: string }[];
  onSuccess: () => void;
}

export function WorkflowStatusDialog({
  open, onOpenChange, projectId, projectName, companyId,
  targetStatus, editMode, currentValues, employees, onSuccess,
}: WorkflowStatusDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Besichtigung fields
  const [besichtigungDate, setBesichtigungDate] = useState('');
  const [besichtigungTimeStart, setBesichtigungTimeStart] = useState('');
  const [besichtigungTimeEnd, setBesichtigungTimeEnd] = useState('');
  const [besichtigungEmployeeId, setBesichtigungEmployeeId] = useState('');

  // In Arbeit fields
  const [workStartDate, setWorkStartDate] = useState('');
  const [workEndDate, setWorkEndDate] = useState('');

  const activeStage = editMode || targetStatus;
  const showBesichtigung = activeStage === 'besichtigung';
  const showInArbeit = activeStage === 'in_bearbeitung';
  const showConfirmOnly = activeStage === 'angebot' || activeStage === 'beauftragt' || activeStage === 'anfrage';
  const showFertig = activeStage === 'abgeschlossen';

  // Pre-fill from current values
  useEffect(() => {
    if (open && currentValues) {
      setBesichtigungDate(currentValues.besichtigung_date || '');
      setBesichtigungTimeStart(currentValues.besichtigung_time_start || '');
      setBesichtigungTimeEnd(currentValues.besichtigung_time_end || '');
      setBesichtigungEmployeeId(currentValues.besichtigung_employee_id || '');
      setWorkStartDate(currentValues.work_start_date || '');
      setWorkEndDate(currentValues.work_end_date || '');
    } else if (open) {
      setBesichtigungDate('');
      setBesichtigungTimeStart('');
      setBesichtigungTimeEnd('');
      setBesichtigungEmployeeId('');
      setWorkStartDate('');
      setWorkEndDate('');
    }
  }, [open, currentValues]);

  const getTitle = () => {
    if (editMode === 'besichtigung') return 'Besichtigungstermin bearbeiten';
    if (editMode === 'in_bearbeitung') return 'Baustart bearbeiten';
    if (!targetStatus) return '';
    const config = PROJECT_STATUS_CONFIG[targetStatus];
    return `Status: ${config.icon} ${config.label}`;
  };

  const canSave = () => {
    if (showBesichtigung && !editMode) {
      return !!besichtigungDate && !!besichtigungTimeStart && !!besichtigungEmployeeId;
    }
    if (showInArbeit && !editMode) {
      return !!workStartDate;
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};

      // Status change (not in edit mode)
      if (targetStatus && !editMode) {
        updates.status = targetStatus;
        if (targetStatus === 'abgeschlossen') {
          updates.completed_at = new Date().toISOString();
        }
      }

      // Besichtigung appointment
      if (showBesichtigung) {
        updates.besichtigung_date = besichtigungDate || null;
        updates.besichtigung_time_start = besichtigungTimeStart || null;
        updates.besichtigung_time_end = besichtigungTimeEnd || null;
        updates.besichtigung_employee_id = besichtigungEmployeeId || null;

        // Calendar event sync
        if (besichtigungDate) {
          const calendarData = {
            title: `Besichtigung: ${projectName}`,
            start_date: besichtigungDate,
            end_date: besichtigungDate,
            start_time: besichtigungTimeStart || null,
            end_time: besichtigungTimeEnd || null,
            type: 'besichtigung',
            company_id: companyId,
            project_id: projectId,
            assigned_employees: besichtigungEmployeeId ? [besichtigungEmployeeId] : [],
          };

          const existingEventId = currentValues?.besichtigung_calendar_event_id;
          if (existingEventId) {
            await supabase.from('calendar_events').update(calendarData).eq('id', existingEventId);
          } else {
            const { data: newEvent } = await supabase
              .from('calendar_events')
              .insert(calendarData)
              .select('id')
              .single();
            if (newEvent) {
              updates.besichtigung_calendar_event_id = newEvent.id;
            }
          }
        } else if (currentValues?.besichtigung_calendar_event_id) {
          // Date removed → delete calendar event
          await supabase.from('calendar_events').delete().eq('id', currentValues.besichtigung_calendar_event_id);
          updates.besichtigung_calendar_event_id = null;
        }
      }

      // In Arbeit dates
      if (showInArbeit) {
        updates.work_start_date = workStartDate || null;
        updates.work_end_date = workEndDate || null;
      }

      // Update project
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;

      const msg = editMode
        ? 'Termin gespeichert'
        : `Status zu "${PROJECT_STATUS_CONFIG[targetStatus!].label}" geändert`;
      toast({ title: 'Erfolg', description: msg });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message || 'Speichern fehlgeschlagen', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAppointment = async () => {
    if (!targetStatus) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: targetStatus })
        .eq('id', projectId);
      if (error) throw error;
      toast({ title: 'Erfolg', description: `Status zu "${PROJECT_STATUS_CONFIG[targetStatus].label}" geändert` });
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
          <DialogTitle className="text-lg">{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Besichtigung fields */}
          {showBesichtigung && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  Datum {!editMode && '*'}
                </Label>
                <Input type="date" value={besichtigungDate} onChange={e => setBesichtigungDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Von {!editMode && '*'}
                  </Label>
                  <Input type="time" value={besichtigungTimeStart} onChange={e => setBesichtigungTimeStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bis</Label>
                  <Input type="time" value={besichtigungTimeEnd} onChange={e => setBesichtigungTimeEnd(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Mitarbeiter {!editMode && '*'}
                </Label>
                <Select value={besichtigungEmployeeId} onValueChange={setBesichtigungEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!editMode && (
                <button onClick={handleSkipAppointment} className="text-xs text-slate-400 hover:text-blue-500 transition-colors">
                  Ohne Termin fortfahren →
                </button>
              )}
            </>
          )}

          {/* In Arbeit fields */}
          {showInArbeit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  Baustart {!editMode && '*'}
                </Label>
                <Input type="date" value={workStartDate} onChange={e => setWorkStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Geplantes Ende</Label>
                <Input type="date" value={workEndDate} onChange={e => setWorkEndDate(e.target.value)} />
              </div>
            </div>
          )}

          {/* Simple confirmation */}
          {showConfirmOnly && !editMode && (
            <p className="text-sm text-slate-600">
              Status zu <strong>{PROJECT_STATUS_CONFIG[targetStatus!]?.label}</strong> ändern?
            </p>
          )}

          {/* Fertig confirmation */}
          {showFertig && !editMode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              Projekt als abgeschlossen markieren? Das Abschlussdatum wird automatisch gesetzt.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving || !canSave()}>
            {saving ? 'Speichern...' : editMode ? 'Speichern' : 'Bestätigen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [x] **Step 3: Commit**

```bash
git add src/components/WorkflowStatusDialog.tsx
git commit -m "feat: add WorkflowStatusDialog with contextual appointment fields"
```

---

### Task 5: Enhance Workflow Bar in ProjectDetailView

**Files:**
- Modify: `src/components/ProjectDetailView.tsx` (lines 983-1006 and 1105-1143)

- [x] **Step 1: Add imports and state for dialog**

At the top of `ProjectDetailView.tsx`, add or verify these imports:
```typescript
import { WorkflowStatusDialog } from './WorkflowStatusDialog';
import { WORKFLOW_STAGES } from '@/types/project';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar as CalendarIcon, User } from 'lucide-react';
```
Note: `format`, `de`, `CalendarIcon`, and `User` may already be imported in this file. Only add what's missing — do not duplicate imports.

Add state near other state declarations:
```typescript
const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
const [workflowTargetStatus, setWorkflowTargetStatus] = useState<ProjectStatus | undefined>();
const [workflowEditMode, setWorkflowEditMode] = useState<'besichtigung' | 'in_bearbeitung' | undefined>();
const [allEmployees, setAllEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
```

Load employees in `loadProject` function (add to Promise.all):
```typescript
const { data: empData } = await supabase
  .from('employees')
  .select('id, first_name, last_name')
  .eq('company_id', profile.company_id)
  .not('status', 'in', '("Inaktiv","Gekündigt")');
if (empData) setAllEmployees(empData);
```

- [x] **Step 2: Replace handleStatusChange with dialog opener**

Replace the existing `handleStatusChange` function (lines 983-1006):

```typescript
const handleStatusChange = (newStatus: string) => {
  if (!project || !permissions.can_change_status) return;
  setWorkflowTargetStatus(newStatus as ProjectStatus);
  setWorkflowEditMode(undefined);
  setWorkflowDialogOpen(true);
};

const handleEditAppointment = (mode: 'besichtigung' | 'in_bearbeitung') => {
  setWorkflowTargetStatus(undefined);
  setWorkflowEditMode(mode);
  setWorkflowDialogOpen(true);
};
```

- [x] **Step 3: Update the workflow bar render with date annotations**

Replace the workflow bar section (lines 1105-1143). The new version uses `WORKFLOW_STAGES` and adds a date row:

```typescript
{project.project_type !== 'kleinauftrag' && (() => {
  const stages = WORKFLOW_STAGES.map(key => ({
    key,
    label: PROJECT_STATUS_CONFIG[key].label,
    icon: PROJECT_STATUS_CONFIG[key].icon,
  }));
  const statusKey = project.status === 'angebot_versendet' ? 'angebot' : project.status;
  const currentIdx = stages.findIndex(s => s.key === statusKey);

  const getDateAnnotation = (stageKey: string) => {
    switch (stageKey) {
      case 'anfrage': return project.created_at ? format(new Date(project.created_at), 'dd.MM.', { locale: de }) : null;
      case 'besichtigung': {
        if (!project.besichtigung_date) return null;
        const d = format(new Date(project.besichtigung_date), 'dd.MM.', { locale: de });
        const t = project.besichtigung_time_start ? ` ${project.besichtigung_time_start.slice(0, 5)}` : '';
        return d + t;
      }
      case 'in_bearbeitung': return project.work_start_date ? format(new Date(project.work_start_date), 'dd.MM.', { locale: de }) : null;
      case 'abgeschlossen': return project.completed_at ? format(new Date(project.completed_at), 'dd.MM.', { locale: de }) : null;
      default: return null;
    }
  };

  const getEmployeeName = () => {
    if (!project.besichtigung_employee_id) return null;
    const emp = allEmployees.find(e => e.id === project.besichtigung_employee_id);
    return emp ? `${emp.first_name.charAt(0)}. ${emp.last_name}` : null;
  };

  return (
    <div className="mb-4">
      {/* Status Bar */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200">
        {stages.map((stage, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;
          return (
            <button
              key={stage.key}
              onClick={() => permissions.can_change_status && handleStatusChange(stage.key)}
              disabled={!permissions.can_change_status}
              className={`flex-1 py-2 text-xs sm:text-sm font-medium text-center transition-all ${
                isPast ? 'bg-emerald-500 text-white' :
                isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1' :
                'bg-slate-100 text-slate-500 hover:bg-slate-200'
              } ${permissions.can_change_status ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="hidden sm:inline">{stage.label}</span>
              <span className="sm:hidden">{stage.icon}</span>
            </button>
          );
        })}
      </div>
      {/* Date Annotations */}
      <div className="hidden sm:flex mt-1">
        {stages.map(stage => {
          const date = getDateAnnotation(stage.key);
          const empName = stage.key === 'besichtigung' ? getEmployeeName() : null;
          return (
            <div key={stage.key} className="flex-1 text-center">
              <div className="text-[10px] text-slate-400 leading-tight">{date || '—'}</div>
              {empName && <div className="text-[10px] text-slate-400 leading-tight">{empName}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
})()}
```

- [x] **Step 4: Add the dialog component at the bottom of the return**

Before the closing `</div>` of the main component return, add:

```typescript
{project && (
  <WorkflowStatusDialog
    open={workflowDialogOpen}
    onOpenChange={setWorkflowDialogOpen}
    projectId={project.id}
    projectName={project.project_name}
    companyId={project.company_id}
    targetStatus={workflowTargetStatus}
    editMode={workflowEditMode}
    currentValues={{
      besichtigung_date: project.besichtigung_date,
      besichtigung_time_start: project.besichtigung_time_start,
      besichtigung_time_end: project.besichtigung_time_end,
      besichtigung_employee_id: project.besichtigung_employee_id,
      besichtigung_calendar_event_id: project.besichtigung_calendar_event_id,
      work_start_date: project.work_start_date,
      work_end_date: project.work_end_date,
    }}
    employees={allEmployees}
    onSuccess={loadProject}
  />
)}
```

- [x] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May need adjustments for project property names. Fix any type mismatches.

- [x] **Step 6: Commit**

```bash
git add src/components/ProjectDetailView.tsx
git commit -m "feat: enhance workflow bar with date annotations and dialog integration"
```

---

### Task 6: Add Termine Section to Details Tab

**Files:**
- Modify: `src/components/ProjectDetailView.tsx` (after line 1675, inside Details tab)

- [x] **Step 1: Add Termine cards after Kundeninformationen**

After the closing `</div>` of the grid (line 1676), before the closing `</TabsContent>`:

```typescript
{/* Termine Section */}
<div className="mt-5">
  <h3 className="text-sm font-semibold text-slate-700 mb-3">Termine</h3>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* Besichtigung Card */}
    {project.besichtigung_date ? (
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-sm font-semibold text-slate-900">Besichtigung</span>
            </div>
            <button
              onClick={() => handleEditAppointment('besichtigung')}
              className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              Bearbeiten
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
              {format(new Date(project.besichtigung_date), 'dd. MMMM yyyy', { locale: de })}
              {project.besichtigung_time_start && (
                <span>, {project.besichtigung_time_start.slice(0, 5)}{project.besichtigung_time_end ? ` – ${project.besichtigung_time_end.slice(0, 5)}` : ''}</span>
              )}
            </div>
            {project.besichtigung_employee_id && (() => {
              const emp = allEmployees.find(e => e.id === project.besichtigung_employee_id);
              return emp ? (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {emp.first_name} {emp.last_name}
                </div>
              ) : null;
            })()}
          </div>
        </CardContent>
      </Card>
    ) : (
      <Card
        className="border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all rounded-xl"
        onClick={() => handleEditAppointment('besichtigung')}
      >
        <CardContent className="p-4 flex flex-col items-center justify-center text-center py-6">
          <CalendarIcon className="h-5 w-5 text-slate-300 mb-1.5" />
          <span className="text-sm font-medium text-slate-500">Besichtigung</span>
          <span className="text-xs text-slate-400">Termin festlegen</span>
        </CardContent>
      </Card>
    )}

    {/* In Arbeit Card */}
    {project.work_start_date ? (
      <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-sm font-semibold text-slate-900">In Arbeit</span>
            </div>
            <button
              onClick={() => handleEditAppointment('in_bearbeitung')}
              className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              Bearbeiten
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
              Baustart: {format(new Date(project.work_start_date), 'dd. MMMM yyyy', { locale: de })}
            </div>
            {project.work_end_date && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                Geplantes Ende: {format(new Date(project.work_end_date), 'dd. MMMM yyyy', { locale: de })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    ) : (
      <Card
        className="border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all rounded-xl"
        onClick={() => handleEditAppointment('in_bearbeitung')}
      >
        <CardContent className="p-4 flex flex-col items-center justify-center text-center py-6">
          <CalendarIcon className="h-5 w-5 text-slate-300 mb-1.5" />
          <span className="text-sm font-medium text-slate-500">In Arbeit</span>
          <span className="text-xs text-slate-400">Baustart festlegen</span>
        </CardContent>
      </Card>
    )}
  </div>
</div>
```

- [x] **Step 2: Ensure imports exist**

Verify that `CalendarIcon` (from lucide-react), `User`, `format`, and `de` locale are imported. Most should already exist in the file.

- [x] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [x] **Step 4: Commit**

```bash
git add src/components/ProjectDetailView.tsx
git commit -m "feat: add Termine section to Details tab with editable appointment cards"
```

---

### Task 7: Manual Smoke Test

- [x] **Step 1: Start dev server**

Run: `npm run dev`

- [x] **Step 2: Test workflow bar**

1. Open a project → verify 6-stage workflow bar shows
2. Click a stage → verify dialog opens
3. For Besichtigung: fill date/time/employee → save → verify date shows under bar
4. For In Arbeit: fill start/end date → save → verify date shows under bar
5. For Angebot/Beauftragt: verify simple confirmation dialog
6. For Fertig: verify completion confirmation

- [x] **Step 3: Test Details tab**

1. Go to Details tab → verify Termine section with 2 cards
2. Click empty card → verify dialog opens for adding appointment
3. Click "Bearbeiten" on filled card → verify dialog opens with pre-filled values
4. Change date → save → verify card updates

- [x] **Step 4: Test calendar event**

1. Set a Besichtigung date → check `calendar_events` table in Supabase for new entry
2. Change Besichtigung date → verify calendar event was updated (not duplicated)

- [x] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: workflow-termine smoke test fixes"
```
