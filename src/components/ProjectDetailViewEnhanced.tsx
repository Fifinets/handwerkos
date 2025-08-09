import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Calendar,
  Clock,
  DollarSign,
  Euro,
  FileText,
  Package,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  description: string;
  budget: number;
  material_costs: number;
  labor_costs: number;
  progress_percentage: number;
  status_color: 'green' | 'yellow' | 'red';
  next_milestone: string;
  milestone_date: string;
  start_date: string;
  end_date: string;
}

interface TeamMember {
  id: string;
  employee_id: string;
  employee_name: string;
  role: string;
  hourly_rate: number;
  hours_budgeted: number;
  hours_actual: number;
  responsibilities: string[];
  employee_email?: string;
  employee_phone?: string;
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  status: 'planned' | 'ordered' | 'delivered' | 'installed' | 'cancelled';
  supplier: string;
  delivery_date: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  due_date: string;
  completed_date: string;
  is_completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface Document {
  id: string;
  name: string;
  document_type: string;
  file_url: string;
  is_favorite: boolean;
  created_at: string;
}

interface ProjectDetailViewEnhancedProps {
  project: Project;
  onUpdate: () => void;
}

export default function ProjectDetailViewEnhanced({ project, onUpdate }: ProjectDetailViewEnhancedProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  // Financial calculations
  const totalCosts = project.material_costs + project.labor_costs;
  const remainingBudget = project.budget - totalCosts;
  const projectedProfit = remainingBudget;
  const isOverBudget = totalCosts > project.budget;

  // Status indicators
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'green': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'yellow': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'red': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'green': return 'Im Plan';
      case 'yellow': return 'Leicht verzögert';
      case 'red': return 'Kritisch';
      default: return 'Unbekannt';
    }
  };

  // Data fetching
  const fetchProjectData = async () => {
    setLoading(true);
    try {
      // Fetch team members
      const { data: teamData } = await supabase
        .from('project_team_assignments')
        .select(`
          *,
          employees:employee_id (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('project_id', project.id)
        .eq('is_active', true);

      if (teamData) {
        const formattedTeam = teamData.map((member: any) => ({
          id: member.id,
          employee_id: member.employee_id,
          employee_name: `${member.employees.first_name} ${member.employees.last_name}`,
          role: member.role,
          hourly_rate: member.hourly_rate || 0,
          hours_budgeted: member.hours_budgeted || 0,
          hours_actual: member.hours_actual || 0,
          responsibilities: member.responsibilities || [],
          employee_email: member.employees.email,
          employee_phone: member.employees.phone,
        }));
        setTeamMembers(formattedTeam);
      }

      // Fetch materials
      const { data: materialsData } = await supabase
        .from('project_materials')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (materialsData) {
        setMaterials(materialsData);
      }

      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', project.id)
        .order('due_date', { ascending: true });

      if (milestonesData) {
        setMilestones(milestonesData);
      }

      // Fetch documents
      const { data: documentsData } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', project.id)
        .order('is_favorite', { ascending: false });

      if (documentsData) {
        setDocuments(documentsData);
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Fehler beim Laden der Projektdaten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [project.id]);

  // Check if project is overdue
  const isOverdue = new Date(project.end_date) < new Date() && project.progress_percentage < 100;
  
  return (
    <div className="space-y-6">
      {/* Header with basic info and status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Financial Overview */}
        <Card className="border-l-4 border-l-blue-500 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Finanzübersicht
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Budget:</span>
                <span className="font-medium">€{project.budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Materialkosten:</span>
                <span className="font-medium">€{project.material_costs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lohnkosten:</span>
                <span className="font-medium">€{project.labor_costs.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Gesamtkosten:</span>
                <span className="font-bold">€{totalCosts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Restbudget:</span>
                <span className={`font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  €{remainingBudget.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Gewinn/Verlust:</span>
                <div className="flex items-center gap-1">
                  {projectedProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`font-bold ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{Math.abs(projectedProfit).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card className="border-l-4 border-l-green-500 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Fortschritt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Fertigstellung</span>
                <span className="text-2xl font-bold">{project.progress_percentage}%</span>
              </div>
              <Progress value={project.progress_percentage} className="w-full h-3" />
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(project.status_color)}
              <span className="text-sm font-medium">{getStatusText(project.status_color)}</span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status_color)}`}></div>
            </div>

            {isOverdue && (
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600 font-medium">Projekt überfällig</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline Overview */}
        <Card className="border-l-4 border-l-purple-500 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Termine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 flex-1">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Projektstart:</span>
                <span className="text-sm font-medium">
                  {new Date(project.start_date).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Projektende:</span>
                <span className="text-sm font-medium">
                  {new Date(project.end_date).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
            
            {project.next_milestone && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Nächster Meilenstein</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.next_milestone}</p>
                  {project.milestone_date && (
                    <p className="text-sm font-medium">
                      {new Date(project.milestone_date).toLocaleDateString('de-DE')}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="team" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="team">Team & Rollen</TabsTrigger>
          <TabsTrigger value="materials">Material & Ressourcen</TabsTrigger>
          <TabsTrigger value="milestones">Meilensteine</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team-Mitglieder & Verantwortlichkeiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {teamMembers.map((member) => (
                  <Card key={member.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">{member.employee_name}</span>
                        </div>
                        <Badge variant="secondary">{member.role}</Badge>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {member.employee_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {member.employee_email}
                            </div>
                          )}
                          {member.employee_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.employee_phone}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Stundenlohn: </span>
                          <span className="font-medium">€{member.hourly_rate}/h</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Stunden: </span>
                          <span className="font-medium">{member.hours_actual}h / {member.hours_budgeted}h</span>
                        </div>
                        <Progress 
                          value={(member.hours_actual / member.hours_budgeted) * 100} 
                          className="w-full h-2" 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Verantwortlichkeiten:</span>
                        <div className="space-y-1">
                          {member.responsibilities.map((resp, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {resp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Material & Ressourcen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{material.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {material.quantity} {material.unit} × €{material.unit_price} = €{material.total_price}
                      </div>
                      {material.supplier && (
                        <div className="text-sm text-muted-foreground">
                          Lieferant: {material.supplier}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          material.status === 'installed' ? 'default' :
                          material.status === 'delivered' ? 'secondary' :
                          material.status === 'ordered' ? 'outline' : 'destructive'
                        }
                      >
                        {material.status === 'planned' && 'Geplant'}
                        {material.status === 'ordered' && 'Bestellt'}
                        {material.status === 'delivered' && 'Geliefert'}
                        {material.status === 'installed' && 'Verbaut'}
                        {material.status === 'cancelled' && 'Storniert'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meilensteine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${milestone.is_completed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className="flex-1">
                      <div className="font-medium">{milestone.title}</div>
                      <div className="text-sm text-muted-foreground">{milestone.description}</div>
                      <div className="text-sm text-muted-foreground">
                        Fällig: {new Date(milestone.due_date).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        milestone.priority === 'high' ? 'destructive' :
                        milestone.priority === 'medium' ? 'default' : 'secondary'
                      }>
                        {milestone.priority === 'high' && 'Hoch'}
                        {milestone.priority === 'medium' && 'Mittel'}
                        {milestone.priority === 'low' && 'Niedrig'}
                      </Badge>
                      {milestone.is_completed && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dokumente & Schnellzugriff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {documents.filter(doc => doc.is_favorite).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-yellow-600" />
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {doc.document_type === 'contract' && 'Vertrag'}
                          {doc.document_type === 'blueprint' && 'Bauplan'}
                          {doc.document_type === 'quote' && 'Angebot'}
                          {doc.document_type === 'invoice' && 'Rechnung'}
                          {doc.document_type === 'other' && 'Sonstiges'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Separator />
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {documents.filter(doc => !doc.is_favorite).map((doc) => (
                    <div key={doc.id} className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium truncate">{doc.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}