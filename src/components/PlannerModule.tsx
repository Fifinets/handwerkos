import React, { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isWithinInterval, eachDayOfInterval } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, Users, Briefcase, Plus, Filter, User, Clock, MapPin, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

// Types for the planner
interface Project {
  id: string
  name: string
  description?: string
  start_date: string
  end_date?: string
  location?: string
  status: string
  color: string
  customer_id?: string
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  position?: string
  department?: string
  status: string
}

interface Absence {
  id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  status: string
  reason?: string
  employee?: Employee
}

interface CalendarEvent {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  start_time?: string
  end_time?: string
  is_full_day: boolean
  location?: string
  type: string
  color: string
}

interface ProjectAssignment {
  id: string
  project_id: string
  employee_id: string
  role?: string
  start_date: string
  end_date?: string
  hours_per_day: number
  project?: Project
  employee?: Employee
}

const PlannerModule: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'employees' | 'resources'>('overview')
  const [filterType, setFilterType] = useState<'all' | 'projects' | 'absences' | 'events'>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  
  // Data states
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([])
  const [loading, setLoading] = useState(true)
  
  const { toast } = useToast()

  // Load data on component mount
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadProjects(),
        loadEmployees(),
        loadAbsences(),
        loadCalendarEvents(),
        loadProjectAssignments()
      ])
    } catch (error) {
      console.error('Error loading planner data:', error)
      toast({
        title: "Fehler beim Laden",
        description: "Die Planerdaten konnten nicht geladen werden.",
        variant: "destructive"
      })
    }
    setLoading(false)
  }

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('start_date')
    
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

  const loadAbsences = async () => {
    const { data, error } = await supabase
      .from('employee_absences')
      .select(`
        *,
        employee:employees!employee_absences_employee_id_fkey(*)
      `)
      .order('start_date')
    
    if (error) throw error
    setAbsences((data as any) || [])
  }

  const loadCalendarEvents = async () => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_date')
    
    if (error) throw error
    setCalendarEvents(data || [])
  }

  const loadProjectAssignments = async () => {
    const { data, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        project:projects(*),
        employee:employees(*)
      `)
      .order('start_date')
    
    if (error) throw error
    setProjectAssignments(data || [])
  }

  // Date navigation functions
  const getDateRange = () => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      }
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      }
    }
  }

  const { start, end } = getDateRange()
  const dateRange = eachDayOfInterval({ start, end })

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1))
    } else {
      setCurrentDate(subMonths(currentDate, 1))
    }
  }

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1))
    } else {
      setCurrentDate(addMonths(currentDate, 1))
    }
  }

  // Helper functions for rendering calendar items
  const getColorForAbsenceType = (type: string) => {
    switch (type) {
      case 'urlaub': return 'bg-green-500'
      case 'krank': return 'bg-red-500'
      case 'fortbildung': return 'bg-blue-500'
      case 'elternzeit': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getIconForAbsenceType = (type: string) => {
    switch (type) {
      case 'urlaub': return <Calendar className="w-3 h-3" />
      case 'krank': return <AlertCircle className="w-3 h-3" />
      case 'fortbildung': return <User className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'genehmigt': return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'abgelehnt': return <XCircle className="w-3 h-3 text-red-500" />
      default: return <Clock className="w-3 h-3 text-yellow-500" />
    }
  }

  // Get unique departments for filtering
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))]

  // Filter employees by department
  const filteredEmployees = selectedDepartment === 'all' 
    ? employees 
    : employees.filter(emp => emp.department === selectedDepartment)

  // Render calendar overview with all data
  const renderCalendarOverview = () => {
    return (
      <div className="grid grid-cols-1 gap-0 border border-border rounded-lg overflow-hidden">
        {/* Header row with dates */}
        <div className="grid grid-cols-12 bg-muted">
          <div className="col-span-3 p-3 border-r border-border font-medium">
            Ressource
          </div>
          <div className="col-span-9 grid" style={{ gridTemplateColumns: `repeat(${dateRange.length}, 1fr)` }}>
            {dateRange.map((date, index) => (
              <div
                key={index}
                className="p-2 text-center text-xs border-r border-border last:border-r-0"
              >
                <div className="font-medium">
                  {format(date, 'EEE', { locale: de })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(date, 'dd.MM', { locale: de })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Projects section */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border-b border-border">
          <div className="p-2 px-3 font-medium text-sm text-blue-700 dark:text-blue-300 flex items-center">
            <Briefcase className="w-4 h-4 mr-2" />
            Projekte
          </div>
        </div>
        
        {projects.map((project, index) => (
          <div key={project.id} className={`grid grid-cols-12 border-b border-border last:border-b-0 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/50'}`}>
            <div className="col-span-3 p-3 border-r border-border">
              <div className="font-medium text-sm">{project.name}</div>
              <div className="text-xs text-muted-foreground">{project.location}</div>
              <Badge variant="outline" className="mt-1 text-xs">{project.status}</Badge>
            </div>
            
            <div className="col-span-9 relative h-12">
              <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dateRange.length}, 1fr)` }}>
                {dateRange.map((date, dayIndex) => (
                  <div key={dayIndex} className="border-r border-border last:border-r-0 relative" />
                ))}
              </div>
              
              {/* Project timeline bar */}
              {(() => {
                const projectStart = new Date(project.start_date)
                const projectEnd = project.end_date ? new Date(project.end_date) : projectStart
                const taskStart = Math.max(0, Math.floor((projectStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                const taskEnd = Math.min(dateRange.length - 1, Math.floor((projectEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                
                if (taskStart > dateRange.length - 1 || taskEnd < 0) return null
                
                const width = ((taskEnd - taskStart + 1) / dateRange.length) * 100
                const left = (taskStart / dateRange.length) * 100
                
                return (
                  <div
                    className="absolute top-1 h-8 rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      minWidth: '40px',
                      backgroundColor: project.color
                    }}
                    title={`${project.name} (${format(projectStart, 'dd.MM')} - ${format(projectEnd, 'dd.MM')})`}
                  >
                    <span className="truncate">{project.name}</span>
                  </div>
                )
              })()}
            </div>
          </div>
        ))}

        {/* Employees section */}
        <div className="bg-green-50 dark:bg-green-950/20 border-b border-border">
          <div className="p-2 px-3 font-medium text-sm text-green-700 dark:text-green-300 flex items-center">
            <Users className="w-4 h-4 mr-2" />
            Mitarbeiter
          </div>
        </div>
        
        {filteredEmployees.map((employee, index) => {
          const employeeAbsences = absences.filter(a => a.employee_id === employee.id)
          const employeeAssignments = projectAssignments.filter(a => a.employee_id === employee.id)
          
          return (
            <div key={employee.id} className={`grid grid-cols-12 border-b border-border last:border-b-0 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/50'}`}>
              <div className="col-span-3 p-3 border-r border-border">
                <div className="font-medium text-sm">{employee.first_name} {employee.last_name}</div>
                <div className="text-xs text-muted-foreground">{employee.position}</div>
                <div className="text-xs text-muted-foreground">{employee.department}</div>
              </div>
              
              <div className="col-span-9 relative h-16">
                <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dateRange.length}, 1fr)` }}>
                  {dateRange.map((date, dayIndex) => (
                    <div key={dayIndex} className="border-r border-border last:border-r-0 relative" />
                  ))}
                </div>
                
                {/* Absence bars */}
                {employeeAbsences.map((absence) => {
                  const absenceStart = new Date(absence.start_date)
                  const absenceEnd = new Date(absence.end_date)
                  const taskStart = Math.max(0, Math.floor((absenceStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                  const taskEnd = Math.min(dateRange.length - 1, Math.floor((absenceEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                  
                  if (taskStart > dateRange.length - 1 || taskEnd < 0) return null
                  
                  const width = ((taskEnd - taskStart + 1) / dateRange.length) * 100
                  const left = (taskStart / dateRange.length) * 100
                  
                  return (
                    <div
                      key={absence.id}
                      className={`absolute top-1 h-6 ${getColorForAbsenceType(absence.type)} rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm`}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        minWidth: '30px'
                      }}
                      title={`${absence.type} (${format(absenceStart, 'dd.MM')} - ${format(absenceEnd, 'dd.MM')}) - ${absence.status}`}
                    >
                      {getIconForAbsenceType(absence.type)}
                      <span className="ml-1 truncate">{absence.type}</span>
                      {getStatusIcon(absence.status)}
                    </div>
                  )
                })}
                
                {/* Project assignment bars */}
                {employeeAssignments.map((assignment, idx) => {
                  const assignStart = new Date(assignment.start_date)
                  const assignEnd = assignment.end_date ? new Date(assignment.end_date) : assignStart
                  const taskStart = Math.max(0, Math.floor((assignStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                  const taskEnd = Math.min(dateRange.length - 1, Math.floor((assignEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
                  
                  if (taskStart > dateRange.length - 1 || taskEnd < 0) return null
                  
                  const width = ((taskEnd - taskStart + 1) / dateRange.length) * 100
                  const left = (taskStart / dateRange.length) * 100
                  
                  return (
                    <div
                      key={assignment.id}
                      className="absolute bottom-1 h-6 bg-blue-500 rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        minWidth: '40px'
                      }}
                      title={`${assignment.project?.name} (${assignment.hours_per_day}h/Tag)`}
                    >
                      <Briefcase className="w-3 h-3 mr-1" />
                      <span className="truncate">{assignment.project?.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Lade Planerdaten...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold">Planer</h1>
          <Badge variant="outline" className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>Ressourcenplanung</span>
          </Badge>
        </div>
        
        <div className="flex items-center space-x-4">
          {activeTab === 'overview' && (
            <>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Alle Abteilungen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Abteilungen</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle anzeigen</SelectItem>
                  <SelectItem value="projects">Nur Projekte</SelectItem>
                  <SelectItem value="absences">Nur Abwesenheiten</SelectItem>
                  <SelectItem value="events">Nur Termine</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          
          <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Woche</SelectItem>
              <SelectItem value="month">Monat</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={loadAllData} variant="outline" size="sm">
            Aktualisieren
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Übersicht</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center space-x-2">
            <Briefcase className="w-4 h-4" />
            <span>Projekte</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Mitarbeiter</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>Ressourcen</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>
                    {viewMode === 'week' 
                      ? `${format(start, 'dd.MM', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`
                      : format(currentDate, 'MMMM yyyy', { locale: de })
                    }
                  </span>
                </CardTitle>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={navigatePrevious}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                    Heute
                  </Button>
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {renderCalendarOverview()}
              
              {/* Legend */}
              <div className="mt-6 space-y-3">
                <h4 className="font-medium">Legende</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Urlaub</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Krank</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Projekte/Fortbildung</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                    <span>Elternzeit</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center space-x-6 text-xs">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Genehmigt</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span>Beantragt</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span>Abgelehnt</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Projektkalender</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Projektkalender wird hier implementiert...</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Mitarbeiterkalender</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Mitarbeiterkalender wird hier implementiert...</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Ressourcenplanung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Ressourcenplanung wird hier implementiert...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PlannerModule