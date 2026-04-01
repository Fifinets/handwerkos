// src/components/planner/dialogs/SingleAssignDialog.tsx
import { useState, useEffect } from 'react';
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

  // Sync prefill when dialog opens with new props
  useEffect(() => {
    if (open) {
      setEntryType('project');
      setEmployeeId(prefillEmployeeId);
      setProjectId(prefillProjectId);
      setStartDate(prefillDate || format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
    }
  }, [open, prefillEmployeeId, prefillProjectId, prefillDate]);

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
    if (!companyId) {
      toast({ title: 'Fehler', description: 'Keine Firma zugeordnet.', variant: 'destructive' });
      return;
    }
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
