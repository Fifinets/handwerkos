import React, { useState, useMemo, useCallback, DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar as CalendarIcon, Users, Briefcase, Plus, ChevronLeft, ChevronRight,
  Search, Palmtree, X, AlertTriangle, Eye, Zap, Undo2, BarChart3,
  ArrowRight, CalendarClock, Settings, Truck, Gauge, Wrench,
} from "lucide-react";
import {
  addDays, addMonths, format, startOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, subDays, subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Extracted modules
import type { PlannerProject, PlannerEmployee, Assignment, DragPayload, ViewMode, UtilizationFilter } from './types';
import { PROJECT_COLORS, VACATION_COLOR, SICK_COLOR } from './constants';
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
import { ProjectShiftDialog } from './dialogs/ProjectShiftDialog';
import { CapacityCheckDialog } from './dialogs/CapacityCheckDialog';

export function PlannerPage() {
  const { toast } = useToast();

  // ── Data from React Query ──────────────────────────────────
  const {
    employees, projects, vacations, calendarEvents,
    devices, equipmentAssignments,
    isLoading, invalidateAll, companyId,
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

  // ── Dialog state (NEW) ────────────────────────────────────
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignProjectId, setBulkAssignProjectId] = useState('');
  const [showReplan, setShowReplan] = useState(false);
  const [replanProject, setReplanProject] = useState<PlannerProject | null>(null);
  const [showProjectShift, setShowProjectShift] = useState(false);
  const [shiftProject, setShiftProject] = useState<PlannerProject | null>(null);
  const [showCapacityCheck, setShowCapacityCheck] = useState(false);

  // ── Drag & drop state ──────────────────────────────────────
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<{ employeeId: string; date: string } | null>(null);

  // ── Hooks ──────────────────────────────────────────────────
  const { push: pushUndo, undo: handleUndo, count: undoCount } = useUndoStack(invalidateAll);

  // ── Display days ───────────────────────────────────────────
  const displayDays = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    const mStart = startOfMonth(currentDate);
    const mEnd = endOfMonth(currentDate);
    return eachDayOfInterval({ start: mStart, end: mEnd });
  }, [currentDate, viewMode]);

  const isMonth = viewMode === 'month';

  // ── Holidays ───────────────────────────────────────────────
  const holidays = useMemo(() => {
    const years = new Set(displayDays.map(d => d.getFullYear()));
    const all = new Map<string, string>();
    years.forEach(y => getGermanHolidays(y).forEach((v, k) => all.set(k, v)));
    return all;
  }, [displayDays]);

  // ── Conflicts (from extracted hook) ────────────────────────
  const { conflicts: employeeConflicts, totalCount: totalConflictCount } = useConflicts(
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

  const equipmentInUse = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const activeDeviceIds = new Set<string>();
    equipmentAssignments.forEach(a => {
      if (!a.is_active) return;
      const start = a.start_date || '';
      const end = a.end_date || '9999-12-31';
      if (today >= start && today <= end) activeDeviceIds.add(a.device_id);
    });
    return activeDeviceIds.size;
  }, [equipmentAssignments]);

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

  // ── Banner data ────────────────────────────────────────────
  const unplannedProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.status !== 'in_bearbeitung' && p.status !== 'beauftragt') return false;
      const team = p.project_team_assignments?.filter(a => a.is_active) || [];
      if (team.length === 0) return false;
      return team.some(a => !a.start_date);
    });
  }, [projects]);

  const unstaffedProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.status === 'abgeschlossen' || p.status === 'storniert') return false;
      const team = p.project_team_assignments?.filter(a => a.is_active) || [];
      return team.length === 0;
    });
  }, [projects]);

  const idleEmployees = useMemo(() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = addDays(ws, 6);
    return filteredEmployees.filter(emp => {
      const hasAssignment = projects.some(p =>
        p.project_team_assignments?.some(a =>
          a.employee_id === emp.id && a.is_active && a.start_date &&
          new Date(a.start_date) <= weekEnd &&
          (!a.end_date || new Date(a.end_date) >= ws)
        )
      );
      return !hasAssignment;
    });
  }, [filteredEmployees, projects, currentDate]);

  // ── Sick employees on active projects ─────────────────────
  const sickOnActiveProject = useMemo(() => {
    const today = new Date();
    const results: { employee: PlannerEmployee; project: PlannerProject }[] = [];
    for (const emp of employees) {
      const absence = getAbsence(vacations, emp.id, today);
      if (absence !== 'sick') continue;
      // Find active project assignments for this employee
      for (const proj of projects) {
        const hasActive = proj.project_team_assignments?.some(a =>
          a.employee_id === emp.id && a.is_active
        );
        if (hasActive) {
          results.push({ employee: emp, project: proj });
          break; // one banner per employee
        }
      }
    }
    return results;
  }, [employees, vacations, projects]);

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
    setAssignProjectId('');
    setShowAssignDialog(true);
  };

  const openAssignForProject = (projectId: string) => {
    setAssignProjectId(projectId);
    setAssignEmployeeId('');
    setAssignStartDate('');
    setShowAssignDialog(true);
  };

  // ── Auto-assignment handler ────────────────────────────────
  const handleAutoAssign = async (project: PlannerProject) => {
    const team = project.project_team_assignments?.filter(a => a.is_active && !a.start_date) || [];
    if (team.length === 0) return;
    const startDate = project.work_start_date || project.start_date || format(new Date(), 'yyyy-MM-dd');
    const endDate = project.work_end_date || project.end_date || null;
    try {
      for (const member of team) {
        const { error } = await supabase
          .from('project_team_assignments')
          .update({ start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
          .eq('project_id', project.id)
          .eq('employee_id', member.employee_id);
        if (error) throw error;
      }
      toast({ title: 'Auto-Planung', description: `${team.length} Mitarbeiter für "${project.name}" eingeplant.` });
      invalidateAll();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    }
  };

  // ── Remove assignment ──────────────────────────────────────
  const handleRemoveAssignment = async (projectId: string, employeeId: string) => {
    if (!confirm('Zuweisung entfernen?')) return;
    const { error } = await supabase
      .from('project_team_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('employee_id', employeeId);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      pushUndo({
        description: 'Zuweisung entfernt',
        revert: async () => {
          await supabase.from('project_team_assignments')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('project_id', projectId).eq('employee_id', employeeId);
        },
      });
      toast({ title: 'Zuweisung entfernt' });
      invalidateAll();
    }
  };

  // ── Grid helpers ───────────────────────────────────────────
  const gridStyle: React.CSSProperties = isMonth
    ? { display: 'grid', gridTemplateColumns: `repeat(${displayDays.length}, minmax(0, 1fr))` }
    : {};
  const gridClass = isMonth ? '' : (viewMode === 'day' ? 'grid grid-cols-1' : 'grid grid-cols-7');

  // ── Drag-drop handlers ─────────────────────────────────────
  const handleDragStart = useCallback((e: DragEvent, payload: DragPayload) => {
    setDragPayload(payload);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: DragEvent) => {
    setDragPayload(null);
    setDropTarget(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent, employeeId: string, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ employeeId, date });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent, targetEmployeeId: string, targetDate: string) => {
    e.preventDefault();
    setDropTarget(null);
    const payload = dragPayload;
    setDragPayload(null);
    if (!payload) return;

    const { projectId, employeeId: sourceEmployeeId, originDate, assignmentStartDate, assignmentEndDate } = payload;
    const originMs = new Date(originDate).getTime();
    const targetMs = new Date(targetDate).getTime();
    const shiftDays = Math.round((targetMs - originMs) / (1000 * 60 * 60 * 24));

    if (shiftDays === 0 && sourceEmployeeId === targetEmployeeId) return;

    const newStart = format(addDays(new Date(assignmentStartDate), shiftDays), 'yyyy-MM-dd');
    const newEnd = assignmentEndDate
      ? format(addDays(new Date(assignmentEndDate), shiftDays), 'yyyy-MM-dd')
      : null;

    try {
      if (sourceEmployeeId === targetEmployeeId) {
        await supabase
          .from('project_team_assignments')
          .update({ start_date: newStart, end_date: newEnd, updated_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('employee_id', sourceEmployeeId)
          .eq('is_active', true);
      } else {
        await supabase
          .from('project_team_assignments')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('employee_id', sourceEmployeeId)
          .eq('is_active', true);

        const { data: existing } = await supabase
          .from('project_team_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('employee_id', targetEmployeeId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('project_team_assignments')
            .update({ start_date: newStart, end_date: newEnd, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('project_team_assignments')
            .insert({ project_id: projectId, employee_id: targetEmployeeId, start_date: newStart, end_date: newEnd, is_active: true, role: 'team_member' });
        }
      }

      pushUndo({
        description: 'Zuweisung verschoben',
        revert: async () => {
          if (sourceEmployeeId === targetEmployeeId) {
            await supabase.from('project_team_assignments')
              .update({ start_date: assignmentStartDate, end_date: assignmentEndDate, updated_at: new Date().toISOString() })
              .eq('project_id', projectId).eq('employee_id', sourceEmployeeId).eq('is_active', true);
          } else {
            await supabase.from('project_team_assignments')
              .update({ is_active: true, start_date: assignmentStartDate, end_date: assignmentEndDate, updated_at: new Date().toISOString() })
              .eq('project_id', projectId).eq('employee_id', sourceEmployeeId);
            await supabase.from('project_team_assignments')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('project_id', projectId).eq('employee_id', targetEmployeeId).eq('is_active', true);
          }
        },
      });

      toast({ title: 'Zuweisung verschoben' });
      invalidateAll();
    } catch (err: any) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    }
  }, [dragPayload, invalidateAll, toast, pushUndo]);

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
            onClick={() => { setBulkAssignProjectId(''); setShowBulkAssign(true); }}>
            <Users className="h-4 w-4 mr-2" /> Team zuweisen
          </Button>
          <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => openAssignDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Neuer Eintrag
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <PlannerKPICards
        projectCount={projects.length}
        assignedCount={assignedEmployeeIds.size}
        freeCount={Math.max(0, employees.length - assignedEmployeeIds.size)}
        vacationTodayCount={vacationTodayCount}
        totalConflicts={totalConflictCount}
        equipmentInUse={equipmentInUse}
        isLoading={isLoading}
      />

      {/* Banners */}
      <PlannerBanners
        unplannedProjects={unplannedProjects}
        unstaffedProjects={unstaffedProjects}
        idleEmployees={idleEmployees}
        onAutoAssign={handleAutoAssign}
        onAssignForProject={openAssignForProject}
        onAssignEmployee={(empId) => openAssignDialog(empId)}
      />

      {/* Sick replacement banner */}
      {sickOnActiveProject.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {sickOnActiveProject.length} Mitarbeiter krank auf aktivem Projekt
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sickOnActiveProject.map(({ employee, project }) => (
                  <Button key={employee.id} variant="outline" size="sm"
                    className="bg-white border-red-300 text-red-800 hover:bg-red-100 text-xs h-7"
                    onClick={() => {
                      setReplanProject(project);
                      setShowReplan(true);
                    }}>
                    <Users className="h-3 w-3 mr-1" />
                    Ersatz für {employee.first_name} ({project.name})
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Sidebar */}
        <div className="xl:w-64 space-y-6 flex-shrink-0">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-800">Filter</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input placeholder="Name, Position..." className="pl-8 bg-slate-50 border-slate-200 text-sm h-9"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Projekt</label>
                <Select value={filterProjectId} onValueChange={setFilterProjectId}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Alle Projekte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Projekte</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {uniquePositions.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Position</label>
                  <Select value={filterPosition} onValueChange={setFilterPosition}>
                    <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Alle Positionen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Positionen</SelectItem>
                      {uniquePositions.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Auslastung</label>
                <div className="flex gap-1">
                  {([['all', 'Alle'], ['available', 'Frei'], ['overloaded', 'Voll']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFilterUtilization(key)}
                      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        filterUtilization === key
                          ? key === 'overloaded' ? 'bg-red-100 text-red-700 border border-red-300'
                          : key === 'available' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                          : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {(filterProjectId !== 'all' || filterPosition !== 'all' || filterUtilization !== 'all' || searchTerm) && (
                <button
                  onClick={() => { setFilterProjectId('all'); setFilterPosition('all'); setFilterUtilization('all'); setSearchTerm(''); }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  Filter zurücksetzen
                </button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">Mitarbeiter</CardTitle>
              <Badge variant="outline" className="text-xs font-normal text-slate-500">{employees.length}</Badge>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-y-auto">
              <div className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="space-y-1.5 flex-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-16" /></div>
                    </div>
                  ))
                ) : employees.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 text-center">Keine aktiven Mitarbeiter.</div>
                ) : (
                  employees.map(emp => {
                    const isAssigned = assignedEmployeeIds.has(emp.id);
                    const onVac = getAbsence(vacations, emp.id, new Date());
                    const util = employeeUtilization.get(emp.id) || 0;
                    const hasConflict = employeeConflicts.has(emp.id);
                    return (
                      <div key={emp.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                        onClick={() => openAssignDialog(emp.id)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="truncate">
                            <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1">
                              {emp.first_name} {emp.last_name}
                              {hasConflict && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                            </div>
                            <div className="text-xs text-slate-500 truncate">{emp.position || '—'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] font-medium ${util > 100 ? 'text-red-600' : util >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {util}%
                          </span>
                          {onVac === 'vacation' && <Palmtree className="h-3.5 w-3.5 text-amber-500" />}
                          {onVac === 'sick' && <div className="h-3.5 w-3.5 rounded-full bg-red-400 flex items-center justify-center text-[8px] text-white font-bold">K</div>}
                          <div className={`h-2 w-2 rounded-full ${isAssigned ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          {projects.length > 0 && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-800">Legende</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1.5">
                {projects.map(p => {
                  const color = projectColorMap.get(p.id) || PROJECT_COLORS[0];
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className={`h-3.5 w-3.5 rounded-sm ${color.bg} border-l-[3px] ${color.border} flex-shrink-0`} />
                      <span className="text-xs text-slate-700 truncate">{p.name}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                  <div className={`h-3.5 w-3.5 rounded-sm ${VACATION_COLOR.bg} border-l-[3px] ${VACATION_COLOR.border} flex-shrink-0`} />
                  <span className="text-xs text-slate-700">Urlaub</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-3.5 w-3.5 rounded-sm ${SICK_COLOR.bg} border-l-[3px] ${SICK_COLOR.border} flex-shrink-0`} />
                  <span className="text-xs text-slate-700">Krank</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-sky-200 border border-dashed border-sky-400 flex-shrink-0" />
                  <span className="text-xs text-slate-700">Besichtigung</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-rose-100 border border-rose-300 flex-shrink-0" />
                  <span className="text-xs text-slate-700">Feiertag</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Calendar */}
        <div className="flex-1 space-y-4 min-w-0">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={navigatePrevious} className="h-8 w-8 p-0 bg-white"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 bg-white font-medium text-slate-700">Heute</Button>
                <Button variant="outline" size="sm" onClick={navigateNext} className="h-8 w-8 p-0 bg-white"><ChevronRight className="h-4 w-4" /></Button>
                <span className="ml-2 font-medium text-slate-800 text-sm sm:text-base">{formattedDateRange()}</span>
              </div>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full sm:w-auto">
                <TabsList className="bg-slate-100/50 p-1 border border-slate-200 h-9 w-full sm:w-auto">
                  <TabsTrigger value="day" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Tag</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Woche</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Monat</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="p-0 min-h-[600px] overflow-x-auto">
              <div className="flex flex-col bg-slate-50/50" style={{ minWidth: isMonth ? `${displayDays.length * 36}px` : undefined }}>
                {/* Day Header Row */}
                <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
                  <div className="w-48 flex-shrink-0 border-r border-slate-200 p-3 font-medium text-sm text-slate-500 bg-slate-50/50">
                    Mitarbeiter
                  </div>
                  <div className={`flex-1 ${gridClass} divide-x divide-slate-100 bg-white`} style={gridStyle}>
                    {displayDays.map((day, i) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const isToday = dayStr === format(new Date(), 'yyyy-MM-dd');
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const holiday = holidays.get(dayStr);
                      return (
                        <TooltipProvider key={i} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`p-1.5 text-center font-medium ${isMonth ? 'text-[10px]' : 'text-xs'} ${
                                holiday ? 'text-rose-600 bg-rose-50' :
                                isToday ? 'bg-blue-50' :
                                isWeekend ? 'text-slate-400 bg-slate-50/60' :
                                'text-slate-500'
                              }`}>
                                {isMonth ? (
                                  <>
                                    <div className="flex justify-center">
                                      <span className={isToday ? 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold' : ''}>
                                        {format(day, 'dd')}
                                      </span>
                                    </div>
                                    <div className={`text-[8px] opacity-70 ${isToday ? 'text-blue-600' : ''}`}>{format(day, 'EE', { locale: de })}</div>
                                  </>
                                ) : (
                                  <>
                                    <div className={isToday ? 'text-blue-500 font-semibold' : ''}>{format(day, 'EEE', { locale: de })}</div>
                                    <div className="flex justify-center mt-0.5">
                                      <span className={isToday ? 'inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-[11px] font-bold' : ''}>
                                        {format(day, 'dd.MM', { locale: de })}
                                      </span>
                                    </div>
                                    {holiday && <div className="text-[9px] text-rose-500 font-normal truncate">{holiday}</div>}
                                  </>
                                )}
                              </div>
                            </TooltipTrigger>
                            {holiday && (
                              <TooltipContent side="bottom" className="text-xs">
                                <p className="font-semibold text-rose-600">{holiday}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>

                {/* Employee Rows */}
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="flex border-b border-slate-100 bg-white">
                      <div className="w-48 flex-shrink-0 border-r border-slate-200 p-3 flex flex-col justify-center gap-1.5">
                        <Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" />
                      </div>
                      <div className={`flex-1 ${gridClass} divide-x divide-slate-100 min-h-[64px]`} style={gridStyle}>
                        {displayDays.map((_, i) => (
                          <div key={i} className="p-1">{idx % 2 === 0 && i < 3 && <Skeleton className="h-5 w-full rounded" />}</div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                    {employees.length === 0 ? 'Keine aktiven Mitarbeiter.' : 'Keine Ergebnisse.'}
                  </div>
                ) : (
                  filteredEmployees.map(emp => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      displayDays={displayDays}
                      projects={projects}
                      vacations={vacations}
                      calendarEvents={calendarEvents}
                      projectColorMap={projectColorMap}
                      gridClass={gridClass}
                      gridStyle={gridStyle}
                      isMonth={isMonth}
                      holidays={holidays}
                      conflicts={employeeConflicts.get(emp.id)}
                      utilization={employeeUtilization.get(emp.id) || 0}
                      dropTarget={dropTarget}
                      isDragging={!!dragPayload}
                      onCellClick={(day) => openAssignDialog(emp.id, day)}
                      onRemoveAssignment={handleRemoveAssignment}
                      onReplanProject={(project) => { setReplanProject(project); setShowReplan(true); }}
                      onShiftProject={(project) => { setShiftProject(project); setShowProjectShift(true); }}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    />
                  ))
                )}

                {/* Equipment Section */}
                {devices.length > 0 && (
                  <>
                    <div className="flex border-b-2 border-slate-300 bg-slate-100 sticky top-0 z-10">
                      <div className="w-48 flex-shrink-0 border-r border-slate-200 p-3 font-semibold text-sm text-slate-700 bg-slate-100 flex items-center gap-2">
                        <Settings className="h-4 w-4" /> Geräte &amp; Fahrzeuge
                      </div>
                      <div className="flex-1" />
                    </div>
                    {devices.map(device => {
                      const assignments = equipmentAssignments.filter(a => a.device_id === device.id);
                      const Icon = device.category === 'fahrzeug' ? Truck : device.category === 'messgeraet' ? Gauge : Wrench;
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
                            {assignments.map(a => {
                              const project = projects.find(p => p.id === a.project_id);
                              if (!project) return null;
                              const color = projectColorMap.get(a.project_id) || PROJECT_COLORS[0];
                              const startStr = a.start_date || (displayDays[0] && format(displayDays[0], 'yyyy-MM-dd'));
                              const endStr = a.end_date || (displayDays[displayDays.length - 1] && format(displayDays[displayDays.length - 1], 'yyyy-MM-dd'));
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <SingleAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        employees={employees}
        projects={projects}
        vacations={vacations}
        companyId={companyId}
        prefillEmployeeId={assignEmployeeId}
        prefillProjectId={assignProjectId}
        prefillDate={assignStartDate}
        onSuccess={invalidateAll}
      />

      <BulkAssignDialog
        open={showBulkAssign}
        onOpenChange={setShowBulkAssign}
        employees={employees}
        projects={projects}
        vacations={vacations}
        onSuccess={invalidateAll}
        prefillProjectId={bulkAssignProjectId}
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

      <ProjectShiftDialog
        open={showProjectShift}
        onOpenChange={setShowProjectShift}
        project={shiftProject}
        allProjects={projects}
        employees={employees}
        onSuccess={invalidateAll}
      />

      <CapacityCheckDialog
        open={showCapacityCheck}
        onOpenChange={setShowCapacityCheck}
        employees={employees}
        projects={projects}
        vacations={vacations}
        onOpenBulkAssign={(projectId) => {
          setBulkAssignProjectId(projectId || '');
          setShowBulkAssign(true);
        }}
      />
    </div>
  );
}

// ── Employee Row (Gantt-bar approach) ─────────────────────────
const EmployeeRow = React.memo(function EmployeeRow({
  employee, displayDays, projects, vacations, calendarEvents,
  projectColorMap, gridClass, gridStyle, isMonth,
  holidays, conflicts, utilization, dropTarget, isDragging,
  onCellClick, onRemoveAssignment, onReplanProject, onShiftProject,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: {
  employee: PlannerEmployee;
  displayDays: Date[];
  projects: PlannerProject[];
  vacations: import('./types').VacationRequest[];
  calendarEvents: import('./types').CalendarEvent[];
  projectColorMap: Map<string, typeof PROJECT_COLORS[0]>;
  gridClass: string;
  gridStyle: React.CSSProperties;
  isMonth: boolean;
  holidays: Map<string, string>;
  conflicts: Set<string> | undefined;
  utilization: number;
  dropTarget: { employeeId: string; date: string } | null;
  isDragging: boolean;
  onCellClick: (day: Date) => void;
  onRemoveAssignment: (projectId: string, employeeId: string) => void;
  onReplanProject: (project: PlannerProject) => void;
  onShiftProject: (project: PlannerProject) => void;
  onDragStart: (e: DragEvent, payload: DragPayload) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent, employeeId: string, date: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, employeeId: string, date: string) => void;
}) {
  const barH = isMonth ? 22 : 30;
  const barGap = 2;
  const numDays = displayDays.length;

  const utilColor = utilization > 100 ? 'bg-red-500' : utilization >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const utilTextColor = utilization > 100 ? 'text-red-600' : utilization >= 80 ? 'text-amber-600' : 'text-emerald-600';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayStrings = useMemo(() => displayDays.map(d => format(d, 'yyyy-MM-dd')), [displayDays]);
  const dayIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    dayStrings.forEach((ds, i) => map.set(ds, i));
    return map;
  }, [dayStrings]);

  // ── Collect project bars ──
  const projectBars = useMemo(() => {
    const seen = new Set<string>();
    const bars: { project: PlannerProject; assignment: Assignment; startCol: number; endCol: number; clipL: boolean; clipR: boolean }[] = [];

    for (let i = 0; i < displayDays.length; i++) {
      for (const { project, assignment } of getEmployeeDayAssignments(projects, employee.id, displayDays[i])) {
        if (seen.has(project.id)) continue;
        seen.add(project.id);

        const sDate = assignment.start_date || project.start_date || null;
        const eDate = assignment.end_date || project.end_date || null;
        const clipL = !sDate || sDate < dayStrings[0];
        const clipR = !eDate || eDate > dayStrings[numDays - 1];
        const effectiveStart = !sDate || sDate < dayStrings[0] ? dayStrings[0] : sDate;
        const effectiveEnd = !eDate || eDate > dayStrings[numDays - 1] ? dayStrings[numDays - 1] : eDate;
        const startCol = dayIndexMap.get(effectiveStart) ?? 0;
        const endCol = dayIndexMap.get(effectiveEnd) ?? numDays - 1;

        bars.push({ project, assignment, startCol, endCol, clipL, clipR });
      }
    }
    bars.sort((a, b) => a.startCol - b.startCol || a.project.id.localeCompare(b.project.id));
    return bars;
  }, [displayDays, projects, employee.id, dayStrings, dayIndexMap, numDays]);

  // ── Collect absence bars ──
  const absenceBars = useMemo(() => {
    const bars: { type: 'vacation' | 'sick'; startCol: number; endCol: number }[] = [];
    let curType: 'vacation' | 'sick' | null = null;
    let blockStart = -1;
    for (let i = 0; i <= displayDays.length; i++) {
      const abs = i < displayDays.length ? getAbsence(vacations, employee.id, displayDays[i]) : null;
      if (abs !== curType) {
        if (curType && blockStart >= 0) bars.push({ type: curType, startCol: blockStart, endCol: i - 1 });
        curType = abs;
        blockStart = abs ? i : -1;
      }
    }
    return bars;
  }, [displayDays, vacations, employee.id]);

  // ── Collect calendar event bars ──
  const calEventBars = useMemo(() => {
    const seen = new Set<string>();
    const bars: { event: import('./types').CalendarEvent; startCol: number; endCol: number }[] = [];
    for (let i = 0; i < displayDays.length; i++) {
      for (const ev of getCalendarEventsForDay(calendarEvents, employee.id, displayDays[i])) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const effectiveStart = ev.start_date < dayStrings[0] ? dayStrings[0] : ev.start_date;
        const effectiveEnd = ev.end_date > dayStrings[numDays - 1] ? dayStrings[numDays - 1] : ev.end_date;
        bars.push({ event: ev, startCol: dayIndexMap.get(effectiveStart) ?? i, endCol: dayIndexMap.get(effectiveEnd) ?? i });
      }
    }
    return bars;
  }, [displayDays, calendarEvents, employee.id, dayStrings, dayIndexMap, numDays]);

  // ── Lane assignment ──
  const { projectLanes, totalLanes } = useMemo(() => {
    const laneEnds: number[] = [];
    const pLanes: number[] = [];
    for (const bar of projectBars) {
      let lane = laneEnds.findIndex(end => end < bar.startCol);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(bar.endCol); }
      else { laneEnds[lane] = bar.endCol; }
      pLanes.push(lane);
    }
    const numProjLanes = laneEnds.length || 0;
    const extra = (absenceBars.length > 0 ? 1 : 0) + (calEventBars.length > 0 ? 1 : 0);
    return { projectLanes: pLanes, totalLanes: numProjLanes + extra };
  }, [projectBars, absenceBars, calEventBars]);

  const absenceLane = projectBars.length > 0 ? Math.max(...projectLanes) + 1 : 0;
  const calLane = absenceLane + (absenceBars.length > 0 ? 1 : 0);
  const contentH = Math.max(totalLanes * (barH + barGap) + barGap, 48);

  return (
    <div className="flex border-b border-slate-100 bg-white group/row hover:bg-slate-50/50">
      <div className="w-48 flex-shrink-0 border-r border-slate-200 p-2.5 flex items-center gap-2.5 bg-white group-hover/row:bg-slate-50/50 transition-colors">
        <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-600">
          {employee.first_name[0]}{employee.last_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800 truncate block">{employee.first_name} {employee.last_name}</span>
          <span className="text-xs text-slate-500 truncate block">{employee.position || '—'}</span>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${utilColor} rounded-full transition-all`} style={{ width: `${Math.min(utilization, 100)}%` }} />
            </div>
            <span className={`text-[10px] font-medium ${utilTextColor} min-w-[28px] text-right`}>{utilization}%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden" style={{ minHeight: contentH }}>
        {/* Background day cells */}
        <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: `repeat(${numDays}, 1fr)` }}>
          {displayDays.map((day, i) => {
            const ds = dayStrings[i];
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = ds === todayStr;
            const holiday = holidays.get(ds);
            const hasConflict = conflicts?.has(ds);
            const isDropHere = dropTarget?.employeeId === employee.id && dropTarget?.date === ds;

            return (
              <div key={i}
                className={`h-full relative ${
                  isDropHere ? '' : isToday ? 'bg-blue-50/60' : holiday ? 'bg-rose-50/50' : isWeekend ? 'bg-slate-50/80' : ''
                } ${i > 0 ? 'border-l border-slate-100' : ''} ${isToday && !isDropHere ? 'border-l border-blue-200' : ''} ${
                  !isDragging ? 'cursor-pointer hover:bg-blue-50/30' : ''
                } ${isDropHere ? 'bg-blue-100/60 ring-2 ring-inset ring-blue-400' : ''}`}
                onClick={!isDragging ? () => onCellClick(day) : undefined}
                onDragOver={isDragging ? (e) => { e.preventDefault(); onDragOver(e, employee.id, ds); } : undefined}
                onDragLeave={isDragging ? onDragLeave : undefined}
                onDrop={isDragging ? (e) => onDrop(e, employee.id, ds) : undefined}
              >
                {hasConflict && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="absolute top-0.5 right-0.5 h-3 w-3 text-red-500 z-20" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-semibold text-red-600">Konflikt</p>
                        <p className="text-slate-500">Doppelbelegung oder Urlaub-Überschneidung</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          })}
        </div>

        {/* Project bars */}
        {projectBars.map((bar, idx) => {
          const lane = projectLanes[idx];
          const color = projectColorMap.get(bar.project.id) || PROJECT_COLORS[0];
          const left = (bar.startCol / numDays) * 100;
          const width = ((bar.endCol - bar.startCol + 1) / numDays) * 100;
          const top = lane * (barH + barGap) + barGap;
          const roundR = bar.clipR ? '' : 'rounded-r-md';

          return (
            <TooltipProvider key={bar.project.id} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    draggable={!isDragging}
                    onDragStart={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = e.clientX - rect.left;
                      const cols = bar.endCol - bar.startCol + 1;
                      const dayOffset = Math.min(Math.floor((relX / rect.width) * cols), cols - 1);
                      const originIdx = bar.startCol + dayOffset;
                      onDragStart(e, {
                        projectId: bar.project.id,
                        employeeId: employee.id,
                        originDate: dayStrings[originIdx],
                        assignmentStartDate: bar.assignment.start_date || bar.project.start_date || dayStrings[bar.startCol],
                        assignmentEndDate: bar.assignment.end_date || bar.project.end_date || null,
                      });
                    }}
                    onDragEnd={onDragEnd}
                    className={`absolute ${color.bg} ${color.text} border-l-[3px] ${color.border} ${roundR} pl-1.5 pr-2 py-0.5 ${isMonth ? 'text-[9px]' : 'text-xs'} font-semibold truncate cursor-grab active:cursor-grabbing shadow-sm group/block z-10 flex items-center`}
                    style={{ left: `${left}%`, width: `${width}%`, top, height: barH, pointerEvents: isDragging ? 'none' : 'auto' }}
                  >
                    {bar.project.name}
                    {!isMonth && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-opacity flex items-center gap-0.5">
                        <button
                          className="bg-black/20 rounded p-0.5"
                          title="Team umplanen"
                          onClick={(e) => { e.stopPropagation(); onReplanProject(bar.project); }}
                        >
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                        <button
                          className="bg-black/20 rounded p-0.5"
                          title="Projekt verschieben"
                          onClick={(e) => { e.stopPropagation(); onShiftProject(bar.project); }}
                        >
                          <CalendarClock className="h-2.5 w-2.5" />
                        </button>
                        <button
                          className="bg-black/20 rounded p-0.5"
                          title="Zuweisung entfernen"
                          onClick={(e) => { e.stopPropagation(); onRemoveAssignment(bar.project.id, employee.id); }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{bar.project.name}</p>
                  {bar.project.location && <p className="text-slate-400">{bar.project.location}</p>}
                  <p className="text-slate-400">
                    {bar.project.start_date && format(new Date(bar.project.start_date), 'dd.MM.yy', { locale: de })} – {bar.project.end_date ? format(new Date(bar.project.end_date), 'dd.MM.yy', { locale: de }) : 'offen'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {/* Absence bars */}
        {absenceBars.map((bar, idx) => {
          const abColor = bar.type === 'sick' ? SICK_COLOR : VACATION_COLOR;
          const label = bar.type === 'sick' ? 'Krank' : 'Urlaub';
          const left = (bar.startCol / numDays) * 100;
          const width = ((bar.endCol - bar.startCol + 1) / numDays) * 100;
          const top = absenceLane * (barH + barGap) + barGap;

          return (
            <TooltipProvider key={`abs-${idx}`} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute ${abColor.bg} ${abColor.text} border-l-[3px] ${abColor.border} rounded-r-md pl-1.5 pr-2 py-0.5 ${isMonth ? 'text-[9px]' : 'text-xs'} font-semibold truncate shadow-sm z-10 flex items-center`}
                    style={{ left: `${left}%`, width: `${width}%`, top, height: barH, pointerEvents: isDragging ? 'none' : 'auto' }}
                  >
                    {isMonth ? label[0] : label}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{label}</p>
                  <p className="text-slate-400">{employee.first_name} {employee.last_name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {/* Calendar event bars */}
        {calEventBars.map(bar => {
          const left = (bar.startCol / numDays) * 100;
          const width = ((bar.endCol - bar.startCol + 1) / numDays) * 100;
          const top = calLane * (barH + barGap) + barGap;

          return (
            <TooltipProvider key={bar.event.id} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute bg-sky-100 border border-dashed border-sky-400 text-sky-700 rounded-sm px-2 py-0.5 text-[10px] font-medium truncate flex items-center gap-1 z-10"
                    style={{ left: `${left}%`, width: `${width}%`, top, height: barH, pointerEvents: isDragging ? 'none' : 'auto' }}
                  >
                    <Eye className="h-2.5 w-2.5 flex-shrink-0" />
                    {!isMonth && bar.event.title}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{bar.event.title}</p>
                  {bar.event.start_time && <p className="text-slate-400">{bar.event.start_time}{bar.event.end_time ? ` – ${bar.event.end_time}` : ''}</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
});

export default PlannerPage;
