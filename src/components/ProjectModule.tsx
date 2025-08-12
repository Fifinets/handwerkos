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
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Projekte & Baustellen</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">🌙 Dark Mode</span>
          <span className="text-sm text-gray-500">👥 Mitarbeiter-Ansicht</span>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Neues Projekt
          </Button>
        </div>
      </div>

      {/* Sticky KPIs exactly like HTML reference */}
      <section 
        className="sticky top-0 z-10 backdrop-blur-sm bg-white/85 border border-slate-900/6 p-3 rounded-2xl shadow-lg grid grid-cols-4 gap-3 mb-4"
        style={{ backdropFilter: 'saturate(1.2) blur(6px)' }}
        aria-label="Kennzahlen"
      >
        <div className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 font-semibold mb-1">Aktive Projekte</div>
            <div className="text-2xl font-bold text-gray-900">
              {statusCounts.in_bearbeitung + statusCounts.geplant + statusCounts.anfrage + statusCounts.besichtigung}
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 font-semibold mb-1">Abgeschlossene</div>
            <div className="text-2xl font-bold text-gray-900">{statusCounts.abgeschlossen}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 font-semibold mb-1">Gesamtbudget</div>
            <div className="text-2xl font-bold text-gray-900">€{totalBudget.toLocaleString('de-DE')}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 font-semibold mb-1">Verspätet</div>
            <div className="text-2xl font-bold text-gray-900">{delayedProjects.length}</div>
          </div>
        </div>
      </section>

      {/* Main Content - Full Width */}
      <div className="space-y-6">
        {/* Content Grid exactly like HTML */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <article className="bg-white border border-slate-200/60 rounded-2xl shadow-lg">
              <header className="flex items-center justify-between p-4 border-b border-slate-200/60">
                <h3 className="text-lg font-semibold text-gray-900">Aktuelle Projekte</h3>
                <div className="text-gray-600 text-sm">Heute • {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
              </header>
            <div className="p-3">
              {projects.filter(p => p.status !== 'abgeschlossen').length > 0 ? 
                projects.filter(p => p.status !== 'abgeschlossen').map(project => {
                  const statusColor = project.status === 'geplant' ? 'bg-orange-100 text-orange-800' : 
                                     project.status === 'in_bearbeitung' ? 'bg-blue-100 text-blue-800' : 
                                     'bg-purple-100 text-purple-800';
                  
                  return (
                    <div 
                      key={project.id} 
                      className="project flex flex-col gap-3 mb-6 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                      onDoubleClick={() => handleDoubleClickProject(project)}
                    >
                      <div className="row flex items-center gap-3 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full border ${statusColor === 'bg-orange-100 text-orange-800' ? 'bg-orange-50 text-orange-700 border-orange-200' : statusColor === 'bg-blue-100 text-blue-800' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                          {getStatusDisplayName(project.status)}
                        </span>
                        <strong className="text-gray-900">{project.name}</strong>
                        <span className="text-xs px-2 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          ID: {generateShortId(project.id)}
                        </span>
                      </div>
                      <div className="meta text-gray-600 text-sm">
                        Start: {new Date(project.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • 
                        Ende: {project.end_date ? new Date(project.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'Offen'} • 
                        Budget: <strong className="text-green-600">€{formatBudget(project.budget, project.description)}</strong>
                      </div>
                      <div className="progress h-3 rounded-full bg-slate-200 overflow-hidden relative" role="progressbar" aria-valuenow="55" aria-valuemin="0" aria-valuemax="100">
                        <span 
                          className="block h-full bg-gradient-to-r from-blue-600 to-blue-400"
                          style={{
                            width: project.status === 'abgeschlossen' ? '100%' : 
                                   project.status === 'in_bearbeitung' ? '60%' : 
                                   project.status === 'geplant' ? '30%' : '10%'
                          }}
                        ></span>
                        <div className="ticks absolute inset-0 grid grid-cols-12" aria-hidden="true">
                          {Array.from({length: 12}).map((_, i) => (
                            <i key={i} className="border-r border-dashed border-slate-300/40"></i>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDoubleClickProject(project); }}
                          className="btn inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white shadow-sm cursor-pointer text-gray-900 hover:bg-gray-50"
                          title="Projekt öffnen"
                        >
                          🔎 Öffnen
                        </button>
                        <button className="btn inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white shadow-sm cursor-pointer text-gray-900 hover:bg-gray-50"
                               title="Zeiterfassung">
                          ⏱️ Zeit
                        </button>
                        <button className="btn inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white shadow-sm cursor-pointer text-gray-900 hover:bg-gray-50"
                               title="Dateien">
                          📎 Dateien
                        </button>
                      </div>
                    </div>
                  );
                  }) : (
                    <div className="text-center py-8 text-gray-500">
                      Keine aktiven Projekte vorhanden
                    </div>
                  )}
              </div>
            </div>
          </div>
          
          {/* Right Column - Sidebar Content */}
          <div className="col-span-4 space-y-4">
            {/* Projektstatus */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3 text-sm">Projektstatus</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-gray-700">Anfrage</span>
                  </div>
                  <span className="text-xs font-medium">{statusCounts.anfrage}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-xs text-gray-700">Besichtigung</span>
                  </div>
                  <span className="text-xs font-medium">{statusCounts.besichtigung}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-xs text-gray-700">Planung</span>
                  </div>
                  <span className="text-xs font-medium">{statusCounts.geplant}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-gray-700">In Bearbeitung</span>
                  </div>
                  <span className="text-xs font-medium">{statusCounts.in_bearbeitung}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-gray-700">Abgeschlossen</span>
                  </div>
                  <span className="text-xs font-medium">{statusCounts.abgeschlossen}</span>
                </div>
              </div>
            </div>

            {/* Top Kunden */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3 text-sm">Top Kunden</h3>
              <div className="space-y-2">
                {topCustomers.length > 0 ? topCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="flex justify-between items-center">
                    <span className="text-xs text-gray-700 truncate">{customer.company_name || customer.contact_person}</span>
                    <span className="text-xs text-gray-500">{customer.email}</span>
                  </div>
                )) : (
                  <div className="text-xs text-gray-500 text-center">Keine Kunden</div>
                )}
              </div>
            </div>

            {/* Projekt Übersicht */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3 text-sm">Projekt Übersicht</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Gesamt: {projects.length}</span>
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Planung: {statusCounts.geplant}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">In Bearbeitung: {statusCounts.in_bearbeitung}</span>
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Abgeschlossen: {statusCounts.abgeschlossen}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Verzögerte Projekte - Full Width */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Verzögerte Projekte</h2>
          </div>
          <div className="p-4">
            {delayedProjects.length > 0 ? (
              <div className="space-y-2">
                {delayedProjects.map(project => (
                  <div key={project.id} className="text-xs text-red-600">
                    {project.name} - {new Date(project.end_date).toLocaleDateString('de-DE')}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6 text-sm">Keine Projekte im Verzug 🎉</p>
            )}
          </div>
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