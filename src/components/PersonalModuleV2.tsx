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
import { useFeatureAccess } from "@/hooks/useSubscription";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";

const PersonalModuleV2 = () => {
    const { hasAccess, isLoading: accessLoading, requiredPlan } = useFeatureAccess('employee_management');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
    // Wage editing state: { [employeeId]: string }
    const [wageEdits, setWageEdits] = useState<Record<string, string>>({});
    const [savingWage, setSavingWage] = useState<Record<string, boolean>>({});


    const { inviteEmployee } = useSupabaseAuth();
    const queryClient = useQueryClient();
    const { data: employeesData, isLoading } = useEmployees();
    const employees: Record<string, unknown>[] = Array.isArray(employeesData)
        ? employeesData
        : (employeesData as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];

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

    const saveWage = async (employeeId: string) => {
        const raw = wageEdits[employeeId];
        const wage = parseFloat(raw?.replace(',', '.') ?? '');
        if (isNaN(wage) || wage < 0) {
            toast.error('Bitte einen gültigen Stundensatz eingeben.');
            return;
        }
        setSavingWage(prev => ({ ...prev, [employeeId]: true }));
        const { error } = await supabase
            .from('employees')
            .update({ hourly_wage: wage })
            .eq('id', employeeId);
        setSavingWage(prev => ({ ...prev, [employeeId]: false }));
        if (error) {
            toast.error(`Fehler: ${error.message}`);
            return;
        }
        toast.success('Stundensatz gespeichert.');
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
        // Clear edit state so it shows the fresh value from DB
        setWageEdits(prev => { const n = { ...prev }; delete n[employeeId]; return n; });
    };

    const activeCount = employees.filter(e => ['Aktiv', 'aktiv', 'active'].includes(e.status ?? '')).length;
    const vacationCount = employees.filter(e => ['Urlaub', 'urlaub'].includes(e.status ?? '')).length;
    const sickCount = employees.filter(e => ['Krank', 'krank'].includes(e.status ?? '')).length;

    if (!accessLoading && !hasAccess) {
        return <UpgradePrompt feature="Mitarbeiterverwaltung" requiredPlan={requiredPlan || 'pro'} />;
    }

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
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-slate-900">Stundensätze verwalten</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Netto-Verrechnungssatz pro Mitarbeiter (wird automatisch in Angebote übernommen)</p>
                            </div>
                        </div>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12 text-slate-400">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    Lade Mitarbeiter...
                                </div>
                            ) : employees.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    <Banknote className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-sm">Noch keine Mitarbeiter vorhanden.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-5 py-3 text-left">Mitarbeiter</th>
                                            <th className="px-5 py-3 text-left">Position</th>
                                            <th className="px-5 py-3 text-right">Stundensatz (Netto)</th>
                                            <th className="px-5 py-3 text-right">Aktion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {employees.map(emp => {
                                            const currentWage = emp.hourly_wage ?? 0;
                                            const editVal = wageEdits[emp.id];
                                            const isEditing = editVal !== undefined;
                                            return (
                                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm border border-slate-200 flex-shrink-0">
                                                                {(emp.first_name?.[0] ?? '?')}{(emp.last_name?.[0] ?? '')}
                                                            </div>
                                                            <span className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500">{emp.position || '–'}</td>
                                                    <td className="px-5 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={isEditing ? editVal : currentWage.toFixed(2)}
                                                                    onChange={(e) => setWageEdits(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') saveWage(emp.id); if (e.key === 'Escape') setWageEdits(prev => { const n = { ...prev }; delete n[emp.id]; return n; }); }}
                                                                    className="w-28 text-right pr-7 pl-3 h-9 border border-slate-200 rounded-md text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white hover:border-slate-300 transition-colors"
                                                                />
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">€</span>
                                                            </div>
                                                            <span className="text-xs text-slate-400">/Std</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 bg-slate-900 hover:bg-slate-800 text-white text-xs"
                                                                    onClick={() => saveWage(emp.id)}
                                                                    disabled={savingWage[emp.id]}
                                                                >
                                                                    {savingWage[emp.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Speichern'}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 text-xs text-slate-500"
                                                                    onClick={() => setWageEdits(prev => { const n = { ...prev }; delete n[emp.id]; return n; })}
                                                                >
                                                                    Abbruch
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">
                                                                {currentWage > 0 ? `${currentWage.toFixed(2)} €/Std` : 'Nicht gesetzt'}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={2} className="px-5 py-3 text-slate-500 text-xs font-medium">Ø Stundensatz</td>
                                            <td className="px-5 py-3 text-right text-sm font-bold text-slate-900">
                                                {(() => {
                                                    const waged = employees.filter(e => (e.hourly_wage ?? 0) > 0);
                                                    if (waged.length === 0) return '–';
                                                    const avg = waged.reduce((s, e) => s + (e.hourly_wage ?? 0), 0) / waged.length;
                                                    return `${avg.toFixed(2)} €/Std`;
                                                })()}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </CardContent>
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
