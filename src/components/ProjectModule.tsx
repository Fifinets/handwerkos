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
  // Create a short, individual ID from the full UUID
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
  
  let totalEstimates = 0;
  let totalConfirmed = 0;
  
  if (preCalc.materials) {
    preCalc.materials.forEach(material => {
      if (material.isEstimate) totalEstimates++;
      else totalConfirmed++;
    });
  }
  
  if (preCalc.labor) {
    preCalc.labor.forEach(labor => {
      if (labor.isEstimate) totalEstimates++;
      else totalConfirmed++;
    });
  }
  
  return { totalEstimates, totalConfirmed, total: totalEstimates + totalConfirmed };
};

const formatBudget = (budget: any, description?: string) => {
  let budgetValue = 0;
  
  // First try to get budget from budget field
  if (budget) {
    if (typeof budget === 'number') {
      budgetValue = budget;
    } else if (typeof budget === 'string') {
      // Remove € symbol and convert to number
      budgetValue = parseFloat(budget.replace('€', '').replace(',', '.')) || 0;
    }
  }
  
  // If no budget from field, try to extract from description
  if (budgetValue === 0 && description) {
    budgetValue = extractBudgetFromDescription(description);
  }
  
  if (budgetValue === 0) return '0,00';
  
  return budgetValue.toLocaleString('de-DE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
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
    // Test database connection first
    const testConnection = async () => {
      try {
        const { data, error, count } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true });
        
        console.log('🔗 Database connection test:');
        console.log('  - Error:', error);
        console.log('  - Count:', count);
        console.log('  - Can access projects table:', !error);
        
        // Skip insert capability test to avoid type errors in strict TS
        // Previously attempted a dummy insert here.
        
        
      } catch (testError) {
        console.error('💥 Database connection test failed:', testError);
      }
    };
    
    testConnection();
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
      // Get current user's company ID
      const { data: currentUserProfile } = await supabase.auth.getUser();
      if (!currentUserProfile?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUserProfile.user.id)
        .single();

      if (!profile?.company_id) return;

      // Load only registered, active employees from the same company
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', profile.company_id)
        .neq('status', 'eingeladen')
        .not('user_id', 'is', null);
      
      if (data) {
        setTeamMembers(data.map(employee => ({
          id: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          role: employee.position || 'Mitarbeiter',
          projects: []
        })));
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchProjects = async () => {
    console.log('🔄 Fetching projects...');
    
    try {
      // Get current user's company_id for RLS policy
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        console.error('❌ No authenticated user for project fetch');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) {
        console.error('❌ No company_id found for project fetch');
        return;
      }

      console.log('🏢 Fetching projects for company_id:', profile.company_id);
      
      // Fetch projects for the user's company
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', profile.company_id);
      
      if (error) {
        console.error('❌ Error fetching projects:', error);
        return;
      }
      
      if (!data) {
        console.log('⚠️ No project data returned');
        return;
      }
      
      console.log('✅ Projects fetched:', data.length, 'projects');
      console.log('📋 Project data:', data);
      setProjects(data);

      // compute derived metrics
      let totalBudgetSum = 0;
      const counts = { 
        anfrage: 0, 
        besichtigung: 0, 
        geplant: 0, 
        in_bearbeitung: 0, 
        abgeschlossen: 0 
      } as any;
      const delayed: any[] = [];
      const today = new Date();
      data.forEach((p: any) => {
        if (p.status === 'anfrage') counts.anfrage++;
        else if (p.status === 'besichtigung') counts.besichtigung++;
        else if (p.status === 'geplant') counts.geplant++;
        else if (p.status === 'in_bearbeitung') counts["in_bearbeitung"]++;
        else if (p.status === 'abgeschlossen') counts.abgeschlossen++;
        
        // Sum up the budgets - handle both string and number formats
        let budgetValue = 0;
        if (p.budget) {
          if (typeof p.budget === 'number') {
            budgetValue = p.budget;
          } else if (typeof p.budget === 'string') {
            // Remove € symbol and convert to number
            budgetValue = parseFloat(p.budget.replace('€', '').replace(',', '.')) || 0;
          }
        }
        
        // If no budget from field, try to extract from description
        if (budgetValue === 0 && p.description) {
          budgetValue = extractBudgetFromDescription(p.description);
        }
        
        totalBudgetSum += budgetValue;
        
        if (p.end_date) {
          const endDate = new Date(p.end_date);
          if (endDate < today && p.status !== 'abgeschlossen') delayed.push(p);
        }
      });
      setTotalBudget(totalBudgetSum);
      setStatusCounts(counts);
      setDelayedProjects(delayed);
    } catch (err) {
      console.error('💥 Error in fetchProjects:', err);
      return;
    }
  };

  const fetchTopCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*');
    if (error || !data) return;
    setTopCustomers(data.slice(0, 5));
  };

  const handleEditProject = async (project) => {
    console.log('✏️ handleEditProject called with project:', project);
    console.log('📊 Project budget from database:', project.budget, 'type:', typeof project.budget);
    
    try {
      // Get customer name if customer_id exists
      let customerName = '';
      if (project.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('company_name')
          .eq('id', project.customer_id)
          .single();
        customerName = customer?.company_name || '';
      }

      // Extract budget from description if not in budget field
      let budgetValue = project.budget || 0;
      if (!budgetValue && project.description) {
        budgetValue = extractBudgetFromDescription(project.description);
      }

      // Transform database project to match dialog interface
      const transformedProject = {
        id: project.id,
        name: project.name,
        customer: customerName,
        status: getStatusDisplayName(project.status), // Convert to German display name
        progress: project.progress_percentage || 0,
        startDate: project.start_date,
        endDate: project.end_date,
        budget: budgetValue.toString(),
        team: [],
        location: project.location || ''
      };
      
      console.log('🔄 Transformed project for dialog:', transformedProject);
      
      setSelectedProject(transformedProject);
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error('Error in handleEditProject:', error);
      
      // Extract budget from description if not in budget field  
      let budgetValue = project.budget || 0;
      if (!budgetValue && project.description) {
        budgetValue = extractBudgetFromDescription(project.description);
      }
      
      setSelectedProject({
        id: project.id,
        name: project.name,
        customer: '',
        status: getStatusDisplayName(project.status),
        progress: project.progress_percentage || 0,
        startDate: project.start_date,
        endDate: project.end_date,
        budget: budgetValue.toString(),
        team: [],
        location: project.location || ''
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleShowDetails = (project) => {
    setSelectedProject(project);
    setIsDetailDialogOpen(true);
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

  const handleProjectUpdated = (updatedProject) => {
    console.log('🔄 handleProjectUpdated called with:', updatedProject);
    console.log('📊 Budget value received:', updatedProject.budget, 'type:', typeof updatedProject.budget);
    
    // Optimistic update - immediately update local state
    const statusMapping = {
      'Anfrage': 'anfrage',
      'Besichtigung': 'besichtigung',
      'Planung': 'geplant',
      'In Bearbeitung': 'in_bearbeitung', 
      'Abgeschlossen': 'abgeschlossen'
    };

    // Parse budget safely
    let budget = 0;
    if (updatedProject.budget) {
      const budgetStr = typeof updatedProject.budget === 'string' 
        ? updatedProject.budget 
        : updatedProject.budget.toString();
      budget = parseFloat(budgetStr.replace(/[€,\s]/g, '')) || 0;
      console.log('💰 Parsed budget:', budget);
    } else {
      console.log('⚠️ No budget provided, defaulting to 0');
    }

    // Update local projects state immediately for instant UI feedback
    setProjects(prevProjects => 
      prevProjects.map(project => 
        project.id === updatedProject.id 
          ? {
              ...project,
              name: updatedProject.name,
              status: statusMapping[updatedProject.status] || updatedProject.status,
              start_date: updatedProject.startDate,
              end_date: updatedProject.endDate,
              location: updatedProject.location,
              description: updatedProject.description,
              budget: budget,
              progress_percentage: updatedProject.progress || 0
            }
          : project
      )
    );

    // Update total budget immediately
    setTotalBudget(prevTotal => {
      let totalBudgetSum = 0;
      projects.forEach(project => {
        if (project.id === updatedProject.id) {
          totalBudgetSum += budget;
        } else {
          totalBudgetSum += project.budget || 0;
        }
      });
      return totalBudgetSum;
    });

    // Then update in database
    const updateProject = async () => {
      try {
        console.log('🔄 Updating project in database:', updatedProject);
        
        // Find customer by name to get customer_id
        let customer_id = null;
        if (updatedProject.customer) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('company_name', updatedProject.customer)
            .single();
          customer_id = customer?.id || null;
        }
        
        const updateData = {
          name: updatedProject.name,
          status: statusMapping[updatedProject.status] || updatedProject.status,
          start_date: updatedProject.startDate,
          end_date: updatedProject.endDate,
          location: updatedProject.location,
          description: updatedProject.description,
          customer_id: customer_id
        };

        // Try to add budget and progress_percentage
        // Store budget in description field as a workaround until budget column is added
        if (budget > 0) {
          const budgetInfo = `[BUDGET:${budget}]`;
          if (updateData.description) {
            // If description exists, append budget info if not already there
            if (!updateData.description.includes('[BUDGET:')) {
              updateData.description += ` ${budgetInfo}`;
            } else {
              // Replace existing budget info
              updateData.description = updateData.description.replace(/\[BUDGET:\d+\.?\d*\]/, budgetInfo);
            }
          } else {
            updateData.description = budgetInfo;
          }
        }
        
        console.log('📝 Update data:', updateData);
        
        // First try with basic update (without budget column)
        const basicUpdateData = {
          name: updatedProject.name,
          status: statusMapping[updatedProject.status] || updatedProject.status,
          start_date: updatedProject.startDate,
          end_date: updatedProject.endDate,
          location: updatedProject.location,
          description: updateData.description,
          customer_id: customer_id
        };
        
        const { error } = await supabase
          .from('projects')
          .update(basicUpdateData)
          .eq('id', updatedProject.id);

        if (error) {
          console.error('❌ Error updating project:', error);
          
          // Revert optimistic update on error
          await fetchProjects();
          toast({
            title: "Fehler",
            description: "Projekt konnte nicht aktualisiert werden: " + error.message,
            variant: "destructive"
          });
        } else {
          console.log('✅ Project updated successfully (budget stored in description)');
          toast({
            title: "Erfolg",
            description: "Projekt wurde erfolgreich aktualisiert."
          });
        }
      } catch (err) {
        console.error('💥 Error in handleProjectUpdated:', err);
        // Revert optimistic update on error
        await fetchProjects();
        toast({
          title: "Fehler",
          description: "Unerwarteter Fehler beim Aktualisieren des Projekts",
          variant: "destructive"
        });
      }
    };

    updateProject();
  };

  const handleCreateInvoice = async (projectId: string, projectName: string) => {
    try {
      console.log('Creating invoice from project:', projectId);
      
      const invoiceId = await workflowService.createInvoiceFromProject(projectId);
      if (invoiceId) {
        toast({
          title: "Rechnung erstellt",
          description: `Rechnungsentwurf für Projekt "${projectName}" wurde erfolgreich erstellt.`,
        });
        
        // Refresh projects to show updated status
        fetchProjects();
      }
    } catch (error) {
      console.error('Error creating invoice from project:', error);
      toast({
        title: "Fehler",
        description: "Rechnung konnte nicht erstellt werden. Projekt muss abgeschlossen sein.",
        variant: "destructive"
      });
    }
  };

  const handleProjectDeleted = async (projectId: string) => {
    console.log('🗑️ Project deletion callback received for:', projectId);
    
    // Optimistic update - remove project from local state immediately
    setProjects(prevProjects => {
      const filteredProjects = prevProjects.filter(project => project.id !== projectId);
      console.log('📊 Projects before delete:', prevProjects.length, 'after delete:', filteredProjects.length);
      return filteredProjects;
    });
    
    // Refresh projects from database to ensure consistency
    console.log('🔄 Refreshing projects from database...');
    await fetchProjects();
    console.log('✅ Project deletion completed and UI refreshed');
  };

  const handleProjectAdded = (newProject) => {
    console.log('🆕 Adding new project:', newProject);
    
    // Add project to Supabase
    const addProject = async () => {
      try {
        // Get current user's company_id for RLS policy
        const { data: currentUser } = await supabase.auth.getUser();
        if (!currentUser?.user) {
          console.error('❌ No authenticated user found');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', currentUser.user.id)
          .single();

        if (!profile?.company_id) {
          console.error('❌ No company_id found for user');
          return;
        }

        console.log('🏢 User company_id:', profile.company_id);
        
        // Find customer by name
        const customer = customers.find(c => c.name === newProject.customer);
        console.log('👤 Found customer:', customer);
        
        // Map German status to database values
        const statusMapping = {
          'Planung': 'geplant',
          'In Bearbeitung': 'in_bearbeitung', 
          'Abgeschlossen': 'abgeschlossen'
        };
        
        // Handle date formatting more safely
        let startDate = null;
        let endDate = null;
        
        try {
          if (newProject.startDate) {
            if (newProject.startDate.includes('.')) {
              startDate = newProject.startDate.split('.').reverse().join('-');
            } else {
              startDate = newProject.startDate;
            }
          }
          
          if (newProject.endDate) {
            if (newProject.endDate.includes('.')) {
              endDate = newProject.endDate.split('.').reverse().join('-');
            } else {
              endDate = newProject.endDate;
            }
          }
        } catch (dateError) {
          console.warn('⚠️ Date formatting error:', dateError);
        }
        
        const projectData = {
          name: newProject.name,
          customer_id: customer?.id || null,
          company_id: profile.company_id, // Required for RLS policy
          status: statusMapping[newProject.status] || 'geplant',
          start_date: startDate,
          end_date: endDate,
          location: newProject.location,
          budget: parseFloat(newProject.budget.replace(/[€,\s]/g, '')) || 0,
          description: newProject.description || null
        };
        
        console.log('📝 Inserting project data:', projectData);
        
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select();

        if (error) {
          console.error('❌ Error creating project:', error);
        } else {
          console.log('✅ Project created successfully:', data);
          console.log('🔄 Refreshing projects list...');
          await fetchProjects(); // Wait for refetch to complete
        }
      } catch (err) {
        console.error('💥 Unexpected error in addProject:', err);
      }
    };

    addProject();
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header im Stil der Vorlage */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Projekte & Baustellen</h1>
            <p className="text-gray-600">Übersicht Ihrer aktuellen Projekte und deren Status</p>
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Neues Projekt
          </Button>
        </div>
      </div>

      {/* Statistik-Header wie in der Vorlage */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{statusCounts.in_bearbeitung + statusCounts.geplant + statusCounts.anfrage + statusCounts.besichtigung}</div>
            <div className="text-gray-600 mt-1">Aktive Projekte</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{statusCounts.abgeschlossen}</div>
            <div className="text-gray-600 mt-1">Abgeschlossene</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">€{totalBudget.toLocaleString()}</div>
            <div className="text-gray-600 mt-1">Gesamtbudget</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{delayedProjects.length}</div>
            <div className="text-gray-600 mt-1">Verspätet</div>
          </div>
        </div>
      </div>

      {/* Hauptbereich mit zwei Spalten wie in der Vorlage */}
      <div className="grid grid-cols-12 gap-6">
        {/* Linke Spalte - Aktuelle Projekte */}
        <div className="col-span-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Aktuelle Projekte</h2>
                <div className="text-sm text-gray-500">Heute • {new Date().toLocaleDateString('de-DE')}</div>
              </div>
            </div>
            <div className="p-6 space-y-4">

              {projects.filter(p => p.status !== 'abgeschlossen').map(project => {
                const endDate = project.end_date ? new Date(project.end_date) : null;
                const isOverdue = endDate && endDate < new Date();
                const statusColor = project.status === 'geplant' ? 'orange' : project.status === 'in_bearbeitung' ? 'blue' : 'purple';
                return (
                  <div 
                    key={project.id} 
                    className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onDoubleClick={() => handleDoubleClickProject(project)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 bg-${statusColor}-500 rounded-full`}></div>
                        <div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800 mr-2`}>
                            {getStatusDisplayName(project.status)}
                          </span>
                          <span className="font-medium text-gray-900">{project.name}</span>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">ID: {generateShortId(project.id)}</span>
                    </div>
                    <div className="ml-5 text-sm text-gray-600">
                      Start: {new Date(project.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • 
                      Ende: {project.end_date ? new Date(project.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'Offen'} • 
                      Budget: €{formatBudget(project.budget, project.description)}
                    </div>
                    <div className="ml-5 mt-3 flex items-center gap-4">
                      <button 
                        onClick={() => handleDoubleClickProject(project)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <Building2 className="w-4 h-4" />
                        Öffnen
                      </button>
                      <button 
                        onClick={() => setSelectedProject(project) || setIsEditDialogOpen(true)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                        Bearbeiten
                      </button>
                      <button 
                        onClick={() => setSelectedProject(project) || setIsPreCalculationOpen(true)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <Calculator className="w-4 h-4" />
                        Kalkulieren
                      </button>
                    </div>
                    {/* Fortschrittsbalken */}
                    <div className="ml-5 mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{
                            width: project.status === 'abgeschlossen' ? '100%' : 
                                   project.status === 'in_bearbeitung' ? '60%' : 
                                   project.status === 'geplant' ? '30%' : '10%'
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verzögerte Projekte Sektion */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Verzögerte Projekte</h2>
            </div>
            <div className="p-6">
              {delayedProjects.length > 0 ? (
                <div className="space-y-3">
                  {delayedProjects.map(project => (
                    <div key={project.id} className="text-sm text-red-600">
                      {project.name} - {new Date(project.end_date).toLocaleDateString('de-DE')}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Keine Projekte im Verzug 🏆</p>
              )}
            </div>
          </div>
        </div>

        {/* Rechte Spalte - Sidebar wie in der Vorlage */}
        <div className="col-span-4 space-y-6">
          {/* Projektstatus */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Projektstatus</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-sm text-gray-700">Anfrage</span>
                </div>
                <span className="text-sm font-medium">{statusCounts.anfrage}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-700">Besichtigung</span>
                </div>
                <span className="text-sm font-medium">{statusCounts.besichtigung}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-gray-700">Planung</span>
                </div>
                <span className="text-sm font-medium">{statusCounts.geplant}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-700">In Bearbeitung</span>
                </div>
                <span className="text-sm font-medium">{statusCounts.in_bearbeitung}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-sm text-gray-700">Abgeschlossen</span>
                </div>
                <span className="text-sm font-medium">{statusCounts.abgeschlossen}</span>
              </div>
            </div>
          </div>

          {/* Top Kunden */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Top Kunden</h3>
            <div className="space-y-3">
              {topCustomers.length > 0 ? topCustomers.map((customer) => (
                <div key={customer.id} className="text-sm text-gray-700">
                  {customer.company_name} <span className="text-gray-500 float-right">{customer.email}</span>
                </div>
              )) : (
                <div className="text-sm text-gray-500">Keine Kunden gefunden</div>
              )}
            </div>
          </div>

          {/* Projekt Übersicht */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Projekt Übersicht</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Gesamt: {projects.length}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Planung: {statusCounts.geplant}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">In Bearbeitung: {statusCounts.in_bearbeitung}</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Abgeschlossen: {statusCounts.abgeschlossen}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

                <div className="space-y-3 flex-grow">
                  
                  <div className="flex space-x-1 mb-4">
                    {(() => {
                      if (!project.end_date) {
                        return null;
                      }
                      const start = new Date(project.start_date);
                      const end = new Date(project.end_date);
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const today = new Date();
                      const daysPassed = today >= start ?
                        Math.min(totalDays, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
                        : 0;
                      return Array.from({ length: totalDays }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 h-2 rounded ${idx < daysPassed ? 'bg-blue-600' : 'bg-gray-200'}`}
                        />
                      ));
                    })()}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 mt-auto justify-end">
                  <Button
                    size="sm" 
                    variant={hasPreCalculation(project.description) ? "default" : "outline"}
                    onClick={() => handlePreCalculation(project)}
                    title={hasPreCalculation(project.description) ? "Vor-Kalkulation bearbeiten" : "Vor-Kalkulation erstellen"}
                  >
                    <Calculator className="h-4 w-4" />
                  </Button>
                  {(project.status === 'in_bearbeitung' || project.status === 'abgeschlossen') && (
                    <Button
                      size="sm" 
                      variant="outline"
                      onClick={() => handleProfitabilityAnalysis(project)}
                      title="Nachkalkulation & Rentabilität"
                    >
                      <TrendingUp className="h-4 w-4" />
                    </Button>
                  )}
                  {project.status === 'abgeschlossen' && (
                    <Button
                      size="sm" 
                      variant="default"
                      onClick={() => handleCreateInvoice(project.id, project.name)}
                      title="Rechnung erstellen"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEditProject(project)}
                    title="Projekt bearbeiten"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardHeader><CardTitle>Verzögerte Projekte</CardTitle></CardHeader>
            <CardContent>
              {delayedProjects.length === 0 ? (
                <p className="text-sm text-gray-500">Keine Projekte im Verzug</p>
              ) : delayedProjects.map((p) => (
                <div key={p.id} className="flex justify-between border-b py-1">
                  <span>{p.name}</span>
                  <Badge variant="destructive">überfällig</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Projektstatus</CardTitle></CardHeader>
            <CardContent>
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span>{getStatusDisplayName(status)}</span>
                  <span>{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Kunden</CardTitle></CardHeader>
            <CardContent>
              {topCustomers.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>{c.company_name}</span>
                  <span>{c.email}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Projekt Übersicht</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">
                Gesamt: {projects.length} Projekte
              </div>
              <div className="text-sm">
                {getStatusDisplayName('geplant')}: {statusCounts.geplant}
              </div>
              <div className="text-sm">
                {getStatusDisplayName('in_bearbeitung')}: {statusCounts.in_bearbeitung}
              </div>
              <div className="text-sm">
                {getStatusDisplayName('abgeschlossen')}: {statusCounts.abgeschlossen}
              </div>
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
            // Refresh projects after calculation is saved
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
