import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    const [isLoading, setIsLoading] = useState(true);

    // Assignment dialog state
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [entryType, setEntryType] = useState<EntryType>('project');
    const [assignEmployeeId, setAssignEmployeeId] = useState('');
    const [assignProjectId, setAssignProjectId] = useState('');
    const [assignStartDate, setAssignStartDate] = useState('');
    const [assignEndDate, setAssignEndDate] = useState('');
    const [assignSaving, setAssignSaving] = useState(false);

    // ── Data Loading ─────────────────────────────────────────
    const loadData = useCallback(async () => {
        if (!companyId) return;
        setIsLoading(true);
        const [empRes, projRes, vacRes] = await Promise.all([
            supabase.from('employees')
                .select('id, first_name, last_name, status, position')
                .eq('company_id', companyId)
                .not('status', 'in', '("Inaktiv","Gekündigt")'),
            supabase.from('projects')
                .select('id, name, status, start_date, end_date, location, project_team_assignments(employee_id, is_active, start_date, end_date, role)')
                .eq('company_id', companyId)
                .not('status', 'in', '("abgeschlossen","storniert")'),
            supabase.from('vacation_requests')
                .select('id, employee_id, start_date, end_date, status, reason, absence_type')
                .eq('company_id', companyId)
                .eq('status', 'approved'),
        ]);
        setEmployees(empRes.data || []);
        setProjects(projRes.data || []);
        setVacations(vacRes.data || []);
        setIsLoading(false);
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

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

    // ── Assignment logic with assignment-specific dates ──────
    const getEmployeeDayAssignments = useCallback((employeeId: string, day: Date) => {
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

    // Filter
    const filteredEmployees = useMemo(() => {
        if (!searchTerm.trim()) return employees;
        const term = searchTerm.toLowerCase();
        return employees.filter(emp =>
            `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term) ||
            (emp.position || '').toLowerCase().includes(term)
        );
    }, [employees, searchTerm]);

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
                // Calculate days
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
                // Project assignment
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

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Ressourcenplanung</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Personal, Fahrzeuge und Geräte für Ihre Projekte.</p>
                </div>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => openAssignDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Neuer Eintrag
                </Button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard icon={Briefcase} iconBg="bg-blue-50" iconColor="text-blue-600"
                    value={isLoading ? '—' : projects.length} label="Aktive Projekte" />
                <KpiCard icon={Users} iconBg="bg-amber-50" iconColor="text-amber-600"
                    value={isLoading ? '—' : assignedCount} label="Zugewiesene MA" />
                <KpiCard icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600"
                    value={isLoading ? '—' : freeCount} label="Freie MA" />
                <KpiCard icon={Palmtree} iconBg="bg-amber-50" iconColor="text-amber-600"
                    value={isLoading ? '—' : vacationTodayCount} label="Heute im Urlaub" />
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Left Sidebar */}
                <div className="xl:w-64 space-y-6 flex-shrink-0">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100">
                            <CardTitle className="text-sm font-semibold text-slate-800">Filter</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input placeholder="Name, Position..." className="pl-8 bg-slate-50 border-slate-200 text-sm h-9"
                                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
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
                                        return (
                                            <div key={emp.id}
                                                className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                                onClick={() => openAssignDialog(emp.id)}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div className="truncate">
                                                        <div className="text-sm font-medium text-slate-900 truncate">{emp.first_name} {emp.last_name}</div>
                                                        <div className="text-xs text-slate-500 truncate">{emp.position || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full sm:w-auto">
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
                                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                            return (
                                                <div key={i} className={`p-1.5 text-center font-medium ${isMonth ? 'text-[10px]' : 'text-xs'} ${isToday ? 'text-blue-600 bg-blue-50' : isWeekend ? 'text-slate-400 bg-slate-50/60' : 'text-slate-500'}`}>
                                                    {isMonth ? (
                                                        <><div>{format(day, 'dd')}</div><div className="text-[8px] opacity-60">{format(day, 'EE', { locale: de })}</div></>
                                                    ) : (
                                                        <>{format(day, 'EEE', { locale: de })}<br />{format(day, 'dd.MM', { locale: de })}</>
                                                    )}
                                                </div>
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
                                            projectColorMap={projectColorMap}
                                            gridClass={gridClass}
                                            gridStyle={gridStyle}
                                            isMonth={isMonth}
                                            onCellClick={(day) => openAssignDialog(emp.id, day)}
                                            onRemoveAssignment={handleRemoveAssignment}
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

// ── Employee Row ─────────────────────────────────────────────
const EmployeeRow = React.memo(function EmployeeRow({
    employee, displayDays, getAssignments, getAbsence, projectColorMap,
    gridClass, gridStyle, isMonth, onCellClick, onRemoveAssignment,
}: {
    employee: Employee;
    displayDays: Date[];
    getAssignments: (employeeId: string, day: Date) => { project: Project; assignment: Assignment }[];
    getAbsence: (employeeId: string, day: Date) => 'vacation' | 'sick' | null;
    projectColorMap: Map<string, typeof PROJECT_COLORS[0]>;
    gridClass: string;
    gridStyle: React.CSSProperties;
    isMonth: boolean;
    onCellClick: (day: Date) => void;
    onRemoveAssignment: (projectId: string, employeeId: string) => void;
}) {
    return (
        <div className="flex border-b border-slate-100 bg-white group/row hover:bg-slate-50/50">
            <div className="w-48 flex-shrink-0 border-r border-slate-200 p-3 flex flex-col justify-center bg-white group-hover/row:bg-slate-50/50 transition-colors">
                <span className="text-sm font-medium text-slate-800 truncate">{employee.first_name} {employee.last_name}</span>
                <span className="text-xs text-slate-500 truncate">{employee.position || '—'}</span>
            </div>
            <div className={`flex-1 ${gridClass} min-h-[64px]`} style={gridStyle}>
                {displayDays.map((day, di) => {
                    const dayAssignments = getAssignments(employee.id, day);
                    const absence = getAbsence(employee.id, day);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isEmpty = dayAssignments.length === 0 && !absence;

                    const prevDay = di > 0 ? displayDays[di - 1] : null;
                    const nextDay = di < displayDays.length - 1 ? displayDays[di + 1] : null;

                    return (
                        <div
                            key={di}
                            className={`py-1 flex flex-col gap-0.5 ${isWeekend ? 'bg-slate-50/80' : ''} ${di > 0 ? 'border-l border-slate-100' : ''} ${isEmpty ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}
                            onClick={isEmpty ? () => onCellClick(day) : undefined}
                        >
                            {/* Projects render FIRST (top) so bars stay at consistent height */}
                            {dayAssignments.map(({ project }) => {
                                const color = projectColorMap.get(project.id) || PROJECT_COLORS[0];
                                const prevAssignments = prevDay ? getAssignments(employee.id, prevDay) : [];
                                const nextAssignments = nextDay ? getAssignments(employee.id, nextDay) : [];
                                const continuesFromPrev = prevAssignments.some(a => a.project.id === project.id);
                                const continuesToNext = nextAssignments.some(a => a.project.id === project.id);
                                const roundedL = continuesFromPrev ? 'rounded-l-none -ml-px' : 'rounded-l-md ml-0.5';
                                const roundedR = continuesToNext ? 'rounded-r-none -mr-px' : 'rounded-r-md mr-0.5';

                                return (
                                    <TooltipProvider key={project.id} delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={`${color.bg} ${color.text} ${roundedL} ${roundedR} px-1.5 py-0.5 ${isMonth ? 'text-[8px]' : 'text-[10px]'} font-medium truncate cursor-default shadow-sm group/block relative`}
                                                    style={{ minHeight: isMonth ? '18px' : '24px', lineHeight: '16px' }}
                                                >
                                                    {!continuesFromPrev ? (isMonth ? project.name.substring(0, 3) : project.name) : '\u00A0'}
                                                    {!isMonth && !continuesFromPrev && (
                                                        <button
                                                            className="absolute right-0.5 top-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity bg-black/20 rounded p-0.5"
                                                            onClick={(e) => { e.stopPropagation(); onRemoveAssignment(project.id, employee.id); }}
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                                <p className="font-semibold">{project.name}</p>
                                                {project.location && <p className="text-slate-400">{project.location}</p>}
                                                <p className="text-slate-400">
                                                    {project.start_date && format(new Date(project.start_date), 'dd.MM.yy', { locale: de })} – {project.end_date ? format(new Date(project.end_date), 'dd.MM.yy', { locale: de }) : 'offen'}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}

                            {/* Absence renders BELOW projects */}
                            {absence && (() => {
                                const color = absence === 'sick' ? SICK_COLOR : VACATION_COLOR;
                                const label = absence === 'sick' ? 'Krank' : 'Urlaub';
                                const shortLabel = absence === 'sick' ? 'K' : 'U';
                                const prevAbsence = prevDay ? getAbsence(employee.id, prevDay) : null;
                                const nextAbsence = nextDay ? getAbsence(employee.id, nextDay) : null;
                                const absFromPrev = prevAbsence === absence;
                                const absToNext = nextAbsence === absence;
                                const roundL = absFromPrev ? 'rounded-l-none -ml-px' : 'rounded-l-sm ml-0.5';
                                const roundR = absToNext ? 'rounded-r-none -mr-px' : 'rounded-r-sm mr-0.5';
                                return (
                                    <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={`${color.bg} ${color.text} px-1.5 py-0.5 ${roundL} ${roundR} ${isMonth ? 'text-[8px]' : 'text-[10px]'} font-medium truncate shadow-sm relative`}
                                                    style={{ minHeight: isMonth ? '18px' : '24px', lineHeight: '16px' }}
                                                >
                                                    {!absFromPrev ? (isMonth ? shortLabel : label) : '\u00A0'}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                                <p className="font-semibold">{label}</p>
                                                <p className="text-slate-400">{employee.first_name} {employee.last_name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default PlannerModuleV2;
