import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Clock,
    Play,
    Square,
    Settings,
    Filter,
    Search,
    Calendar,
    MoreHorizontal,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

interface TimeEntry {
    id: string;
    employee: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: string;
    project: string;
    status: 'freigegeben' | 'ausstehend' | 'abgelehnt';
}

const mockEntries: TimeEntry[] = [
    { id: '1', employee: 'Max Mustermann', date: 'Heute', startTime: '07:30', endTime: '16:00', duration: '8:00h', project: 'Sanierung MFH Nordstadt', status: 'ausstehend' },
    { id: '2', employee: 'Anna Schmidt', date: 'Heute', startTime: '08:00', endTime: '-', duration: '-', project: 'Wartung Heizsysteme', status: 'ausstehend' },
    { id: '3', employee: 'Lukas Weber', date: 'Gestern', startTime: '07:00', endTime: '15:30', duration: '8:00h', project: 'Rohbau Einfamilienhaus', status: 'freigegeben' },
    { id: '4', employee: 'Max Mustermann', date: 'Gestern', startTime: '07:30', endTime: '16:00', duration: '8:00h', project: 'Sanierung MFH Nordstadt', status: 'freigegeben' },
];

const TimeTrackingModuleV2 = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isTracking, setIsTracking] = useState(false);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'freigegeben': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'ausstehend': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'abgelehnt': return 'bg-rose-50 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Zeiterfassung</h1>
                    <p className="text-sm text-slate-500 mt-1">Überwachen und verwalten Sie die Arbeitszeiten Ihres Teams.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex">
                        <Settings className="h-4 w-4 mr-2" />
                        Einstellungen
                    </Button>
                    {!isTracking ? (
                        <Button onClick={() => setIsTracking(true)} className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                            <Play className="h-4 w-4 mr-2" />
                            Zeit erfassen
                        </Button>
                    ) : (
                        <Button onClick={() => setIsTracking(false)} variant="destructive" className="w-full sm:w-auto">
                            <Square className="h-4 w-4 mr-2" />
                            Erfassung stoppen
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm relative overflow-hidden">
                    {/* Active tracking indicator */}
                    {isTracking && <div className="absolute top-0 left-0 w-full h-1 bg-slate-500 animate-pulse" />}
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Mitarbeiter aktiv</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">4 / 12</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Stunden Heute</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">32.5h</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Korrekturanfragen</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">2</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Überstunden (Monat)</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">18.5h</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-rose-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="list" className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <TabsList className="bg-slate-100/50 p-1 border border-slate-200">
                        <TabsTrigger value="list" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Alle Einträge</TabsTrigger>
                        <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Freigaben (2)</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Mitarbeiter oder Projekt..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white border-slate-200 h-9"
                            />
                        </div>
                        <Button variant="outline" size="sm" className="bg-white border-slate-200 h-9">
                            <Filter className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Filter</span>
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white border-slate-200 h-9 hidden sm:flex">
                            <Calendar className="h-4 w-4 mr-2" />
                            Datum
                        </Button>
                    </div>
                </div>

                <TabsContent value="list" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Mitarbeiter</th>
                                            <th className="px-5 py-3 font-medium">Datum</th>
                                            <th className="px-5 py-3 font-medium">Projekt / Tätigkeit</th>
                                            <th className="px-5 py-3 font-medium text-right">Zeiten</th>
                                            <th className="px-5 py-3 font-medium text-center">Status</th>
                                            <th className="px-5 py-3 font-medium text-right">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mockEntries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="font-medium text-slate-900">{entry.employee}</div>
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">{entry.date}</td>
                                                <td className="px-5 py-4 text-slate-600">{entry.project}</td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="font-medium text-slate-900">{entry.duration}</div>
                                                    <div className="text-xs text-slate-500">{entry.startTime} - {entry.endTime}</div>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <Badge variant="outline" className={`font-normal ${getStatusColor(entry.status)}`}>
                                                        {entry.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pending" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Alle Zeiten freigegeben</h3>
                            <p className="text-sm text-slate-500 max-w-sm">Es liegen aktuell keine Zeiten zur Freigabe vor. Sie sind auf dem neuesten Stand.</p>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default TimeTrackingModuleV2;


