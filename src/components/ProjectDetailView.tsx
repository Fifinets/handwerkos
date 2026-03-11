import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Clock,
  Users,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  Plus,
  MessageSquare,
  CheckCircle2,
  Image as ImageIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ProjectDashboardData,
  ProjectPermissions,
  getProjectPermissions,
  PROJECT_STATUS_CONFIG,
  UserRole,
  ProjectStatus
} from "@/types/project";
import { useToast } from "@/hooks/use-toast";
import TimeEntryForm from "./TimeEntryForm";
import MaterialEntryForm from "./MaterialEntryForm";

interface ProjectDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ isOpen, onClose, projectId }) => {
  const { toast } = useToast();
  const [project, setProject] = useState<ProjectDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<ProjectPermissions>({
    can_view: false,
    can_edit_basic_data: false,
    can_add_time: false,
    can_add_materials: false,
    can_upload_files: false,
    can_change_status: false,
    can_link_invoices: false,
    can_delete: false,
    can_manage_team: false,
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [isTimeFormOpen, setIsTimeFormOpen] = useState(false);
  const [isMaterialFormOpen, setIsMaterialFormOpen] = useState(false);
  const [isAddTeamMemberOpen, setIsAddTeamMemberOpen] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // NEW STATE
  const [projectOffers, setProjectOffers] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<{id:string; title:string; is_completed:boolean; due_date?:string; priority?:string}[]>([]);
  const [photos, setPhotos] = useState<{id:string; file_url?:string; file_path?:string}[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [teamAssignments, setTeamAssignments] = useState<any[]>([]);

  // Customer projects modal
  const [isCustomerProjectsOpen, setIsCustomerProjectsOpen] = useState(false);
  const [customerProjects, setCustomerProjects] = useState<any[]>([]);
  const [loadingCustomerProjects, setLoadingCustomerProjects] = useState(false);

  // Internal project ID tracking (allows switching projects within the dialog)
  const [currentProjectId, setCurrentProjectId] = useState(projectId);

  // Sync with prop when it changes
  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (isOpen && currentProjectId) {
      fetchProjectData();
    }
  }, [isOpen, currentProjectId]);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      // Get current user and their role
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        toast({
          title: "Fehler",
          description: "Benutzer nicht authentifiziert",
          variant: "destructive"
        });
        return;
      }

      // Get user profile and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) {
        toast({
          title: "Fehler",
          description: "Benutzer-Unternehmen nicht gefunden",
          variant: "destructive"
        });
        return;
      }

      // Fetch basic project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', currentProjectId)
        .eq('company_id', profile.company_id)
        .single();

      if (projectError || !projectData) {
        toast({
          title: "Fehler",
          description: "Projekt nicht gefunden",
          variant: "destructive"
        });
        return;
      }

      // Get customer data
      let customerData = null;
      if (projectData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', projectData.customer_id)
          .single();
        customerData = customer;
      }

      // ====== NEW: CALCULATE DATA FROM TABLES ======

      // 1. TIME ENTRIES: Calculate total hours from time_entries
      const { data: timeEntriesData, error: timeError } = await supabase
        .from('time_entries')
        .select('start_time, end_time, break_duration')
        .eq('project_id', currentProjectId);

      let calculatedTotalHours = 0;
      if (!timeError && timeEntriesData && timeEntriesData.length > 0) {
        calculatedTotalHours = timeEntriesData.reduce((sum, entry) => {
          if (entry.start_time && entry.end_time) {
            const start = new Date(entry.start_time).getTime();
            const end = new Date(entry.end_time).getTime();
            const breakMs = (entry.break_duration || 0) * 60 * 1000;
            const workedMs = end - start - breakMs;
            const hours = workedMs / (1000 * 60 * 60);
            return sum + Math.max(0, hours);
          }
          return sum;
        }, 0);
      }
      setTotalHours(calculatedTotalHours);

      // 2. TEAM ASSIGNMENTS: Get from project_team_assignments (not project_team_members)
      let teamMembersProcessed = [];
      try {
        const { data: teamAssignmentsData, error: teamError } = await supabase
          .from('project_team_assignments')
          .select('id, employee_id')
          .eq('project_id', currentProjectId);

        if (!teamError && teamAssignmentsData && teamAssignmentsData.length > 0) {
          const employeeIds = teamAssignmentsData.map((ta: any) => ta.employee_id);
          const { data: employeeDetails } = await supabase
            .from('employees')
            .select('id, first_name, last_name, email')
            .in('id', employeeIds);

          if (employeeDetails) {
            teamMembersProcessed = teamAssignmentsData.map((ta: any) => ({
              id: ta.employee_id,
              name: `${employeeDetails.find(e => e.id === ta.employee_id)?.first_name || ''} ${employeeDetails.find(e => e.id === ta.employee_id)?.last_name || ''}`.trim(),
              role: 'team_member',
              email: employeeDetails.find(e => e.id === ta.employee_id)?.email || '',
              hours_this_week: 0
            })).filter((tm: any) => tm.name);
          }
        }
      } catch (error) {
        console.log('Team assignments table might not exist:', error);
      }
      setTeamAssignments(teamMembersProcessed);

      // 3. MATERIALS: Get from project_materials and sum total_price
      let totalMaterialCost = 0;
      try {
        const { data: materialsData, error: materialError } = await supabase
          .from('project_materials')
          .select('total_price')
          .eq('project_id', currentProjectId);

        if (!materialError && materialsData && materialsData.length > 0) {
          totalMaterialCost = materialsData.reduce((sum, entry) => sum + (entry.total_price || 0), 0);
        }
      } catch (error) {
        console.log('Project materials table might not exist:', error);
      }

      // 4. OFFERS: Get offers where project_id = projectId and sum gross_total
      let processedOffers = [];
      try {
        const { data: offersData, error: offersError } = await supabase
          .from('offers')
          .select('id, total_amount, status')
          .eq('project_id', currentProjectId);

        if (!offersError && offersData && offersData.length > 0) {
          processedOffers = offersData;
        }
      } catch (error) {
        console.log('Offers table query error:', error);
      }
      setProjectOffers(processedOffers);

      // 5. MILESTONES: Get from project_milestones
      let processedMilestones: any[] = [];
      try {
        const { data: milestonesData, error: milestonesError } = await supabase
          .from('project_milestones')
          .select('id, title, is_completed')
          .eq('project_id', currentProjectId);

        if (!milestonesError && milestonesData && milestonesData.length > 0) {
          processedMilestones = milestonesData;
        }
      } catch (error) {
        console.log('Project milestones table might not exist:', error);
      }
      setMilestones(processedMilestones);

      // 6. PHOTOS: Get from project_documents where document_type = 'image'
      let processedPhotos: any[] = [];
      try {
        const { data: photosData, error: photosError } = await supabase
          .from('project_documents')
          .select('id, file_url, file_path')
          .eq('project_id', currentProjectId);

        if (!photosError && photosData && photosData.length > 0) {
          processedPhotos = photosData;
        }
      } catch (error) {
        console.log('Project documents table might not exist:', error);
      }
      setPhotos(processedPhotos);

      // Calculate real statistics from database
      const totalProjectCost = totalMaterialCost + (calculatedTotalHours * 50); // Assuming 50€/hour
      const projectBudget = projectData.budget || 0;
      const budgetUtilization = projectBudget > 0 ? Math.round((totalProjectCost / projectBudget) * 100) : 0;

      // Calculate days active and remaining
      const startDate = new Date(projectData.start_date || new Date());
      const endDate = new Date(projectData.end_date || new Date());
      const today = new Date();
      const daysActive = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      const realProjectData: ProjectDashboardData = {
        id: projectData.id,
        company_id: projectData.company_id,
        project_name: projectData.name,
        customer_id: projectData.customer_id || '',
        start_date: projectData.start_date || new Date().toISOString().split('T')[0],
        planned_end_date: projectData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: ((projectData.status as ProjectStatus) ?? 'geplant') as ProjectStatus,
        project_address: projectData.site || projectData.location || 'Nicht angegeben',
        project_description: projectData.description || 'Keine Beschreibung',
        budget_planned: projectBudget,
        linked_invoices: [],
        linked_offers: [],
        created_at: projectData.created_at || new Date().toISOString(),
        updated_at: projectData.updated_at || new Date().toISOString(),
        created_by: currentUser.user.id,
        assigned_team: teamMembersProcessed.map(tm => tm.id) || [],

        customer: customerData ? {
          company_name: customerData.company_name || 'Unbekanntes Unternehmen',
          contact_person: customerData.contact_person || 'Nicht angegeben',
          email: customerData.email || 'Nicht angegeben',
          phone: customerData.phone || 'Nicht angegeben'
        } : {
          company_name: 'Kein Kunde zugewiesen',
          contact_person: 'Nicht angegeben',
          email: 'Nicht angegeben',
          phone: 'Nicht angegeben'
        },

        stats: {
          total_hours_logged: calculatedTotalHours,
          total_material_cost: totalMaterialCost,
          total_project_cost: totalProjectCost,
          budget_utilization: budgetUtilization,
          days_active: daysActive,
          days_remaining: daysRemaining,
          team_size: teamMembersProcessed.length || 0,
          documents_count: processedPhotos.length || 0,
          comments_count: 0,
          last_activity: new Date().toISOString()
        },

        recent_activities: [],

        team_members: teamMembersProcessed || [],

        permissions: getProjectPermissions('admin', true)
      };

      // Set permissions based on user role (mock for now)
      const currentUserRole: UserRole = 'admin'; // This should come from user profile
      setPermissions(getProjectPermissions(currentUserRole, true));

      // Get real project activities
      const activities = [];

      // Get recent time entries
      if (timeEntriesData && timeEntriesData.length > 0) {
        const { data: recentTimeEntries } = await supabase
          .from('time_entries')
          .select('id, start_time, created_at')
          .eq('project_id', currentProjectId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentTimeEntries) {
          recentTimeEntries.forEach((entry: any) => {
            activities.push({
              id: `time_${entry.id}`,
              project_id: currentProjectId,
              event_type: 'time',
              title: 'Arbeitszeit erfasst',
              description: `${new Date(entry.start_time).toLocaleDateString('de-DE')}`,
              user_name: 'Team-Mitglied',
              user_role: 'team_member',
              timestamp: entry.created_at
            });
          });
        }
      }

      // Sort activities by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Update project data with real activities only
      realProjectData.recent_activities = activities.slice(0, 10);

      setProject(realProjectData);
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast({
        title: "Fehler",
        description: "Projektdaten konnten nicht geladen werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableEmployees = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) return;

      // Get all employees from the company who are not already in the project
      const { data: employees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, position')
        .eq('company_id', profile.company_id)
        .eq('status', 'active');

      // Filter out employees who are already in the project
      const currentTeamIds = project?.assigned_team || [];
      const available = employees?.filter(emp => !currentTeamIds.includes(emp.id)) || [];

      setAvailableEmployees(available);
    } catch (error) {
      console.error('Error loading available employees:', error);
    }
  };

  const loadCustomerProjects = async (customerId: string) => {
    setLoadingCustomerProjects(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) return;

      // Get all projects for this customer
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('customer_id', customerId)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (!error && projects) {
        setCustomerProjects(projects);
        setIsCustomerProjectsOpen(true);
      } else {
        toast({
          title: "Fehler",
          description: "Kundenprojekte konnten nicht geladen werden",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading customer projects:', error);
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
        variant: "destructive"
      });
    } finally {
      setLoadingCustomerProjects(false);
    }
  };

  const handleAddTeamMember = async (employeeId: string) => {
    try {
      // Add team member to project_team_assignments table
      const { error } = await supabase
        .from('project_team_assignments')
        .insert({
          project_id: currentProjectId,
          employee_id: employeeId,
          assigned_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error adding team member:', error);
        toast({
          title: "Fehler",
          description: "Team-Mitglied konnte nicht hinzugefügt werden",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Team-Mitglied wurde erfolgreich hinzugefügt"
      });

      // Refresh project data to show new team member
      await fetchProjectData();
      setIsAddTeamMemberOpen(false);
    } catch (error) {
      console.error('Error adding team member:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten",
        variant: "destructive"
      });
    }
  };

  const toggleMilestoneCompletion = async (milestoneId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({ is_completed: completed })
        .eq('id', milestoneId);

      if (error) throw error;

      setMilestones(prev =>
        prev.map(m => m.id === milestoneId ? { ...m, is_completed: completed } : m)
      );

      toast({
        title: "Erfolg",
        description: completed ? "Meilenstein abgeschlossen" : "Meilenstein als offen markiert"
      });
    } catch (error) {
      console.error('Error updating milestone:', error);
      toast({
        title: "Fehler",
        description: "Meilenstein konnte nicht aktualisiert werden",
        variant: "destructive"
      });
    }
  };

  const addMilestone = async (title: string) => {
    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Meilenstein-Titel kann nicht leer sein",
        variant: "destructive"
      });
      return;
    }

    try {
      const newMilestone = {
        project_id: currentProjectId,
        title: title.trim(),
        is_completed: false
      };

      const { data, error } = await supabase
        .from('project_milestones')
        .insert(newMilestone as any)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setMilestones(prev => [...prev, data[0]]);
        setNewChecklistItem('');
        toast({
          title: "Erfolg",
          description: "Meilenstein hinzugefügt"
        });
      }
    } catch (error) {
      console.error('Error adding milestone:', error);
      toast({
        title: "Fehler",
        description: "Meilenstein konnte nicht hinzugefügt werden",
        variant: "destructive"
      });
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!file) return;

    try {
      const fileName = `${currentProjectId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('project_documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('project_documents')
        .getPublicUrl(fileName);

      const newDocument = {
        project_id: currentProjectId,
        document_type: 'image',
        file_path: fileName,
        file_url: publicData.publicUrl,
        name: file.name
      };

      const { data, error } = await supabase
        .from('project_documents')
        .insert(newDocument as any)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos(prev => [...prev, data[0]]);
        toast({
          title: "Erfolg",
          description: "Foto hochgeladen"
        });
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Fehler",
        description: "Foto konnte nicht hochgeladen werden",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!project || !permissions.can_change_status) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);

      if (error) throw error;

      setProject(prev => prev ? { ...prev, status: newStatus as any } : null);
      toast({
        title: "Erfolg",
        description: "Projektstatus wurde aktualisiert"
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const getStatusConfig = (status: string) => {
    return PROJECT_STATUS_CONFIG[status as keyof typeof PROJECT_STATUS_CONFIG] || PROJECT_STATUS_CONFIG.geplant;
  };

  const generateShortId = (fullId: string) => {
    // Create a short, individual ID from the full UUID
    const hash = fullId.split('-').join('');
    return `P${hash.substring(0, 6).toUpperCase()}`;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Projektdaten werden geladen...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!project) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Projekt nicht gefunden</h3>
            <p className="text-gray-600">Das angeforderte Projekt konnte nicht geladen werden.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(project.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[95vh] rounded-2xl bg-white shadow-xl overflow-y-auto border border-slate-200 p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* ── Dialog Header ─────────────────────────────────── */}
          <DialogHeader className="px-6 pt-6 pb-0">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <DialogTitle className="text-2xl font-semibold text-slate-900 leading-tight truncate">
                    {project.project_name}
                  </DialogTitle>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusConfig.color} bg-slate-50`}>
                    {statusConfig.label}
                  </span>
                </div>
                <DialogDescription className="text-sm text-slate-500 flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{generateShortId(project.id)}</span>
                  {project.project_address && project.project_address !== 'Nicht angegeben' && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{project.project_address}</span>
                    </>
                  )}
                </DialogDescription>
              </div>

              {/* Budget chip */}
              <div className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Projektkosten</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(project.stats.total_project_cost)}</p>
                {project.budget_planned > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">von {formatCurrency(project.budget_planned)}</p>
                )}
              </div>
            </div>

            {/* Status Pipeline */}
            {(() => {
              const stages = [
                { key: 'anfrage', label: 'Anfrage' },
                { key: 'besichtigung', label: 'Besichtigung' },
                { key: 'geplant', label: 'Geplant' },
                { key: 'in_bearbeitung', label: 'In Arbeit' },
                { key: 'abgeschlossen', label: 'Fertig' },
              ];
              const currentIdx = stages.findIndex(s => s.key === project.status);
              return (
                <div className="flex items-center gap-0 mb-4">
                  {stages.map((stage, idx) => {
                    const isDone = idx < currentIdx;
                    const isActive = idx === currentIdx;
                    return (
                      <React.Fragment key={stage.key}>
                        <div className="flex-1 flex flex-col items-center">
                          <div className={`h-1.5 w-full rounded-full ${isDone ? 'bg-teal-500' : isActive ? 'bg-teal-300' : 'bg-slate-200'
                            }`} />
                          <span className={`text-[10px] mt-1 font-medium hidden sm:block ${isActive ? 'text-teal-600' : isDone ? 'text-slate-500' : 'text-slate-300'
                            }`}>{stage.label}</span>
                        </div>
                        {idx < stages.length - 1 && <div className="w-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}

            {/* Tabs */}
            <TabsList className="bg-slate-100/80 border border-slate-200/60 p-1 rounded-full grid w-full grid-cols-6 h-11">
              {[
                { value: 'overview', label: 'Übersicht' },
                { value: 'details', label: 'Details' },
                { value: 'time', label: 'Zeiten' },
                { value: 'materials', label: 'Material' },
                { value: 'documents', label: 'Dokumente' },
                { value: 'comments', label: 'Kommentare' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-full text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-600 data-[state=active]:font-semibold transition-all text-slate-500 hover:text-slate-700"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </DialogHeader>

          {/* ── Overview Tab ──────────────────────────────────── */}
          <TabsContent value="overview" className="px-6 pb-6 pt-5 space-y-5 min-h-[500px] mt-0">

            {/* Zeile 1 – KPIs (Erfasste Zeit + Angebotssumme) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Erfasste Zeit */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700 m-0">Erfasste Zeit</CardTitle>
                  {permissions.can_add_time && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                      onClick={() => setIsTimeFormOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Erfassen
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-5">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-900">{totalHours.toFixed(1)}</p>
                    <p className="text-xs text-slate-400 mt-1">Stunden insgesamt</p>
                  </div>
                </CardContent>
              </Card>

              {/* Angebotssumme */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Angebotssumme</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-900">{formatCurrency(projectOffers.reduce((sum, o) => sum + (o.total_amount || 0), 0))}</p>
                    <p className="text-xs text-slate-400 mt-1">von {projectOffers.length} Angeboten</p>
                    <div className="mt-3 flex gap-2 justify-center flex-wrap">
                      {projectOffers.filter(o => o.status === 'accepted').length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {projectOffers.filter(o => o.status === 'accepted').length} akzeptiert
                        </span>
                      )}
                      {projectOffers.filter(o => o.status === 'pending').length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-xs font-medium text-yellow-700">
                          {projectOffers.filter(o => o.status === 'pending').length} ausstehend
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zeile 2 – Team + Checkliste */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Team-Mitglieder */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700 m-0">Team-Mitglieder</CardTitle>
                  {permissions.can_manage_team && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                      onClick={() => { loadAvailableEmployees(); setIsAddTeamMemberOpen(true); }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Hinzufügen
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {teamAssignments.length === 0 ? (
                    <div className="p-6 text-center">
                      <Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Noch keine Teammitglieder zugewiesen</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {teamAssignments.map(member => (
                        <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-slate-600 font-semibold text-xs">{member.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{member.name}</p>
                            <p className="text-xs text-slate-400 truncate">{member.email}</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-500">{member.hours_this_week || 0}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            {/* Checkliste — 2-col row */}

              {/* Checkliste (Milestones) */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Checkliste</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-2 mb-4">
                    {milestones.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3">Noch keine Meilensteine. Füge einen hinzu.</p>
                    )}
                    {milestones.map(item => (
                      <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          onChange={() => toggleMilestoneCompletion(item.id, !item.is_completed)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                        />
                        <span className={`text-sm ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.title}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newChecklistItem.trim()) {
                          addMilestone(newChecklistItem);
                        }
                      }}
                      placeholder="+ Meilenstein hinzufügen"
                      className="flex-1 text-sm text-teal-600 placeholder:text-teal-500 bg-transparent border-none outline-none px-0 py-1"
                    />
                    {newChecklistItem.trim() && (
                      <button
                        onClick={() => addMilestone(newChecklistItem)}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Hinzufügen
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Fotos */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700 m-0">Fotos</CardTitle>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        uploadPhoto(e.target.files[0]);
                      }
                    }}
                    style={{ display: 'none' }}
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50" asChild>
                      <span>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Hochladen
                      </span>
                    </Button>
                  </label>
                </CardHeader>
                <CardContent className="p-5">
                  {photos.length === 0 ? (
                    <div className="text-center py-8">
                      <ImageIcon className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Noch keine Fotos hochgeladen</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                          {photo.file_url && (
                            <img
                              src={photo.file_url}
                              alt="Project photo"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Zeile 3 – Status ändern + Fotos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Status ändern */}
              {permissions.can_change_status && statusConfig.nextStates.length > 0 && (
                <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                    <CardTitle className="text-sm font-semibold text-slate-700">Status ändern</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {statusConfig.nextStates.map(nextStatus => {
                      const nextConfig = getStatusConfig(nextStatus);
                      return (
                        <Button
                          key={nextStatus}
                          variant="outline"
                          className="w-full justify-start h-9 text-sm border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          onClick={() => handleStatusChange(nextStatus)}
                        >
                          {nextConfig.label}
                        </Button>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Fotos */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700 m-0">Fotos</CardTitle>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        uploadPhoto(e.target.files[0]);
                      }
                    }}
                    style={{ display: 'none' }}
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50" asChild>
                      <span>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Hochladen
                      </span>
                    </Button>
                  </label>
                </CardHeader>
                <CardContent className="p-5">
                  {photos.length === 0 ? (
                    <div className="text-center py-8">
                      <ImageIcon className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Noch keine Fotos hochgeladen</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                          {photo.file_url && (
                            <img
                              src={photo.file_url}
                              alt="Project photo"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Aktivitäts-Timeline — volle Breite */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Aktivitäts-Timeline</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {project.recent_activities.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Noch keine Aktivitäten vorhanden</p>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-slate-50">
                    {project.recent_activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 py-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{activity.user_name}</p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{formatDateTime(activity.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="time" className="space-y-4 min-h-[600px] mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Zeiterfassung</h3>
              {permissions.can_add_time && (
                <Button onClick={() => setIsTimeFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Zeit erfassen
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Zeiteinträge werden hier angezeigt...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Details Tab ────────────────────────────────────── */}
          <TabsContent value="details" className="px-6 pb-6 pt-5 space-y-5 min-h-[500px] mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Projektdetails */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Projektdetails</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-slate-400 mr-1.5">Start:</span>
                      <span className="font-medium text-slate-800">{formatDate(project.start_date)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 mr-1.5">Ende:</span>
                      <span className="font-medium text-slate-800">{formatDate(project.planned_end_date)}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-sm">{project.stats.days_remaining} Tage verbleibend</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span>{project.project_address}</span>
                  </div>
                  {project.project_description && project.project_description !== 'Keine Beschreibung' && (
                    <p className="text-sm text-slate-500 leading-relaxed">{project.project_description}</p>
                  )}
                </CardContent>
              </Card>

              {/* Kundeninformationen */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden cursor-pointer hover:border-teal-300 hover:shadow-md transition-all" onClick={() => project.customer_id && loadCustomerProjects(project.customer_id)}>
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Kundeninformationen</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Unternehmen</p>
                      <p className="font-semibold text-slate-900 hover:text-teal-600 transition-colors">{project.customer.company_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Ansprechpartner</p>
                      <p className="font-medium text-slate-800">{project.customer.contact_person}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a href={`mailto:${project.customer.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors flex-1">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="truncate">{project.customer.email}</span>
                    </a>
                    {project.customer.phone && (
                      <a href={`tel:${project.customer.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors flex-1">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{project.customer.phone}</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4 min-h-[600px] mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Materialverwaltung</h3>
              {permissions.can_add_materials && (
                <Button onClick={() => setIsMaterialFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Material hinzufügen
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Materialeinträge werden hier angezeigt...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 min-h-[600px] mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Dokumente</h3>
              {permissions.can_upload_files && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Datei hochladen
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Projektdokumente werden hier angezeigt...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4 min-h-[600px] mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Kommentare & Notizen</h3>
              <Button>
                <MessageSquare className="h-4 w-4 mr-2" />
                Kommentar hinzufügen
              </Button>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">Projektkommentare werden hier angezeigt...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Time Entry Form */}
        <TimeEntryForm
          isOpen={isTimeFormOpen}
          onClose={() => setIsTimeFormOpen(false)}
          projectId={project.id}
          onTimeEntryAdded={(entry) => {
            console.log('Time entry added:', entry);
            fetchProjectData();
            toast({
              title: "Erfolg",
              description: "Arbeitszeit wurde erfasst"
            });
          }}
        />

        {/* Material Entry Form */}
        <MaterialEntryForm
          isOpen={isMaterialFormOpen}
          onClose={() => setIsMaterialFormOpen(false)}
          projectId={project.id}
          onMaterialEntryAdded={(entry) => {
            console.log('Material entry added:', entry);
            fetchProjectData();
            toast({
              title: "Erfolg",
              description: "Material wurde erfasst"
            });
          }}
        />

        {/* Add Team Member Dialog */}
        {
          isAddTeamMemberOpen && (
            <Dialog open={isAddTeamMemberOpen} onOpenChange={setIsAddTeamMemberOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Team-Mitglied hinzufügen</DialogTitle>
                  <DialogDescription>
                    Wählen Sie einen Mitarbeiter aus, der dem Projekt hinzugefügt werden soll.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {availableEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Keine verfügbaren Mitarbeiter gefunden oder alle sind bereits dem Projekt zugewiesen.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableEmployees.map(employee => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                            <p className="text-sm text-gray-500">{employee.position}</p>
                            <p className="text-xs text-gray-400">{employee.email}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddTeamMember(employee.id)}
                          >
                            Hinzufügen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )
        }

        {/* Customer Projects Dialog */}
        <Dialog open={isCustomerProjectsOpen} onOpenChange={setIsCustomerProjectsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Projekte für {project?.customer.company_name}</DialogTitle>
              <DialogDescription>
                Alle Projekte dieses Kunden. Klicken Sie auf ein Projekt, um es zu öffnen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {loadingCustomerProjects ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                </div>
              ) : customerProjects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Keine weiteren Projekte für diesen Kunden</p>
                </div>
              ) : (
                customerProjects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setIsCustomerProjectsOpen(false);
                      setCurrentProjectId(proj.id);
                      setActiveTab('overview');
                    }}
                    className={`w-full text-left p-4 border rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all ${
                      proj.id === currentProjectId ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{proj.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {proj.start_date && `von ${new Date(proj.start_date).toLocaleDateString('de-DE')}`}
                          {proj.end_date && ` bis ${new Date(proj.end_date).toLocaleDateString('de-DE')}`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        proj.status === 'abgeschlossen' ? 'bg-green-100 text-green-700' :
                        proj.status === 'in_bearbeitung' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {proj.status === 'abgeschlossen' ? 'Fertig' :
                         proj.status === 'in_bearbeitung' ? 'In Arbeit' :
                         proj.status === 'geplant' ? 'Geplant' : proj.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailView;
