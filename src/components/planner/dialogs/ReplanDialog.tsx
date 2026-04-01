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