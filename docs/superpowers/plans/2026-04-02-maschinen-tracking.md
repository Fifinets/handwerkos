# Maschinen-Tracking & Planner-Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded MachineModule stub with real Supabase-backed equipment management and add equipment scheduling to the Einsatzplaner.

**Architecture:** Extend existing `inspection_devices` table with category/condition/hours columns, create new `equipment_assignments` table for project scheduling. MachineModule gets real CRUD via extended `inspectionService`. Planner gets EquipmentRow component below employee rows with drag-drop support.

**Tech Stack:** React 18 + TypeScript, @tanstack/react-query, shadcn/ui, Supabase, date-fns with German locale.

---

## File Structure

### New files to create:
```
src/components/machine/
├── MachineModuleV2.tsx              # Replaces MachineModule.tsx with real data
├── MachineDetailDialog.tsx          # Detail view with assignments + maintenance
└── MachineFormDialog.tsx            # Add/Edit device dialog

src/components/planner/
└── EquipmentRow.tsx                 # Equipment Gantt bar row for planner

src/hooks/
└── useMachineData.ts               # React Query hooks for machine data
```

### Files to modify:
- `src/components/MachineModule.tsx` → Replace with re-export from MachineModuleV2
- `src/components/planner/types.ts` → Add equipment types
- `src/components/planner/constants.ts` → Add equipment color
- `src/components/planner/hooks/usePlannerData.ts` → Add equipment queries
- `src/components/planner/PlannerPage.tsx` → Add equipment section
- `src/components/planner/PlannerKPICards.tsx` → Add equipment KPI
- `src/services/inspectionService.ts` → Add equipment assignment methods
- `src/hooks/useQueryKeys.ts` → Add machine query keys

---

## Task 1: Database migration — extend inspection_devices + create equipment_assignments

**Files:**
- Migration via Supabase MCP

- [ ] **Step 1: Apply migration**

```sql
-- Extend inspection_devices with equipment tracking fields
ALTER TABLE public.inspection_devices
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'werkzeug'
    CHECK (category IN ('werkzeug', 'fahrzeug', 'messgeraet')),
  ADD COLUMN IF NOT EXISTS operating_hours integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'gut'
    CHECK (condition IN ('gut', 'maessig', 'schlecht', 'defekt')),
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS purchase_price decimal(10,2);

-- Equipment assignments table
CREATE TABLE IF NOT EXISTS public.equipment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.inspection_devices(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, project_id)
);

CREATE INDEX IF NOT EXISTS equipment_assignments_device_idx
  ON public.equipment_assignments (device_id, is_active);
CREATE INDEX IF NOT EXISTS equipment_assignments_project_idx
  ON public.equipment_assignments (project_id, is_active);

-- RLS
ALTER TABLE public.equipment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own company equipment assignments"
  ON public.equipment_assignments FOR SELECT
  USING (device_id IN (
    SELECT id FROM public.inspection_devices WHERE company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users manage own company equipment assignments"
  ON public.equipment_assignments FOR ALL
  USING (device_id IN (
    SELECT id FROM public.inspection_devices WHERE company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  ));
```

- [ ] **Step 2: Verify tables**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'inspection_devices' AND column_name IN ('category', 'operating_hours', 'condition');
```
Expected: 3 rows.

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'equipment_assignments';
```
Expected: 1 row.

---

## Task 2: Add query keys and useMachineData hook

**Files:**
- Modify: `src/hooks/useQueryKeys.ts`
- Create: `src/hooks/useMachineData.ts`

- [ ] **Step 1: Add machine query keys**

In `src/hooks/useQueryKeys.ts`, add after the planner keys (line 99):

```typescript
  // Machine/Equipment keys
  machines: ['machines'] as const,
  machine: (id: string) => ['machines', id] as const,
  machineAssignments: (deviceId: string) => ['machines', deviceId, 'assignments'] as const,
```

- [ ] **Step 2: Create useMachineData.ts**

```typescript
// src/hooks/useMachineData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QUERY_KEYS } from '@/hooks/useQueryKeys';

export interface MachineDevice {
  id: string;
  device_name: string;
  device_type: 'anlage' | 'geraet';
  category: 'werkzeug' | 'fahrzeug' | 'messgeraet';
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  current_location: string | null;
  status: 'active' | 'inactive' | 'disposed';
  condition: 'gut' | 'maessig' | 'schlecht' | 'defekt';
  operating_hours: number;
  next_inspection_date: string | null;
  inspection_interval_months: number;
  purchase_date: string | null;
  purchase_price: number | null;
  created_at: string;
}

export interface EquipmentAssignment {
  id: string;
  device_id: string;
  project_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  projects?: { name: string; status: string };
}

export function useMachineData() {
  const { companyId } = useSupabaseAuth();
  const queryClient = useQueryClient();

  const devicesQuery = useQuery({
    queryKey: QUERY_KEYS.machines,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_devices')
        .select('*')
        .eq('company_id', companyId!)
        .neq('status', 'disposed');
      if (error) throw error;
      return (data || []) as MachineDevice[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.machines });
  };

  return {
    devices: devicesQuery.data || [],
    isLoading: devicesQuery.isLoading,
    invalidateAll,
    companyId,
  };
}

export function useDeviceAssignments(deviceId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.machineAssignments(deviceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_assignments')
        .select('*, projects(name, status)')
        .eq('device_id', deviceId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as EquipmentAssignment[];
    },
    enabled: !!deviceId,
  });
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/hooks/useQueryKeys.ts src/hooks/useMachineData.ts
git commit -m "feat(machines): add useMachineData hook and query keys"
```

---

## Task 3: Extend inspectionService with equipment methods

**Files:**
- Modify: `src/services/inspectionService.ts`

- [ ] **Step 1: Add equipment assignment methods**

Add at the end of the InspectionService class (before the closing `}`):

```typescript
  // ── Equipment Assignment Methods ──────────────────────────
  async assignDeviceToProject(deviceId: string, projectId: string, startDate: string | null, endDate: string | null, notes?: string) {
    const { data: existing } = await supabase
      .from('equipment_assignments')
      .select('id')
      .eq('device_id', deviceId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('equipment_assignments')
        .update({ start_date: startDate, end_date: endDate, is_active: true, notes: notes || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('equipment_assignments')
        .insert({ device_id: deviceId, project_id: projectId, start_date: startDate, end_date: endDate, is_active: true, notes: notes || null });
      if (error) throw error;
    }
  }

  async unassignDeviceFromProject(deviceId: string, projectId: string) {
    const { error } = await supabase
      .from('equipment_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .eq('project_id', projectId);
    if (error) throw error;
  }

  async updateDeviceCondition(deviceId: string, condition: string) {
    const { error } = await supabase
      .from('inspection_devices')
      .update({ condition, updated_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (error) throw error;
  }

  async updateOperatingHours(deviceId: string, hours: number) {
    const { error } = await supabase
      .from('inspection_devices')
      .update({ operating_hours: hours, updated_at: new Date().toISOString() })
      .eq('id', deviceId);
    if (error) throw error;
  }
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/services/inspectionService.ts
git commit -m "feat(machines): add equipment assignment methods to inspectionService"
```

---

## Task 4: Create MachineFormDialog

**Files:**
- Create: `src/components/machine/MachineFormDialog.tsx`

- [ ] **Step 1: Create MachineFormDialog.tsx**

```typescript
// src/components/machine/MachineFormDialog.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Truck, Gauge } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MachineDevice } from '@/hooks/useMachineData';

const CATEGORIES = [
  { value: 'werkzeug', label: 'Werkzeug', icon: Wrench },
  { value: 'fahrzeug', label: 'Fahrzeug', icon: Truck },
  { value: 'messgeraet', label: 'Messgerät', icon: Gauge },
] as const;

const CONDITIONS = [
  { value: 'gut', label: 'Gut' },
  { value: 'maessig', label: 'Mäßig' },
  { value: 'schlecht', label: 'Schlecht' },
  { value: 'defekt', label: 'Defekt' },
] as const;

interface MachineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  device?: MachineDevice | null;
  onSuccess: () => void;
}

export function MachineFormDialog({ open, onOpenChange, companyId, device, onSuccess }: MachineFormDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('werkzeug');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState<string>('gut');
  const [operatingHours, setOperatingHours] = useState(0);
  const [inspectionInterval, setInspectionInterval] = useState(12);

  useEffect(() => {
    if (open && device) {
      setName(device.device_name);
      setCategory(device.category || 'werkzeug');
      setManufacturer(device.manufacturer || '');
      setModel(device.model || '');
      setSerialNumber(device.serial_number || '');
      setLocation(device.current_location || device.location || '');
      setCondition(device.condition || 'gut');
      setOperatingHours(device.operating_hours || 0);
      setInspectionInterval(device.inspection_interval_months || 12);
    } else if (open) {
      setName(''); setCategory('werkzeug'); setManufacturer(''); setModel('');
      setSerialNumber(''); setLocation(''); setCondition('gut'); setOperatingHours(0);
      setInspectionInterval(12);
    }
  }, [open, device]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Fehler', description: 'Bitte Gerätename angeben.', variant: 'destructive' });
      return;
    }
    if (!companyId) return;

    setSaving(true);
    try {
      const payload = {
        device_name: name.trim(),
        category,
        manufacturer: manufacturer || null,
        model: model || null,
        serial_number: serialNumber || null,
        current_location: location || null,
        location: location || null,
        condition,
        operating_hours: operatingHours,
        inspection_interval_months: inspectionInterval,
        device_type: category === 'messgeraet' ? 'geraet' : 'geraet' as const,
        updated_at: new Date().toISOString(),
      };

      if (device) {
        const { error } = await supabase.from('inspection_devices').update(payload).eq('id', device.id);
        if (error) throw error;
        toast({ title: 'Gerät aktualisiert' });
      } else {
        const { error } = await supabase.from('inspection_devices').insert({ ...payload, company_id: companyId, status: 'active' });
        if (error) throw error;
        toast({ title: 'Gerät hinzugefügt' });
      }
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
          <DialogTitle>{device ? 'Gerät bearbeiten' : 'Neues Gerät'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Hilti TE 6-A36" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zustand</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hersteller</Label>
              <Input value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="z.B. Hilti" />
            </div>
            <div className="space-y-2">
              <Label>Modell</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder="z.B. TE 6-A36" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seriennummer</Label>
              <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Standort</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="z.B. Lager" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Betriebsstunden</Label>
              <Input type="number" value={operatingHours} onChange={e => setOperatingHours(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Prüfintervall (Monate)</Label>
              <Input type="number" value={inspectionInterval} onChange={e => setInspectionInterval(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? 'Speichern...' : device ? 'Aktualisieren' : 'Hinzufügen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/machine/MachineFormDialog.tsx
git commit -m "feat(machines): add MachineFormDialog for device CRUD"
```

---

## Task 5: Create MachineModuleV2 (replaces stub)

**Files:**
- Create: `src/components/machine/MachineModuleV2.tsx`
- Modify: `src/components/MachineModule.tsx` (re-export)

- [ ] **Step 1: Create MachineModuleV2.tsx**

```typescript
// src/components/machine/MachineModuleV2.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Truck, Gauge, Plus, Search, AlertTriangle, CheckCircle, Clock, Settings } from "lucide-react";
import { useMachineData } from '@/hooks/useMachineData';
import { MachineFormDialog } from './MachineFormDialog';
import type { MachineDevice } from '@/hooks/useMachineData';

const CATEGORY_ICONS: Record<string, any> = { werkzeug: Wrench, fahrzeug: Truck, messgeraet: Gauge };
const CATEGORY_LABELS: Record<string, string> = { werkzeug: 'Werkzeug', fahrzeug: 'Fahrzeug', messgeraet: 'Messgerät' };
const CONDITION_COLORS: Record<string, string> = {
  gut: 'bg-emerald-100 text-emerald-800',
  maessig: 'bg-amber-100 text-amber-800',
  schlecht: 'bg-orange-100 text-orange-800',
  defekt: 'bg-red-100 text-red-800',
};
const CONDITION_LABELS: Record<string, string> = { gut: 'Gut', maessig: 'Mäßig', schlecht: 'Schlecht', defekt: 'Defekt' };

export function MachineModuleV2() {
  const { devices, isLoading, invalidateAll, companyId } = useMachineData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editDevice, setEditDevice] = useState<MachineDevice | null>(null);

  const filtered = useMemo(() => {
    let result = devices;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d =>
        d.device_name.toLowerCase().includes(term) ||
        (d.serial_number || '').toLowerCase().includes(term) ||
        (d.manufacturer || '').toLowerCase().includes(term)
      );
    }
    if (filterCategory !== 'all') result = result.filter(d => d.category === filterCategory);
    if (filterCondition !== 'all') result = result.filter(d => d.condition === filterCondition);
    return result;
  }, [devices, searchTerm, filterCategory, filterCondition]);

  const stats = useMemo(() => {
    const total = devices.length;
    const byCondition = { gut: 0, maessig: 0, schlecht: 0, defekt: 0 };
    const maintenanceDue = devices.filter(d => {
      if (!d.next_inspection_date) return false;
      return new Date(d.next_inspection_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }).length;
    devices.forEach(d => { if (byCondition[d.condition as keyof typeof byCondition] !== undefined) byCondition[d.condition as keyof typeof byCondition]++; });
    return { total, gut: byCondition.gut, maintenanceDue, defekt: byCondition.defekt + byCondition.schlecht };
  }, [devices]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Geräte & Maschinen</h1>
          <p className="text-sm text-slate-500 mt-1">Werkzeuge, Fahrzeuge und Messgeräte verwalten</p>
        </div>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => { setEditDevice(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Gerät hinzufügen
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center"><Settings className="h-5 w-5 text-blue-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.total}</div><div className="text-xs text-slate-500">Gesamt</div></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.gut}</div><div className="text-xs text-slate-500">Einsatzbereit</div></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.maintenanceDue}</div><div className="text-xs text-slate-500">Wartung fällig</div></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : stats.defekt}</div><div className="text-xs text-slate-500">Defekt/Schlecht</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Name, Seriennummer, Hersteller..." className="pl-8 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            <SelectItem value="werkzeug">Werkzeug</SelectItem>
            <SelectItem value="fahrzeug">Fahrzeug</SelectItem>
            <SelectItem value="messgeraet">Messgerät</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCondition} onValueChange={setFilterCondition}>
          <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Zustand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Zustände</SelectItem>
            <SelectItem value="gut">Gut</SelectItem>
            <SelectItem value="maessig">Mäßig</SelectItem>
            <SelectItem value="schlecht">Schlecht</SelectItem>
            <SelectItem value="defekt">Defekt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(device => {
          const Icon = CATEGORY_ICONS[device.category] || Wrench;
          return (
            <Card key={device.id} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setEditDevice(device); setShowForm(true); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{device.device_name}</h3>
                      <p className="text-xs text-slate-500">{CATEGORY_LABELS[device.category] || device.category}</p>
                    </div>
                  </div>
                  <Badge className={CONDITION_COLORS[device.condition] || 'bg-slate-100 text-slate-800'}>
                    {CONDITION_LABELS[device.condition] || device.condition}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>Hersteller: {device.manufacturer || '—'}</div>
                  <div>S/N: {device.serial_number || '—'}</div>
                  <div>Stunden: {device.operating_hours}h</div>
                  <div>Standort: {device.current_location || '—'}</div>
                </div>
                {device.next_inspection_date && (
                  <div className="mt-2 text-xs">
                    {new Date(device.next_inspection_date) < new Date() ? (
                      <span className="text-red-600 font-medium">Prüfung überfällig</span>
                    ) : (
                      <span className="text-slate-500">Nächste Prüfung: {new Date(device.next_inspection_date).toLocaleDateString('de-DE')}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm text-slate-500">
            {devices.length === 0 ? 'Noch keine Geräte angelegt.' : 'Keine Ergebnisse für diesen Filter.'}
          </div>
        )}
      </div>

      <MachineFormDialog open={showForm} onOpenChange={setShowForm} companyId={companyId} device={editDevice} onSuccess={invalidateAll} />
    </div>
  );
}
```

- [ ] **Step 2: Replace MachineModule.tsx with re-export**

Replace entire content of `src/components/MachineModule.tsx` with:

```typescript
export { MachineModuleV2 as default } from './machine/MachineModuleV2';
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/machine/MachineModuleV2.tsx src/components/MachineModule.tsx
git commit -m "feat(machines): replace MachineModule stub with real Supabase CRUD"
```

---

## Task 6: Add equipment types and colors to planner

**Files:**
- Modify: `src/components/planner/types.ts`
- Modify: `src/components/planner/constants.ts`

- [ ] **Step 1: Add equipment types**

In `src/components/planner/types.ts`, add after `CalendarEvent` interface:

```typescript
export interface PlannerDevice {
  id: string;
  device_name: string;
  category: 'werkzeug' | 'fahrzeug' | 'messgeraet';
  condition: string;
  operating_hours: number;
  current_location: string | null;
}

export interface EquipmentAssignment {
  device_id: string;
  project_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}
```

Change `EntryType` to:

```typescript
export type EntryType = 'project' | 'vacation' | 'sick' | 'equipment';
```

- [ ] **Step 2: Add equipment color**

In `src/components/planner/constants.ts`, add after `SICK_COLOR`:

```typescript
export const EQUIPMENT_COLOR = { bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-500', dot: 'bg-slate-500' } as const;
```

Add to `ENTRY_TYPE_STYLES`:

```typescript
  equipment: { active: 'border-slate-500 bg-slate-50 text-slate-700', label: 'Gerät' },
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/planner/types.ts src/components/planner/constants.ts
git commit -m "feat(planner): add equipment types and colors"
```

---

## Task 7: Extend usePlannerData with equipment queries

**Files:**
- Modify: `src/components/planner/hooks/usePlannerData.ts`
- Modify: `src/hooks/useQueryKeys.ts`

- [ ] **Step 1: Add planner equipment query keys**

In `src/hooks/useQueryKeys.ts`, add after `plannerCalendarEvents`:

```typescript
  plannerDevices: (companyId: string) => ['planner', 'devices', companyId] as const,
  plannerEquipmentAssignments: (companyId: string) => ['planner', 'equipment-assignments', companyId] as const,
```

- [ ] **Step 2: Add equipment queries to usePlannerData**

In `src/components/planner/hooks/usePlannerData.ts`, add imports:

```typescript
import type { PlannerProject, PlannerEmployee, VacationRequest, CalendarEvent, PlannerDevice, EquipmentAssignment } from '../types';
```

Add after `calendarEventsQuery`:

```typescript
  const devicesQuery = useQuery({
    queryKey: QUERY_KEYS.plannerDevices(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_devices')
        .select('id, device_name, category, condition, operating_hours, current_location')
        .eq('company_id', companyId!)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as PlannerDevice[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const equipmentAssignmentsQuery = useQuery({
    queryKey: QUERY_KEYS.plannerEquipmentAssignments(companyId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_assignments')
        .select('device_id, project_id, start_date, end_date, is_active')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as EquipmentAssignment[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
```

Add to the return object:

```typescript
    devices: devicesQuery.data || [],
    equipmentAssignments: equipmentAssignmentsQuery.data || [],
```

Add to `isLoading`:

```typescript
    isLoading: employeesQuery.isLoading || projectsQuery.isLoading || vacationsQuery.isLoading || calendarEventsQuery.isLoading || devicesQuery.isLoading,
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/hooks/useQueryKeys.ts src/components/planner/hooks/usePlannerData.ts
git commit -m "feat(planner): add equipment data queries to usePlannerData"
```

---

## Task 8: Add EquipmentRow to PlannerPage

**Files:**
- Modify: `src/components/planner/PlannerPage.tsx`
- Modify: `src/components/planner/PlannerKPICards.tsx`

- [ ] **Step 1: Add equipment KPI card**

In `src/components/planner/PlannerKPICards.tsx`, add `Settings` to lucide imports, add `equipmentInUse: number` to props interface, and add a 6th KPI card after the conflicts card:

```typescript
<KpiCard icon={Settings} iconBg="bg-slate-50" iconColor="text-slate-600"
  value={isLoading ? '—' : equipmentInUse} label="Geräte im Einsatz" />
```

Change grid to `sm:grid-cols-6`.

- [ ] **Step 2: Add equipment section to PlannerPage**

In `src/components/planner/PlannerPage.tsx`, after the employee rows section (after the `filteredEmployees.map(emp => ...)` closing), add an equipment section:

```typescript
{/* Equipment Section Header */}
{devices.length > 0 && (
  <>
    <div className="flex border-b-2 border-slate-300 bg-slate-100 sticky top-0 z-10">
      <div className="w-48 flex-shrink-0 border-r border-slate-200 p-3 font-semibold text-sm text-slate-700 bg-slate-100 flex items-center gap-2">
        <Settings className="h-4 w-4" /> Geräte & Fahrzeuge
      </div>
      <div className="flex-1" />
    </div>
    {devices.map(device => {
      const assignments = equipmentAssignments.filter(a => a.device_id === device.id);
      const Icon = device.category === 'fahrzeug' ? Truck : device.category === 'messgeraet' ? Gauge : Wrench;
      // Render equipment row similar to employee row but simpler
      return (
        <div key={device.id} className="flex border-b border-slate-100 bg-white group/row hover:bg-slate-50/50">
          <div className="w-48 flex-shrink-0 border-r border-slate-200 p-2.5 flex items-center gap-2.5 bg-white">
            <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs bg-slate-100 text-slate-600">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-800 truncate block">{device.device_name}</span>
              <span className="text-xs text-slate-500 truncate block">{device.current_location || '—'}</span>
            </div>
          </div>
          {/* Equipment bars - reuse project color map */}
          <div className="flex-1 relative" style={{ minHeight: 48 }}>
            <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: `repeat(${displayDays.length}, 1fr)` }}>
              {displayDays.map((day, i) => {
                const ds = format(day, 'yyyy-MM-dd');
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isToday = ds === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div key={i} className={`h-full ${isToday ? 'bg-blue-50/60' : isWeekend ? 'bg-slate-50/80' : ''} ${i > 0 ? 'border-l border-slate-100' : ''}`} />
                );
              })}
            </div>
            {/* Equipment assignment bars */}
            {assignments.map(a => {
              const project = projects.find(p => p.id === a.project_id);
              if (!project) return null;
              const color = projectColorMap.get(a.project_id) || PROJECT_COLORS[0];
              const startStr = a.start_date || displayDays[0] && format(displayDays[0], 'yyyy-MM-dd');
              const endStr = a.end_date || displayDays[displayDays.length - 1] && format(displayDays[displayDays.length - 1], 'yyyy-MM-dd');
              const startIdx = displayDays.findIndex(d => format(d, 'yyyy-MM-dd') >= (startStr || ''));
              const endIdx = displayDays.findIndex(d => format(d, 'yyyy-MM-dd') > (endStr || ''));
              const effectiveStart = Math.max(0, startIdx === -1 ? 0 : startIdx);
              const effectiveEnd = endIdx === -1 ? displayDays.length - 1 : endIdx - 1;
              if (effectiveEnd < effectiveStart) return null;
              const left = (effectiveStart / displayDays.length) * 100;
              const width = ((effectiveEnd - effectiveStart + 1) / displayDays.length) * 100;
              return (
                <div key={a.project_id}
                  className={`absolute ${color.bg} ${color.text} border-l-[3px] ${color.border} rounded-r-md pl-1.5 pr-2 py-0.5 text-xs font-semibold truncate shadow-sm z-10 flex items-center`}
                  style={{ left: `${left}%`, width: `${width}%`, top: 4, height: 26 }}>
                  {project.name}
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </>
)}
```

Add `Settings, Truck, Gauge` to lucide imports. Add `devices` and `equipmentAssignments` from `usePlannerData`.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/planner/PlannerPage.tsx src/components/planner/PlannerKPICards.tsx
git commit -m "feat(planner): add equipment section with Gantt bars"
```
