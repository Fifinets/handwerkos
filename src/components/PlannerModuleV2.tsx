import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Calendar as CalendarIcon,
    Users,
    Briefcase,
    Plus,
    ChevronLeft,
    ChevronRight,
    Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { addDays, addMonths, format, startOfWeek, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const PROJECT_COLORS = [
    { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-white', dot: 'bg-blue-500' },
    { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-white', dot: 'bg-emerald-500' },
    { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-white', dot: 'bg-orange-500' },
    { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-white', dot: 'bg-purple-500' },
    { bg: 'bg-pink-500', light: 'bg-pink-50', text: 'text-white', dot: 'bg-pink-500' },
    { bg: 'bg-teal-500', light: 'bg-teal-50', text: 'text-white', dot: 'bg-teal-500' },
    { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-white', dot: 'bg-amber-500' },
    { bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-white', dot: 'bg-indigo-500' },
    { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-white', dot: 'bg-rose-500' },
    { bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-white', dot: 'bg-cyan-500' },
];

const PlannerModuleV2 = () => {
    const { companyId } = useSupabaseAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
    const [searchTerm, setSearchTerm] = useState('');

    const [employees, setEmployees] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!companyId) return;
        setIsLoading(true);
        Promise.all([
            supabase.from('employees')
                .select('id, first_name, last_name, status, position')
                .eq('company_id', companyId)
                .not('status', 'in', '("Inaktiv","Gekündigt")'),
            supabase.from('projects')
                .select('id, name, status, start_date, end_date, location, project_team_assignments(employee_id, is_active)')
                .eq('company_id', companyId)
                .not('status', 'in', '("abgeschlossen","storniert")'),
        ]).then(([empRes, projRes]) => {
            setEmployees(empRes.data || []);
            setProjects(projRes.data || []);
            setIsLoading(false);
        });
    }, [companyId]);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from(
        { length: viewMode === 'day' ? 1 : 7 },
        (_, i) => addDays(weekStart, i)
    );

    const gridColsClass = viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7';

    const getEmployeeProjects = (employeeId: string) => {
        return projects.filter(p =>
            p.project_team_assignments?.some((a: any) => a.employee_id === employeeId && a.is_active)
        );
    };

    const projectOverlapsDay = (project: any, day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        if (!project.start_date && !project.end_date) return true;
        if (project.start_date && dayStr < project.start_date) return false;
        if (project.end_date && dayStr > project.end_date) return false;
        return true;
    };

    // KPI: unique assigned employee IDs
    const assignedEmployeeIds = useMemo(() => {
        const ids = new Set<string>();
        projects.forEach(p => {
            p.project_team_assignments?.forEach((a: any) => {
                if (a.is_active) ids.add(a.employee_id);
            });
        });
        return ids;
    }, [projects]);

    const assignedCount = assignedEmployeeIds.size;
    const freeCount = employees.length - assignedCount;

    // Assign a stable color to each project
    const projectColorMap = useMemo(() => {
        const map = new Map<string, typeof PROJECT_COLORS[0]>();
        projects.forEach((p, i) => {
            map.set(p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]);
        });
        return map;
    }, [projects]);

    // Filter employees by search term
    const filteredEmployees = useMemo(() => {
        if (!searchTerm.trim()) return employees;
        const term = searchTerm.toLowerCase();
        return employees.filter(emp =>
            `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term) ||
            (emp.position || '').toLowerCase().includes(term)
        );
    }, [employees, searchTerm]);

    const navigatePrevious = () => {
        if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
        if (viewMode === 'week') setCurrentDate(subDays(currentDate, 7));
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    };

    const navigateNext = () => {
        if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
        if (viewMode === 'week') setCurrentDate(addDays(currentDate, 7));
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    };

    const formattedDateRange = () => {
        if (viewMode === 'day') return format(currentDate, 'EEEE, dd. MMMM yyyy', { locale: de });
        if (viewMode === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = addDays(start, 6);
            return `${format(start, 'dd. MMM', { locale: de })} - ${format(end, 'dd. MMM yyyy', { locale: de })}`;
        }
        return format(currentDate, 'MMMM yyyy', { locale: de });
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Ressourcenplanung</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Personal, Fahrzeuge und Geräte für Ihre Projekte.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Neuer Eintrag
                    </Button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : projects.length}</div>
                            <div className="text-xs text-slate-500">Aktive Projekte</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Users className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : assignedCount}</div>
                            <div className="text-xs text-slate-500">Zugewiesene MA</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Users className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-semibold text-slate-900">{isLoading ? '—' : Math.max(0, freeCount)}</div>
                            <div className="text-xs text-slate-500">Freie MA</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Left Sidebar: Filters & Resources list */}
                <div className="xl:w-64 space-y-6 flex-shrink-0">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100">
                            <CardTitle className="text-sm font-semibold text-slate-800">Filter</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">Suche</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Name, Position..."
                                        className="pl-8 bg-slate-50 border-slate-200 text-sm h-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-slate-800">Mitarbeiter</CardTitle>
                            <Badge variant="outline" className="text-xs font-normal text-slate-500">{employees.length}</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="p-3 flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded" />
                                            <div className="space-y-1.5 flex-1">
                                                <Skeleton className="h-3.5 w-24" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                    ))
                                ) : employees.length === 0 ? (
                                    <div className="p-4 text-sm text-slate-500 text-center">Keine aktiven Mitarbeiter gefunden.</div>
                                ) : (
                                    employees.map(emp => {
                                        const empProjects = getEmployeeProjects(emp.id);
                                        const hasAssignment = empProjects.length > 0;
                                        return (
                                            <div key={emp.id} className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                                                        <Users className="h-4 w-4" />
                                                    </div>
                                                    <div className="truncate">
                                                        <div className="text-sm font-medium text-slate-900 truncate">{emp.first_name} {emp.last_name}</div>
                                                        <div className="text-xs text-slate-500 truncate">{emp.position || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${hasAssignment ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Calendar View Area */}
                <div className="flex-1 space-y-4">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={navigatePrevious} className="h-8 w-8 p-0 bg-white">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 bg-white font-medium text-slate-700">
                                    Heute
                                </Button>
                                <Button variant="outline" size="sm" onClick={navigateNext} className="h-8 w-8 p-0 bg-white">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <span className="ml-2 font-medium text-slate-800 text-sm sm:text-base">
                                    {formattedDateRange()}
                                </span>
                            </div>
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full sm:w-auto">
                                <TabsList className="bg-slate-100/50 p-1 border border-slate-200 h-9 w-full sm:w-auto">
                                    <TabsTrigger value="day" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Tag</TabsTrigger>
                                    <TabsTrigger value="week" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Woche</TabsTrigger>
                                    <TabsTrigger value="month" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Monat</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </CardHeader>
                        <CardContent className="p-0 min-h-[600px]">
                            <div className="flex flex-col h-full bg-slate-50/50">
                                {/* Top Axis row */}
                                <div className="flex border-b border-slate-200 bg-white">
                                    <div className="w-48 border-r border-slate-200 p-3 font-medium text-sm text-slate-500 flex items-center bg-slate-50/50">
                                        Mitarbeiter
                                    </div>
                                    <div className={`flex-1 grid ${gridColsClass} divide-x divide-slate-100 bg-white`}>
                                        {weekDays.map((day, i) => {
                                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                            return (
                                                <div key={i} className={`p-2 text-center text-xs font-medium ${isToday ? 'text-blue-600 bg-blue-50' : 'text-slate-500'}`}>
                                                    {format(day, 'EEE', { locale: de })}
                                                    <br />
                                                    {format(day, 'dd.MM', { locale: de })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Employee Rows */}
                                {isLoading ? (
                                    Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx} className="flex border-b border-slate-100 bg-white">
                                            <div className="w-48 border-r border-slate-200 p-3 flex flex-col justify-center gap-1.5">
                                                <Skeleton className="h-4 w-28" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                            <div className={`flex-1 grid ${gridColsClass} divide-x divide-slate-100 min-h-[64px]`}>
                                                {weekDays.map((_, i) => (
                                                    <div key={i} className="p-1">
                                                        {idx % 2 === 0 && i < 3 && <Skeleton className="h-5 w-full rounded" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : filteredEmployees.length === 0 ? (
                                    <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                                        {employees.length === 0
                                            ? 'Keine aktiven Mitarbeiter gefunden.'
                                            : 'Keine Mitarbeiter für diesen Suchbegriff gefunden.'}
                                    </div>
                                ) : (
                                    filteredEmployees.map(emp => {
                                        const empProjects = getEmployeeProjects(emp.id);
                                        return (
                                            <div key={emp.id} className="flex border-b border-slate-100 bg-white group hover:bg-slate-50/50">
                                                <div className="w-48 border-r border-slate-200 p-3 flex flex-col justify-center bg-white group-hover:bg-slate-50/50 transition-colors">
                                                    <span className="text-sm font-medium text-slate-800 truncate">{emp.first_name} {emp.last_name}</span>
                                                    <span className="text-xs text-slate-500 truncate">{emp.position || '—'}</span>
                                                </div>
                                                <div className={`flex-1 grid ${gridColsClass} min-h-[64px]`}>
                                                    {weekDays.map((day, di) => {
                                                        const dayProjects = empProjects.filter(p => projectOverlapsDay(p, day));
                                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                                        const prevDay = di > 0 ? weekDays[di - 1] : null;
                                                        const nextDay = di < weekDays.length - 1 ? weekDays[di + 1] : null;
                                                        return (
                                                            <div key={di} className={`py-1.5 flex flex-col gap-1 ${isWeekend ? 'bg-slate-50/80' : ''} ${di > 0 ? 'border-l border-slate-100' : ''}`}>
                                                                {dayProjects.map(p => {
                                                                    const color = projectColorMap.get(p.id) || PROJECT_COLORS[0];
                                                                    const continuesFromPrev = prevDay && projectOverlapsDay(p, prevDay);
                                                                    const continuesToNext = nextDay && projectOverlapsDay(p, nextDay);
                                                                    const roundedL = continuesFromPrev ? 'rounded-l-none' : 'rounded-l-md ml-1';
                                                                    const roundedR = continuesToNext ? 'rounded-r-none mr-0' : 'rounded-r-md mr-1';
                                                                    return (
                                                                        <TooltipProvider key={p.id} delayDuration={200}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <div
                                                                                        className={`${color.bg} ${color.text} ${roundedL} ${roundedR} px-2 py-1 text-[10px] font-medium truncate cursor-default shadow-sm`}
                                                                                        style={{ minHeight: '24px', lineHeight: '16px' }}
                                                                                    >
                                                                                        {!continuesFromPrev ? p.name : '\u00A0'}
                                                                                    </div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent side="top" className="text-xs">
                                                                                    <p className="font-semibold">{p.name}</p>
                                                                                    {p.location && <p className="text-slate-400">{p.location}</p>}
                                                                                    <p className="text-slate-400">{p.start_date && format(new Date(p.start_date), 'dd.MM.yy', { locale: de })} – {p.end_date ? format(new Date(p.end_date), 'dd.MM.yy', { locale: de }) : 'offen'}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Legend */}
                    {projects.length > 0 && (
                        <div className="flex flex-wrap gap-3 px-1">
                            {projects.map(p => {
                                const color = projectColorMap.get(p.id) || PROJECT_COLORS[0];
                                return (
                                    <div key={p.id} className="flex items-center gap-1.5">
                                        <div className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                                        <span className="text-xs text-slate-600">{p.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlannerModuleV2;
