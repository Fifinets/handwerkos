// src/components/planner/dialogs/BulkAssignDialog.tsx
import { useState, useMemo, useEffect } from 'react';
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
import type { CalendarEvent, PlannerProject, PlannerEmployee, VacationRequest } from '../types';
import { getAvailableEmployees, getEmployeeConflictsForRange } from '../utils/capacityUtils';
import { getGermanHolidays } from '../holidays';
import {
  buildProjectShiftEventRows,
  calculateShiftMinutes,
  DEFAULT_SHIFT_BREAK_MINUTES,
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
  formatMinutesAsHours,
  getWorkDates,
  PROJECT_SHIFT_EVENT_TYPE,
} from '../utils/shiftUtils';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: PlannerEmployee[];
  projects: PlannerProject[];
  vacations: VacationRequest[];
  calendarEvents?: CalendarEvent[];
  companyId: string | null;
  onSuccess: () => void;
  prefillProjectId?: string;
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  employees,
  projects,
  vacations,
  calendarEvents = [],
  companyId,
  onSuccess,
  prefillProjectId = '',
}: BulkAssignDialogProps) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(prefillProjectId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState(DEFAULT_SHIFT_START);
  const [endTime, setEndTime] = useState(DEFAULT_SHIFT_END);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_SHIFT_BREAK_MINUTES);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [positionFilter, setPositionFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  // Sync prefill when dialog opens
  useEffect(() => {
    if (open) {
      setProjectId(prefillProjectId);
      setStartDate('');
      setEndDate('');
      setStartTime(DEFAULT_SHIFT_START);
      setEndTime(DEFAULT_SHIFT_END);
      setBreakMinutes(DEFAULT_SHIFT_BREAK_MINUTES);
      setSelectedEmployees(new Set());
      setPositionFilter('all');
      setExpandedConflicts(new Set());
      // If project is prefilled, load its dates
      if (prefillProjectId) {
        const proj = projects.find(p => p.id === prefillProjectId);
        if (proj) {
          setStartDate(proj.work_start_date || proj.start_date || '');
          setEndDate(proj.work_end_date || proj.end_date || '');
        }
      }
    }
  }, [open, prefillProjectId, projects]);

  // Auto-fill dates from selected project
  const selectedProject = projects.find(p => p.id === projectId);
  const effectiveStart = startDate || selectedProject?.work_start_date || selectedProject?.start_date || '';
  const effectiveEnd = endDate || selectedProject?.work_end_date || selectedProject?.end_date || effectiveStart;
  const plannedMinutes = calculateShiftMinutes(startTime, endTime, breakMinutes);

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
    return getAvailableEmployees(employees, projects, vacations, effectiveStart, effectiveEnd, holidays, calendarEvents);
  }, [employees, projects, vacations, effectiveStart, effectiveEnd, holidays, calendarEvents]);

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
    if (!companyId) {
      toast({ title: 'Fehler', description: 'Keine Firma zugeordnet.', variant: 'destructive' });
      return;
    }
    if (!effectiveStart || plannedMinutes <= 0) {
      toast({ title: 'Fehler', description: 'Bitte Datum und gültige Arbeitszeit angeben.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (!selectedProject) throw new Error('Projekt nicht gefunden.');
      const workDates = new Set(getWorkDates(effectiveStart, effectiveEnd || effectiveStart));
      if (workDates.size === 0) {
        toast({ title: 'Fehler', description: 'Im gewählten Zeitraum liegt kein Werktag.', variant: 'destructive' });
        return;
      }

      const promises = Array.from(selectedEmployees).map(async (empId) => {
        const { data: existing } = await supabase
          .from('project_team_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('employee_id', empId)
          .maybeSingle();

        if (existing) {
          return supabase.from('project_team_assignments')
            .update({ start_date: null, end_date: null, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          return supabase.from('project_team_assignments')
            .insert({ project_id: projectId, employee_id: empId, start_date: null, end_date: null, is_active: true, role: 'team_member' });
        }
      });

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      const replaceIds = calendarEvents
        .filter(event =>
          event.type === PROJECT_SHIFT_EVENT_TYPE &&
          event.project_id === projectId &&
          event.assigned_employees?.some(empId => selectedEmployees.has(empId)) &&
          workDates.has(event.start_date)
        )
        .map(event => event.id);

      if (replaceIds.length > 0) {
        const { error } = await supabase.from('calendar_events').delete().in('id', replaceIds);
        if (error) throw error;
      }

      const shiftRows = Array.from(selectedEmployees).flatMap(empId =>
        buildProjectShiftEventRows({
          companyId,
          employeeId: empId,
          project: selectedProject,
          startDate: effectiveStart,
          endDate: effectiveEnd || effectiveStart,
          startTime,
          endTime,
          breakMinutes,
        })
      );

      const { error: shiftError } = await supabase.from('calendar_events').insert(shiftRows);
      if (shiftError) throw shiftError;

      if (errors.length > 0) {
        toast({ title: 'Teilweise Fehler', description: `${errors.length} von ${results.length} Zuweisungen fehlgeschlagen.`, variant: 'destructive' });
      } else {
        toast({ title: 'Team geplant', description: `${selectedEmployees.size} Mitarbeiter mit ${formatMinutesAsHours(plannedMinutes)} pro Tag geplant.` });
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
              <Label>Datum von</Label>
              <Input type="date" value={effectiveStart} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Datum bis</Label>
              <Input type="date" value={effectiveEnd} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Von (Uhrzeit)</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bis (Uhrzeit)</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pause (Min.)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={breakMinutes}
                  onChange={e => setBreakMinutes(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>
            <div className="text-xs font-medium text-blue-700">
              Geplant: {formatMinutesAsHours(plannedMinutes)} pro Tag
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
