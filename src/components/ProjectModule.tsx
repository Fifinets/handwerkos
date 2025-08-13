import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, CheckCircle, Clock, AlertTriangle, Building2, FileText, Edit, Calculator, TrendingUp, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { workflowService } from "@/services/WorkflowService";
import { useToast } from "@/hooks/use-toast";
import AddProjectDialog from "./AddProjectDialog";
import EditProjectDialog from "./EditProjectDialog";
import ProjectDetailDialogWithTasks from "./ProjectDetailDialogWithTasks";
import ProjectDetailView from "./ProjectDetailView";
import OrderModule from "./OrderModule";
import PreCalculationDialog from "./PreCalculationDialog";
import ProjectProfitabilityDialog from "./ProjectProfitabilityDialog";
import ProjectKpiBar from "./projects/ProjectKpiBar";
import StatusList from "./projects/StatusList";
import ProjectRow from "./projects/ProjectRow";
import EmptyState from "./projects/EmptyState";

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
      return 'Besichtigung';
    case 'geplant':
      return 'Planung';
    case 'in_bearbeitung':
      return 'In Bearbeitung';
    case 'abgeschlossen':
      return 'Abgeschlossen';
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
  const [projects, setProjects] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ 
    anfrage: 0, 
    besichtigung: 0, 
    geplant: 0, 
    in_bearbeitung: 0, 
    abgeschlossen: 0 
  });
  const [topCustomers, setTopCustomers] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [delayedProjects, setDelayedProjects] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isProjectDetailViewOpen, setIsProjectDetailViewOpen] = useState(false);
  const [isPreCalculationOpen, setIsPreCalculationOpen] = useState(false);
  const [isProfitabilityOpen, setIsProfitabilityOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [customers, setCustomers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchTopCustomers();
    fetchCustomers();
    fetchTeamMembers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('status', 'Aktiv');
    
    if (data) {
      setCustomers(data.map(customer => ({
        id: customer.id,
        name: customer.company_name,
        contact: customer.contact_person,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        projects: 0,
        revenue: '€0',
        status: customer.status
      })));
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data: currentUserProfile } = await supabase.auth.getUser();
      if (!currentUserProfile?.user) return;

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', currentUserProfile.user.id)
        .single();

      if (!userProfile?.company_id) return;

      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .neq('status', 'eingeladen');

      if (employees) {
        setTeamMembers(employees);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      if (data) {
        setProjects(data);
        
        const counts = {
          anfrage: 0,
          besichtigung: 0,
          geplant: 0,
          in_bearbeitung: 0,
          abgeschlossen: 0
        };

        let budget = 0;
        const delayed = [];
        const today = new Date().toISOString().split('T')[0];

        data.forEach(project => {
          if (counts.hasOwnProperty(project.status)) {
            counts[project.status]++;
          }

          const projectBudget = extractBudgetFromDescription(project.description) || project.budget || 0;
          budget += projectBudget;

          if (project.end_date && project.end_date < today && project.status !== 'abgeschlossen') {
            delayed.push(project);
          }
        });

        setStatusCounts(counts);
        setTotalBudget(budget);
        setDelayedProjects(delayed);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchTopCustomers = async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('status', 'Aktiv')
        .limit(5);

      if (data) {
        setTopCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching top customers:', error);
    }
  };

  const handleProjectAdded = () => {
    fetchProjects();
    setIsAddDialogOpen(false);
  };

  const handleProjectUpdated = () => {
    fetchProjects();
    setIsEditDialogOpen(false);
  };

  const handleProjectDeleted = () => {
    fetchProjects();
    setIsEditDialogOpen(false);
  };

  const handleDoubleClickProject = (project) => {
    setSelectedProjectId(project.id);
    setIsProjectDetailViewOpen(true);
  };

  const handlePreCalculation = (project) => {
    setSelectedProject(project);
    setIsPreCalculationOpen(true);
  };

  const handleProfitabilityAnalysis = (project) => {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projekte & Baustellen</h1>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
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
          <Card className="shadow-soft">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="badge-pill bg-green-100 text-green-800 border-green-200">Aktuelle</span>
                <CardTitle>Projekte</CardTitle>
              </div>
              <div className="text-sm text-muted-foreground">Heute • {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.filter(p => p.status !== 'abgeschlossen').length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Projekte vorhanden</p>
              ) : (
                projects.filter(p => p.status !== 'abgeschlossen').map((project) => (
                  <div key={project.id} className="border rounded-xl p-3 shadow-softer">
                    <ProjectRow
                      id={generateShortId(project.id)}
                      name={project.name}
                      status={project.status as any}
                      budget={extractBudgetFromDescription(project.description) || project.budget || 0}
                      start={project.start_date}
                      end={project.end_date}
                      progress={project.status === 'abgeschlossen' ? 100 : 
                               project.status === 'in_bearbeitung' ? 60 : 
                               project.status === 'geplant' ? 30 : 10}
                      onOpen={() => handleDoubleClickProject(project)}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-2"><CardTitle>Verzögerte Projekte</CardTitle></CardHeader>
            <CardContent>
              {delayedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Projekte im Verzug 🎉</p>
              ) : delayedProjects.map((project: any) => (
                <div key={project.id} className="border rounded-xl p-3 mb-2">
                  <ProjectRow 
                    id={generateShortId(project.id)} 
                    name={project.name} 
                    status={project.status} 
                    budget={extractBudgetFromDescription(project.description) || project.budget || 0} 
                    progress={project.status === 'abgeschlossen' ? 100 : 
                             project.status === 'in_bearbeitung' ? 60 : 
                             project.status === 'geplant' ? 30 : 10}
                    onOpen={() => handleDoubleClickProject(project)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* rechte 1/3 */}
        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="pb-2"><CardTitle>Projektstatus</CardTitle></CardHeader>
            <CardContent><StatusList counts={statusCounts} /></CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-2"><CardTitle>Top Kunden</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Hier erscheinen Kunden, sobald Projekte abgeschlossen sind.</p>
              ) : topCustomers.map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between text-sm">
                  <span>{customer.company_name || customer.contact_person}</span>
                  <span className="text-muted-foreground">{customer.email}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-2"><CardTitle>Projekt Übersicht</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <span className="badge-pill bg-slate-50   text-slate-700  border-slate-200">Gesamt: {projects.length}</span>
              <span className="badge-pill bg-amber-50  text-amber-700 border-amber-200">Planung: {statusCounts.geplant}</span>
              <span className="badge-pill bg-blue-50   text-blue-700  border-blue-200">In Bearbeitung: {statusCounts.in_bearbeitung}</span>
              <span className="badge-pill bg-green-50  text-green-700 border-green-200">Abgeschlossen: {statusCounts.abgeschlossen}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <AddProjectDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onProjectAdded={handleProjectAdded}
        customers={customers}
        teamMembers={teamMembers}
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
          onCalculationSaved={async () => {
            await fetchProjects();
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