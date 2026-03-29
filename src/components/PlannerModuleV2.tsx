import React, { useState, useEffect, useMemo, useCallback, useRef, DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Calendar as CalendarIcon,
    Users,
    Briefcase,
    Plus,
    ChevronLeft,
    ChevronRight,
    Search,
    Palmtree,
    X,
    AlertTriangle,
    Eye,
    Zap,
    Undo2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    addDays,
    addMonths,
    format,
    startOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    subDays,
    subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useToast } from '@/hooks/use-toast';

// ── Colors ───────────────────────────────────────────────────
const PROJECT_COLORS = [
    { bg: 'bg-blue-500', text: 'text-white', dot: 'bg-blue-500' },
    { bg: 'bg-emerald-500', text: 'text-white', dot: 'bg-emerald-500' },
    { bg: 'bg-orange-500', text: 'text-white', dot: 'bg-orange-500' },
    { bg: 'bg-purple-500', text: 'text-white', dot: 'bg-purple-500' },
    { bg: 'bg-pink-500', text: 'text-white', dot: 'bg-pink-500' },
    { bg: 'bg-teal-500', text: 'text-white', dot: 'bg-teal-500' },
    { bg: 'bg-amber-500', text: 'text-white', dot: 'bg-amber-500' },
    { bg: 'bg-indigo-500', text: 'text-white', dot: 'bg-indigo-500' },
    { bg: 'bg-rose-500', text: 'text-white', dot: 'bg-rose-500' },
    { bg: 'bg-cyan-500', text: 'text-white', dot: 'bg-cyan-500' },
];

const VACATION_COLOR = { bg: 'bg-amber-300', text: 'text-amber-900' };
const SICK_COLOR = { bg: 'bg-red-300', text: 'text-red-900' };

type EntryType = 'project' | 'vacation' | 'sick';

const ENTRY_TYPE_STYLES: Record<EntryType, { active: string; label: string }> = {
    project: { active: 'border-blue-500 bg-blue-50 text-blue-700', label: 'Projekt' },
    vacation: { active: 'border-amber-500 bg-amber-50 text-amber-700', label: 'Urlaub' },
    sick: { active: 'border-red-500 bg-red-50 text-red-700', label: 'Krank' },
};

// ── German Public Holidays ───────────────────────────────────
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

function getGermanHolidays(year: number): Map<string, string> {
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

// ── Types ────────────────────────────────────────────────────
interface Assignment {
    employee_id: string;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    role: string | null;
}

interface Project {
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

interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    position: string | null;
}

interface VacationRequest {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    status: string;
    reason: string | null;
    absence_type: string;
}

interface CalendarEvent {
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

interface DragPayload {
    projectId: string;
    employeeId: string;
    originDate: string;          // day cell the drag started from
    assignmentStartDate: string; // actual assignment start
    assignmentEndDate: string | null;
}

interface UndoEntry {
    description: string;
    revert: () => Promise<void>;
}

// ── Component ────────────────────────────────────────────────
const PlannerModuleV2 = () => {
    const { companyId } = useSupabaseAuth();
    const { toast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
    const [searchTerm, setSearchTerm] = useState('');

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [vacations, setVacations] = useState<VacationRequest[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Assignment dialog state
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [entryType, setEntryType] = useState<EntryType>('project');
    const [assignEmployeeId, setAssignEmployeeId] = useState('');
    const [assignProjectId, setAssignProjectId] = useState('');
    const [assignStartDate, setAssignStartDate] = useState('');
    const [assignEndDate, setAssignEndDate] = useState('');
    const [assignSaving, setAssignSaving] = useState(false);

    // Filter state
    const [filterProjectId, setFilterProjectId] = useState<string>('all');
    const [filterPosition, setFilterPosition] = useState<string>('all');
    const [filterUtilization, setFilterUtilization] = useState<'all' | 'overloaded' | 'available'>('all');

    // Undo stack (ref to avoid stale closures)
    const undoStackRef = useRef<UndoEntry[]>([]);
    const [undoCount, setUndoCount] = useState(0); // for re-render on undo availability

    // Drag & drop state
    const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
    const [dropTarget, setDropTarget] = useState<{ employeeId: string; date: string } | null>(null);

    // ── Data Loading ─────────────────────────────────────────
    const loadData = useCallback(async () => {
        if (!companyId) return;
        setIsLoading(true);
        const [empRes, projRes, vacRes, calRes] = await Promise.all([
            supabase.from('employees')
                .select('id, first_name, last_name, status, position')
                .eq('company_id', companyId)
                .not('status', 'in', '("Inaktiv","Gekündigt")'),
            supabase.from('projects')
                .select('id, name, status, start_date, end_date, location, work_start_date, work_end_date, project_team_assignments(employee_id, is_active, start_date, end_date, role)')
                .eq('company_id', companyId)
                .not('status', 'in', '("abgeschlossen","storniert")'),
            supabase.from('vacation_requests')
                .select('id, employee_id, start_date, end_date, status, reason, absence_type')
                .eq('company_id', companyId)
                .eq('status', 'approved'),
            supabase.from('calendar_events')
                .select('id, title, start_date, end_date, start_time, end_time, type, project_id, assigned_employees')
                .eq('company_id', companyId),
        ]);
        setEmployees(empRes.data || []);
        setProjects((projRes.data || []) as Project[]);
        setVacations(vacRes.data || []);
        setCalendarEvents((calRes.data || []) as CalendarEvent[]);
        setIsLoading(false);
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Undo ─────────────────────────────────────────────────
    const pushUndo = useCallback((entry: UndoEntry) => {
        undoStackRef.current = [...undoStackRef.current, entry];
        setUndoCount(undoStackRef.current.length);
    }, []);

    const handleUndo = useCallback(async () => {
        const entry = undoStackRef.current.pop();
        setUndoCount(undoStackRef.current.length);
        if (!entry) return;
        try {
            await entry.revert();
            toast({ title: 'Rückgängig', description: entry.description });
            loadData();
        } catch (err: any) {
            toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
        }
    }, [toast, loadData]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleUndo]);

    // ── Display Days ─────────────────────────────────────────
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

    const displayDays = useMemo(() => {
        if (viewMode === 'day') return [currentDate];
        if (viewMode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const mStart = startOfMonth(currentDate);
        const mEnd = endOfMonth(currentDate);
        return eachDayOfInterval({ start: mStart, end: mEnd });
    }, [currentDate, viewMode, weekStart]);

    const isMonth = viewMode === 'month';

    // ── Grid helpers ─────────────────────────────────────────
    const gridStyle: React.CSSProperties = isMonth
        ? { display: 'grid', gridTemplateColumns: `repeat(${displayDays.length}, minmax(0, 1fr))` }
        : {};
    const gridClass = isMonth ? '' : (viewMode === 'day' ? 'grid grid-cols-1' : 'grid grid-cols-7');

    // ── Holidays ─────────────────────────────────────────────
    const holidays = useMemo(() => {
        const years = new Set(displayDays.map(d => d.getFullYear()));
        const all = new Map<string, string>();
        years.forEach(y => getGermanHolidays(y).forEach((v, k) => all.set(k, v)));
        return all;
    }, [displayDays]);

    // ── Assignment logic with assignment-specific dates ──────
    const getEmployeeDayAssignments = useCallback((employeeId: string, day: Date) => {
        // No assignments on weekends
        const dow = day.getDay();
        if (dow === 0 || dow === 6) return [];

        const dayStr = format(day, 'yyyy-MM-dd');
        const result: { project: Project; assignment: Assignment }[] = [];

        for (const project of projects) {
            const assignments = project.project_team_assignments?.filter(
                (a) => a.employee_id === employeeId && a.is_active
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
    }, [projects]);

    const getAbsence = useCallback((employeeId: string, day: Date): 'vacation' | 'sick' | null => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const match = vacations.find(v =>
            v.employee_id === employeeId && dayStr >= v.start_date && dayStr <= v.end_date
        );
        if (!match) return null;
        return (match.absence_type === 'sick' ? 'sick' : 'vacation');
    }, [vacations]);

    // ── Calendar events per employee per day ─────────────────
    const getCalendarEventsForDay = useCallback((employeeId: string, day: Date) => {
        const ds = format(day, 'yyyy-MM-dd');
        return calendarEvents.filter(ev => {
            if (ds < ev.start_date || ds > ev.end_date) return false;
            return ev.assigned_employees?.includes(employeeId) ?? false;
        });
    }, [calendarEvents]);

    // ── KPIs ─────────────────────────────────────────────────
    const assignedEmployeeIds = useMemo(() => {
        const ids = new Set<string>();
        projects.forEach(p => {
            p.project_team_assignments?.forEach((a) => {
                if (a.is_active) ids.add(a.employee_id);
            });
        });
        return ids;
    }, [projects]);

    const vacationTodayCount = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const ids = new Set<string>();
        vacations.forEach(v => {
            if (today >= v.start_date && today <= v.end_date) ids.add(v.employee_id);
        });
        return ids.size;
    }, [vacations]);

    const assignedCount = assignedEmployeeIds.size;
    const freeCount = Math.max(0, employees.length - assignedCount);

    // Color map
    const projectColorMap = useMemo(() => {
        const map = new Map<string, typeof PROJECT_COLORS[0]>();
        projects.forEach((p, i) => map.set(p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]));
        return map;
    }, [projects]);

    // ── Utilization per employee ─────────────────────────────
    const employeeUtilization = useMemo(() => {
        const result = new Map<string, number>();
        for (const emp of employees) {
            let workDays = 0, assignedDays = 0;
            for (const day of displayDays) {
                if (day.getDay() === 0 || day.getDay() === 6) continue;
                const ds = format(day, 'yyyy-MM-dd');
                if (holidays.has(ds)) continue;
                workDays++;
                if (getEmployeeDayAssignments(emp.id, day).length > 0) assignedDays++;
            }
            result.set(emp.id, workDays > 0 ? Math.round((assignedDays / workDays) * 100) : 0);
        }
        return result;
    }, [employees, displayDays, holidays, getEmployeeDayAssignments]);

    // ── Conflict detection ───────────────────────────────────
    const employeeConflicts = useMemo(() => {
        const conflicts = new Map<string, Set<string>>();
        for (const emp of employees) {
            const empConflicts = new Set<string>();
            for (const day of displayDays) {
                const ds = format(day, 'yyyy-MM-dd');
                const assignments = getEmployeeDayAssignments(emp.id, day);
                const absence = getAbsence(emp.id, day);
                if (assignments.length > 1 || (assignments.length > 0 && absence)) {
                    empConflicts.add(ds);
                }
            }
            if (empConflicts.size > 0) conflicts.set(emp.id, empConflicts);
        }
        return conflicts;
    }, [employees, displayDays, getEmployeeDayAssignments, getAbsence]);

    const totalConflictCount = useMemo(() => {
        let count = 0;
        employeeConflicts.forEach(dates => count += dates.size);
        return count;
    }, [employeeConflicts]);

    // ── Unique positions for filter ──────────────────────────
    const uniquePositions = useMemo(() => {
        const positions = new Set<string>();
        employees.forEach(e => { if (e.position) positions.add(e.position); });
        return Array.from(positions).sort();
    }, [employees]);

    // ── Enhanced filter ──────────────────────────────────────
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
        if (filterPosition !== 'all') {
            result = result.filter(e => e.position === filterPosition);
        }
        if (filterUtilization === 'overloaded') {
            result = result.filter(e => (employeeUtilization.get(e.id) || 0) > 100);
        } else if (filterUtilization === 'available') {
            result = result.filter(e => (employeeUtilization.get(e.id) || 0) < 80);
        }
        return result;
    }, [employees, searchTerm, filterProjectId, filterPosition, filterUtilization, projects, employeeUtilization]);

    // ── Auto-assignment: projects in "in_bearbeitung" with team but no planner dates ──
    const unplannedProjects = useMemo(() => {
        return projects.filter(p => {
            if (p.status !== 'in_bearbeitung') return false;
            const team = p.project_team_assignments?.filter(a => a.is_active) || [];
            if (team.length === 0) return false;
            return team.some(a => !a.start_date);
        });
    }, [projects]);

    const handleAutoAssign = async (project: Project) => {
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
            loadData();
        } catch (err: any) {
            toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
        }
    };

    // Navigation
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

    // ── Assignment Dialog ────────────────────────────────────
    const openAssignDialog = (prefillEmployeeId?: string, prefillDate?: Date) => {
        setEntryType('project');
        setAssignEmployeeId(prefillEmployeeId || '');
        setAssignProjectId('');
        setAssignStartDate(prefillDate ? format(prefillDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
        setAssignEndDate('');
        setShowAssignDialog(true);
    };

    const handleAssign = async () => {
        if (!assignEmployeeId || !assignStartDate) {
            toast({ title: 'Fehler', description: 'Bitte Mitarbeiter und Startdatum angeben.', variant: 'destructive' });
            return;
        }
        if (entryType === 'project' && !assignProjectId) {
            toast({ title: 'Fehler', description: 'Bitte ein Projekt auswählen.', variant: 'destructive' });
            return;
        }

        setAssignSaving(true);
        try {
            if (entryType === 'vacation' || entryType === 'sick') {
                const start = new Date(assignStartDate);
                const end = assignEndDate ? new Date(assignEndDate) : start;
                const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

                const { error } = await supabase
                    .from('vacation_requests')
                    .insert({
                        company_id: companyId,
                        employee_id: assignEmployeeId,
                        start_date: assignStartDate,
                        end_date: assignEndDate || assignStartDate,
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
                    .eq('project_id', assignProjectId)
                    .eq('employee_id', assignEmployeeId)
                    .maybeSingle();

                if (existing) {
                    const { error } = await supabase
                        .from('project_team_assignments')
                        .update({
                            start_date: assignStartDate,
                            end_date: assignEndDate || null,
                            is_active: true,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existing.id);
                    if (error) throw error;
                    toast({ title: 'Zuweisung aktualisiert' });
                } else {
                    const { error } = await supabase
                        .from('project_team_assignments')
                        .insert({
                            project_id: assignProjectId,
                            employee_id: assignEmployeeId,
                            start_date: assignStartDate,
                            end_date: assignEndDate || null,
                            is_active: true,
                            role: 'team_member',
                        });
                    if (error) throw error;
                    toast({ title: 'Mitarbeiter zugewiesen' });
                }
            }
            setShowAssignDialog(false);
            loadData();
        } catch (err: any) {
            console.error('Assignment error:', err);
            toast({ title: 'Fehler', description: err.message || 'Speichern fehlgeschlagen.', variant: 'destructive' });
        } finally {
            setAssignSaving(false);
        }
    };

    const handleRemoveAssignment = async (projectId: string, employeeId: string) => {
        if (!confirm('Zuweisung entfernen?')) return;
        pushUndo({
            description: 'Zuweisung entfernt',
            revert: async () => {
                await supabase.from('project_team_assignments')
                    .update({ is_active: true, updated_at: new Date().toISOString() })
                    .eq('project_id', projectId).eq('employee_id', employeeId);
            },
        });
        const { error } = await supabase
            .from('project_team_assignments')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .eq('employee_id', employeeId);
        if (error) {
            toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Zuweisung entfernt' });
            loadData();
        }
    };

    // ── Drag & Drop ──────────────────────────────────────────
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

        // Shift relative to the cell the drag started from, NOT the assignment start
        const originMs = new Date(originDate).getTime();
        const targetMs = new Date(targetDate).getTime();
        const shiftDays = Math.round((targetMs - originMs) / (1000 * 60 * 60 * 24));

        if (shiftDays === 0 && sourceEmployeeId === targetEmployeeId) return;

        const newStart = format(addDays(new Date(assignmentStartDate), shiftDays), 'yyyy-MM-dd');
        const newEnd = assignmentEndDate
            ? format(addDays(new Date(assignmentEndDate), shiftDays), 'yyyy-MM-dd')
            : null;

        try {
            // Push undo before mutating
            pushUndo({
                description: 'Zuweisung verschoben',
                revert: async () => {
                    if (sourceEmployeeId === targetEmployeeId) {
                        await supabase.from('project_team_assignments')
                            .update({ start_date: assignmentStartDate, end_date: assignmentEndDate, updated_at: new Date().toISOString() })
                            .eq('project_id', projectId).eq('employee_id', sourceEmployeeId).eq('is_active', true);
                    } else {
                        // Reactivate source, deactivate target
                        await supabase.from('project_team_assignments')
                            .update({ is_active: true, start_date: assignmentStartDate, end_date: assignmentEndDate, updated_at: new Date().toISOString() })
                            .eq('project_id', projectId).eq('employee_id', sourceEmployeeId);
                        await supabase.from('project_team_assignments')
                            .update({ is_active: false, updated_at: new Date().toISOString() })
                            .eq('project_id', projectId).eq('employee_id', targetEmployeeId).eq('is_active', true);
                    }
                },
            });

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
            toast({ title: 'Zuweisung verschoben' });
            loadData();
        } catch (err: any) {
            toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
        }
    }, [dragPayload, loadData, toast]);

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Ressourcenplanung</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Personal, Fahrzeuge und Geräte für Ihre Projekte.</p>
                </div>
                <div className="flex items-center gap-2">
                    {undoCount > 0 && (
                        <Button variant="outline" size="sm" onClick={handleUndo} className="text-slate-600">
                            <Undo2 className="h-4 w-4 mr-1" />
                            Rückgängig
                            <kbd className="ml-1.5 text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-400">Ctrl+Z</kbd>
                        </Button>
                    )}
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => openAssignDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Neuer Eintrag
                    </Button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <KpiCard icon={Briefcase} iconBg="bg-blue-50" iconColor="text-blue-600"
                    value={isLoading ? '—' : projects.length} label="Aktive Projekte" />
                <KpiCard icon={Users} iconBg="bg-amber-50" iconColor="text-amber-600"
                    value={isLoading ? '—' : assignedCount} label="Zugewiesene MA" />
                <KpiCard icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600"
                    value={isLoading ? '—' : freeCount} label="Freie MA" />
                <KpiCard icon={Palmtree} iconBg="bg-amber-50" iconColor="text-amber-600"
                    value={isLoading ? '—' : vacationTodayCount} label="Heute im Urlaub" />
                <KpiCard icon={AlertTriangle} iconBg={totalConflictCount > 0 ? "bg-red-50" : "bg-slate-50"} iconColor={totalConflictCount > 0 ? "text-red-600" : "text-slate-400"}
                    value={isLoading ? '—' : totalConflictCount} label="Konflikte" />
            </div>

            {/* Auto-Assignment Banner */}
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
                                        <Button
                                            key={p.id}
                                            variant="outline"
                                            size="sm"
                                            className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100 text-xs h-7"
                                            onClick={() => handleAutoAssign(p)}
                                        >
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

                            {/* Project filter */}
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

                            {/* Position filter */}
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

                            {/* Utilization filter */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Auslastung</label>
                                <div className="flex gap-1">
                                    {([['all', 'Alle'], ['available', 'Frei'], ['overloaded', 'Voll']] as const).map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => setFilterUtilization(key)}
                                            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                                filterUtilization === key
                                                    ? key === 'overloaded' ? 'bg-red-100 text-red-700 border border-red-300'
                                                    : key === 'available' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                    : 'bg-slate-200 text-slate-700 border border-slate-300'
                                                    : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reset filters */}
                            {(filterProjectId !== 'all' || filterPosition !== 'all' || filterUtilization !== 'all' || searchTerm) && (
                                <button
                                    onClick={() => { setFilterProjectId('all'); setFilterPosition('all'); setFilterUtilization('all'); setSearchTerm(''); }}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
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
                                        const onVac = getAbsence(emp.id, new Date());
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
                                            <div className={`h-3 w-3 rounded-sm ${color.bg} flex-shrink-0`} />
                                            <span className="text-xs text-slate-700 truncate">{p.name}</span>
                                        </div>
                                    );
                                })}
                                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                                    <div className={`h-3 w-3 rounded-sm ${VACATION_COLOR.bg} flex-shrink-0`} />
                                    <span className="text-xs text-slate-700">Urlaub</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-sm ${SICK_COLOR.bg} flex-shrink-0`} />
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
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'day' | 'week' | 'month')} className="w-full sm:w-auto">
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
                                                                isToday ? 'text-blue-600 bg-blue-50' :
                                                                isWeekend ? 'text-slate-400 bg-slate-50/60' :
                                                                'text-slate-500'
                                                            }`}>
                                                                {isMonth ? (
                                                                    <><div>{format(day, 'dd')}</div><div className="text-[8px] opacity-60">{format(day, 'EE', { locale: de })}</div></>
                                                                ) : (
                                                                    <>
                                                                        {format(day, 'EEE', { locale: de })}<br />{format(day, 'dd.MM', { locale: de })}
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
                                            getAssignments={getEmployeeDayAssignments}
                                            getAbsence={getAbsence}
                                            getCalendarEvents={getCalendarEventsForDay}
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
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        />
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Assignment Dialog */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
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
                        {/* Entry Type Toggle */}
                        <div className="grid grid-cols-3 gap-2">
                            {(['project', 'vacation', 'sick'] as EntryType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setEntryType(type)}
                                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                        entryType === type
                                            ? ENTRY_TYPE_STYLES[type].active
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                                >
                                    {ENTRY_TYPE_STYLES[type].label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <Label>Mitarbeiter *</Label>
                            <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
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
                                <Select value={assignProjectId} onValueChange={setAssignProjectId}>
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
                                <Label>Von *</Label>
                                <Input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Bis</Label>
                                <Input type="date" value={assignEndDate} onChange={e => setAssignEndDate(e.target.value)} />
                            </div>
                        </div>

                        {entryType !== 'project' && (
                            <div className={`rounded-lg p-3 text-sm ${entryType === 'sick' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                                {entryType === 'sick'
                                    ? 'Krankheitstage werden sofort als genehmigt eingetragen.'
                                    : 'Urlaub wird sofort als genehmigt eingetragen (Manager-Eintrag).'}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Abbrechen</Button>
                        <Button onClick={handleAssign} disabled={assignSaving}
                            className={entryType === 'sick' ? 'bg-red-600 hover:bg-red-700' : entryType === 'vacation' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}>
                            {assignSaving ? 'Speichern...' : entryType === 'project' ? 'Zuweisen' : 'Eintragen'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ── KPI Card ─────────────────────────────────────────────────
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

// ── Employee Row (Gantt-bar approach) ─────────────────────────
const EmployeeRow = React.memo(function EmployeeRow({
    employee, displayDays, getAssignments, getAbsence, getCalendarEvents,
    projectColorMap, gridClass, gridStyle, isMonth,
    holidays, conflicts, utilization, dropTarget, isDragging,
    onCellClick, onRemoveAssignment,
    onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: {
    employee: Employee;
    displayDays: Date[];
    getAssignments: (employeeId: string, day: Date) => { project: Project; assignment: Assignment }[];
    getAbsence: (employeeId: string, day: Date) => 'vacation' | 'sick' | null;
    getCalendarEvents: (employeeId: string, day: Date) => CalendarEvent[];
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
    onDragStart: (e: DragEvent, payload: DragPayload) => void;
    onDragEnd: (e: DragEvent) => void;
    onDragOver: (e: DragEvent, employeeId: string, date: string) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent, employeeId: string, date: string) => void;
}) {
    const barH = isMonth ? 18 : 24;
    const barGap = 2;
    const numDays = displayDays.length;

    const utilColor = utilization > 100 ? 'bg-red-500' : utilization >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
    const utilTextColor = utilization > 100 ? 'text-red-600' : utilization >= 80 ? 'text-amber-600' : 'text-emerald-600';

    const dayStrings = useMemo(() => displayDays.map(d => format(d, 'yyyy-MM-dd')), [displayDays]);
    const dayIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        dayStrings.forEach((ds, i) => map.set(ds, i));
        return map;
    }, [dayStrings]);

    // ── Collect project bars (one bar per project) ──
    const projectBars = useMemo(() => {
        const seen = new Set<string>();
        const bars: { project: Project; assignment: Assignment; startCol: number; endCol: number; clipL: boolean; clipR: boolean }[] = [];

        for (let i = 0; i < displayDays.length; i++) {
            for (const { project, assignment } of getAssignments(employee.id, displayDays[i])) {
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
    }, [displayDays, getAssignments, employee.id, dayStrings, dayIndexMap, numDays]);

    // ── Collect absence bars ──
    const absenceBars = useMemo(() => {
        const bars: { type: 'vacation' | 'sick'; startCol: number; endCol: number }[] = [];
        let curType: 'vacation' | 'sick' | null = null;
        let blockStart = -1;
        for (let i = 0; i <= displayDays.length; i++) {
            const abs = i < displayDays.length ? getAbsence(employee.id, displayDays[i]) : null;
            if (abs !== curType) {
                if (curType && blockStart >= 0) bars.push({ type: curType, startCol: blockStart, endCol: i - 1 });
                curType = abs;
                blockStart = abs ? i : -1;
            }
        }
        return bars;
    }, [displayDays, getAbsence, employee.id]);

    // ── Collect calendar event bars ──
    const calEventBars = useMemo(() => {
        const seen = new Set<string>();
        const bars: { event: CalendarEvent; startCol: number; endCol: number }[] = [];
        for (let i = 0; i < displayDays.length; i++) {
            for (const ev of getCalendarEvents(employee.id, displayDays[i])) {
                if (seen.has(ev.id)) continue;
                seen.add(ev.id);
                const effectiveStart = ev.start_date < dayStrings[0] ? dayStrings[0] : ev.start_date;
                const effectiveEnd = ev.end_date > dayStrings[numDays - 1] ? dayStrings[numDays - 1] : ev.end_date;
                bars.push({ event: ev, startCol: dayIndexMap.get(effectiveStart) ?? i, endCol: dayIndexMap.get(effectiveEnd) ?? i });
            }
        }
        return bars;
    }, [displayDays, getCalendarEvents, employee.id, dayStrings, dayIndexMap, numDays]);

    // ── Lane assignment (greedy) ──
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
            {/* Name column */}
            <div className="w-48 flex-shrink-0 border-r border-slate-200 p-3 flex flex-col justify-center bg-white group-hover/row:bg-slate-50/50 transition-colors">
                <span className="text-sm font-medium text-slate-800 truncate">{employee.first_name} {employee.last_name}</span>
                <span className="text-xs text-slate-500 truncate">{employee.position || '—'}</span>
                <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${utilColor} rounded-full transition-all`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                    </div>
                    <span className={`text-[10px] font-medium ${utilTextColor} min-w-[28px] text-right`}>{utilization}%</span>
                </div>
            </div>

            {/* Day area — positioned container */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: contentH }}>
                {/* Background day cells (click/drop targets + visual) */}
                <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: `repeat(${numDays}, 1fr)` }}>
                    {displayDays.map((day, i) => {
                        const ds = dayStrings[i];
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const holiday = holidays.get(ds);
                        const hasConflict = conflicts?.has(ds);
                        const isDropHere = dropTarget?.employeeId === employee.id && dropTarget?.date === ds;

                        return (
                            <div
                                key={i}
                                className={`h-full relative ${
                                    holiday ? 'bg-rose-50/50' : isWeekend ? 'bg-slate-50/80' : ''
                                } ${i > 0 ? 'border-l border-slate-100' : ''} ${
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

                {/* Project bars — absolutely positioned, spanning columns */}
                {projectBars.map((bar, idx) => {
                    const lane = projectLanes[idx];
                    const color = projectColorMap.get(bar.project.id) || PROJECT_COLORS[0];
                    const left = (bar.startCol / numDays) * 100;
                    const width = ((bar.endCol - bar.startCol + 1) / numDays) * 100;
                    const top = lane * (barH + barGap) + barGap;
                    const roundL = bar.clipL ? '' : 'rounded-l-md';
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
                                        className={`absolute ${color.bg} ${color.text} ${roundL} ${roundR} px-2 py-0.5 ${isMonth ? 'text-[8px]' : 'text-[10px]'} font-medium truncate cursor-grab active:cursor-grabbing shadow-sm group/block z-10 flex items-center`}
                                        style={{ left: `${left}%`, width: `${width}%`, top, height: barH, pointerEvents: isDragging ? 'none' : 'auto' }}
                                    >
                                        {isMonth ? bar.project.name.substring(0, 3) : bar.project.name}
                                        {!isMonth && (
                                            <button
                                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-opacity bg-black/20 rounded p-0.5"
                                                onClick={(e) => { e.stopPropagation(); onRemoveAssignment(bar.project.id, employee.id); }}
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
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
                                        className={`absolute ${abColor.bg} ${abColor.text} rounded-md px-2 py-0.5 ${isMonth ? 'text-[8px]' : 'text-[10px]'} font-medium truncate shadow-sm z-10 flex items-center`}
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

                {/* Calendar event bars (Besichtigung etc.) */}
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

export default PlannerModuleV2;
