import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
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
    AlertCircle,
    Loader2,
    UserX,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEmployees, QUERY_KEYS } from "@/hooks/useApi";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import EditEmployeeDialog from "@/components/personal/EditEmployeeDialog";
import { toast } from "sonner";
import AddEmployeeDialog from "@/components/personal/AddEmployeeDialog";

const PersonalModuleV2 = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

    const { inviteEmployee } = useSupabaseAuth();
    const queryClient = useQueryClient();
    const { data: employeesData, isLoading } = useEmployees();
    const employees: any[] = Array.isArray(employeesData)
        ? employeesData
        : (employeesData as any)?.items ?? [];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aktiv': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'aktiv': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Urlaub': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Krank': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Inaktiv': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            aktiv: 'Aktiv', Aktiv: 'Aktiv',
            urlaub: 'Urlaub', Urlaub: 'Urlaub',
            krank: 'Krank', Krank: 'Krank',
            inaktiv: 'Inaktiv', Inaktiv: 'Inaktiv',
        };
        return labels[status] ?? status;
    };

    const filteredEmployees = employees.filter(emp => {
        const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.toLowerCase();
        const pos = (emp.position ?? '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return fullName.includes(term) || pos.includes(term);
    });

    const handleAddEmployee = async (newEmployee: {
        email: string; firstName: string; lastName: string;
        position: string; phone: string; license: string; qualifications: string[];
    }) => {
        setIsAddingEmployee(true);
        try {
            const result = await inviteEmployee(newEmployee.email, {
                firstName: newEmployee.firstName,
                lastName: newEmployee.lastName,
                position: newEmployee.position,
                phone: newEmployee.phone,
                license: newEmployee.license,
                qualifications: newEmployee.qualifications,
            });
            if (!result.success) {
                toast.error(`Fehler: ${result.error}`);
                return;
            }
            toast.success(`${newEmployee.firstName} ${newEmployee.lastName} wurde eingeladen!`);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
            setIsAddEmployeeOpen(false);
        } catch {
            toast.error('Unerwarteter Fehler beim Einladen.');
        } finally {
            setIsAddingEmployee(false);
        }
    };

    const handleSaveEmployee = async (formData: any) => {
        if (!editingEmployee) return;
        const nameParts = (formData.name ?? '').split(' ');
        const first_name = nameParts[0] ?? '';
        const last_name = nameParts.slice(1).join(' ') ?? '';
        const { error } = await supabase
            .from('employees')
            .update({
                first_name,
                last_name,
                position: formData.position,
                phone: formData.phone,
                status: formData.status,
                license: formData.license,
                qualifications: formData.qualifications,
            })
            .eq('id', editingEmployee.id);
        if (error) {
            toast.error(`Fehler beim Speichern: ${error.message}`);
            return;
        }
        toast.success('Mitarbeiter erfolgreich aktualisiert.');
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
        setEditingEmployee(null);
    };

    const activeCount = employees.filter(e => ['Aktiv', 'aktiv', 'active'].includes(e.status ?? '')).length;
    const vacationCount = employees.filter(e => ['Urlaub', 'urlaub'].includes(e.status ?? '')).length;
    const sickCount = employees.filter(e => ['Krank', 'krank'].includes(e.status ?? '')).length;

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
                    <Button
                        className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
                        onClick={() => setIsAddEmployeeOpen(true)}
                    >
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
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : employees.length}
                            </h3>
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
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : activeCount}
                            </h3>
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
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : vacationCount}
                            </h3>
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
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : sickCount}
                            </h3>
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
                            {isLoading ? (
                                <div className="flex items-center justify-center py-16 text-slate-400">
                                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                    <span>Mitarbeiter werden geladen...</span>
                                </div>
                            ) : filteredEmployees.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <UserX className="h-10 w-10 mb-3" />
                                    <p className="font-medium text-slate-600">
                                        {searchTerm ? 'Keine Treffer gefunden' : 'Noch keine Mitarbeiter'}
                                    </p>
                                    <p className="text-sm mt-1">
                                        {searchTerm
                                            ? 'Versuchen Sie einen anderen Suchbegriff.'
                                            : 'Klicken Sie auf „Mitarbeiter einladen", um zu starten.'}
                                    </p>
                                </div>
                            ) : (
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
                                                                {(employee.first_name?.[0] ?? '?')}{(employee.last_name?.[0] ?? '')}
                                                            </div>
                                                            <div className="font-semibold text-slate-900">
                                                                {employee.first_name} {employee.last_name}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-slate-900 font-medium">{employee.position || '–'}</div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-600">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 text-xs">
                                                                <Mail className="h-3.5 w-3.5 text-slate-400" /> {employee.email}
                                                            </div>
                                                            {employee.phone && (
                                                                <div className="flex items-center gap-1.5 text-xs">
                                                                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {employee.phone}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <Badge variant="outline" className={`font-normal ${getStatusColor(employee.status ?? '')}`}>
                                                            {getStatusLabel(employee.status ?? 'Aktiv')}
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
                                                                <DropdownMenuItem onClick={() => setEditingEmployee(employee)}>Bearbeiten</DropdownMenuItem>
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
                            )}
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

            <AddEmployeeDialog
                isOpen={isAddEmployeeOpen}
                onClose={() => setIsAddEmployeeOpen(false)}
                onSubmit={handleAddEmployee}
                isLoading={isAddingEmployee}
            />

            <EditEmployeeDialog
                isOpen={!!editingEmployee}
                onClose={() => setEditingEmployee(null)}
                employee={editingEmployee ? {
                    id: editingEmployee.id,
                    name: `${editingEmployee.first_name ?? ''} ${editingEmployee.last_name ?? ''}`.trim(),
                    position: editingEmployee.position ?? '',
                    email: editingEmployee.email ?? '',
                    phone: editingEmployee.phone ?? '',
                    status: editingEmployee.status ?? 'Aktiv',
                    qualifications: editingEmployee.qualifications ?? [],
                    license: editingEmployee.license ?? '',
                    currentProject: '',
                    hoursThisMonth: 0,
                    vacationDays: 0,
                    role: editingEmployee.role ?? 'employee',
                    grants: editingEmployee.grants ?? [],
                } : null}
                onSave={handleSaveEmployee}
            />
        </div>
    );
};

export default PersonalModuleV2;
