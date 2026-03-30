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
  CheckCircle2,
  LayoutDashboard,
  AlertCircle,
  UserCircle,
  CalendarDays,
  TrendingUp,
  FileWarning,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type TabValue = 'dashboard' | 'projects' | 'delivery-notes' | 'timesheet' | 'vacation' | 'profile' | 'invoices';

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
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');
  const [profileData, setProfileData] = useState({ position: '', phone: '', hourly_wage: 0, start_date: '' });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
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
  const [deliveryNotePrefill, setDeliveryNotePrefill] = useState<{
    work_date?: string; start_time?: string; end_time?: string;
    break_minutes?: number; description?: string;
  } | undefined>();

  // Time Entry Form State
  const [timeFormOpen, setTimeFormOpen] = useState(false);
  const [timeFormSaving, setTimeFormSaving] = useState(false);
  const [lieferscheinPromptOpen, setLieferscheinPromptOpen] = useState(false);
  const [savedTimeEntryData, setSavedTimeEntryData] = useState<{
    project_id: string; work_date: string; start_time: string;
    end_time: string; break_minutes: number; description: string;
  } | null>(null);
  const [timeForm, setTimeForm] = useState({
    project_id: '',
    work_date: new Date().toISOString().split('T')[0],
    start_time: '07:00',
    end_time: '15:30',
    break_minutes: 30,
    description: '',
  });

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
      fetchProfileData();
    }
  }, [employee?.id]);

  const fetchProfileData = async () => {
    if (!employee?.id) return;
    const { data } = await supabase
      .from('employees')
      .select('position, phone, hourly_wage, start_date')
      .eq('id', employee.id)
      .single();
    if (data) setProfileData({ position: data.position || '', phone: data.phone || '', hourly_wage: data.hourly_wage || 0, start_date: data.start_date || '' });
  };

  // Stunden diese Woche
  const weekHours = (() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return timeEntries
      .filter(e => e.start_time && new Date(e.start_time) >= monday)
      .reduce((sum, e) => {
        if (!e.start_time || !e.end_time) return sum;
        return sum + (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 3600000;
      }, 0);
  })();

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

  const handleSaveTimeEntry = async () => {
    if (!employee || !timeForm.project_id || !timeForm.start_time || !timeForm.end_time) return;
    setTimeFormSaving(true);
    try {
      const startISO = `${timeForm.work_date}T${timeForm.start_time}:00`;
      const endISO = `${timeForm.work_date}T${timeForm.end_time}:00`;
      const { error } = await supabase.from('time_entries').insert({
        employee_id: employee.id,
        project_id: timeForm.project_id,
        company_id: employee.company_id,
        start_time: startISO,
        end_time: endISO,
        description: timeForm.description,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Zeit gespeichert' });
      setSavedTimeEntryData({ ...timeForm });
      setTimeFormOpen(false);
      fetchTimeEntries();
      // Prompt: Lieferschein erstellen?
      setLieferscheinPromptOpen(true);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Zeit konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setTimeFormSaving(false);
    }
  };

  const handleCreateLieferscheinFromTime = () => {
    if (!savedTimeEntryData) return;
    setLieferscheinPromptOpen(false);
    setEditingDeliveryNoteId(undefined);
    setSelectedProjectId(savedTimeEntryData.project_id);
    setDeliveryNotePrefill({
      work_date: savedTimeEntryData.work_date,
      start_time: savedTimeEntryData.start_time,
      end_time: savedTimeEntryData.end_time,
      break_minutes: savedTimeEntryData.break_minutes,
      description: savedTimeEntryData.description,
    });
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
    { id: 'dashboard', icon: LayoutDashboard, label: 'Übersicht' },
    { id: 'projects', icon: Building2, label: 'Meine Projekte' },
    { id: 'delivery-notes', icon: ClipboardList, label: 'Lieferscheine' },
    { id: 'timesheet', icon: Clock, label: 'Zeiterfassung' },
    { id: 'vacation', icon: Plane, label: 'Urlaub' },
    { id: 'profile', icon: UserCircle, label: 'Mein Profil' },
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
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Guten Tag, {employee.first_name}!</h1>
              <p className="text-muted-foreground">Deine Übersicht für heute</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><Building2 className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aktive Projekte</p>
                      <p className="text-2xl font-bold">{projects.filter(p => p.status === 'active' || p.status === 'in_bearbeitung' || p.status === 'beauftragt').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg"><ClipboardList className="h-5 w-5 text-amber-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Offene Lieferscheine</p>
                      <p className="text-2xl font-bold">{deliveryNotes.filter(n => n.status === 'draft' || n.status === 'submitted').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stunden diese Woche</p>
                      <p className="text-2xl font-bold">{weekHours.toFixed(1)}h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg"><CalendarDays className="h-5 w-5 text-purple-600" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resturlaub</p>
                      <p className="text-2xl font-bold">{vacationDays.total - vacationDays.used} Tage</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Abgelehnte Lieferscheine prominent */}
            {deliveryNotes.filter(n => n.status === 'rejected').length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-red-800 flex items-center gap-2">
                    <FileWarning className="h-5 w-5" />
                    Abgelehnte Lieferscheine — Überarbeitung erforderlich
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deliveryNotes.filter(n => n.status === 'rejected').map(note => (
                    <div key={note.id} className="bg-white rounded-lg p-3 border border-red-200 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{note.delivery_note_number || 'Entwurf'} — {note.project?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(note.work_date)}</p>
                        {note.rejection_reason && (
                          <p className="text-xs text-red-700 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            {note.rejection_reason}
                          </p>
                        )}
                      </div>
                      {canEditDeliveryNote(note) && (
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 flex-shrink-0"
                          onClick={() => handleEditDeliveryNote(note.id, note.project_id)}>
                          <Edit className="h-3 w-3 mr-1" /> Bearbeiten
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Schnellaktionen */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Schnellaktionen</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button onClick={() => {
                  setTimeForm({ project_id: '', work_date: new Date().toISOString().split('T')[0], start_time: '07:00', end_time: '15:30', break_minutes: 30, description: '' });
                  setTimeFormOpen(true);
                }}>
                  <Clock className="h-4 w-4 mr-2" /> Zeit erfassen
                </Button>
                <Button variant="outline" onClick={() => handleNewDeliveryNote(projects[0]?.id)}>
                  <ClipboardList className="h-4 w-4 mr-2" /> Neuer Lieferschein
                </Button>
                <Button variant="outline" onClick={() => { setActiveTab('timesheet'); }}>
                  <Eye className="h-4 w-4 mr-2" /> Alle Zeiteinträge
                </Button>
              </CardContent>
            </Card>

            {/* Letzte Lieferscheine */}
            {deliveryNotes.filter(n => n.status !== 'rejected').length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Letzte Lieferscheine</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deliveryNotes.filter(n => n.status !== 'rejected').slice(0, 5).map(note => (
                    <div key={note.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <span className="text-sm font-medium">{note.delivery_note_number || 'Entwurf'}</span>
                        <span className="text-sm text-muted-foreground ml-2">{note.project?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(note.work_date)}</span>
                        <DeliveryNoteStatusBadge status={note.status} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

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
                      <TableRow key={note.id} className={note.status === 'rejected' ? 'bg-red-50 hover:bg-red-100' : ''}>
                        <TableCell className="font-mono text-sm">
                          {note.delivery_note_number || '-'}
                        </TableCell>
                        <TableCell>{formatDate(note.work_date)}</TableCell>
                        <TableCell>{note.project?.name || '-'}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{note.description || '-'}</div>
                          {note.status === 'rejected' && note.rejection_reason && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-red-600">
                              <AlertCircle className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{note.rejection_reason}</span>
                            </div>
                          )}
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
              <Button onClick={() => {
                setTimeForm({ project_id: '', work_date: new Date().toISOString().split('T')[0], start_time: '07:00', end_time: '15:30', break_minutes: 30, description: '' });
                setTimeFormOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Zeit erfassen
              </Button>
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

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Mein Profil</h1>
              <p className="text-muted-foreground">Deine Stammdaten</p>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-5 w-5" /> Persönliche Daten</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Vorname</Label>
                    <p className="text-sm font-medium mt-0.5">{employee.first_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nachname</Label>
                    <p className="text-sm font-medium mt-0.5">{employee.last_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Position</Label>
                    <p className="text-sm font-medium mt-0.5">{profileData.position || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefon</Label>
                    <p className="text-sm font-medium mt-0.5">{profileData.phone || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Stundenlohn (netto)</Label>
                    <p className="text-sm font-medium mt-0.5">{profileData.hourly_wage ? formatCurrency(profileData.hourly_wage) + ' /h' : '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Angestellt seit</Label>
                    <p className="text-sm font-medium mt-0.5">{profileData.start_date ? formatDate(profileData.start_date) : '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Urlaub</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold">{vacationDays.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Gesamttage</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{vacationDays.used}</p>
                    <p className="text-xs text-muted-foreground mt-1">Genommen</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600">{vacationDays.total - vacationDays.used}</p>
                    <p className="text-xs text-muted-foreground mt-1">Verbleibend</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Passwort ändern</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Neues Passwort</Label>
                  <Input type="password" className="mt-1" placeholder="Mindestens 8 Zeichen"
                    value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
                </div>
                <div>
                  <Label>Passwort bestätigen</Label>
                  <Input type="password" className="mt-1" placeholder="Passwort wiederholen"
                    value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                </div>
                <Button
                  disabled={pwSaving || pwForm.next.length < 8 || pwForm.next !== pwForm.confirm}
                  onClick={async () => {
                    setPwSaving(true);
                    try {
                      const { error } = await supabase.auth.updateUser({ password: pwForm.next });
                      if (error) throw error;
                      toast({ title: 'Passwort geändert' });
                      setPwForm({ current: '', next: '', confirm: '' });
                    } catch {
                      toast({ title: 'Fehler beim Ändern', variant: 'destructive' });
                    } finally {
                      setPwSaving(false);
                    }
                  }}
                >
                  {pwSaving ? 'Wird gespeichert...' : 'Passwort speichern'}
                </Button>
              </CardContent>
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

      {/* Zeit erfassen Dialog */}
      <Dialog open={timeFormOpen} onOpenChange={setTimeFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Zeit erfassen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Projekt</Label>
              <Select value={timeForm.project_id} onValueChange={v => setTimeForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Projekt wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" className="mt-1" value={timeForm.work_date}
                onChange={e => setTimeForm(f => ({ ...f, work_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Von</Label>
                <Input type="time" className="mt-1" value={timeForm.start_time}
                  onChange={e => setTimeForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <Label>Bis</Label>
                <Input type="time" className="mt-1" value={timeForm.end_time}
                  onChange={e => setTimeForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
              <div>
                <Label>Pause (min)</Label>
                <Input type="number" className="mt-1" min={0} step={5} value={timeForm.break_minutes}
                  onChange={e => setTimeForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Tätigkeitsbeschreibung</Label>
              <Textarea className="mt-1" rows={3} placeholder="Was wurde gemacht?"
                value={timeForm.description}
                onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeFormOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveTimeEntry} disabled={timeFormSaving || !timeForm.project_id}>
              {timeFormSaving ? 'Speichern...' : 'Speichern & weiter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lieferschein erstellen? Prompt */}
      <Dialog open={lieferscheinPromptOpen} onOpenChange={setLieferscheinPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Zeit gespeichert
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Möchtest du direkt einen Lieferschein für diese Zeit erstellen?
            Du kannst dort noch Materialien und Fotos hinzufügen.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLieferscheinPromptOpen(false)}>
              Nein, später
            </Button>
            <Button onClick={handleCreateLieferscheinFromTime}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Lieferschein erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Note Form Dialog */}
      <DeliveryNoteForm
        projectId={selectedProjectId}
        deliveryNoteId={editingDeliveryNoteId}
        prefillData={deliveryNotePrefill}
        open={deliveryNoteFormOpen}
        onOpenChange={setDeliveryNoteFormOpen}
        onSuccess={() => {
          fetchDeliveryNotes();
          setDeliveryNoteFormOpen(false);
          setDeliveryNotePrefill(undefined);
        }}
      />

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
