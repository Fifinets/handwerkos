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
    const emp = employees.find(e => e.id === a.employee_id);
    const otherProjects = allProjects.filter(p => p.id !== project.id);
    // Check every day in the shifted range
    let current = new Date(newStart);
    while (current <= newEnd) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        const empAssignments = getEmployeeDayAssignments(otherProjects, a.employee_id, current);
        if (empAssignments.length > 0) {
          conflicts.push(`${emp?.first_name} ${emp?.last_name} am ${format(current, 'dd.MM.')}: ${empAssignments[0].project.name}`);
        }
      }
      current = addDays(current, 1);
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
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        toast({ title: 'Teilweise Fehler', description: `${errors.length} Zuweisungen fehlgeschlagen.`, variant: 'destructive' });
      }

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