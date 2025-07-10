import React, { useState, useEffect } from 'react'
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { Play, Pause, Square, Clock, Calendar, User, MapPin, Filter, Plus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface TimeEntry {
  id: string
  employee_id: string
  project_id?: string
  start_time: string
  end_time?: string
  break_duration: number
  description?: string
  status: string
  created_at: string
  updated_at: string
  employee?: {
    first_name: string
    last_name: string
  }
  project?: {
    name: string
    color: string
  }
}

interface Project {
  id: string
  name: string
  color: string
  status: string
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  user_id?: string
}

const TimeTrackingModule: React.FC = () => {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [newEntryDialog, setNewEntryDialog] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [selectedDate, selectedEmployee])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadTimeEntries(),
        loadProjects(),
        loadEmployees(),
        loadCurrentEmployee()
      ])
    } catch (error) {
      console.error('Error loading time tracking data:', error)
      toast({
        title: "Fehler beim Laden",
        description: "Die Zeiterfassungsdaten konnten nicht geladen werden.",
        variant: "destructive"
      })
    }
    setLoading(false)
  }

  const loadCurrentEmployee = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error loading current employee:', error)
      return
    }

    setCurrentEmployee(data)
  }

  const loadTimeEntries = async () => {
    const dateStart = startOfDay(selectedDate)
    const dateEnd = endOfDay(selectedDate)

    let query = supabase
      .from('time_entries')
      .select(`
        *,
        employee:employees(first_name, last_name),
        project:projects(name, color)
      `)
      .gte('start_time', dateStart.toISOString())
      .lte('start_time', dateEnd.toISOString())
      .order('start_time', { ascending: false })

    if (selectedEmployee !== 'all') {
      query = query.eq('employee_id', selectedEmployee)
    }

    const { data, error } = await query

    if (error) throw error
    setTimeEntries(data || [])

    // Find active entry
    const active = data?.find(entry => entry.status === 'aktiv')
    setActiveEntry(active || null)
  }

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, color, status')
      .order('name')

    if (error) throw error
    setProjects(data || [])
  }

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'aktiv')
      .order('last_name')

    if (error) throw error
    setEmployees(data || [])
  }

  const startTimeTracking = async (projectId?: string, description?: string) => {
    if (!currentEmployee) {
      toast({
        title: "Fehler",
        description: "Kein Mitarbeiter gefunden.",
        variant: "destructive"
      })
      return
    }

    if (activeEntry) {
      toast({
        title: "Zeiterfassung bereits aktiv",
        description: "Beenden Sie zuerst die aktuelle Zeiterfassung.",
        variant: "destructive"
      })
      return
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        employee_id: currentEmployee.id,
        project_id: projectId || null,
        start_time: new Date().toISOString(),
        description: description || null,
        status: 'aktiv'
      })
      .select(`
        *,
        employee:employees(first_name, last_name),
        project:projects(name, color)
      `)
      .single()

    if (error) {
      toast({
        title: "Fehler beim Starten",
        description: "Die Zeiterfassung konnte nicht gestartet werden.",
        variant: "destructive"
      })
      return
    }

    setActiveEntry(data)
    loadTimeEntries()
    setNewEntryDialog(false)
    toast({
      title: "Zeiterfassung gestartet",
      description: "Die Zeiterfassung wurde erfolgreich gestartet."
    })
  }

  const stopTimeTracking = async () => {
    if (!activeEntry) return

    const { error } = await supabase
      .from('time_entries')
      .update({
        end_time: new Date().toISOString(),
        status: 'beendet'
      })
      .eq('id', activeEntry.id)

    if (error) {
      toast({
        title: "Fehler beim Stoppen",
        description: "Die Zeiterfassung konnte nicht gestoppt werden.",
        variant: "destructive"
      })
      return
    }

    setActiveEntry(null)
    loadTimeEntries()
    toast({
      title: "Zeiterfassung beendet",
      description: "Die Zeiterfassung wurde erfolgreich beendet."
    })
  }

  const pauseTimeTracking = async () => {
    if (!activeEntry) return

    const newStatus = activeEntry.status === 'aktiv' ? 'pausiert' : 'aktiv'

    const { error } = await supabase
      .from('time_entries')
      .update({ status: newStatus })
      .eq('id', activeEntry.id)

    if (error) {
      toast({
        title: "Fehler",
        description: "Der Status konnte nicht geändert werden.",
        variant: "destructive"
      })
      return
    }

    setActiveEntry({ ...activeEntry, status: newStatus })
    loadTimeEntries()
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = parseISO(startTime)
    const end = endTime ? parseISO(endTime) : new Date()
    const minutes = differenceInMinutes(end, start)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}h`
  }

  const getTotalHours = () => {
    return timeEntries.reduce((total, entry) => {
      if (entry.status === 'beendet' && entry.end_time) {
        const start = parseISO(entry.start_time)
        const end = parseISO(entry.end_time)
        return total + differenceInMinutes(end, start)
      }
      return total
    }, 0)
  }

  const NewEntryDialog = () => {
    const [description, setDescription] = useState('')
    const [projectId, setProjectId] = useState('')

    const handleSubmit = () => {
      startTimeTracking(projectId || undefined, description || undefined)
      setDescription('')
      setProjectId('')
    }

    return (
      <Dialog open={newEntryDialog} onOpenChange={setNewEntryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Zeiterfassung starten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="project">Projekt (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Projekt auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Projekt</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Was arbeiten Sie?"
              />
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
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Lade Zeiterfassung...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Zeiterfassung</h1>
        <Button onClick={() => setNewEntryDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Zeiterfassung
        </Button>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Aktuelle Zeiterfassung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeEntry ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">
                    {activeEntry.project?.name || 'Allgemeine Arbeitszeit'}
                  </p>
                  <p className="text-muted-foreground">
                    Gestartet: {format(parseISO(activeEntry.start_time), 'HH:mm', { locale: de })}
                  </p>
                  {activeEntry.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeEntry.description}
                    </p>
                  )}
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
                <Button
                  variant="outline"
                  onClick={pauseTimeTracking}
                  className="flex-1"
                >
                  {activeEntry.status === 'aktiv' ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pausieren
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Fortsetzen
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={stopTimeTracking}
                  className="flex-1"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Beenden
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Keine aktive Zeiterfassung</p>
              <Button onClick={() => setNewEntryDialog(true)}>
                <Play className="w-4 h-4 mr-2" />
                Zeiterfassung starten
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <Label>Mitarbeiter</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{timeEntries.length}</p>
              <p className="text-muted-foreground">Einträge heute</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {Math.floor(getTotalHours() / 60)}:{(getTotalHours() % 60).toString().padStart(2, '0')}h
              </p>
              <p className="text-muted-foreground">Gesamtzeit heute</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {timeEntries.filter(e => e.status === 'beendet').length}
              </p>
              <p className="text-muted-foreground">Abgeschlossen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>Zeiteinträge</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Zeiteinträge für das ausgewählte Datum gefunden.
            </div>
          ) : (
            <div className="space-y-4">
              {timeEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {entry.project && (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: entry.project.color }}
                      />
                    )}
                    <div>
                      <p className="font-medium">
                        {entry.project?.name || 'Allgemeine Arbeitszeit'}
                      </p>
                      {entry.description && (
                        <p className="text-sm text-muted-foreground">
                          {entry.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>
                          {format(parseISO(entry.start_time), 'HH:mm', { locale: de })} - {' '}
                          {entry.end_time 
                            ? format(parseISO(entry.end_time), 'HH:mm', { locale: de })
                            : 'Laufend'
                          }
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.employee?.first_name} {entry.employee?.last_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {entry.end_time 
                        ? formatDuration(entry.start_time, entry.end_time)
                        : formatDuration(entry.start_time)
                      }
                    </p>
                    <Badge 
                      variant={
                        entry.status === 'aktiv' ? 'default' : 
                        entry.status === 'beendet' ? 'secondary' : 'outline'
                      }
                    >
                      {entry.status === 'aktiv' ? 'Aktiv' : 
                       entry.status === 'beendet' ? 'Beendet' : 'Pausiert'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewEntryDialog />
    </div>
  )
}

export default TimeTrackingModule