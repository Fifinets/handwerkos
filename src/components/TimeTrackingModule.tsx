import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { formatMinutesToTime } from '@/utils/timeUtils';
import { Play, Pause, Square, Clock, Calendar, User, MapPin, Filter, Plus, Settings, Users, Wifi, WifiOff, Edit } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OfflineTimeTrackingManager, GPSLocationManager, NetworkManager, type GeolocationPosition, type OfflineTimeEntry } from "@/lib/timetrackingUtils";
import EditTimeEntryDialog from "./EditTimeEntryDialog";
import { 
  useTimesheets, 
  useProjects, 
  useEmployees,
  useCreateTimesheet,
  useUpdateTimesheet
} from "@/hooks/useApi";
interface TimeEntry {
  id: string;
  employee_id: string;
  project_id?: string;
  start_time: string;
  end_time?: string;
  break_duration: number;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  start_location_lat?: number;
  start_location_lng?: number;
  start_location_address?: string;
  end_location_lat?: number;
  end_location_lng?: number;
  end_location_address?: string;
  is_offline_synced?: boolean;
  offline_created_at?: string;
  employee?: {
    first_name: string;
    last_name: string;
  };
  project?: {
    name: string;
    color: string;
  };
}
interface TimeEntryCorrection {
  id: string;
  time_entry_id: string;
  requested_by: string;
  approved_by?: string;
  original_start_time: string;
  original_end_time?: string;
  corrected_start_time: string;
  corrected_end_time?: string;
  original_description?: string;
  corrected_description?: string;
  correction_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}
interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
}
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  user_id?: string;
}
interface WorkingHoursConfig {
  id: string;
  employee_id?: string;
  start_time: string;
  end_time: string;
  break_duration: number;
  working_days: number[];
  is_default: boolean;
}
const TimeTrackingModule: React.FC = () => {
  const { toast } = useToast();
  const {
    userRole
  } = useAuth();
  
  // React Query hooks
  const { data: timeEntriesResponse, isLoading: timeEntriesLoading } = useTimesheets();
  const { data: projectsResponse, isLoading: projectsLoading } = useProjects();
  const { data: teamMembersResponse, isLoading: teamLoading } = useEmployees();
  
  const createTimeEntryMutation = useCreateTimesheet();
  const updateTimeEntryMutation = useUpdateTimesheet();
  
  // Extract data from responses
  const timeEntries = timeEntriesResponse?.items || [];
  const projects = projectsResponse?.items || [];
  const employees = teamMembersResponse?.items || [];
  
  // Local state
  const [absences, setAbsences] = useState<any[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig[]>([]);
  const [corrections, setCorrections] = useState<TimeEntryCorrection[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isOnline, setIsOnline] = useState(NetworkManager.isOnline());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [newEntryDialog, setNewEntryDialog] = useState(false);
  const [workingHoursDialog, setWorkingHoursDialog] = useState(false);
  const [correctionDialog, setCorrectionDialog] = useState(false);
  const [selectedEntryForCorrection, setSelectedEntryForCorrection] = useState<TimeEntry | null>(null);
  const [selectedEmployeeForHours, setSelectedEmployeeForHours] = useState<string>('');
  const [editDialog, setEditDialog] = useState(false);
  const [selectedEntryForEdit, setSelectedEntryForEdit] = useState<TimeEntry | null>(null);
  
  // Derived data
  const activeEntry = timeEntries.find(entry => entry.status === 'aktiv') || null;
  const loading = timeEntriesLoading || projectsLoading || teamLoading;

  // Manager Instanzen
  const offlineManager = new OfflineTimeTrackingManager();
  const gpsManager = new GPSLocationManager();


  // Initialize Service Worker and Network Status
  useEffect(() => {
    NetworkManager.registerServiceWorker();
    const cleanup = NetworkManager.onStatusChange(online => {
      setIsOnline(online);
      if (online) {
        // Sync offline entries when coming back online
        syncOfflineEntries();
        toast({
          title: "Wieder online",
          description: "Synchronisiere Offline-Daten..."
        });
      } else {
        toast({
          title: "Offline-Modus",
          description: "Zeiteinträge werden lokal gespeichert.",
          variant: "destructive"
        });
      }
    });
    return cleanup;
  }, []);
  useEffect(() => {
    loadCurrentEmployee();
    loadWorkingHours();
    loadAbsences();
  }, [selectedDate, selectedEmployee, selectedEmployeeId]);
  const loadCurrentEmployee = async () => {
  // Erst prüfen, ob ein User eingeloggt ist
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  // Profil laden
  const { data: currentEmpData, error: currentEmpError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (currentEmpError) {
    toast({
      title: 'Profil konnte nicht geladen werden',
      description: currentEmpError.message,
      variant: 'destructive',
    });
    throw currentEmpError;
  }

  setCurrentEmployee(currentEmpData);
};
  const syncOfflineEntries = async () => {
    try {
      const offlineEntries = await offlineManager.getOfflineEntries();
      for (const entry of offlineEntries) {
        try {
          createTimeEntryMutation.mutate({
            employee_id: entry.employee_id,
            project_id: entry.project_id,
            start_time: entry.start_time,
            end_time: entry.end_time,
            description: entry.description,
            status: entry.status,
            start_location_lat: entry.start_location?.lat,
            start_location_lng: entry.start_location?.lng,
            start_location_address: entry.start_location?.address,
            end_location_lat: entry.end_location?.lat,
            end_location_lng: entry.end_location?.lng,
            end_location_address: entry.end_location?.address,
            is_offline_synced: true,
            offline_created_at: entry.offline_created_at
          }, {
            onSuccess: () => {
              offlineManager.removeOfflineEntry(entry.id);
            }
          });
        } catch (syncError) {
          console.error('Error syncing offline entry:', syncError);
        }
      }
      if (offlineEntries.length > 0) {
        toast({
          title: "Synchronisation abgeschlossen",
          description: `${offlineEntries.length} Offline-Einträge wurden synchronisiert.`
        });
      }
    } catch (error) {
      console.error('Error syncing offline entries:', error);
    }
  };
  // Data is now loaded via React Query hooks

  const loadWorkingHours = async () => {
    const {
      data,
      error
    } = await supabase.from('working_hours_config').select('*').order('is_default', {
      ascending: false
    });
    if (error) throw error;
    setWorkingHours(data || []);
  };
  const loadAbsences = async () => {
    const currentMonth = format(selectedDate, 'yyyy-MM');
    const {
      data,
      error
    } = await supabase.from('employee_absences').select('*').gte('start_date', `${currentMonth}-01`).lte('end_date', `${currentMonth}-31`).eq('status', 'genehmigt');
    if (error) throw error;
    setAbsences(data || []);
  };
  const startTimeTracking = async (projectId?: string, description?: string) => {
    if (!currentEmployee) {
      toast({
        title: "Fehler",
        description: "Kein Mitarbeiter gefunden.",
        variant: "destructive"
      });
      return;
    }
    if (activeEntry) {
      toast({
        title: "Zeiterfassung bereits aktiv",
        description: "Beenden Sie zuerst die aktuelle Zeiterfassung.",
        variant: "destructive"
      });
      return;
    }

    // Get GPS location
    let startLocation: GeolocationPosition | undefined;
    try {
      startLocation = await gpsManager.getCurrentPosition();
    } catch (error) {
      console.warn('GPS location not available:', error);
    }
    const timeEntry = {
      employee_id: currentEmployee.id,
      project_id: projectId || null,
      start_time: new Date().toISOString(),
      description: description || null,
      status: 'aktiv',
      start_location_lat: startLocation?.lat,
      start_location_lng: startLocation?.lng,
      start_location_address: startLocation?.address
    };
    if (!isOnline) {
      // Save offline
      const offlineEntry: OfflineTimeEntry = {
        id: crypto.randomUUID(),
        employee_id: currentEmployee.id,
        project_id: projectId || undefined,
        start_time: new Date().toISOString(),
        description: description || undefined,
        status: 'aktiv',
        start_location: startLocation,
        offline_created_at: new Date().toISOString()
      };
      await offlineManager.saveOfflineEntry(offlineEntry);
      toast({
        title: "Offline gespeichert",
        description: "Zeiterfassung wird bei der nächsten Verbindung synchronisiert."
      });
      return;
    }
    createTimeEntryMutation.mutate(timeEntry, {
      onSuccess: (data) => {
        setNewEntryDialog(false);
        toast({
          title: "Zeiterfassung gestartet",
          description: startLocation ? `Gestartet an: ${startLocation.address}` : "Die Zeiterfassung wurde erfolgreich gestartet."
        });
      },
      onError: () => {
        toast({
          title: "Fehler beim Starten",
          description: "Die Zeiterfassung konnte nicht gestartet werden.",
          variant: "destructive"
        });
      }
    });
  };
  const stopTimeTracking = async () => {
    if (!activeEntry) return;

    // Get GPS location
    let endLocation: GeolocationPosition | undefined;
    try {
      endLocation = await gpsManager.getCurrentPosition();
    } catch (error) {
      console.warn('GPS location not available:', error);
    }
    const updateData = {
      end_time: new Date().toISOString(),
      status: 'beendet',
      end_location_lat: endLocation?.lat,
      end_location_lng: endLocation?.lng,
      end_location_address: endLocation?.address
    };
    updateTimeEntryMutation.mutate(
      { id: activeEntry.id, data: updateData },
      {
        onSuccess: () => {
          toast({
            title: "Zeiterfassung beendet",
            description: endLocation ? `Beendet an: ${endLocation.address}` : "Die Zeiterfassung wurde erfolgreich beendet."
          });
        },
        onError: () => {
          toast({
            title: "Fehler beim Stoppen",
            description: "Die Zeiterfassung konnte nicht gestoppt werden.",
            variant: "destructive"
          });
        }
      }
    );
  };
  const pauseTimeTracking = async () => {
    if (!activeEntry) return;
    const newStatus = activeEntry.status === 'aktiv' ? 'pausiert' : 'aktiv';
    updateTimeEntryMutation.mutate(
      { id: activeEntry.id, data: { status: newStatus } },
      {
        onError: () => {
          toast({
            title: "Fehler",
            description: "Der Status konnte nicht geändert werden.",
            variant: "destructive"
          });
        }
      }
    );
  };
  const startTimeTrackingForEmployee = async (employeeId: string, projectId?: string, description?: string) => {
    if (!userRole || userRole !== 'manager') {
      toast({
        title: "Keine Berechtigung",
        description: "Nur Manager können Zeiterfassung für andere starten.",
        variant: "destructive"
      });
      return;
    }

    // Check if employee already has active entry
    const {
      data: existingEntry
    } = await supabase.from('time_entries').select('*').eq('employee_id', employeeId).eq('status', 'aktiv').single();
    if (existingEntry) {
      toast({
        title: "Zeiterfassung bereits aktiv",
        description: "Dieser Mitarbeiter hat bereits eine aktive Zeiterfassung.",
        variant: "destructive"
      });
      return;
    }
    createTimeEntryMutation.mutate({
      employee_id: employeeId,
      project_id: projectId || null,
      start_time: new Date().toISOString(),
      description: description || null,
      status: 'aktiv'
    }, {
      onSuccess: (data) => {
        toast({
          title: "Zeiterfassung gestartet",
          description: `Zeiterfassung für ${data.employee?.first_name} ${data.employee?.last_name} wurde gestartet.`
        });
      },
      onError: () => {
        toast({
          title: "Fehler beim Starten",
          description: "Die Zeiterfassung konnte nicht gestartet werden.",
          variant: "destructive"
        });
      }
    });
  };
  const updateWorkingHours = async (employeeId: string | null, config: Partial<WorkingHoursConfig>) => {
    if (!userRole || userRole !== 'manager') {
      toast({
        title: "Keine Berechtigung",
        description: "Nur Manager können Arbeitszeiten ändern.",
        variant: "destructive"
      });
      return;
    }

    // Check if config exists
    const {
      data: existing
    } = await supabase.from('working_hours_config').select('*').eq('employee_id', employeeId).single();
    if (existing) {
      // Update existing
      const {
        error
      } = await supabase.from('working_hours_config').update(config).eq('id', existing.id);
      if (error) {
        toast({
          title: "Fehler beim Aktualisieren",
          description: "Die Arbeitszeiten konnten nicht aktualisiert werden.",
          variant: "destructive"
        });
        return;
      }
    } else {
      // Create new
      const {
        error
      } = await supabase.from('working_hours_config').insert({
        employee_id: employeeId,
        ...config
      });
      if (error) {
        toast({
          title: "Fehler beim Erstellen",
          description: "Die Arbeitszeiten konnten nicht erstellt werden.",
          variant: "destructive"
        });
        return;
      }
    }
    loadWorkingHours();
    setWorkingHoursDialog(false);
    toast({
      title: "Arbeitszeiten aktualisiert",
      description: "Die Arbeitszeiten wurden erfolgreich gespeichert."
    });
  };
  const formatWorkingDays = (days: number[]) => {
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days.map(day => dayNames[day === 7 ? 0 : day]).join(', ');
  };
  const getWorkingHoursForEmployee = (employeeId: string) => {
    return workingHours.find(wh => wh.employee_id === employeeId) || workingHours.find(wh => wh.is_default);
  };
  const WorkingHoursDialog = () => {
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('17:00');
    const [breakDuration, setBreakDuration] = useState(30);
    const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
    useEffect(() => {
      if (selectedEmployeeForHours) {
        const config = getWorkingHoursForEmployee(selectedEmployeeForHours);
        if (config) {
          setStartTime(config.start_time.slice(0, 5));
          setEndTime(config.end_time.slice(0, 5));
          setBreakDuration(config.break_duration);
          setWorkingDays(config.working_days);
        }
      }
    }, [selectedEmployeeForHours]);
    const handleSave = () => {
      updateWorkingHours(selectedEmployeeForHours === 'default' ? null : selectedEmployeeForHours, {
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        break_duration: breakDuration,
        working_days: workingDays,
        is_default: selectedEmployeeForHours === 'default'
      });
    };
    const toggleWorkingDay = (day: number) => {
      setWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
    };
    return <Dialog open={workingHoursDialog} onOpenChange={setWorkingHoursDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Arbeitszeiten konfigurieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mitarbeiter</Label>
              <Select value={selectedEmployeeForHours} onValueChange={setSelectedEmployeeForHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Mitarbeiter wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Standard (alle Mitarbeiter)</SelectItem>
                  {employees.map(employee => <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Arbeitsbeginn</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label>Arbeitsende</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
            
            <div>
              <Label>Pausendauer (Minuten)</Label>
              <Input type="number" value={breakDuration} onChange={e => setBreakDuration(Number(e.target.value))} min="0" max="120" />
            </div>
            
            <div>
              <Label>Arbeitstage</Label>
              <div className="flex gap-2 mt-2">
                {[{
                value: 1,
                label: 'Mo'
              }, {
                value: 2,
                label: 'Di'
              }, {
                value: 3,
                label: 'Mi'
              }, {
                value: 4,
                label: 'Do'
              }, {
                value: 5,
                label: 'Fr'
              }, {
                value: 6,
                label: 'Sa'
              }, {
                value: 7,
                label: 'So'
              }].map(day => <Button key={day.value} variant={workingDays.includes(day.value) ? 'default' : 'outline'} size="sm" onClick={() => toggleWorkingDay(day.value)}>
                    {day.label}
                  </Button>)}
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setWorkingHoursDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={!selectedEmployeeForHours}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>;
  };
  const ManagerStartDialog = () => {
    const [employeeId, setEmployeeId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [description, setDescription] = useState('');
    const handleSubmit = () => {
      if (!employeeId) return;
      startTimeTrackingForEmployee(employeeId, projectId === 'none' ? undefined : projectId || undefined, description || undefined);
      setEmployeeId('');
      setProjectId('');
      setDescription('');
      setNewEntryDialog(false);
    };
    return <div className="space-y-4">
        <div>
          <Label htmlFor="employee">Mitarbeiter</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Mitarbeiter auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map(employee => <SelectItem key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="project">Projekt (optional)</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Projekt auswählen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Projekt</SelectItem>
              {projects.map(project => <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{
                  backgroundColor: project.color
                }} />
                    {project.name}
                  </div>
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Beschreibung (optional)</Label>
          <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschreibung der Tätigkeit..." />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setNewEntryDialog(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!employeeId}>
            <Play className="w-4 h-4 mr-2" />
            Starten
          </Button>
        </div>
      </div>;
  };
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = parseISO(startTime);
    const end = endTime ? parseISO(endTime) : new Date();
    const minutes = differenceInMinutes(end, start);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}h`;
  };
  const getTotalHours = () => {
    return timeEntries.reduce((total, entry) => {
      if (entry.status === 'beendet' && entry.end_time) {
        const start = parseISO(entry.start_time);
        const end = parseISO(entry.end_time);
        return total + differenceInMinutes(end, start);
      }
      return total;
    }, 0);
  };
  const NewEntryDialog = () => {
    const [description, setDescription] = useState('');
    const [projectId, setProjectId] = useState('');
    const handleSubmit = () => {
      startTimeTracking(projectId === 'none' ? undefined : projectId || undefined, description || undefined);
      setDescription('');
      setProjectId('');
    };
    return <Dialog open={newEntryDialog} onOpenChange={setNewEntryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userRole === 'manager' ? 'Zeiterfassung starten' : 'Neue Zeiterfassung starten'}
            </DialogTitle>
          </DialogHeader>
          {userRole === 'manager' ? <ManagerStartDialog /> : <div className="space-y-4">
              <div>
                <Label htmlFor="project">Projekt (optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Projekt auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Projekt</SelectItem>
                    {projects.map(project => <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{
                      backgroundColor: project.color
                    }} />
                          {project.name}
                        </div>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Beschreibung (optional)</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Was arbeiten Sie?" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setNewEntryDialog(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSubmit}>
                  <Play className="w-4 h-4 mr-2" />
                  Starten
                </Button>
              </div>
            </div>}
        </DialogContent>
      </Dialog>;
  };
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        {/* Current Status Card */}
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="text-right">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Tracking Log */}
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="border rounded-xl p-4">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-foreground">Zeiterfassung</h1>
        <div className="flex items-center gap-4">
          {userRole === 'manager' && <Button 
              variant="outline" 
              onClick={() => setWorkingHoursDialog(true)}
              className="rounded-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Arbeitszeiten
            </Button>}
          <Button 
            onClick={() => setNewEntryDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 rounded-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {userRole === 'manager' ? 'Zeiterfassung starten' : 'Meine Zeiterfassung'}
          </Button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Heute erfasst</p>
                <p className="text-2xl font-bold">{formatMinutesToTime(getTotalHours())}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktive Mitarbeiter</p>
                <p className="text-2xl font-bold">{timeEntries.filter(e => e.status === 'aktiv').length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pausierte</p>
                <p className="text-2xl font-bold">{timeEntries.filter(e => e.status === 'pausiert').length}</p>
              </div>
              <Pause className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">{isOnline ? 'Online' : 'Offline'}</p>
              </div>
              {isOnline ? <Wifi className="h-8 w-8 text-purple-500 opacity-50" /> : <WifiOff className="h-8 w-8 text-red-500 opacity-50" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Status */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Aktuelle Zeiterfassung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeEntry ? <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">
                    {activeEntry.project?.name || 'Allgemeine Arbeitszeit'}
                  </p>
                  <p className="text-muted-foreground">
                    Gestartet: {format(parseISO(activeEntry.start_time), 'HH:mm', {
                  locale: de
                })}
                  </p>
                  {activeEntry.description && <p className="text-sm text-muted-foreground mt-1">
                      {activeEntry.description}
                    </p>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {formatDuration(activeEntry.start_time)}
                  </p>
                  <Badge variant={activeEntry.status === 'aktiv' ? 'default' : 'secondary'}>
                    {activeEntry.status === 'aktiv' ? 'Aktiv' : 'Pausiert'}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={pauseTimeTracking} className="flex-1 rounded-xl">
                  {activeEntry.status === 'aktiv' ? <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pausieren
                    </> : <>
                      <Play className="w-4 h-4 mr-2" />
                      Fortsetzen
                    </>}
                </Button>
                <Button variant="destructive" onClick={stopTimeTracking} className="flex-1 rounded-xl">
                  <Square className="w-4 h-4 mr-2" />
                  Beenden
                </Button>
              </div>
            </div> : <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Keine aktive Zeiterfassung</p>
              <Button onClick={() => setNewEntryDialog(true)}>
                <Play className="w-4 h-4 mr-2" />
                Zeiterfassung starten
              </Button>
            </div>}
        </CardContent>
      </Card>

      {/* Zeiterfassungs-Log */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Zeiterfassung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
          // Berechne Monatsgesamtstunden für den ausgewählten Mitarbeiter
          const currentMonth = format(selectedDate, 'yyyy-MM');
          const filteredEntries = timeEntries.filter(entry => {
            const matchesMonth = format(new Date(entry.start_time), 'yyyy-MM') === currentMonth;
            const matchesEmployee = selectedEmployeeId === 'all' || !selectedEmployeeId || entry.employee_id === selectedEmployeeId;
            return matchesMonth && matchesEmployee;
          });
          const monthlyTotalHours = filteredEntries.reduce((total, entry) => {
            if (entry.end_time) {
              const duration = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60);
              return total + duration;
            }
            return total;
          }, 0);

          // Gruppiere Einträge nach Datum
          const entriesByDate = filteredEntries.reduce((acc, entry) => {
            const date = format(new Date(entry.start_time), 'yyyy-MM-dd');
            if (!acc[date]) acc[date] = [];
            acc[date].push(entry);
            return acc;
          }, {} as Record<string, typeof filteredEntries>);
          const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
          return <div className="space-y-4">
                {/* Mitarbeiterauswahl */}
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Mitarbeiter auswählen</Label>
                    <Select value={selectedEmployeeId || "all"} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Mitarbeiter wählen..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                        {employees.length > 0 ? employees.map(employee => <SelectItem key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </SelectItem>) : <SelectItem value="loading" disabled>Lade Mitarbeiter...</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Monatsübersicht */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border">
                  <h3 className="font-semibold text-lg mb-2">
                    Monatsübersicht {format(selectedDate, 'MMMM yyyy', {
                  locale: de
                })}
                    {selectedEmployee && <span className="text-base font-normal ml-2">
                        - {selectedEmployee.first_name} {selectedEmployee.last_name}
                      </span>}
                  </h3>
                  <p className="text-2xl font-bold text-primary">
                    {monthlyTotalHours.toFixed(1)} Stunden
                  </p>
                </div>

                {/* Tägliche Einträge */}
                {selectedEmployeeId && selectedEmployeeId !== 'all' ? <div className="space-y-3">
                    {(() => {
                // Erstelle eine Liste aller Tage im Monat
                const currentMonthDate = new Date(selectedDate);
                const year = currentMonthDate.getFullYear();
                const month = currentMonthDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const allDays = [];
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  const dateString = format(date, 'yyyy-MM-dd');
                  const dayOfWeek = date.getDay(); // 0 = Sonntag, 6 = Samstag
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const hasEntries = entriesByDate[dateString];

                  // Prüfe auf Urlaub für den aktuellen Tag und Mitarbeiter
                  const isOnVacation = absences.some(absence => {
                    const startDate = new Date(absence.start_date);
                    const endDate = new Date(absence.end_date);
                    const currentDate = new Date(dateString);
                    return absence.employee_id === selectedEmployeeId && absence.type === 'urlaub' && currentDate >= startDate && currentDate <= endDate;
                  });
                  allDays.push({
                    date: dateString,
                    dateObject: date,
                    isWeekend,
                    hasEntries,
                    isOnVacation,
                    entries: hasEntries || []
                  });
                }
                return allDays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(({
                  date,
                  dateObject,
                  isWeekend,
                  hasEntries,
                  isOnVacation,
                  entries
                }) => {
                  // Wenn es ein Urlaubstag ist
                  if (isOnVacation && !hasEntries) {
                    return <div key={date} className="border rounded-lg overflow-hidden bg-yellow-50/50 border-yellow-200">
                                <div className="bg-yellow-100/50 p-4 border-b">
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-semibold text-yellow-800">
                                      {format(dateObject, 'EEEE, dd.MM.yyyy', {
                              locale: de
                            })}
                                    </h4>
                                    <div className="text-right">
                                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-200 text-yellow-800">
                                        Urlaub
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>;
                  }

                  // Wenn es ein Wochenende ist und keine Einträge gibt
                  if (isWeekend && !hasEntries) {
                    return <div key={date} className="border rounded-lg overflow-hidden bg-gray-50/50">
                                <div className="bg-gray-100/50 p-4 border-b">
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-semibold text-gray-600">
                                      {format(dateObject, 'EEEE, dd.MM.yyyy', {
                              locale: de
                            })}
                                    </h4>
                                    <div className="text-right">
                                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                        Freier Tag
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>;
                  }

                  // Wenn es keine Einträge für einen Werktag gibt, überspringen
                  if (!hasEntries) {
                    return null;
                  }
                  const dayTotalMinutes = entries.reduce((total, entry) => {
                    if (entry.end_time) {
                      const duration = new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime();
                      return total + duration / (1000 * 60);
                    }
                    return total;
                  }, 0);
                  const dayTotalHours = dayTotalMinutes / 60;
                  const firstEntry = entries.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
                  const lastEntry = entries.sort((a, b) => new Date(b.end_time || b.start_time).getTime() - new Date(a.end_time || a.start_time).getTime())[0];
                  return <div key={date} className={cn("border rounded-lg overflow-hidden", isOnVacation ? "bg-yellow-50/50 border-yellow-200" : isWeekend ? "bg-amber-50/50 border-amber-200" : "")}>
                              {/* Tagesheader */}
                              <div className={cn("p-4 border-b", isOnVacation ? "bg-yellow-100/50" : isWeekend ? "bg-amber-100/50" : "bg-muted/50")}>
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className={cn("font-semibold", isOnVacation ? "text-yellow-800" : "")}>
                                      {format(dateObject, 'EEEE, dd.MM.yyyy', {
                              locale: de
                            })}
                                    </h4>
                                    <div className="flex gap-2 mt-1">
                                      {isOnVacation && <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800 inline-block">
                                          Urlaub (gearbeitet)
                                        </span>}
                                      {isWeekend && <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-200 text-amber-800 inline-block">
                                          Wochenendarbeit
                                        </span>}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold">{dayTotalHours.toFixed(1)}h</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(firstEntry.start_time), 'HH:mm')} - {lastEntry.end_time ? format(new Date(lastEntry.end_time), 'HH:mm') : 'Aktiv'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Einträge für den Tag */}
                              <div className="divide-y">
                                {entries.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map(entry => {
                        const project = projects.find(p => p.id === entry.project_id);
                        const duration = entry.end_time ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60) : 0;
                        const breakDuration = entry.break_duration || 0;
                        return <div key={entry.id} className="p-4 hover:bg-muted/30">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="font-medium">
                                                {format(new Date(entry.start_time), 'HH:mm')} - {entry.end_time ? format(new Date(entry.end_time), 'HH:mm') : 'Aktiv'}
                                              </span>
                                              <span className={cn("px-2 py-1 rounded-full text-xs font-medium", entry.status === 'aktiv' ? "bg-green-100 text-green-800" : entry.status === 'beendet' ? "bg-blue-100 text-blue-800" : entry.status === 'pausiert' ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800")}>
                                                {entry.status === 'aktiv' ? 'Aktiv' : entry.status === 'beendet' ? 'Beendet' : entry.status === 'pausiert' ? 'Pausiert' : entry.status}
                                              </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              <p><strong>Projekt:</strong> {project?.name || 'Kein Projekt'}</p>
                                              {entry.description && <p><strong>Beschreibung:</strong> {entry.description}</p>}
                                              {breakDuration > 0 && <p><strong>Pause:</strong> {breakDuration} min</p>}
                                            </div>
                                          </div>
                                          <div className="text-right ml-4 flex items-center gap-2">
                                            {entry.end_time && <span className="text-lg font-bold">{duration.toFixed(1)}h</span>}
                                            {userRole === 'manager' && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  setSelectedEntryForEdit(entry);
                                                  setEditDialog(true);
                                                }}
                                              >
                                                <Edit className="w-4 h-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>;
                      })}
                              </div>
                            </div>;
                }).filter(Boolean); // Entferne null-Werte
              })()}
                    {Object.keys(entriesByDate).length === 0 && <div className="p-8 text-center text-muted-foreground border rounded-lg">
                        Keine Zeiterfassungseinträge für den ausgewählten Mitarbeiter gefunden
                      </div>}
                  </div> : <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    Bitte wählen Sie einen Mitarbeiter aus, um die Zeiterfassung anzuzeigen
                  </div>}
              </div>;
        })()}
        </CardContent>
      </Card>

      {/* Filters */}
      

      {/* Summary */}
      

      {/* Time Entries List */}
      

      <NewEntryDialog />
      <WorkingHoursDialog />
      <EditTimeEntryDialog
        open={editDialog}
        onOpenChange={setEditDialog}
        timeEntry={selectedEntryForEdit}
        projects={projects}
        onSave={() => {
          // React Query will automatically refetch due to cache invalidation
        }}
      />
    </div>;
};
export default TimeTrackingModule;
