import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, CheckCircle, Clock, AlertTriangle, Building2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import AddProjectDialog from "./AddProjectDialog";
import EditProjectDialog from "./EditProjectDialog";
import ProjectDetailDialogWithTasks from "./ProjectDetailDialogWithTasks";
import ProjectDetailView from "./ProjectDetailView";
import OrderModule from "./OrderModule";

const getStatusColor = (status: string) => {
  switch (status) {
    case 'in_bearbeitung':
      return 'bg-yellow-100 text-yellow-800';
    case 'abgeschlossen':
      return 'bg-green-100 text-green-800';
    case 'geplant':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'in_bearbeitung':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'abgeschlossen':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'geplant':
      return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    default:
      return <CheckCircle className="h-4 w-4 text-gray-600" />;
  }
};

const getStatusDisplayName = (status: string) => {
  switch (status) {
    case 'in_bearbeitung':
      return 'In Bearbeitung';
    case 'abgeschlossen':
      return 'Abgeschlossen';
    case 'geplant':
      return 'Planung';
    default:
      return status;
  }
};

const ProjectModule = () => {
  const [projects, setProjects] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ geplant: 0, in_bearbeitung: 0, abgeschlossen: 0 });
  const [topCustomers, setTopCustomers] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [delayedProjects, setDelayedProjects] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isProjectDetailViewOpen, setIsProjectDetailViewOpen] = useState(false);
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
        
        // Test if we can insert (without actually inserting)
        const { error: insertTestError } = await supabase
          .from('projects')
          .insert({})
          .select()
          .limit(0);
          
        console.log('  - Can insert to projects table:', !insertTestError || insertTestError.message.includes('null value'));
        if (insertTestError) {
          console.log('  - Insert test error:', insertTestError);
        }
        
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
    } catch (err) {
      console.error('💥 Error in fetchProjects:', err);
      return;
    }

    setTotalBudget(0);

    const counts = { geplant: 0, in_bearbeitung: 0, abgeschlossen: 0 };
    const delayed = [];
    const today = new Date();

    data.forEach(p => {
      if (p.status === 'geplant') counts.geplant++;
      else if (p.status === 'in_bearbeitung') counts["in_bearbeitung"]++;
      else if (p.status === 'abgeschlossen') counts.abgeschlossen++;
      
      if (p.end_date) {
        const endDate = new Date(p.end_date);
        if (endDate < today && p.status !== 'abgeschlossen') delayed.push(p);
      }
    });

    setStatusCounts(counts);
    setDelayedProjects(delayed);
  };

  const fetchTopCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*');
    if (error || !data) return;
    setTopCustomers(data.slice(0, 5));
  };

  const handleEditProject = (project) => {
    // Transform database project to match dialog interface
    const transformedProject = {
      id: project.id,
      name: project.name,
      customer: '', // Will be filled from customer_id lookup
      status: getStatusDisplayName(project.status), // Convert to German display name
      progress: 0,
      startDate: project.start_date,
      endDate: project.end_date,
      budget: '€0',
      team: [],
      location: project.location || ''
    };
    
    setSelectedProject(transformedProject);
    setIsEditDialogOpen(true);
  };

  const handleShowDetails = (project) => {
    setSelectedProject(project);
    setIsDetailDialogOpen(true);
  };

  const handleDoubleClickProject = (project) => {
    setSelectedProjectId(project.id);
    setIsProjectDetailViewOpen(true);
  };

  const handleProjectUpdated = (updatedProject) => {
    // Update project in Supabase
    const updateProject = async () => {
      // Map German status to database values
      const statusMapping = {
        'Planung': 'geplant',
        'In Bearbeitung': 'in_bearbeitung', 
        'Abgeschlossen': 'abgeschlossen'
      };
      
      const { error } = await supabase
        .from('projects')
        .update({
          name: updatedProject.name,
          status: statusMapping[updatedProject.status] || updatedProject.status,
          start_date: updatedProject.startDate,
          end_date: updatedProject.endDate,
          location: updatedProject.location,
          description: updatedProject.description
        })
        .eq('id', updatedProject.id);

      if (!error) {
        await fetchProjects();
      }
    };

    updateProject();
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
          description: `Budget: ${newProject.budget}`
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Projekte & Baustellen</h2>
          <p className="text-gray-600">Verwalten Sie Projekte und Aufträge</p>
        </div>
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Projekte
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Aufträge
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Projekt-Dashboard</h3>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              
            >
              <Plus className="h-4 w-4 mr-2" />
              Neues Projekt
            </Button>
          </div>


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p>Aktive Projekte</p><p className="text-2xl">{statusCounts.in_bearbeitung}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Abgeschlossene</p><p className="text-2xl">{statusCounts.abgeschlossen}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Gesamtbudget</p><p className="text-2xl">€{totalBudget.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p>Projekte gesamt</p><p className="text-2xl">{projects.length}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Aktuelle Projekte</h3>
          </div>

          {projects.filter(p => p.status !== 'abgeschlossen').map(project => {
            const endDate = project.end_date ? new Date(project.end_date) : null;
            const isOverdue = endDate && endDate < new Date();
            return (
            <Card 
              key={project.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onDoubleClick={() => handleDoubleClickProject(project)}
            >
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(project.status)}
                      <h4 className="text-lg font-semibold">{project.name}</h4>
                      <Badge className={getStatusColor(project.status)}>
                        {getStatusDisplayName(project.status)}
                      </Badge>
                      {isOverdue && (
                        <Badge variant="destructive">Überfällig</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">{project.description || 'Projektbeschreibung'}</p>
                    <p className="text-sm text-gray-500">Projekt-ID: {project.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> Start: {new Date(project.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </p>
                    {project.end_date && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> Ende: {new Date(project.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 flex-grow">
                  <div className="grid grid-cols-1 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Status:</p>
                      <p className="font-medium">{getStatusDisplayName(project.status)}</p>
                    </div>
                  </div>
                  
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

                <div className="flex gap-2 pt-4 mt-auto">
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShowDetails(project);
                    }}
                  >
                    Details
                  </Button>
                  <Button
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEditProject(project)}
                  >
                    Bearbeiten
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

        </TabsContent>

        <TabsContent value="orders">
          <OrderModule />
        </TabsContent>
      </Tabs>

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
    </div>
  );
};

export default ProjectModule;
