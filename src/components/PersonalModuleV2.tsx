import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Users,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Mail,
    Phone,
    HardHat,
    Banknote,
    GraduationCap,
    Clock,
    Settings,
    AlertCircle
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    position: string;
    department: string;
    email: string;
    phone: string;
    status: 'Aktiv' | 'Krank' | 'Urlaub' | 'Inaktiv';
}

const mockEmployees: Employee[] = [
    { id: '1', first_name: 'Max', last_name: 'Mustermann', position: 'Bauleiter', department: 'Bauleitung', email: 'max@example.com', phone: '+49 123 45678', status: 'Aktiv' },
    { id: '2', first_name: 'Anna', last_name: 'Schmidt', position: 'Elektrikerin', department: 'Elektro', email: 'anna@example.com', phone: '+49 234 56789', status: 'Urlaub' },
    { id: '3', first_name: 'Lukas', last_name: 'Weber', position: 'Anlagenmechaniker', department: 'Sanitär', email: 'lukas@example.com', phone: '+49 345 67890', status: 'Krank' },
    { id: '4', first_name: 'Sarah', last_name: 'Müller', position: 'Bürokauffrau', department: 'Verwaltung', email: 'sarah@example.com', phone: '+49 456 78901', status: 'Aktiv' },
];

const PersonalModuleV2 = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aktiv': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Urlaub': return 'bg-slate-50 text-blue-700 border-blue-200';
            case 'Krank': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Inaktiv': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredEmployees = mockEmployees.filter(emp =>
        emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Personalverwaltung</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Ihre Mitarbeiter, Löhne und Qualifikationen.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex">
                        <Settings className="h-4 w-4 mr-2" />
                        Einstellungen
                    </Button>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Mitarbeiter einladen
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Mitarbeiter gesamt</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{mockEmployees.length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Users className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Im Einsatz / Aktiv</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{mockEmployees.filter(e => e.status === 'Aktiv').length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                            <HardHat className="h-6 w-6 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Urlaub</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{mockEmployees.filter(e => e.status === 'Urlaub').length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Krankgemeldet</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{mockEmployees.filter(e => e.status === 'Krank').length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-rose-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-slate-100/50 p-1 border border-slate-200">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Mitarbeiterübersicht</TabsTrigger>
                    <TabsTrigger value="wages" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Stundenlohn & Kosten</TabsTrigger>
                    <TabsTrigger value="qualifications" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Qualifikationen</TabsTrigger>
                </TabsList>

                <div className="flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Name, Position oder Abteilung suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white border-slate-200"
                        />
                    </div>
                    <Button variant="outline" className="bg-white border-slate-200">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </Button>
                </div>

                <TabsContent value="overview" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Mitarbeiter</th>
                                            <th className="px-5 py-3 font-medium">Position</th>
                                            <th className="px-5 py-3 font-medium">Kontaktdaten</th>
                                            <th className="px-5 py-3 font-medium text-center">Status</th>
                                            <th className="px-5 py-3 font-medium text-right">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredEmployees.map((employee) => (
                                            <tr key={employee.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 flex-shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-semibold border border-slate-200">
                                                            {employee.first_name[0]}{employee.last_name[0]}
                                                        </div>
                                                        <div className="font-semibold text-slate-900">
                                                            {employee.first_name} {employee.last_name}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="text-slate-900 font-medium">{employee.position}</div>
                                                    <div className="text-xs text-slate-500">{employee.department}</div>
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-xs"><Mail className="h-3.5 w-3.5 text-slate-400" /> {employee.email}</div>
                                                        <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3.5 w-3.5 text-slate-400" /> {employee.phone}</div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <Badge variant="outline" className={`font-normal ${getStatusColor(employee.status)}`}>
                                                        {employee.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem>Profil ansehen</DropdownMenuItem>
                                                            <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                                                            <DropdownMenuItem>Status ändern</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-rose-600">Entfernen</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="wages" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Banknote className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Stundenlöhne verwalten</h3>
                            <p className="text-sm text-slate-500 max-w-sm">Hier können Sie bald Löhne, Verrechnungssätze und Personalkosten zentral pflegen.</p>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="qualifications" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <GraduationCap className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Qualifikationen & Zertifikate</h3>
                            <p className="text-sm text-slate-500 max-w-sm">Übersicht aller Führerscheine, Zertifikate und Fortbildungen Ihrer Mitarbeiter.</p>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PersonalModuleV2;

