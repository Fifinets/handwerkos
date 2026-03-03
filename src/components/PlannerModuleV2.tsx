import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Calendar as CalendarIcon,
    Users,
    Briefcase,
    Plus,
    Filter,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, addMonths, format, startOfWeek, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface Resource {
    id: string;
    name: string;
    type: 'employee' | 'equipment' | 'vehicle';
    status: 'available' | 'in_use' | 'maintenance' | 'absent';
    details?: string;
}

const PlannerModuleV2 = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
    const [searchTerm, setSearchTerm] = useState('');

    // Mock data for UI demonstration
    const mockResources: Resource[] = [
        { id: '1', name: 'Max Mustermann', type: 'employee', status: 'in_use', details: 'Maurer' },
        { id: '2', name: 'Anna Schmidt', type: 'employee', status: 'available', details: 'Elektriker' },
        { id: '3', name: 'Bagger CAT 320', type: 'equipment', status: 'in_use', details: 'Baustelle Nord' },
        { id: '4', name: 'Transporter B-WZ 123', type: 'vehicle', status: 'maintenance', details: 'Werkstatt' },
    ];

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

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Left Sidebar: Filters & Resources list (collapsible on mobile, side by side on desktop) */}
                <div className="xl:w-64 space-y-6 flex-shrink-0">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100">
                            <CardTitle className="text-sm font-semibold text-slate-800">Filter</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">Ressourcentyp</label>
                                <Select defaultValue="all">
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm h-9">
                                        <SelectValue placeholder="Alle Typen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Typen</SelectItem>
                                        <SelectItem value="employee">Mitarbeiter</SelectItem>
                                        <SelectItem value="equipment">Maschinen</SelectItem>
                                        <SelectItem value="vehicle">Fahrzeuge</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">Status</label>
                                <Select defaultValue="all">
                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-sm h-9">
                                        <SelectValue placeholder="Alle Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Status</SelectItem>
                                        <SelectItem value="available">Verfügbar</SelectItem>
                                        <SelectItem value="in_use">Im Einsatz</SelectItem>
                                        <SelectItem value="absent">Abwesend</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">Suche</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Name, Gewerk..."
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
                            <CardTitle className="text-sm font-semibold text-slate-800">Ressourcen</CardTitle>
                            <Badge variant="outline" className="text-xs font-normal text-slate-500">{mockResources.length}</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {mockResources.map(resource => (
                                    <div key={resource.id} className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                                                {resource.type === 'employee' ? <Users className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                                            </div>
                                            <div className="truncate">
                                                <div className="text-sm font-medium text-slate-900 truncate">{resource.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{resource.details}</div>
                                            </div>
                                        </div>
                                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${resource.status === 'available' ? 'bg-emerald-500' :
                                                resource.status === 'in_use' ? 'bg-slate-500' :
                                                    'bg-rose-500'
                                            }`} />
                                    </div>
                                ))}
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
                            {/* Dummy Timeline display representing the calendar grid */}
                            <div className="flex flex-col h-full bg-slate-50/50">
                                {/* Top Axis row */}
                                <div className="flex border-b border-slate-200 bg-white">
                                    <div className="w-48 border-r border-slate-200 p-3 font-medium text-sm text-slate-500 flex items-center bg-slate-50/50">
                                        Ressource
                                    </div>
                                    <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 bg-white">
                                        {Array.from({ length: 7 }).map((_, i) => (
                                            <div key={i} className="p-2 text-center text-xs text-slate-500 font-medium">
                                                Mo, {10 + i}.10
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Rows per resource */}
                                {mockResources.map(resource => (
                                    <div key={resource.id} className="flex border-b border-slate-100 bg-white group hover:bg-slate-50/50">
                                        <div className="w-48 border-r border-slate-200 p-3 flex flex-col justify-center bg-white group-hover:bg-slate-50/50 transition-colors">
                                            <span className="text-sm font-medium text-slate-800 truncate">{resource.name}</span>
                                            <span className="text-xs text-slate-500 truncate">{resource.details}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 relative min-h-[64px]">
                                            {/* Background grid */}
                                            {Array.from({ length: 7 }).map((_, i) => (
                                                <div key={i} className="h-full bg-white group-hover:bg-transparent transition-colors" />
                                            ))}

                                            {/* Dummy Events positioned absolutely */}
                                            {resource.status === 'in_use' && (
                                                <div
                                                    className="absolute top-2 bottom-2 left-[14.28%] right-[42.85%] bg-blue-100/80 border border-blue-200 rounded text-blue-800 text-xs p-1.5 shadow-sm truncate flex flex-col justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                                                >
                                                    <span className="font-semibold block truncate">Projekt Nordstadt</span>
                                                    <span className="truncate opacity-80 flex items-center gap-1"><MapPin className="h-3 w-3" /> Baustelle A</span>
                                                </div>
                                            )}
                                            {resource.status === 'maintenance' && (
                                                <div
                                                    className="absolute top-2 bottom-2 left-[57.14%] right-[0%] bg-amber-100/80 border border-amber-200 rounded text-amber-800 text-xs p-1.5 shadow-sm truncate flex flex-col justify-center cursor-pointer hover:bg-amber-100 transition-colors"
                                                >
                                                    <span className="font-semibold block truncate">Wartung / TÜV</span>
                                                    <span className="truncate opacity-80 flex items-center gap-1"><Clock className="h-3 w-3" /> 08:00 - 16:00</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Filler rows */}
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <div key={`filler-${idx}`} className="flex border-b border-slate-100 bg-white flex-1">
                                        <div className="w-48 border-r border-slate-200 p-3 bg-white" />
                                        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100">
                                            {Array.from({ length: 7 }).map((_, i) => (
                                                <div key={`filler-bg-${i}`} className="h-full bg-white" />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PlannerModuleV2;

