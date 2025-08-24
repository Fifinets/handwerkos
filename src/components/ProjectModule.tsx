import React, { useState, useCallback, useEffect } from 'react';

// Type definitions
type ProjectStatus = 'anfrage' | 'besichtigung' | 'geplant' | 'in_bearbeitung' | 'abgeschlossen';

interface Customer {
  id: string;
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
}

interface ProjectCustomer {
  company_name?: string;
  contact_person?: string;
  email?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  budget?: number;
  start_date?: string;
  end_date?: string;
  customer_id?: string;
  created_at?: string;
  customers?: ProjectCustomer;
}

interface TeamMember {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  status?: string;
  company_id?: string;
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, CheckCircle, Clock, AlertTriangle, Building2, FileText, Edit, Calculator, TrendingUp, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  useProjects, 
  useCustomers, 
  useCreateProject,
  useUpdateProject,
  useDeleteProject
} from "@/hooks/useApi";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Skeleton } from "@/components/ui/skeleton";
import AddProjectDialog from "./AddProjectDialog";
import EditProjectDialog from "./EditProjectDialog";
import ProjectDetailDialogWithTasks from "./ProjectDetailDialogWithTasks";
import ProjectDetailView from "./ProjectDetailView";
import OrderModule from "./OrderModule";
import PreCalculationDialog from "./PreCalculationDialog";
import ProjectProfitabilityDialog from "./ProjectProfitabilityDialog";
import ProjectKpiBar from "./projects/ProjectKpiBar";
import StatusList, { type StatusCounts } from "./projects/StatusList";
import ProjectRow from "./projects/ProjectRow";
import EmptyState from "./projects/EmptyState";
import AutoFixDatabase from "./AutoFixDatabase";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'anfrage':
      return 'bg-purple-100 text-purple-800';
    case 'besichtigung':
      return 'bg-orange-100 text-orange-800';
    case 'geplant':
      return 'bg-blue-100 text-blue-800';
    case 'in_bearbeitung':
      return 'bg-yellow-100 text-yellow-800';
    case 'abgeschlossen':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'anfrage':
      return <FileText className="h-4 w-4 text-purple-600" />;
    case 'besichtigung':
      return <Building2 className="h-4 w-4 text-orange-600" />;
    case 'geplant':
      return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    case 'in_bearbeitung':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'abgeschlossen':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    default:
      return <CheckCircle className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusDisplayName = (status: string) => {
  switch (status) {
    case 'anfrage':
      return 'Anfrage';
    case 'besichtigung':
      return 'Termin ausmachen';
    case 'geplant':
      return 'In Planung';
    case 'in_bearbeitung':
      return 'In Arbeit';
    case 'abgeschlossen':
      return 'Erledigt';
    default:
      return status;
  }
};

const generateShortId = (fullId: string) => {
  const hash = fullId.split('-').join('');
  return `P${hash.substring(0, 6).toUpperCase()}`;
};

const extractBudgetFromDescription = (description: string) => {
  if (!description) return 0;
  const budgetMatch = description.match(/\[BUDGET:(\d+\.?\d*)\]/);
  return budgetMatch ? parseFloat(budgetMatch[1]) : 0;
};

const extractPreCalculationFromDescription = (description: string) => {
  if (!description) return null;
  const preCalcMatch = description.match(/\[PRECALC:(.*?)\]/);
  if (preCalcMatch) {
    try {
      return JSON.parse(preCalcMatch[1]);
    } catch (e) {
      console.warn('Error parsing pre-calculation:', e);
      return null;
    }
  }
  return null;
};

const hasPreCalculation = (description: string) => {
  return extractPreCalculationFromDescription(description) !== null;
};

const getEstimateInfo = (description: string) => {
  const preCalc = extractPreCalculationFromDescription(description);
  if (!preCalc) return null;
  
  const materialEstimates = preCalc.materials ? Object.keys(preCalc.materials).length : 0;
  const laborEstimates = preCalc.labor ? Object.keys(preCalc.labor).length : 0;
  
  return {
    totalEstimates: materialEstimates + laborEstimates,
    materials: materialEstimates,
    labor: laborEstimates
  };
};

const formatBudget = (budget: number, description: string) => {
  const budgetFromDesc = extractBudgetFromDescription(description);
  const budgetValue = budgetFromDesc > 0 ? budgetFromDesc : (budget || 0);
  
  return budgetValue.toLocaleString('de-DE', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  });
};

const ProjectModule = () => {
  const { toast } = useToast();
  const { companyId } = useSupabaseAuth();
  
  // React Query hooks
  const { data: projectsResponse, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: customersResponse, isLoading: customersLoading } = useCustomers();
  
  // Debug: Direct database query
  const [debugProjects, setDebugProjects] = useState([]);
  const [debugError, setDebugError] = useState(null);
  
  useEffect(() => {
    const fetchDebugProjects = async () => {
      try {
        console.log('DEBUG: Fetching projects directly...');
        const { data, error } = await supabase
          .from('projects')
          .select('*');
        
        console.log('DEBUG: Direct query result:', { data, error });
        setDebugProjects(data || []);
        setDebugError(error);
      } catch (err) {
        console.error('DEBUG: Direct query failed:', err);
        setDebugError(err);
      }
    };
    
    fetchDebugProjects();
  }, []);
  
  // Local state for employees (using same logic as PersonalModule)
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);
  
  // Fetch employees using PersonalModule logic
  const fetchEmployees = useCallback(async () => {
    try {
      setTeamLoading(true);
      
      console.log('ProjectModule: fetchEmployees called with companyId:', companyId);
      
      if (!companyId) {
        console.error('ProjectModule: No company ID available');
        setTeamLoading(false);
        return;
      }
      
      // Debug query - get ALL employees for this company
      const { data: allEmployeesData, error: debugError } = await supabase
        .from('employees')
        .select('id, email, status, user_id, company_id')
        .eq('company_id', companyId);
      
      console.log('ProjectModule: DEBUG - All employees for company:', allEmployeesData);
      
      // Main employees query
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          position,
          status,
          qualifications,
          license
        `)
        .eq('company_id', companyId)
        .eq('status', 'Aktiv') // Only show active employees
        .order('created_at', { ascending: false });

      console.log('ProjectModule: Employees query result:', employeesData, employeesError);

      if (employeesError) {
        console.error('ProjectModule: Error fetching employees:', employeesError);
        setTeamLoading(false);
        return;
      }

      // Fetch profile names separately for employees with user_id
      const userIds = employeesData?.filter(emp => emp.user_id).map(emp => emp.user_id) || [];
      let profilesData = [];
      
      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        
        if (!error) {
          profilesData = data || [];
        }
      }

      // Map employee data and filter for complete profiles
      const employeeList = employeesData?.map(employee => {
        const profile = profilesData.find(p => p.id === employee.user_id);
        const firstName = profile?.first_name || employee.first_name || '';
        const lastName = profile?.last_name || employee.last_name || '';
        
        return {
          id: employee.id,
          first_name: firstName,
          last_name: lastName,
          name: `${firstName} ${lastName}`.trim(),
          email: employee.email,
          phone: employee.phone,
          position: employee.position,
          status: employee.status,
          qualifications: employee.qualifications || [],
          license: employee.license,
          projects: [], // Add for compatibility with AddProjectDialog
          user_id: employee.user_id // Keep for filtering
        };
      })
      .filter(employee => {
        // Show employees that have a meaningful name
        // Accept if first_name OR last_name exists, or if combined name is not empty
        const hasFirstName = employee.first_name && employee.first_name.trim().length > 0;
        const hasLastName = employee.last_name && employee.last_name.trim().length > 0;
        const hasValidName = employee.name && employee.name.trim().length > 0 && employee.name.trim() !== ' ';
        
        const shouldInclude = hasFirstName || hasLastName || hasValidName;
        
        console.log('ProjectModule: Employee filter check:', {
          employee: employee.name,
          hasFirstName,
          hasLastName, 
          hasValidName,
          shouldInclude,
          user_id: employee.user_id
        });
        
        if (!shouldInclude) {
          console.log('ProjectModule: Filtering out employee without proper name:', employee);
        }
        
        return shouldInclude;
      }) || [];

      console.log('ProjectModule: Final employee list:', employeeList);
      setTeamMembers(employeeList);
    } catch (error) {
      console.error('ProjectModule: fetchEmployees error:', error);
    } finally {
      setTeamLoading(false);
    }
  }, [companyId]);

  // Fetch employees when component mounts or companyId changes
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);
  
  // Local state for dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isProjectDetailViewOpen, setIsProjectDetailViewOpen] = useState(false);
  const [isPreCalculationOpen, setIsPreCalculationOpen] = useState(false);
  const [isProfitabilityOpen, setIsProfitabilityOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Extract data from responses
  // Use debugProjects as fallback if the API hook fails
  const projects = projectsResponse?.items || debugProjects || [];
  const customers = customersResponse?.items || [];
  
  // Debug logging
  console.log('ProjectModule - projectsResponse:', projectsResponse);
  console.log('ProjectModule - projects:', projects);
  console.log('ProjectModule - projectsError:', projectsError);
  console.log('ProjectModule - debugProjects:', debugProjects);
  
  // Debug logging
  console.log('Customers data:', customers);
  console.log('Team members data:', teamMembers);
  console.log('Team members loading:', teamLoading);
  
  // Always use real data, with fallback only if completely empty
  const customersWithFallback = customers.length > 0 ? customers : [
    {
      id: 'demo_customer_1',
      name: 'Demo Kunde - Bitte echte Kunden hinzufügen',
      company_name: 'Demo Kunde',
      contact_person: 'Bitte echte Kunden hinzufügen',
      email: 'demo@example.com',
      phone: '+49 000 000000',
      address: 'Demo Adresse',
      projects: 0,
      revenue: '0',
      status: 'Demo'
    }
  ];
  
  // Use team members directly from state
  const teamMembersWithFallback = teamMembers;
  
  // Loading state
  const isLoading = projectsLoading || customersLoading || teamLoading;
  
  // Debug logging
  console.log('ProjectModule Debug:', {
    projectsResponse,
    projects,
    projectsLoading,
    projectsError,
    isLoading,
    debugProjects,
    debugError,
    companyId
  });
  
  // Calculate derived data
  const statusCounts: StatusCounts = {
    anfrage: projects.filter(p => p.status === 'anfrage').length,
    besichtigung: projects.filter(p => p.status === 'besichtigung').length,
    geplant: projects.filter(p => p.status === 'geplant').length,
    in_bearbeitung: projects.filter(p => p.status === 'in_bearbeitung').length,
    abgeschlossen: projects.filter(p => p.status === 'abgeschlossen').length
  };
  
  const totalBudget = projects.reduce((total, project) => {
    const budget = extractBudgetFromDescription(project.description) || project.budget || 0;
    return total + budget;
  }, 0);
  
  const today = new Date().toISOString().split('T')[0];
  const delayedProjects = projects.filter(project => 
    project.end_date && project.end_date < today && project.status !== 'abgeschlossen'
  );
  
  const topCustomers = customers.filter(c => c.status === 'Aktiv').slice(0, 5);

  const handleProjectAdded = () => {
    setIsAddDialogOpen(false);
  };

  const handleProjectUpdated = () => {
    setIsEditDialogOpen(false);
  };

  const handleProjectDeleted = () => {
    setIsEditDialogOpen(false);
  };

  const handleDoubleClickProject = (project: Project) => {
    setSelectedProjectId(project.id);
    setIsProjectDetailViewOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setIsEditDialogOpen(true);
  };

  const handlePreCalculation = (project: Project) => {
    setSelectedProject(project);
    setIsPreCalculationOpen(true);
  };

  const handleProfitabilityAnalysis = (project: Project) => {
    setSelectedProject(project);
    setIsProfitabilityOpen(true);
  };

  const handleCreateInvoice = (projectId: string, projectName: string) => {
    console.log(`Creating invoice for project ${projectId}: ${projectName}`);
    toast({
      title: "Rechnung erstellen",
      description: `Rechnung für ${projectName} wird erstellt...`,
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Auto-fix database if needed */}
      <AutoFixDatabase />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projekte & Baustellen</h1>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 rounded-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Neues Projekt
        </Button>
      </div>

      {/* KPI Bar */}
      <ProjectKpiBar
        active={projects.filter(p => p.status !== 'abgeschlossen').length}
        done={projects.filter(p => p.status === 'abgeschlossen').length}
        budget={totalBudget || 0}
        late={delayedProjects.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* linke 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-green-100 text-green-800 border-green-200">Aktuelle</span>
                <CardTitle>Projekte</CardTitle>
              </div>
              <div className="text-sm text-muted-foreground">Heute • {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="border rounded-xl p-3 shadow-softer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                ))
              ) : projects.filter(p => p.status !== 'abgeschlossen').length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p>Keine Projekte vorhanden</p>
                  <p className="text-xs mt-2">Debug: {debugProjects.length} Projekte in DB</p>
                  {debugError && <p className="text-xs text-red-500">Error: {debugError.message}</p>}
                  {projectsError && <p className="text-xs text-red-500">React Query Error: {projectsError.message}</p>}
                </div>
              ) : (
                projects.filter(p => p.status !== 'abgeschlossen').map((project) => (
                  <div 
                    key={project.id} 
                    className="border rounded-xl p-3 shadow-softer cursor-pointer hover:shadow-md transition-shadow"
                    onDoubleClick={() => handleDoubleClickProject(project)}
                  >
                    <ProjectRow
                      id={generateShortId(project.id)}
                      project_number={project.project_number}
                      name={project.name}
                      status={project.status}
                      budget={extractBudgetFromDescription(project.description) || project.budget || 0}
                      start={project.start_date}
                      end={project.end_date}
                      onOpen={() => handleDoubleClickProject(project)}
                      onEdit={() => handleEditProject(project)}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardHeader className="pb-2"><CardTitle>Verzögerte Projekte</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : delayedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Projekte im Verzug 🎉</p>
              ) : delayedProjects.map((project: Project) => (
                <div 
                  key={project.id} 
                  className="border rounded-xl p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow"
                  onDoubleClick={() => handleDoubleClickProject(project)}
                >
                  <ProjectRow 
                    id={generateShortId(project.id)} 
                    project_number={project.project_number}
                    name={project.name} 
                    status={project.status} 
                    budget={extractBudgetFromDescription(project.description) || project.budget || 0} 
                    start={project.start_date}
                    end={project.end_date}
                    onOpen={() => handleDoubleClickProject(project)}
                    onEdit={() => handleEditProject(project)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* rechte 1/3 */}
        <div className="space-y-4">
          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardHeader className="pb-2"><CardTitle>Projektstatus</CardTitle></CardHeader>
            <CardContent><StatusList counts={statusCounts} /></CardContent>
          </Card>

          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardHeader className="pb-2"><CardTitle>Top Kunden</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))
              ) : topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Hier erscheinen Kunden, sobald Projekte abgeschlossen sind.</p>
              ) : topCustomers.map((customer: Customer) => (
                <div key={customer.id} className="flex items-center justify-between text-sm">
                  <span>{customer.company_name || customer.contact_person}</span>
                  <span className="text-muted-foreground">{customer.email}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardHeader className="pb-2"><CardTitle>Projekt Übersicht</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-slate-50 text-slate-700 border-slate-200">Gesamt: {projects.length}</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-amber-50 text-amber-700 border-amber-200">In Planung: {statusCounts.geplant}</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200">In Arbeit: {statusCounts.in_bearbeitung}</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-green-50 text-green-700 border-green-200">Erledigt: {statusCounts.abgeschlossen}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <AddProjectDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onProjectAdded={handleProjectAdded}
        customers={customersWithFallback}
        teamMembers={teamMembersWithFallback}
      />

      <EditProjectDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        project={selectedProject}
        onProjectUpdated={handleProjectUpdated}
        onProjectDeleted={handleProjectDeleted}
      />

      <ProjectDetailDialogWithTasks
        isOpen={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        project={selectedProject}
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

      {selectedProject && (
        <PreCalculationDialog
          isOpen={isPreCalculationOpen}
          onClose={() => setIsPreCalculationOpen(false)}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          customerId={selectedProject.customer_id || ''}
          onCalculationSaved={() => {
            // React Query will automatically refetch due to cache invalidation
          }}
        />
      )}

      {selectedProject && (
        <ProjectProfitabilityDialog
          isOpen={isProfitabilityOpen}
          onClose={() => setIsProfitabilityOpen(false)}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
        />
      )}
    </div>
  );
};

export default ProjectModule;