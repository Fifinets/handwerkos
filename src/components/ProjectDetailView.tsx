import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Building2,
  MapPin,
  Phone,
  Mail,
  Edit,
  Plus,
  Download,
  MessageSquare
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

        team_members: await Promise.all(teamMembers?.map(async (tm) => {
          // Calculate hours this week for each team member
          const startOfWeek = new Date();
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          
          const { data: weeklyHours } = await supabase
            .from('time_entries')
            .select('hours')
            .eq('project_id', projectId)
            .eq('employee_id', tm.employee_id)
            .gte('entry_date', startOfWeek.toISOString())
            .lte('entry_date', endOfWeek.toISOString());
          
          const totalHoursThisWeek = weeklyHours?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;
          
          return {
            id: tm.employee_id,
            name: `${tm.employees.first_name} ${tm.employees.last_name}`.trim(),
            role: 'team_member',
            email: tm.employees.email,
            hours_this_week: totalHoursThisWeek
          };
        }) || []),

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
      <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <Building2 className="h-6 w-6" />
                  {project.project_name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-1">
                  <Badge className={`${statusConfig.bgColor} ${statusConfig.color} text-sm`}>
                    {statusConfig.icon} {statusConfig.label}
                  </Badge>
                  <span className="text-gray-500">ID: {generateShortId(project.id)}</span>
                </DialogDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Aktueller Projektkosten</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(project.stats.total_project_cost)}</p>
                  {project.budget_planned && project.budget_planned > 0 && (
                    <p className="text-xs text-gray-500">von {formatCurrency(project.budget_planned)} Budget</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Tabs direkt im Header */}
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="time">Zeiten</TabsTrigger>
              <TabsTrigger value="materials">Material</TabsTrigger>
              <TabsTrigger value="documents">Dokumente</TabsTrigger>
              <TabsTrigger value="comments">Kommentare</TabsTrigger>
            </TabsList>
          </DialogHeader>

          <TabsContent value="overview" className="space-y-4 min-h-[600px] mt-0">
            {/* Project Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Gesamtstunden</p>
                      <p className="text-2xl font-bold">{project.stats.total_hours_logged}h</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Materialkosten</p>
                      <p className="text-2xl font-bold">{formatCurrency(project.stats.total_material_cost)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Budget-Nutzung</p>
                      <p className="text-2xl font-bold">{project.stats.budget_utilization}%</p>
                    </div>
                    <AlertTriangle className={`h-8 w-8 ${project.stats.budget_utilization > 80 ? 'text-red-500' : 'text-yellow-500'}`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Team-Größe</p>
                      <p className="text-2xl font-bold">{project.stats.team_size}</p>
                    </div>
                    <Users className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Details */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Projektdetails</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-6">
                        <div className="text-sm">
                          <span className="text-gray-600">Start:</span> {formatDate(project.start_date)}
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Ende:</span> {formatDate(project.planned_end_date)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Standort</p>
                        <p className="font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {project.project_address}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Verbleibende Tage</p>
                        <p className="font-medium">{project.stats.days_remaining} Tage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Kundeninformationen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Unternehmen</p>
                      <p className="font-medium">{project.customer.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Ansprechpartner</p>
                      <p className="font-medium">{project.customer.contact_person}</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{project.customer.email}</span>
                      </div>
                      {project.customer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{project.customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Team Members */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Team-Mitglieder
                      {permissions.can_manage_team && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            loadAvailableEmployees();
                            setIsAddTeamMemberOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Hinzufügen
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.team_members.length === 0 ? (
                      <p className="text-sm text-gray-500">Noch keine Teammitglieder zugewiesen</p>
                    ) : (
                      project.team_members.map(member => (
                        <div key={member.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{member.name || 'Unbekannt'}</p>
                            <p className="text-sm text-gray-600">{member.email || 'Keine E-Mail'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{member.hours_this_week || 0}h</p>
                            <p className="text-xs text-gray-500">diese Woche</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Status Management */}
                {permissions.can_change_status && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Status ändern</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {statusConfig.nextStates.map(nextStatus => {
                        const nextConfig = getStatusConfig(nextStatus);
                        return (
                          <Button
                            key={nextStatus}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => handleStatusChange(nextStatus)}
                          >
                            {nextConfig.icon} {nextConfig.label}
                          </Button>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Recent Activities */}
                <Card>
                  <CardHeader>
                    <CardTitle>Letzte Aktivitäten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.recent_activities.length === 0 ? (
                      <p className="text-sm text-gray-500">Noch keine Aktivitäten für dieses Projekt</p>
                    ) : (
                      project.recent_activities.map(activity => (
                        <div key={activity.id} className="border-l-2 border-blue-200 pl-3">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-gray-600">{activity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{activity.user_name}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">{formatDateTime(activity.timestamp)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-4 min-h-[600px] mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Projektteam</h3>
              {permissions.can_manage_team && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Mitarbeiter hinzufügen
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-4">
                {project.team_members && project.team_members.length > 0 ? (
                  <div className="space-y-4">
                    {project.team_members.map((member: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Users className="h-8 w-8 text-gray-400" />
                          <div>
                            <p className="font-medium">{member.first_name} {member.last_name}</p>
                            <p className="text-sm text-gray-500">{member.position}</p>
                            {member.email && (
                              <p className="text-xs text-gray-400">{member.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {member.hours_per_day ? `${member.hours_per_day}h/Tag` : 'Vollzeit'}
                          </Badge>
                          {permissions.can_manage_team && (
                            <Button variant="outline" size="sm">
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Noch keine Teammitglieder zugewiesen</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Fügen Sie Mitarbeiter hinzu, um sie diesem Projekt zuzuweisen
                    </p>
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
        </Tabs>

        {/* Time Entry Form */}
        <TimeEntryForm
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
        {isAddTeamMemberOpen && (
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailView;