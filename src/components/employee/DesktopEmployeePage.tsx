// Desktop Employee Page
// Für Übersicht & Nacharbeit am PC
// Features: Projekte, Lieferscheine, Zeiterfassung, Urlaub

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  ClipboardList,
  Clock,
  Plane,
  CheckSquare,
  Receipt,
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  Check,
  X,
  Plus,
  User,
  LogOut,
} from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteStatusBadge } from '@/components/delivery-notes/DeliveryNoteStatusBadge';
import { DeliveryNoteForm } from '@/components/delivery-notes/DeliveryNoteForm';
import { VacationRequestDialog } from '@/components/VacationRequestDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNavigate } from 'react-router-dom';

type TabValue = 'projects' | 'delivery-notes' | 'timesheet' | 'vacation' | 'approvals' | 'invoices';

interface Project {
  id: string;
  name: string;
  customer_name?: string;
  status: string;
  location?: string;
  start_date?: string;
  end_date?: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  project_name?: string;
  start_time: string;
  end_time?: string;
  description?: string;
  status: string;
}

export function DesktopEmployeePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signOut } = useSupabaseAuth();
  const {
    employee,
    isLoading: permissionsLoading,
    isManager,
    can,
    canApproveDeliveryNote,
    canViewInvoices,
    canEditDeliveryNote,
    canSubmitDeliveryNote,
  } = useEmployeePermissions();

  // State
  const [activeTab, setActiveTab] = useState<TabValue>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Delivery Notes
  const {
    deliveryNotes,
    isLoading: notesLoading,
    fetchDeliveryNotes,
    submitForApproval,
    approve,
    reject,
  } = useDeliveryNotes({});

  // Delivery Note Form State
  const [deliveryNoteFormOpen, setDeliveryNoteFormOpen] = useState(false);
  const [editingDeliveryNoteId, setEditingDeliveryNoteId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  // Vacation Dialog
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);

  // Fetch data
  useEffect(() => {
    if (employee?.id) {
      fetchProjects();
      fetchTimeEntries();
      fetchDeliveryNotes();
    }
  }, [employee?.id]);

  const fetchProjects = async () => {
    if (!employee) return;

    try {
      // Fetch projects where employee is team member
      const { data: teamProjects, error } = await supabase
        .from('project_team_members')
        .select(`
          project_id,
          projects (
            id,
            name,
            status,
            location,
            start_date,
            end_date,
            customers (
              company_name
            )
          )
        `)
        .eq('employee_id', employee.id);

      if (error) throw error;

      const projectList: Project[] = (teamProjects || [])
        .filter(tp => tp.projects)
        .map(tp => ({
          id: tp.projects.id,
          name: tp.projects.name,
          status: tp.projects.status,
          location: tp.projects.location,
          start_date: tp.projects.start_date,
          end_date: tp.projects.end_date,
          customer_name: tp.projects.customers?.company_name,
        }));

      setProjects(projectList);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTimeEntries = async () => {
    if (!employee) return;

    try {
      const { data, error } = await supabase
        .from('project_time_entries')
        .select(`
          id,
          project_id,
          start_time,
          end_time,
          description,
          status,
          projects (name)
        `)
        .eq('employee_id', employee.id)
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTimeEntries((data || []).map(entry => ({
        ...entry,
        project_name: entry.projects?.name,
      })));
    } catch (err) {
      console.error('Error fetching time entries:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Delivery Note Actions
  const handleNewDeliveryNote = (projectId?: string) => {
    setEditingDeliveryNoteId(undefined);
    setSelectedProjectId(projectId);
    setDeliveryNoteFormOpen(true);
  };

  const handleEditDeliveryNote = (noteId: string, projectId: string) => {
    setEditingDeliveryNoteId(noteId);
    setSelectedProjectId(projectId);
    setDeliveryNoteFormOpen(true);
  };

  const handleSubmitDeliveryNote = async (noteId: string) => {
    const success = await submitForApproval(noteId);
    if (success) {
      toast({ title: 'Lieferschein eingereicht', description: 'Wartet auf Freigabe' });
    }
  };

  const handleApproveDeliveryNote = async (noteId: string) => {
    const success = await approve(noteId);
    if (success) {
      toast({ title: 'Freigegeben', description: 'Lieferschein wurde freigegeben' });
    }
  };

  const handleRejectDeliveryNote = async (noteId: string) => {
    const reason = prompt('Ablehnungsgrund (min. 10 Zeichen):');
    if (reason && reason.length >= 10) {
      const success = await reject(noteId, reason);
      if (success) {
        toast({ title: 'Abgelehnt', description: 'Lieferschein wurde abgelehnt' });
      }
    }
  };

  // Format helpers
  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  const formatTime = (datetime: string | undefined) => {
    if (!datetime) return '-';
    return format(new Date(datetime), 'HH:mm', { locale: de });
  };

  const calculateHours = (start: string, end?: string) => {
    if (!end) return '-';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return (diff / (1000 * 60 * 60)).toFixed(1) + 'h';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      planning: 'outline',
      active: 'default',
      paused: 'secondary',
      completed: 'default',
      closed: 'secondary',
    };
    const labels: Record<string, string> = {
      planning: 'Geplant',
      active: 'Aktiv',
      paused: 'Pausiert',
      completed: 'Abgeschlossen',
      closed: 'Geschlossen',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">Kein Mitarbeiter-Profil gefunden.</p>
            <Button className="mt-4" onClick={() => navigate('/auth')}>
              Zur Anmeldung
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter delivery notes for approvals tab
  const pendingApprovals = deliveryNotes.filter(dn => dn.status === 'submitted');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        {/* User Info */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{employee.first_name} {employee.last_name}</p>
              <p className="text-xs text-muted-foreground">
                {isManager ? 'Manager' : 'Mitarbeiter'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setActiveTab('projects')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'projects'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Building2 className="h-5 w-5" />
                Meine Projekte
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('delivery-notes')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'delivery-notes'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-100'
                }`}
              >
                <ClipboardList className="h-5 w-5" />
                Lieferscheine
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('timesheet')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'timesheet'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Clock className="h-5 w-5" />
                Zeiterfassung
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('vacation')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'vacation'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Plane className="h-5 w-5" />
                Urlaub
              </button>
            </li>

            {/* Conditional: Approvals (Manager or grant) */}
            {canApproveDeliveryNote() && (
              <li className="pt-4 border-t mt-4">
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === 'approvals'
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <CheckSquare className="h-5 w-5" />
                  Freigaben
                  {pendingApprovals.length > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {pendingApprovals.length}
                    </Badge>
                  )}
                </button>
              </li>
            )}

            {/* Conditional: Invoices (only with grant) */}
            {canViewInvoices() && (
              <li>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === 'invoices'
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <Receipt className="h-5 w-5" />
                  Rechnungen
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-2 border-t">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Abmelden
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Meine Projekte</h1>
                <p className="text-muted-foreground">Projekte, denen du zugewiesen bist</p>
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Ort</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead className="w-[100px]">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Wird geladen...
                      </TableCell>
                    </TableRow>
                  ) : projects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Projekte zugewiesen
                      </TableCell>
                    </TableRow>
                  ) : (
                    projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>{project.customer_name || '-'}</TableCell>
                        <TableCell>{project.location || '-'}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>
                          {formatDate(project.start_date)} - {formatDate(project.end_date)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleNewDeliveryNote(project.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            LS
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Delivery Notes Tab */}
        {activeTab === 'delivery-notes' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Lieferscheine</h1>
                <p className="text-muted-foreground">
                  {can('delivery_note.edit_all') ? 'Alle Lieferscheine' : 'Meine Lieferscheine'}
                </p>
              </div>
              {projects.length > 0 && (
                <Button onClick={() => handleNewDeliveryNote(projects[0]?.id)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Lieferschein
                </Button>
              )}
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Wird geladen...
                      </TableCell>
                    </TableRow>
                  ) : deliveryNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Lieferscheine vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliveryNotes.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="font-mono text-sm">
                          {note.delivery_note_number || note.number || '-'}
                        </TableCell>
                        <TableCell>{formatDate(note.work_date || note.delivery_date)}</TableCell>
                        <TableCell>{note.project?.name || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {note.description || '-'}
                        </TableCell>
                        <TableCell>
                          <DeliveryNoteStatusBadge status={note.status} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                Ansehen
                              </DropdownMenuItem>

                              {canEditDeliveryNote(note) && (
                                <DropdownMenuItem
                                  onClick={() => handleEditDeliveryNote(note.id, note.project_id)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                              )}

                              {canSubmitDeliveryNote(note) && (
                                <DropdownMenuItem
                                  onClick={() => handleSubmitDeliveryNote(note.id)}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Einreichen
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Timesheet Tab */}
        {activeTab === 'timesheet' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Zeiterfassung</h1>
                <p className="text-muted-foreground">Meine erfassten Arbeitszeiten</p>
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Ende</TableHead>
                    <TableHead>Stunden</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Keine Zeiteinträge vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.start_time)}</TableCell>
                        <TableCell>{entry.project_name || '-'}</TableCell>
                        <TableCell>{formatTime(entry.start_time)}</TableCell>
                        <TableCell>{formatTime(entry.end_time)}</TableCell>
                        <TableCell>{calculateHours(entry.start_time, entry.end_time)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entry.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === 'approved' ? 'default' : 'outline'}>
                            {entry.status === 'approved' ? 'Bestätigt' : entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Vacation Tab */}
        {activeTab === 'vacation' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Urlaub</h1>
                <p className="text-muted-foreground">Urlaubsanträge verwalten</p>
              </div>
              <Button onClick={() => setVacationDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Urlaub beantragen
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Urlaubsübersicht</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Urlaubsanträge und Resturlaub werden hier angezeigt.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Approvals Tab (Manager / with grant) */}
        {activeTab === 'approvals' && canApproveDeliveryNote() && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Freigaben</h1>
                <p className="text-muted-foreground">
                  Lieferscheine zur Freigabe ({pendingApprovals.length} offen)
                </p>
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="w-[150px]">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine offenen Freigaben
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingApprovals.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="font-mono text-sm">
                          {note.delivery_note_number || note.number || '-'}
                        </TableCell>
                        <TableCell>{formatDate(note.work_date || note.delivery_date)}</TableCell>
                        <TableCell>
                          {note.created_by_employee
                            ? `${note.created_by_employee.first_name} ${note.created_by_employee.last_name}`
                            : '-'}
                        </TableCell>
                        <TableCell>{note.project?.name || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {note.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveDeliveryNote(note.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectDeliveryNote(note.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Invoices Tab (only with grant) */}
        {activeTab === 'invoices' && canViewInvoices() && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Rechnungen</h1>
                <p className="text-muted-foreground">Rechnungsübersicht</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Rechnungen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Rechnungsliste wird hier angezeigt.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Delivery Note Form Dialog */}
      {selectedProjectId && (
        <DeliveryNoteForm
          projectId={selectedProjectId}
          deliveryNoteId={editingDeliveryNoteId}
          open={deliveryNoteFormOpen}
          onOpenChange={setDeliveryNoteFormOpen}
          onSuccess={() => {
            fetchDeliveryNotes();
            setDeliveryNoteFormOpen(false);
          }}
        />
      )}

      {/* Vacation Dialog */}
      <VacationRequestDialog
        isOpen={vacationDialogOpen}
        onClose={() => setVacationDialogOpen(false)}
      />
    </div>
  );
}

export default DesktopEmployeePage;
