import React, { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isWithinInterval, eachDayOfInterval } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, Users, Briefcase, Plus, Filter, User, Clock, MapPin, AlertCircle, CheckCircle, XCircle, CalendarIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
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
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month')
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

  // Get year calendar layout (months on Y-axis, days 1-31 on X-axis)
  const renderYearCalendarOverview = () => {
    const currentYear = currentDate.getFullYear()
    const months = Array.from({ length: 12 }, (_, i) => i)
    const days = Array.from({ length: 31 }, (_, i) => i + 1)

    // Helper function to get items for a specific month and day
    const getItemsForDate = (month: number, day: number) => {
      const date = new Date(currentYear, month, day)
      
      // Skip invalid dates (e.g., Feb 30)
      if (date.getMonth() !== month) return null
      
      const dateString = format(date, 'yyyy-MM-dd')
      
      const items: any[] = []
      
      // Add projects
      projects.forEach(project => {
        const projectStart = new Date(project.start_date)
        const projectEnd = project.end_date ? new Date(project.end_date) : projectStart
        
        if (date >= projectStart && date <= projectEnd) {
          items.push({
            type: 'project',
            item: project,
            color: project.color
          })
        }
      })
      
      // Add absences
      absences.forEach(absence => {
        const absenceStart = new Date(absence.start_date)
        const absenceEnd = new Date(absence.end_date)
        
        if (date >= absenceStart && date <= absenceEnd) {
          items.push({
            type: 'absence',
            item: absence,
            color: getColorForAbsenceType(absence.type).replace('bg-', '')
          })
        }
      })
      
      // Add calendar events
      calendarEvents.forEach(event => {
        const eventStart = new Date(event.start_date)
        const eventEnd = new Date(event.end_date)
        
        if (date >= eventStart && date <= eventEnd) {
          items.push({
            type: 'event',
            item: event,
            color: event.color
          })
        }
      })
      
      return items.length > 0 ? items : null
    }

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] border border-border rounded-lg overflow-hidden">
          {/* Header row with days 1-31 */}
          <div className="grid bg-muted" style={{ gridTemplateColumns: '120px repeat(31, 1fr)' }}>
            <div className="p-3 border-r border-border font-medium text-center">
              Monat
            </div>
            {days.map(day => (
              <div
                key={day}
                className="p-2 text-center text-xs border-r border-border last:border-r-0 font-medium"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Months rows */}
          {months.map((month, monthIndex) => (
            <div
              key={month}
              className={`grid ${monthIndex % 2 === 0 ? 'bg-background' : 'bg-muted/50'} border-b border-border last:border-b-0`}
              style={{ gridTemplateColumns: '120px repeat(31, 1fr)' }}
            >
              {/* Month name */}
              <div className="p-3 border-r border-border font-medium text-center bg-muted/50">
                {format(new Date(currentYear, month, 1), 'MMMM', { locale: de })}
              </div>
              
              {/* Days */}
              {days.map(day => {
                const date = new Date(currentYear, month, day)
                const isValidDate = date.getMonth() === month
                const items = isValidDate ? getItemsForDate(month, day) : null
                
                return (
                  <div
                    key={day}
                    className={`border-r border-border last:border-r-0 h-16 relative ${
                      !isValidDate ? 'bg-muted/30' : ''
                    }`}
                  >
                    {isValidDate && items && (
                      <div className="absolute inset-0 p-1 space-y-1">
                        {items.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="h-3 rounded text-white text-xs flex items-center justify-center font-medium shadow-sm"
                            style={{
                              backgroundColor: item.type === 'project' 
                                ? item.color 
                                : item.type === 'absence'
                                  ? `rgb(${item.color === 'green-500' ? '34 197 94' : item.color === 'red-500' ? '239 68 68' : item.color === 'blue-500' ? '59 130 246' : '107 114 128'})`
                                  : item.item.color
                            }}
                            title={
                              item.type === 'project' 
                                ? `Projekt: ${item.item.name}`
                                : item.type === 'absence'
                                  ? `${item.item.type}: ${item.item.employee?.first_name} ${item.item.employee?.last_name}`
                                  : `Termin: ${item.item.title}`
                            }
                          >
                            {item.type === 'project' && <Briefcase className="w-2 h-2" />}
                            {item.type === 'absence' && getIconForAbsenceType(item.item.type)}
                            {item.type === 'event' && <Calendar className="w-2 h-2" />}
                          </div>
                        ))}
                        {items.length > 3 && (
                          <div className="h-3 bg-gray-400 rounded text-white text-xs flex items-center justify-center font-medium">
                            +{items.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Project calendar view (active projects on Y-axis, days 1-31 on X-axis for selected month)
  const renderProjectCalendarView = () => {
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    
    // Filter active projects
    const activeProjects = projects.filter(project => {
      const projectStart = new Date(project.start_date)
      const projectEnd = project.end_date ? new Date(project.end_date) : new Date()
      const monthStart = new Date(currentYear, currentMonth, 1)
      const monthEnd = new Date(currentYear, currentMonth + 1, 0)
      
      // Project is active if it overlaps with the current month
      return projectStart <= monthEnd && projectEnd >= monthStart
    })

    // Helper function to check if project is active on a specific day
    const isProjectActiveOnDay = (project: Project, day: number) => {
      const date = new Date(currentYear, currentMonth, day)
      const projectStart = new Date(project.start_date)
      const projectEnd = project.end_date ? new Date(project.end_date) : projectStart
      
      return date >= projectStart && date <= projectEnd
    }

    // Get assignments for a project on a specific day
    const getProjectAssignmentsForDay = (projectId: string, day: number) => {
      const date = new Date(currentYear, currentMonth, day)
      return projectAssignments.filter(assignment => {
        const assignStart = new Date(assignment.start_date)
        const assignEnd = assignment.end_date ? new Date(assignment.end_date) : assignStart
        
        return assignment.project_id === projectId && 
               date >= assignStart && 
               date <= assignEnd
      })
    }

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] border border-border rounded-lg overflow-hidden">
          {/* Header row with days 1-31 */}
          <div className="grid bg-muted" style={{ gridTemplateColumns: '200px repeat(' + daysInMonth + ', 1fr)' }}>
            <div className="p-3 border-r border-border font-medium">
              Projekt
            </div>
            {days.map(day => (
              <div
                key={day}
                className="p-2 text-center text-xs border-r border-border last:border-r-0 font-medium"
              >
                <div>{day}</div>
                <div className="text-muted-foreground">
                  {format(new Date(currentYear, currentMonth, day), 'EEE', { locale: de })}
                </div>
              </div>
            ))}
          </div>

          {/* Project rows */}
          {activeProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Keine aktiven Projekte in {format(currentDate, 'MMMM yyyy', { locale: de })}
            </div>
          ) : (
            activeProjects.map((project, index) => (
              <div
                key={project.id}
                className={`grid ${index % 2 === 0 ? 'bg-background' : 'bg-muted/50'} border-b border-border last:border-b-0`}
                style={{ gridTemplateColumns: '200px repeat(' + daysInMonth + ', 1fr)' }}
              >
                {/* Project info */}
                <div className="p-3 border-r border-border">
                  <div className="font-medium text-sm">{project.name}</div>
                  <div className="text-xs text-muted-foreground">{project.location}</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline" className="text-xs">{project.status}</Badge>
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: project.color }}
                      title={`Projekt: ${project.name}`}
                    />
                  </div>
                </div>
                
                {/* Days */}
                {days.map(day => {
                  const isActive = isProjectActiveOnDay(project, day)
                  const assignments = getProjectAssignmentsForDay(project.id, day)
                  
                  return (
                    <div
                      key={day}
                      className="border-r border-border last:border-r-0 h-20 relative"
                    >
                      {isActive && (
                        <div className="absolute inset-0 p-1">
                          {/* Project timeline bar */}
                          <div
                            className="h-6 rounded-md flex items-center justify-center text-white text-xs font-medium shadow-sm mb-1"
                            style={{ backgroundColor: project.color }}
                            title={`${project.name} - ${format(new Date(currentYear, currentMonth, day), 'dd.MM.yyyy')}`}
                          >
                            <Briefcase className="w-3 h-3" />
                          </div>
                          
                          {/* Employee assignments */}
                          <div className="space-y-1">
                            {assignments.slice(0, 2).map(assignment => (
                              <div
                                key={assignment.id}
                                className="h-4 bg-blue-200 dark:bg-blue-800 rounded text-xs flex items-center px-1 text-blue-800 dark:text-blue-200"
                                title={`${assignment.employee?.first_name} ${assignment.employee?.last_name} (${assignment.hours_per_day}h)`}
                              >
                                <User className="w-2 h-2 mr-1" />
                                <span className="truncate">
                                  {assignment.employee?.first_name?.charAt(0)}{assignment.employee?.last_name?.charAt(0)}
                                </span>
                                <span className="ml-auto text-xs">{assignment.hours_per_day}h</span>
                              </div>
                            ))}
                            {assignments.length > 2 && (
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded text-xs flex items-center justify-center text-gray-600 dark:text-gray-300">
                                +{assignments.length - 2}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          "hover:bg-muted/50"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(currentDate, 'MMMM yyyy', { locale: de })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={currentDate}
                        onSelect={(date) => date && setCurrentDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {renderYearCalendarOverview()}
              
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
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Briefcase className="w-5 h-5" />
                  <span>Projektkalender - {format(currentDate, 'yyyy', { locale: de })}</span>
                </CardTitle>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={navigatePrevious}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          "hover:bg-muted/50"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(currentDate, 'MMMM yyyy', { locale: de })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={currentDate}
                        onSelect={(date) => date && setCurrentDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderProjectCalendarView()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="employees">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Mitarbeiterkalender - {format(currentDate, 'yyyy', { locale: de })}</span>
                </CardTitle>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={navigatePrevious}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          "hover:bg-muted/50"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(currentDate, 'MMMM yyyy', { locale: de })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={currentDate}
                        onSelect={(date) => date && setCurrentDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
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