import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  Edit,
  Plus,
  Download,
  MessageSquare,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ProjectDashboardData,
  ProjectPermissions,
  TimeEntry,
  MaterialEntry,
  ProjectDocument,
  ProjectComment,
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
  const [userRole, setUserRole] = useState<UserRole>('mitarbeiter');
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
  const [checklistItems, setChecklistItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  useEffect(() => {
    if (isOpen && projectId) {
      fetchProjectData();
    }
  }, [isOpen, projectId]);

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
        .eq('id', projectId)
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

      // Calculate real statistics from database

      // Get real time entries for this project (with fallback)
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('hours_worked')
        .eq('project_id', projectId);

      if (timeError) {
        console.log('Time entries table might not exist yet:', timeError.message);
      }

      // Calculate total hours from real time entries (fallback to 0 if no data)
      const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0) || 0;

      // Get real material costs for this project (with fallback)
      const { data: materialEntries, error: materialError } = await supabase
        .from('material_entries')
        .select('total_cost')
        .eq('project_id', projectId);

      if (materialError) {
        console.log('Material entries table might not exist yet:', materialError.message);
      }

      // Calculate total material costs from real data (fallback to 0 if no data)
      const totalMaterialCost = materialEntries?.reduce((sum, entry) => sum + (entry.total_cost || 0), 0) || 0;

      // Get assigned team members for this project (with fallback)
      // First try simple query without join
      const { data: teamMemberIds, error: teamIdsError } = await supabase
        .from('project_team_members')
        .select('employee_id')
        .eq('project_id', projectId);

      console.log('Team member IDs for project:', { teamMemberIds, teamIdsError, projectId });

      let teamMembers = [];
      let teamError = teamIdsError;

      // If we have team member IDs, fetch their details
      if (teamMemberIds && teamMemberIds.length > 0) {
        const employeeIds = teamMemberIds.map(tm => tm.employee_id);

        const { data: employeeDetails, error: employeeError } = await supabase
          .from('employees')
          .select('id, first_name, last_name, email')
          .in('id', employeeIds);

        console.log('Employee details:', { employeeDetails, employeeError, employeeIds });

        if (employeeDetails) {
          teamMembers = teamMemberIds.map(tm => ({
            employee_id: tm.employee_id,
            employees: employeeDetails.find(emp => emp.id === tm.employee_id)
          })).filter(tm => tm.employees); // Only include if employee details found
        }

        teamError = employeeError;
      }

      console.log('Team members query result:', { teamMembers, teamError, projectId });

      // Additional debug: Check what's in the project_team_members table
      const { data: allTeamMembers, error: allTeamError } = await supabase
        .from('project_team_members')
        .select('*');
      console.log('All team members in database:', { allTeamMembers, allTeamError });

      if (teamError) {
        console.log('Project team members table might not exist yet:', teamError.message);
        // If table doesn't exist, show helpful message to user
        if (teamError.message.includes('relation "public.project_team_members" does not exist')) {
          console.log('project_team_members table needs to be created. Please apply the migration.');
        }
      }

      // Get project comments count (with fallback)
      const { data: comments, error: commentsError } = await supabase
        .from('project_comments')
        .select('id')
        .eq('project_id', projectId);

      if (commentsError) {
        console.log('Project comments table might not exist yet:', commentsError.message);
      }

      // Get project documents count (with fallback)
      const { data: documents, error: documentsError } = await supabase
        .from('project_documents')
        .select('id')
        .eq('project_id', projectId);

      if (documentsError) {
        console.log('Project documents table might not exist yet:', documentsError.message);
      }

      // Calculate budget utilization
      const projectBudget = projectData.budget || 0;
      const totalProjectCost = totalMaterialCost + (totalHours * 50); // Assuming 50€/hour
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
        project_address: projectData.location || projectData.address || 'Nicht angegeben',
        project_description: projectData.description || 'Keine Beschreibung',
        budget_planned: projectBudget,
        linked_invoices: [],
        linked_offers: [],
        created_at: projectData.created_at || new Date().toISOString(),
        updated_at: projectData.updated_at || new Date().toISOString(),
        created_by: currentUser.user.id,
        assigned_team: teamMembers?.map(tm => tm.employee_id) || [],

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
          total_hours_logged: totalHours,
          total_material_cost: totalMaterialCost,
          total_project_cost: totalProjectCost,
          budget_utilization: budgetUtilization,
          days_active: daysActive,
          days_remaining: daysRemaining,
          team_size: teamMembers?.length || 0,
          documents_count: documents?.length || 0,
          comments_count: comments?.length || 0,
          last_activity: new Date().toISOString()
        },

        recent_activities: [], // Will be populated with real data below

        team_members: teamMembers?.map(tm => ({
          id: tm.employee_id,
          name: `${tm.employees.first_name} ${tm.employees.last_name}`.trim(),
          role: 'team_member',
          email: tm.employees.email,
          hours_this_week: 0 // TODO: Calculate from time entries
        })) || [],

        permissions: getProjectPermissions('admin', true)
      };

      // Set permissions based on user role (mock for now)
      const currentUserRole: UserRole = 'admin'; // This should come from user profile
      setUserRole(currentUserRole);
      setPermissions(getProjectPermissions(currentUserRole, true));

      // Get real project activities
      const activities = [];

      // Get recent comments
      if (comments && comments.length > 0) {
        const { data: recentComments } = await supabase
          .from('project_comments')
          .select('id, content, created_at, profiles!inner(first_name, last_name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentComments) {
          recentComments.forEach(comment => {
            activities.push({
              id: `comment_${comment.id}`,
              project_id: projectId,
              event_type: 'comment',
              title: 'Neuer Kommentar hinzugefügt',
              description: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
              user_name: `${comment.profiles.first_name} ${comment.profiles.last_name}`,
              user_role: 'team_member',
              timestamp: comment.created_at
            });
          });
        }
      }

      // Get recent time entries
      if (timeEntries && timeEntries.length > 0) {
        const { data: recentTimeEntries } = await supabase
          .from('time_entries')
          .select('id, hours_worked, work_date, profiles!inner(first_name, last_name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentTimeEntries) {
          recentTimeEntries.forEach(entry => {
            activities.push({
              id: `time_${entry.id}`,
              project_id: projectId,
              event_type: 'time',
              title: 'Arbeitszeit erfasst',
              description: `${entry.hours_worked}h am ${new Date(entry.work_date).toLocaleDateString('de-DE')}`,
              user_name: `${entry.profiles.first_name} ${entry.profiles.last_name}`,
              user_role: 'team_member',
              timestamp: entry.work_date
            });
          });
        }
      }

      // Get recent material entries
      if (materialEntries && materialEntries.length > 0) {
        const { data: recentMaterialEntries } = await supabase
          .from('material_entries')
          .select('id, material_name, quantity, total_cost, created_at, profiles!inner(first_name, last_name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentMaterialEntries) {
          recentMaterialEntries.forEach(entry => {
            activities.push({
              id: `material_${entry.id}`,
              project_id: projectId,
              event_type: 'material',
              title: 'Material hinzugefügt',
              description: `${entry.material_name} (${entry.quantity}x) - ${entry.total_cost}€`,
              user_name: `${entry.profiles.first_name} ${entry.profiles.last_name}`,
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

  const handleAddTeamMember = async (employeeId: string) => {
    try {
      // Add team member to project_team_members table
      const { error } = await supabase
        .from('project_team_members')
        .insert({
          project_id: projectId,
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
  console.log('Project status:', project.status, 'Status config:', statusConfig);

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
            <TabsList className="bg-slate-100/80 border border-slate-200/60 p-1 rounded-full grid w-full grid-cols-5 h-11">
              {[
                { value: 'overview', label: 'Übersicht' },
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

            {/* KPI Cards — Zeiten erfasst / Material / Angebotssumme */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Zeiten erfasst</p>
                    <p className="text-2xl font-bold text-slate-900">{project.stats.total_hours_logged} h</p>
                    <p className="text-xs text-slate-400 mt-0.5">erfasst</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-slate-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Material</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(project.stats.total_material_cost)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{project.stats.documents_count > 0 ? `${project.stats.documents_count} Positionen` : 'keine Einträge'}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-slate-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Angebotssumme</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(project.budget_planned)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Netto · exkl. MwSt.</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-5 w-5 text-slate-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main 2-col grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Left col — Details + Customer */}
              <div className="lg:col-span-2 space-y-5">

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
                <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                    <CardTitle className="text-sm font-semibold text-slate-700">Kundeninformationen</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Unternehmen</p>
                        <p className="font-semibold text-slate-900">{project.customer.company_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Ansprechpartner</p>
                        <p className="font-medium text-slate-800">{project.customer.contact_person}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a href={`mailto:${project.customer.email}`} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors flex-1">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{project.customer.email}</span>
                      </a>
                      {project.customer.phone && (
                        <a href={`tel:${project.customer.phone}`} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors flex-1">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span>{project.customer.phone}</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right col — Team + Status + Aktivitäten */}
              <div className="space-y-5">

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
                    {project.team_members.length === 0 ? (
                      <div className="p-6 text-center">
                        <Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Noch keine Teammitglieder zugewiesen</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {project.team_members.map(member => (
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

                {/* Letzte Aktivitäten */}
                <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                    <CardTitle className="text-sm font-semibold text-slate-700">Letzte Aktivitäten</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {project.recent_activities.length === 0 ? (
                      <div className="text-center py-6">
                        <Clock className="h-7 w-7 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Noch keine Aktivitäten</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {project.recent_activities.slice(0, 6).map(activity => (
                          <div key={activity.id} className="flex gap-3">
                            <div className="flex flex-col items-center gap-1 pt-1">
                              <div className="h-2 w-2 rounded-full bg-slate-300 flex-shrink-0" />
                              <div className="w-px flex-1 bg-slate-100" />
                            </div>
                            <div className="pb-3 flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 leading-tight">{activity.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{activity.user_name} · {formatDateTime(activity.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Checkliste + Fotos — 2-col row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Checkliste */}
              <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Checkliste</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-2 mb-4">
                    {checklistItems.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3">Noch keine Punkte. Füge den ersten hinzu.</p>
                    )}
                    {checklistItems.map(item => (
                      <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => setChecklistItems(prev =>
                            prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i)
                          )}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                        />
                        <span className={`text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.text}
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
                          setChecklistItems(prev => [...prev, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                          setNewChecklistItem('');
                        }
                      }}
                      placeholder="+ Punkt hinzufügen"
                      className="flex-1 text-sm text-teal-600 placeholder:text-teal-500 bg-transparent border-none outline-none px-0 py-1"
                    />
                    {newChecklistItem.trim() && (
                      <button
                        onClick={() => {
                          setChecklistItems(prev => [...prev, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                          setNewChecklistItem('');
                        }}
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
                  <button className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    Hochladen
                  </button>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Noch keine Fotos hochgeladen</p>
                    <button className="mt-3 text-xs text-teal-600 hover:text-teal-700 font-medium">
                      + Erstes Foto hinzufügen
                    </button>
                  </div>
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
                    {project.recent_activities.map((activity, idx) => (
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
        </Tabs >

        {/* Time Entry Form */}
        < TimeEntryForm
          isOpen={isTimeFormOpen}
          onClose={() => setIsTimeFormOpen(false)}
          projectId={project.id}
          onTimeEntryAdded={(entry) => {
            console.log('Time entry added:', entry);
            // TODO: Add to project time entries list
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
            // TODO: Add to project material entries list
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
      </DialogContent >
    </Dialog >
  );
};

export default ProjectDetailView;