import React, { useState, useCallback, useEffect } from 'react';

import type {
    Project,
    ProjectStatus,
    Customer,
    Employee as TeamMember
} from '@/types';

// Extended Project type for local usage if needed, or just use Project
interface ProjectWithCustomers extends Project {
    id: string; // Ensure id is required
    project_number?: string;
    customers?: {
        company_name?: string;
        contact_person?: string;
        email?: string;
    };
    // Compatibility fields for some sub-components
    customer?: any;
    progress?: number;
    startDate?: string;
    endDate?: string;
    team?: string[];
    location?: string;
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Plus,
    CheckCircle,
    Clock,
    AlertTriangle,
    Building2,
    FileText,
    Search,
    Filter,
    BarChart,
    HardHat,
    FolderOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
    useProjects,
    useCustomers
} from "@/hooks/useApi";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Skeleton } from "@/components/ui/skeleton";
import AddProjectDialog from "./AddProjectDialog";
import EditProjectDialog from "./EditProjectDialog";
import ProjectDetailDialogWithTasks from "./ProjectDetailDialogWithTasks";
import ProjectDetailView from "./ProjectDetailView";
import PreCalculationDialog from "./PreCalculationDialog";
import ProjectProfitabilityDialog from "./ProjectProfitabilityDialog";
import ProjectRow from "./projects/ProjectRow";
import AutoFixDatabase from "./AutoFixDatabase";

const getStatusColor = (status: string) => {
    switch (status) {
        case 'anfrage':
            return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'besichtigung':
            return 'bg-slate-50 text-blue-700 border-blue-200';
        case 'geplant':
            return 'bg-slate-50 text-indigo-700 border-indigo-200';
        case 'in_bearbeitung':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'abgeschlossen':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        default:
            return 'bg-gray-50 text-gray-700 border-gray-200';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'anfrage':
            return <FileText className="h-4 w-4 text-slate-500" />;
        case 'besichtigung':
            return <Search className="h-4 w-4 text-slate-500" />;
        case 'geplant':
            return <FolderOpen className="h-4 w-4 text-slate-500" />;
        case 'in_bearbeitung':
            return <HardHat className="h-4 w-4 text-amber-500" />;
        case 'abgeschlossen':
            return <CheckCircle className="h-4 w-4 text-emerald-500" />;
        default:
            return <FileText className="h-4 w-4 text-gray-500" />;
    }
};

const extractBudgetFromDescription = (description: string) => {
    if (!description) return 0;
    const budgetMatch = description.match(/\[BUDGET:(\d+\.?\d*)\]/);
    return budgetMatch ? parseFloat(budgetMatch[1]) : 0;
};

const ProjectModuleV2 = () => {
    const { toast } = useToast();
    const { companyId } = useSupabaseAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [showCompleted, setShowCompleted] = useState(false);

    // React Query hooks
    const { data: projectsResponse, isLoading: projectsLoading, error: projectsError } = useProjects();
    const { data: customersResponse, isLoading: customersLoading } = useCustomers();

    // Debug: Direct database query
    const [debugProjects, setDebugProjects] = useState<ProjectWithCustomers[]>([]);
    const [debugError, setDebugError] = useState<any>(null);

    useEffect(() => {
        const fetchDebugProjects = async () => {
            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*');

                setDebugProjects((data as any) || []);
                setDebugError(error);
            } catch (err) {
                setDebugError(err);
            }
        };

        fetchDebugProjects();
    }, []);

    // Local state for employees
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [teamLoading, setTeamLoading] = useState(true);

    const fetchEmployees = useCallback(async () => {
        try {
            setTeamLoading(true);
            if (!companyId) {
                setTeamLoading(false);
                return;
            }

            console.log('Fetching employees for companyId:', companyId);

            // 1. Fetch employees basic data
            const { data: employeesData, error: employeesError } = await supabase
                .from('employees')
                .select('id, user_id, first_name, last_name, email, phone, position, status')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (employeesError) {
                console.error('Error fetching employees:', employeesError);
                setTeamLoading(false);
                return;
            }

            console.log('Found employees:', employeesData?.length);

            // 2. Fetch project assignments separately to be more robust
            const { data: assignmentsData, error: assignmentsError } = await supabase
                .from('project_team_members')
                .select(`
                    employee_id,
                    projects(
                        name,
                        start_date,
                        end_date
                    )
                `);

            if (assignmentsError) {
                console.warn('Error fetching project assignments (ignoring):', assignmentsError);
                // We continue even if assignments fail, just no availability check
            }

            const userIds = employeesData?.filter(emp => emp.user_id).map(emp => emp.user_id) || [];
            let profilesData: any[] = [];


            if (userIds.length > 0) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, first_name, last_name')
                    .in('id', userIds);

                if (!error) {
                    profilesData = data || [];
                }
            }

            const employeeList = (employeesData || [])
                .filter(employee => {
                    // Inclusion filter: handle various 'active' status strings
                    const status = (employee.status || '').toLowerCase();
                    return status === 'aktiv' || status === 'active' || status === '' || status === 'eingeladen';
                })
                .map(employee => {
                    const profile = profilesData.find(p => p.id === employee.user_id);
                    const firstName = profile?.first_name || employee.first_name || '';
                    const lastName = profile?.last_name || employee.last_name || '';
                    const fullName = `${firstName} ${lastName}`.trim();

                    // Map project assignments from the separate data
                    const projectAssignments = (assignmentsData || [])
                        .filter(a => a.employee_id === employee.id)
                        .map(ptm => ptm.projects)
                        .filter(p => p && (p as any).start_date)
                        .map(p => ({
                            name: (p as any).name,
                            // Convert YYYY-MM-DD to DD.MM.YYYY for the availability logic
                            startDate: (p as any).start_date.split('-').reverse().join('.'),
                            endDate: ((p as any).end_date || (p as any).start_date).split('-').reverse().join('.')
                        }));

                    return {
                        id: employee.id,
                        first_name: firstName,
                        last_name: lastName,
                        name: fullName || employee.email || 'Unbekannter Mitarbeiter',
                        email: employee.email,
                        phone: employee.phone,
                        position: employee.position,
                        status: employee.status,
                        user_id: employee.user_id,
                        projects: projectAssignments
                    };
                })
                .filter(employee => {
                    // Ensure we have at least a name or ID or email to show
                    return employee.name !== 'Unbekannter Mitarbeiter' || employee.id || employee.email;
                });

            console.log('Final employee list:', employeeList);
            setTeamMembers(employeeList);

        } catch (error) {
            console.error('ProjectModule: fetchEmployees error:', error);
        } finally {
            setTeamLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Local state for dialogs
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [isProjectDetailViewOpen, setIsProjectDetailViewOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<ProjectWithCustomers | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const projects = (projectsResponse?.items || debugProjects || []) as ProjectWithCustomers[];
    const customers = customersResponse?.items || [];

    // Filter projects based on search and status
    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.project_number && p.project_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.customers?.company_name && p.customers.company_name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        // If showCompleted is false, only show active projects
        if (!showCompleted && p.status === 'abgeschlossen') return false;

        return true;
    });

    const customersWithFallback = customers.length > 0 ? customers : [
        {
            id: 'demo_customer_1',
            name: 'Demo Kunde',
            company_name: 'Demo Kunde',
            contact_person: 'Bitte echte Kunden hinzufügen',
            email: 'demo@example.com',
            phone: '+49 000 000000',
            address: 'Demo Adresse',
            status: 'Demo'
        }
    ];

    const isLoading = projectsLoading || customersLoading || teamLoading;

    // Derived data
    const statusCounts = {
        anfrage: projects.filter(p => p.status === 'anfrage').length,
        besichtigung: projects.filter(p => p.status === 'besichtigung').length,
        geplant: projects.filter(p => p.status === 'geplant').length,
        in_bearbeitung: projects.filter(p => p.status === 'in_bearbeitung').length,
        abgeschlossen: projects.filter(p => p.status === 'abgeschlossen').length
    };

    const today = new Date().toISOString().split('T')[0];
    const delayedProjects = projects.filter(project =>
        project.end_date && project.end_date < today && project.status !== 'abgeschlossen'
    );

    const activeProjectsCount = projects.filter(p => p.status !== 'abgeschlossen').length;
    const generateShortId = (fullId: string) => {
        const hash = fullId.split('-').join('');
        return `P${hash.substring(0, 6).toUpperCase()}`;
    };

    const handleDoubleClickProject = (project: ProjectWithCustomers) => {
        setSelectedProjectId(project.id);
        setIsProjectDetailViewOpen(true);
    };

    const handleEditProject = (project: ProjectWithCustomers) => {
        setSelectedProject(project);
        setIsEditDialogOpen(true);
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <AutoFixDatabase />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Projekte</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Ihre aktiven Baustellen und laufenden Aufträge.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Projekt suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-[250px] bg-white border-slate-200"
                        />
                    </div>
                    <Button
                        onClick={() => setShowCompleted(!showCompleted)}
                        variant={showCompleted ? "default" : "outline"}
                        className={showCompleted ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white border-slate-200"}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        {showCompleted ? "Alle Projekte" : "Nur aktive"}
                    </Button>
                    <Button onClick={() => setIsAddDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Neues Projekt
                    </Button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Aktive Projekte</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{activeProjectsCount}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <HardHat className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Abgeschlossen (Gesamt)</p>
                            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{statusCounts.abgeschlossen}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Im Verzug</p>
                            <h3 className="text-2xl font-bold text-rose-600 mt-1">{delayedProjects.length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-rose-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">In Planung</p>
                            <h3 className="text-2xl font-bold text-slate-600 mt-1">{statusCounts.geplant}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <FolderOpen className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main List Area (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="border-b border-slate-100 pb-4">
                            <CardTitle className="text-lg font-semibold text-slate-800">Projektliste</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-6 space-y-4">
                                    {Array(4).fill(0).map((_, i) => (
                                        <div key={i} className="flex flex-col space-y-3">
                                            <Skeleton className="h-[70px] w-full rounded-lg" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center">
                                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <HardHat className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900 mb-1">Keine Projekte gefunden</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        {searchTerm ? `Wir konnten keine Ergebnisse für "${searchTerm}" finden.` : 'Erstellen Sie Ihr erstes Projekt, um den Überblick zu behalten.'}
                                    </p>
                                    {!searchTerm && (
                                        <Button onClick={() => setIsAddDialogOpen(true)} className="mt-6 bg-slate-900 text-white">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Erstes Projekt anlegen
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredProjects.map((project) => (
                                        <div
                                            key={project.id}
                                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer group ${
                                                project.status === 'abgeschlossen' ? 'opacity-70 hover:opacity-100' : ''
                                            }`}
                                            onDoubleClick={() => handleDoubleClickProject(project)}
                                        >
                                            <ProjectRow
                                                id={generateShortId(project.id)}
                                                project_number={project.project_number}
                                                name={project.name}
                                                status={project.status as any}
                                                budget={extractBudgetFromDescription(project.description || '') || project.budget || 0}
                                                start={project.start_date}
                                                end={project.end_date}
                                                onOpen={() => handleDoubleClickProject(project)}
                                                onEdit={() => handleEditProject(project)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Area (1/3 width) */}
                <div className="space-y-6">
                    {/* Delayed Projects */}
                    {delayedProjects.length > 0 && (
                        <Card className="bg-white border-rose-200 shadow-sm overflow-hidden">
                            <div className="bg-rose-50 border-b border-rose-100 px-5 py-3 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                                <h3 className="font-semibold text-rose-900">Projekte im Verzug ({delayedProjects.length})</h3>
                            </div>
                            <CardContent className="p-0 divide-y divide-slate-100">
                                {delayedProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="p-4 hover:bg-rose-50/50 cursor-pointer transition-colors"
                                        onClick={() => handleDoubleClickProject(project)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-slate-800 text-sm truncate pr-2">{project.name}</span>
                                            <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-800 border-rose-200 shrink-0">Überfällig</Badge>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                            <span>Ref: {project.project_number || generateShortId(project.id)}</span>
                                            <span className="text-rose-600 font-medium">Enddatum: {project.end_date ? new Date(project.end_date).toLocaleDateString('de-DE') : '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Status Distribution */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="border-b border-slate-100 pb-4">
                            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <BarChart className="h-4 w-4 text-slate-500" />
                                Statusübersicht
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-3">
                                {[
                                    { key: 'anfrage', label: 'Anfrage', color: 'bg-slate-300', count: statusCounts.anfrage },
                                    { key: 'besichtigung', label: 'Besichtigung', color: 'bg-blue-400', count: statusCounts.besichtigung },
                                    { key: 'geplant', label: 'In Planung', color: 'bg-indigo-400', count: statusCounts.geplant },
                                    { key: 'in_bearbeitung', label: 'In Arbeit', color: 'bg-amber-400', count: statusCounts.in_bearbeitung },
                                    { key: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-emerald-400', count: statusCounts.abgeschlossen },
                                ].map(stat => (
                                    <div key={stat.key}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-600">{stat.label}</span>
                                            <span className="font-medium text-slate-900">{stat.count}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${stat.color}`}
                                                style={{ width: `${projects.length > 0 ? (stat.count / projects.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AddProjectDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onProjectAdded={() => setIsAddDialogOpen(false)}
                customers={customersWithFallback as any}
                teamMembers={teamMembers}
            />

            <EditProjectDialog
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                project={selectedProject as any}
                onProjectUpdated={() => setIsEditDialogOpen(false)}
                onProjectDeleted={() => setIsEditDialogOpen(false)}
            />

            <ProjectDetailDialogWithTasks
                isOpen={isDetailDialogOpen}
                onClose={() => setIsDetailDialogOpen(false)}
                project={selectedProject as any}
            />

            {selectedProjectId && (
                <ProjectDetailView
                    isOpen={isProjectDetailViewOpen}
                    onClose={() => {
                        setIsProjectDetailViewOpen(false);
                        setSelectedProjectId(null);
                    }}
                    projectId={selectedProjectId}
                />
            )}
        </div>
    );
};

export default ProjectModuleV2;

