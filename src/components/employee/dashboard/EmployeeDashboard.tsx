// Mitarbeiter-Übersicht (Dashboard)
// Extrahiert aus DesktopEmployeePage.tsx (activeTab === 'dashboard')

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  ClipboardList,
  Clock,
  Eye,
  Edit,
  TrendingUp,
  CalendarDays,
  FileWarning,
  AlertCircle,
} from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useDeliveryNotes } from '@/hooks/useDeliveryNotes';
import { DeliveryNoteStatusBadge } from '@/components/delivery-notes/DeliveryNoteStatusBadge';
import { DeliveryNoteForm } from '@/components/delivery-notes/DeliveryNoteForm';
import { TimeEntryDialog } from '@/components/employee/timesheet/TimeEntryDialog';
import { supabase } from '@/integrations/supabase/client';
import { normalizeProjectStatus } from '@/lib/projectStatus';

interface Project {
  id: string;
  name: string;
  customer_name?: string;
  status: string;
  // Wird derzeit nicht mitgeladen (fetchProjects selektiert die Spalte nicht),
  // bleibt daher immer undefined — Feld existiert nur für den Statusabgleich unten.
  workflow_stage?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  start_time: string;
  end_time?: string;
  description?: string;
  status: string;
}

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const { employee, canEditDeliveryNote } = useEmployeePermissions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [vacationDays, setVacationDays] = useState({ total: 30, used: 0 });

  const { deliveryNotes, fetchDeliveryNotes } = useDeliveryNotes();

  // Zeit erfassen Dialog
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);

  // Lieferschein bearbeiten (Abgelehnte Lieferscheine)
  const [deliveryNoteFormOpen, setDeliveryNoteFormOpen] = useState(false);
  const [editingDeliveryNoteId, setEditingDeliveryNoteId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  useEffect(() => {
    if (employee?.id) {
      fetchProjects();
      fetchTimeEntries();
      fetchDeliveryNotes();
      fetchVacation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const fetchProjects = async () => {
    if (!employee) return;
    try {
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

      setTimeEntries((data || []).map(entry => ({ ...entry })));
    } catch (err) {
      console.error('Error fetching time entries:', err);
    }
  };

  const fetchVacation = async () => {
    if (!employee) return;
    try {
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

  const handleEditDeliveryNote = (noteId: string, projectId: string) => {
    setEditingDeliveryNoteId(noteId);
    setSelectedProjectId(projectId);
    setDeliveryNoteFormOpen(true);
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

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  if (!employee) {
    return <p className="text-muted-foreground">Wird geladen...</p>;
  }

  return (
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
                <p className="text-2xl font-bold">{projects.filter(p => { const n = normalizeProjectStatus(p.status, p.workflow_stage); return n.status === 'active' || n.workflow_stage === 'ordered'; }).length}</p>
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
          <Button onClick={() => setTimeEntryDialogOpen(true)}>
            <Clock className="h-4 w-4 mr-2" /> Zeit erfassen
          </Button>
          <Button variant="outline" onClick={() => navigate('/employee/projekte')}>
            <ClipboardList className="h-4 w-4 mr-2" /> Neuer Lieferschein
          </Button>
          <Button variant="outline" onClick={() => navigate('/employee/zeiterfassung')}>
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

      {/* Zeit erfassen Dialog */}
      <TimeEntryDialog
        open={timeEntryDialogOpen}
        onOpenChange={setTimeEntryDialogOpen}
        projects={projects}
        onSaved={() => {
          fetchTimeEntries();
          fetchDeliveryNotes();
        }}
      />

      {/* Lieferschein bearbeiten (aus "Abgelehnte Lieferscheine") */}
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
    </div>
  );
}

export default EmployeeDashboard;
