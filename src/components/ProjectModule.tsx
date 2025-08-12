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
    <div className="p-[22px] min-h-screen" style={{ background: 'radial-gradient(1200px 800px at 70% -100px, rgba(99,102,241,.08) 0%, transparent 70%), #f6f8fc' }}>
      {/* Topbar exakt wie im HTML */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[22px] font-bold text-gray-900">Projekte & Baustellen</div>
        <div className="flex gap-2 items-center">
          <button className="inline-flex items-center gap-2 h-10 px-[14px] rounded-xl border border-gray-200 bg-white shadow-sm cursor-pointer text-gray-900 hover:bg-gray-50">
            🌙 Dark Mode
          </button>
          <button className="inline-flex items-center gap-2 h-10 px-[14px] rounded-xl border border-gray-200 bg-white shadow-sm cursor-pointer text-gray-900 hover:bg-gray-50">
            👥 Mitarbeiter-Ansicht
          </button>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-[14px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-transparent"
          >
            ＋ Neues Projekt
          </Button>
        </div>
      </div>

      {/* Sticky KPIs exakt wie im HTML */}
      <section 
        className="sticky top-0 z-10 backdrop-blur-sm bg-white/85 border border-slate-900/6 p-3 rounded-[14px] shadow-lg grid grid-cols-4 gap-3 mb-4"
        style={{ backdropFilter: 'saturate(1.2) blur(6px)' }}
        aria-label="Kennzahlen"
      >
        <div className="bg-white border border-slate-100/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <h4 className="margin-0 text-[13px] text-gray-600 font-semibold">Aktive Projekte</h4>
            <div className="text-[20px] font-bold text-gray-900">
              {statusCounts.in_bearbeitung + statusCounts.geplant + statusCounts.anfrage + statusCounts.besichtigung}
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-100/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <h4 className="margin-0 text-[13px] text-gray-600 font-semibold">Abgeschlossene</h4>
            <div className="text-[20px] font-bold text-gray-900">{statusCounts.abgeschlossen}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-100/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <h4 className="margin-0 text-[13px] text-gray-600 font-semibold">Gesamtbudget</h4>
            <div className="text-[20px] font-bold text-gray-900">€{totalBudget.toLocaleString('de-DE')}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-100/60 rounded-xl p-3 flex items-center justify-between">
          <div>
            <h4 className="margin-0 text-[13px] text-gray-600 font-semibold">Verspätet</h4>
            <div className="text-[20px] font-bold text-gray-900">{delayedProjects.length}</div>
          </div>
        </div>
      </section>

      {/* Content Grid exakt wie im HTML */}
      <section className="grid grid-cols-[1.5fr_0.8fr] gap-4" aria-label="Hauptinhalte">
        <div className="col-left">
          {/* Aktuelle Projekte */}
          <article className="bg-white border border-slate-100/60 rounded-[14px] shadow-lg">
            <header className="flex items-center justify-between p-[14px_16px] border-b border-slate-100/60">
              <h3 className="m-0 text-[16px] font-semibold text-gray-900">Aktuelle Projekte</h3>
              <div className="text-gray-600 text-sm">Heute • {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
            </header>
            <div className="p-[12px_16px]">
              {projects.filter(p => p.status !== 'abgeschlossen').length > 0 ? 
                projects.filter(p => p.status !== 'abgeschlossen').map(project => {
                  const getBadgeClass = (status: string) => {
                    switch(status) {
                      case 'abgeschlossen': return 'bg-green-50 text-green-700 border-green-200';
                      case 'geplant': return 'bg-orange-50 text-orange-700 border-orange-200';  
                      case 'in_bearbeitung': return 'bg-blue-50 text-blue-700 border-blue-200';
                      default: return 'bg-gray-50 text-gray-700 border-gray-200';
                    }
                  };
                  
                  const progressPercent = project.status === 'abgeschlossen' ? 100 : 
                                         project.status === 'in_bearbeitung' ? 60 : 
                                         project.status === 'geplant' ? 30 : 10;
                  
                  return (
                    <div 
                      key={project.id} 
                      className="project flex flex-col gap-[10px] mb-6 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                      onDoubleClick={() => handleDoubleClickProject(project)}
                    >
                      <div className="row flex items-center gap-[10px] flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full border ${getBadgeClass(project.status)}`}>
                          {getStatusDisplayName(project.status)}
                        </span>
                        <strong className="text-gray-900">{project.name}</strong>
                        <span className="text-xs px-2 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          ID: {generateShortId(project.id)}
                        </span>
                      </div>
                      <div className="meta text-gray-600 text-[13px]">
                        Start: {new Date(project.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • 
                        Ende: {project.end_date ? new Date(project.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'Offen'} • 
                        Budget: <strong className="text-green-600">€{formatBudget(project.budget, project.description)}</strong>
                      </div>
                      <div className="progress h-[10px] rounded-full bg-slate-200 overflow-hidden relative">
                        <span 
                          className="block h-full bg-gradient-to-r from-blue-600 to-blue-400"
                          style={{ width: `${progressPercent}%` }}
                        ></span>
                        <div className="ticks absolute inset-0 grid grid-cols-12">
                          {Array.from({length: 12}).map((_, i) => (
                            <i key={i} className="border-r border-dashed border-slate-300/50"></i>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDoubleClickProject(project); }}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
                        >
                          🔎 Öffnen
                        </button>
                        <button className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
                          ⏱️ Zeit
                        </button>
                        <button className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
                          📎 Dateien
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-gray-500 text-sm text-center py-4">Keine Projekte vorhanden</p>
                )}
            </div>
          </article>

          {/* Verzögerte Projekte */}
          <article className="bg-white border border-slate-100/60 rounded-[14px] shadow-lg mt-4">
            <header className="flex items-center justify-between p-[14px_16px] border-b border-slate-100/60">
              <h3 className="m-0 text-[16px] font-semibold text-gray-900">Verzögerte Projekte</h3>
            </header>
            <div className="p-[12px_16px]">
              {delayedProjects.length > 0 ? (
                delayedProjects.map(project => (
                  <div key={project.id} className="project flex flex-col gap-[10px] mb-4">
                    <div className="row flex items-center gap-[10px] flex-wrap">
                      <span className="text-xs px-2 py-1 rounded-full border bg-orange-50 text-orange-700 border-orange-200">Verspätet</span>
                      <strong className="text-gray-900">{project.name}</strong>
                      <span className="text-xs px-2 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">ID: {generateShortId(project.id)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">Keine Projekte im Verzug 🎉</p>
              )}
            </div>
          </article>
        </div>

        <div className="col-right">
          {/* Projektstatus */}
          <article className="bg-white border border-slate-100/60 rounded-[14px] shadow-lg">
            <header className="flex items-center justify-between p-[14px_16px] border-b border-slate-100/60">
              <h3 className="m-0 text-[16px] font-semibold text-gray-900">Projektstatus</h3>
            </header>
            <div className="p-[12px_16px]">
              <div className="status-list grid grid-cols-[1fr_auto] gap-2 text-sm">
                <div className="status-item contents">
                  <div className="status-label flex items-center gap-2">
                    <span className="status-dot w-[10px] h-[10px] rounded-full bg-blue-400"></span>
                    Anfrage
                  </div>
                  <div className="font-medium">{statusCounts.anfrage}</div>
                </div>
                <div className="status-item contents">
                  <div className="status-label flex items-center gap-2">
                    <span className="status-dot w-[10px] h-[10px] rounded-full bg-yellow-400"></span>
                    Besichtigung
                  </div>
                  <div className="font-medium">{statusCounts.besichtigung}</div>
                </div>
                <div className="status-item contents">
                  <div className="status-label flex items-center gap-2">
                    <span className="status-dot w-[10px] h-[10px] rounded-full bg-orange-400"></span>
                    Planung
                  </div>
                  <div className="font-medium">{statusCounts.geplant}</div>
                </div>
                <div className="status-item contents">
                  <div className="status-label flex items-center gap-2">
                    <span className="status-dot w-[10px] h-[10px] rounded-full bg-blue-400"></span>
                    In Bearbeitung
                  </div>
                  <div className="font-medium">{statusCounts.in_bearbeitung}</div>
                </div>
                <div className="status-item contents">
                  <div className="status-label flex items-center gap-2">
                    <span className="status-dot w-[10px] h-[10px] rounded-full bg-green-400"></span>
                    Abgeschlossen
                  </div>
                  <div className="font-medium">{statusCounts.abgeschlossen}</div>
                </div>
              </div>
            </div>
          </article>

          {/* Top Kunden */}
          <article className="bg-white border border-slate-100/60 rounded-[14px] shadow-lg mt-4">
            <header className="flex items-center justify-between p-[14px_16px] border-b border-slate-100/60">
              <h3 className="m-0 text-[16px] font-semibold text-gray-900">Top Kunden</h3>
            </header>
            <div className="p-[12px_16px] top-customers flex flex-col gap-[10px] text-sm">
              {topCustomers.length > 0 ? topCustomers.slice(0, 5).map((customer) => (
                <div key={customer.id} className="customer flex items-center justify-between">
                  <span className="text-gray-900">{customer.company_name || customer.contact_person}</span>
                  <span className="text-gray-600">{customer.email}</span>
                </div>
              )) : (
                <div className="text-gray-500 text-center py-2">Keine Kunden</div>
              )}
            </div>
          </article>

          {/* Projekt Übersicht */}
          <article className="bg-white border border-slate-100/60 rounded-[14px] shadow-lg mt-4">
            <header className="flex items-center justify-between p-[14px_16px] border-b border-slate-100/60">
              <h3 className="m-0 text-[16px] font-semibold text-gray-900">Projekt Übersicht</h3>
            </header>
            <div className="p-[12px_16px] grid grid-cols-2 gap-[10px] text-sm">
              <div className="text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200 justify-self-start">
                Gesamt: {projects.length}
              </div>
              <div className="text-xs px-2 py-1 rounded-full border bg-orange-50 text-orange-700 border-orange-200 justify-self-start">
                Planung: {statusCounts.geplant}
              </div>
              <div className="text-xs px-2 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 justify-self-start">
                In Bearbeitung: {statusCounts.in_bearbeitung}
              </div>
              <div className="text-xs px-2 py-1 rounded-full border bg-green-50 text-green-700 border-green-200 justify-self-start">
                Abgeschlossen: {statusCounts.abgeschlossen}
              </div>
            </div>
          </article>
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