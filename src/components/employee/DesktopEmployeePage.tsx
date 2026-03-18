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
  Receipt,
  MoreHorizontal,
  Eye,
  Edit,
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
import { ThemeToggle } from '@/components/ui/theme-toggle';

type TabValue = 'projects' | 'delivery-notes' | 'timesheet' | 'vacation' | 'invoices';

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
    canViewInvoices,
    canEditDeliveryNote,
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
  } = useDeliveryNotes();

  // Delivery Note Form State
  const [deliveryNoteFormOpen, setDeliveryNoteFormOpen] = useState(false);
  const [editingDeliveryNoteId, setEditingDeliveryNoteId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  // Vacation Dialog
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [vacationRequests, setVacationRequests] = useState<any[]>([]);
  const [vacationDays, setVacationDays] = useState({ total: 30, used: 0 });

  // Invoices
  const [invoiceList, setInvoiceList] = useState<any[]>([]);

  // Fetch data
  useEffect(() => {
    if (employee?.id) {
      fetchProjects();
      fetchTimeEntries();
      fetchDeliveryNotes();
      fetchVacation();
      fetchInvoices();
    }
  }, [employee?.id]);

  const fetchProjects = async () => {
    if (!employee) return;

    try {
      // Fetch projects where employee is team member
      const { data: teamProjects, error } = await supabase
        .from('project_team_assignments')
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
        .from('time_entries')
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

  const fetchVacation = async () => {
    if (!employee) return;
    try {
      const { data, error } = await supabase
        .from('vacation_requests')
        .select('*')
        .eq('employee_id', employee.id)
        .order('start_date', { ascending: false });
      if (error) console.error('Vacation fetch error:', error);
      setVacationRequests(data || []);

      const { data: empVacation } = await supabase
        .from('employees')
        .select('vacation_days_total, vacation_days_used')
        .eq('id', employee.id)
        .single();
      if (empVacation) {
        setVacationDays({
          total: empVacation.vacation_days_total || 30,
          used: empVacation.vacation_days_used || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching vacation data:', err);
    }
  };

  const fetchInvoices = async () => {
    if (!employee || !canViewInvoices()) return;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', employee.company_id)
        .order('invoice_date', { ascending: false })
        .limit(50);
      if (error) console.error('Invoice fetch error:', error);
      setInvoiceList(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
  };

  const getVacationStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Genehmigt</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Abgelehnt</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Ausstehend</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Bezahlt</Badge>;
      case 'sent':
      case 'issued':
        return <Badge variant="default">Versendet</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Überfällig</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Storniert</Badge>;
      case 'draft':
      default:
        return <Badge variant="outline">Entwurf</Badge>;
    }
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

  const navItems: { id: TabValue; icon: any; label: string }[] = [
    { id: 'projects', icon: Building2, label: 'Meine Projekte' },
    { id: 'delivery-notes', icon: ClipboardList, label: 'Lieferscheine' },
    { id: 'timesheet', icon: Clock, label: 'Zeiterfassung' },
    { id: 'vacation', icon: Plane, label: 'Urlaub' },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 flex">
      {/* Dark Sidebar – same style as Manager */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
        {/* User Info */}
        <div className="p-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <User className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{employee.first_name} {employee.last_name}</p>
              <p className="text-xs text-slate-500">
                {isManager ? 'Manager' : 'Mitarbeiter'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2">
          <div className="space-y-0.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                  activeTab === item.id
                    ? 'bg-slate-800 text-teal-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <item.icon className={`h-5 w-5 ${activeTab === item.id ? 'text-teal-400' : 'text-slate-400'}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}

            {/* Conditional: Invoices */}
            {canViewInvoices() && (
              <button
                onClick={() => setActiveTab('invoices')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                  activeTab === 'invoices'
                    ? 'bg-slate-800 text-teal-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Receipt className={`h-5 w-5 ${activeTab === 'invoices' ? 'text-teal-400' : 'text-slate-400'}`} />
                <span className="text-sm">Rechnungen</span>
              </button>
            )}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-slate-800/60">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm">Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Main area with header */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header – same style as Manager */}
        <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-slate-800">Mitarbeiter Arbeitsbereich</h2>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </header>

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
                          {note.delivery_note_number || '-'}
                        </TableCell>
                        <TableCell>{formatDate(note.work_date)}</TableCell>
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

            {/* Vacation KPI Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gesamtanspruch</CardDescription>
                  <CardTitle className="text-2xl">{vacationDays.total} Tage</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Genommen</CardDescription>
                  <CardTitle className="text-2xl">{vacationDays.used} Tage</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resturlaub</CardDescription>
                  <CardTitle className="text-2xl">{vacationDays.total - vacationDays.used} Tage</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Vacation Requests Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Tage</TableHead>
                    <TableHead>Grund</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacationRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Keine Urlaubsanträge vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacationRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          {formatDate(req.start_date)} – {formatDate(req.end_date)}
                        </TableCell>
                        <TableCell>{req.days_requested}</TableCell>
                        <TableCell>{req.reason || '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getVacationStatusBadge(req.status)}
                            {req.rejection_reason && (
                              <span className="text-xs text-red-600">{req.rejection_reason}</span>
                            )}
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

        {/* Approvals Tab (Manager / with grant) */}

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Rechnungen vorhanden
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoiceList.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                        <TableCell>{inv.snapshot_customer_name || '—'}</TableCell>
                        <TableCell>{formatCurrency(inv.gross_amount || inv.amount || 0)}</TableCell>
                        <TableCell>
                          <span className={inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled' ? 'text-red-600 font-medium' : ''}>
                            {formatDate(inv.due_date)}
                          </span>
                        </TableCell>
                        <TableCell>{getInvoiceStatusBadge(inv.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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
        open={vacationDialogOpen}
        onOpenChange={setVacationDialogOpen}
        onSuccess={fetchVacation}
      />
      </div>
    </div>
  );
}

export default DesktopEmployeePage;
