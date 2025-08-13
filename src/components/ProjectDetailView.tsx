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

      // Mock data for development - replace with real Supabase queries when tables exist
      const mockProjectData: ProjectDashboardData = {
        id: projectData.id,
        company_id: projectData.company_id,
        project_name: projectData.name,
        customer_id: projectData.customer_id || '',
        start_date: projectData.start_date || new Date().toISOString().split('T')[0],
        planned_end_date: projectData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: ((projectData.status as ProjectStatus) ?? 'geplant') as ProjectStatus,
        project_address: projectData.location || 'Nicht angegeben',
        project_description: projectData.description || 'Keine Beschreibung',
        linked_invoices: [],
        linked_offers: [],
        created_at: projectData.created_at || new Date().toISOString(),
        updated_at: projectData.updated_at || new Date().toISOString(),
        created_by: currentUser.user.id,
        assigned_team: [],
        
        customer: customerData ? {
          company_name: customerData.company_name,
          contact_person: customerData.contact_person,
          email: customerData.email,
          phone: customerData.phone
        } : {
          company_name: 'Unbekannter Kunde',
          contact_person: 'Nicht verfügbar',
          email: 'nicht-verfuegbar@example.com',
          phone: undefined
        },

        stats: {
          total_hours_logged: 45.5,
          total_material_cost: 2850.00,
          total_project_cost: 12750.00,
          budget_utilization: 68.5,
          days_active: 12,
          days_remaining: 8,
          team_size: 3,
          documents_count: 8,
          comments_count: 12,
          last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },

        recent_activities: [
          {
            id: '1',
            project_id: projectId,
            event_type: 'comment',
            title: 'Neuer Kommentar hinzugefügt',
            description: 'Materiallieferung für Freitag geplant',
            user_name: 'Max Mustermann',
            user_role: 'projektleiter',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: '2',
            project_id: projectId,
            event_type: 'document',
            title: 'Dokument hochgeladen',
            description: 'Bauplan_Final.pdf',
            user_name: 'Anna Schmidt',
            user_role: 'admin',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        ],

        team_members: [
          {
            id: '1',
            name: 'Max Mustermann',
            role: 'projektleiter',
            email: 'max@example.com',
            hours_this_week: 32.5
          },
          {
            id: '2', 
            name: 'Anna Schmidt',
            role: 'admin',
            email: 'anna@example.com',
            hours_this_week: 28.0
          }
        ],

        permissions: getProjectPermissions('admin', true)
      };

      // Set permissions based on user role (mock for now)
      const currentUserRole: UserRole = 'admin'; // This should come from user profile
      setUserRole(currentUserRole);
      setPermissions(getProjectPermissions(currentUserRole, true));
      
      setProject(mockProjectData);
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
            <Button onClick={onClose} className="mt-4">
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusConfig = getStatusConfig(project.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {project.project_name}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-4 mt-2">
                <Badge className={`${statusConfig.bgColor} ${statusConfig.color} text-sm`}>
                  {statusConfig.icon} {statusConfig.label}
                </Badge>
                <span className="text-gray-500">ID: {generateShortId(project.id)}</span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Budget</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(project.stats.total_project_cost)}</p>
              </div>
              <div className="flex gap-2">
                {permissions.can_edit_basic_data && (
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={onClose}>
                  Schließen
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="time">Zeiten</TabsTrigger>
            <TabsTrigger value="materials">Material</TabsTrigger>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
            <TabsTrigger value="comments">Kommentare</TabsTrigger>
          </TabsList>

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
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Hinzufügen
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.team_members.map(member => (
                      <div key={member.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-gray-600">{member.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{member.hours_this_week}h</p>
                          <p className="text-xs text-gray-500">diese Woche</p>
                        </div>
                      </div>
                    ))}
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
                    {project.recent_activities.map(activity => (
                      <div key={activity.id} className="border-l-2 border-blue-200 pl-3">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-600">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{activity.user_name}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{formatDateTime(activity.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
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
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetailView;