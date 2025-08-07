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
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', profile.company_id)
        .neq('status', 'eingeladen')
        .not('user_id', 'is', null)
        .order('last_name')
      
      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error loading employees:', error);
    }
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
                
                const isStartOfSpan = (item: any, currentDate: Date) => {
                  if (item.type === 'project') {
                    const projectStart = new Date(item.item.start_date)
                    return isSameDay(projectStart, currentDate) || (projectStart < currentDate && day === 1)
                  }
                  if (item.type === 'absence') {
                    const absenceStart = new Date(item.item.start_date)
                    return isSameDay(absenceStart, currentDate) || (absenceStart < currentDate && day === 1)
                  }
                  if (item.type === 'event') {
                    const eventStart = new Date(item.item.start_date)
                    return isSameDay(eventStart, currentDate) || (eventStart < currentDate && day === 1)
                  }
                  return false
                }

                const getSpanWidth = (item: any, currentDate: Date) => {
                  const monthStart = new Date(currentYear, month, 1)
                  const monthEnd = new Date(currentYear, month + 1, 0)
                  
                  let startDate: Date, endDate: Date
                  
                  if (item.type === 'project') {
                    startDate = new Date(item.item.start_date)
                    endDate = item.item.end_date ? new Date(item.item.end_date) : new Date()
                  } else if (item.type === 'absence') {
                    startDate = new Date(item.item.start_date)
                    endDate = new Date(item.item.end_date)
                  } else {
                    startDate = new Date(item.item.start_date)
                    endDate = new Date(item.item.end_date)
                  }
                  
                  // Clip to current month
                  const spanStart = startDate < monthStart ? monthStart : startDate
                  const spanEnd = endDate > monthEnd ? monthEnd : endDate
                  
                  const startDay = spanStart.getDate()
                  const endDay = spanEnd.getDate()
                  
                  // If the end date is beyond the current month, extend to the last day of the month
                  if (endDate > monthEnd) {
                    return monthEnd.getDate() - startDay + 1
                  }
                  
                  return endDay - startDay + 1
                }

                return (
                  <div
                    key={day}
                    className={`border-r border-border last:border-r-0 h-16 relative ${
                      !isValidDate ? 'bg-muted/30' : ''
                    }`}
                  >
                    {isValidDate && items && (
                      <div className="absolute inset-0 p-1">
                        {items.map((item, idx) => {
                          const currentDate = new Date(currentYear, month, day)
                          const shouldShowItem = isStartOfSpan(item, currentDate)
                          
                          if (!shouldShowItem) return null
                          
                          const spanWidth = getSpanWidth(item, currentDate)
                          
                          return (
                            <div
                              key={`${item.type}-${item.item.id || idx}`}
                              className="h-3 rounded text-white text-xs flex items-center justify-center font-medium shadow-sm absolute hover:h-4 hover:z-20 transition-all duration-200 group cursor-pointer"
                              style={{
                                backgroundColor: item.type === 'project' 
                                  ? item.color 
                                  : item.type === 'absence'
                                    ? `rgb(${item.color === 'green-500' ? '34 197 94' : item.color === 'red-500' ? '239 68 68' : item.color === 'blue-500' ? '59 130 246' : '107 114 128'})`
                                    : item.item.color,
                                width: `${spanWidth * 100}%`,
                                left: 0,
                                top: `${2 + idx * 14}px`,
                                zIndex: 10
                              }}
                              title={
                                item.type === 'project' 
                                  ? `Projekt: ${item.item.name}`
                                  : item.type === 'absence'
                                    ? `${item.item.type}: ${item.item.employee?.first_name} ${item.item.employee?.last_name}`
                                    : `Termin: ${item.item.title}`
                              }
                            >
                              {spanWidth >= 3 && (
                                <>
                                  {item.type === 'project' && <Briefcase className="w-1.5 h-1.5" />}
                                  {item.type === 'absence' && getIconForAbsenceType(item.item.type)}
                                  {item.type === 'event' && <Calendar className="w-1.5 h-1.5" />}
                                </>
                              )}
                              {/* Tooltip für Hover */}
                              <div className="absolute top-[-32px] left-0 bg-background border border-border rounded px-2 py-1 text-xs text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-30">
                                {item.type === 'project' 
                                  ? item.item.name
                                  : item.type === 'absence'
                                    ? `${item.item.type}: ${item.item.employee?.first_name} ${item.item.employee?.last_name}`
                                    : item.item.title}
                              </div>
                            </div>
                          )
                        })}
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
    
    // Filter active projects - show projects that are active, planned, or in progress
    const activeProjects = projects.filter(project => {
      const status = project.status.toLowerCase()
      const isActiveStatus = status === 'aktiv' || status === 'geplant' || status === 'in bearbeitung'
      
      if (isActiveStatus) {
        return true // Always show active projects regardless of dates
      }
      
      // For other projects, only show if they overlap with the current month
      const projectStart = new Date(project.start_date)
      const projectEnd = project.end_date ? new Date(project.end_date) : new Date()
      const monthStart = new Date(currentYear, currentMonth, 1)
      const monthEnd = new Date(currentYear, currentMonth + 1, 0)
      
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
                
                {/* Days container with project timeline */}
                <div className="relative h-20" style={{ gridColumn: `2 / ${daysInMonth + 2}` }}>
                  {/* Background grid for days */}
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${daysInMonth}, 1fr)` }}>
                    {days.map(day => (
                      <div
                        key={day}
                        className="border-r border-border last:border-r-0"
                      />
                    ))}
                  </div>
                  
                  {/* Project timeline bar - continuous across days */}
                  {(() => {
                    const projectStart = new Date(project.start_date)
                    const projectEnd = project.end_date ? new Date(project.end_date) : projectStart
                    const monthStart = new Date(currentYear, currentMonth, 1)
                    const monthEnd = new Date(currentYear, currentMonth + 1, 0)
                    
                    // Calculate start and end positions within the month
                    const effectiveStart = projectStart < monthStart ? 1 : projectStart.getDate()
                    const effectiveEnd = projectEnd > monthEnd ? daysInMonth : projectEnd.getDate()
                    
                    // Skip if project doesn't overlap with current month
                    if (projectEnd < monthStart || projectStart > monthEnd) return null
                    
                    const width = ((effectiveEnd - effectiveStart + 1) / daysInMonth) * 100
                    const left = ((effectiveStart - 1) / daysInMonth) * 100
                    
                    return (
                      <div
                        className="absolute top-2 h-12 rounded-md flex items-center px-3 text-white text-sm font-medium shadow-md z-10"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: project.color,
                          minWidth: '60px'
                        }}
                        title={`${project.name} (${format(projectStart, 'dd.MM.yyyy')} - ${format(projectEnd, 'dd.MM.yyyy')})`}
                      >
                        <Briefcase className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{project.name}</span>
                        <div className="ml-auto flex items-center space-x-1">
                          <span className="text-xs opacity-90">
                            {format(projectStart, 'dd.MM')} - {format(projectEnd, 'dd.MM')}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* Employee assignments as small indicators */}
                  {days.map(day => {
                    const assignments = getProjectAssignmentsForDay(project.id, day)
                    
                    if (assignments.length === 0) return null
                    
                    const dayLeft = ((day - 1) / daysInMonth) * 100
                    const dayWidth = (1 / daysInMonth) * 100
                    
                    return (
                      <div
                        key={`assignments-${day}`}
                        className="absolute bottom-1 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded flex items-center justify-center"
                        style={{
                          left: `${dayLeft}%`,
                          width: `${dayWidth - 1}%`,
                          minWidth: '20px'
                        }}
                        title={`${assignments.length} Mitarbeiter: ${assignments.map(a => `${a.employee?.first_name} ${a.employee?.last_name} (${a.hours_per_day}h)`).join(', ')}`}
                      >
                        <User className="w-2 h-2 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs ml-1 text-blue-600 dark:text-blue-400">{assignments.length}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Employee calendar view (employees on Y-axis, days 1-31 on X-axis for selected month)
  const renderEmployeeCalendarView = () => {
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    
    // Filter active employees
    const activeEmployees = employees.filter(emp => emp.status === 'aktiv')

    // Helper function to check if employee has absence on a specific day
    const getEmployeeAbsencesForDay = (employeeId: string, day: number) => {
      const date = new Date(currentYear, currentMonth, day)
      return absences.filter(absence => {
        const absenceStart = new Date(absence.start_date)
        const absenceEnd = new Date(absence.end_date)
        
        return absence.employee_id === employeeId && 
               date >= absenceStart && 
               date <= absenceEnd
      })
    }

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] border border-border rounded-lg overflow-hidden">
          {/* Header row with days 1-31 */}
          <div className="grid bg-muted" style={{ gridTemplateColumns: '200px repeat(' + daysInMonth + ', 1fr)' }}>
            <div className="p-3 border-r border-border font-medium">
              Mitarbeiter
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

          {/* Employee rows */}
          {activeEmployees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Keine aktiven Mitarbeiter in {format(currentDate, 'MMMM yyyy', { locale: de })}
            </div>
          ) : (
            activeEmployees.map((employee, index) => {
              // Get all absences for this employee in the current month
              const employeeAbsences = absences.filter(absence => {
                const absenceStart = new Date(absence.start_date)
                const absenceEnd = new Date(absence.end_date)
                const monthStart = new Date(currentYear, currentMonth, 1)
                const monthEnd = new Date(currentYear, currentMonth + 1, 0)
                
                return absence.employee_id === employee.id &&
                       absenceStart <= monthEnd && 
                       absenceEnd >= monthStart
              })

              return (
                <div
                  key={employee.id}
                  className={`grid ${index % 2 === 0 ? 'bg-background' : 'bg-muted/50'} border-b border-border last:border-b-0`}
                  style={{ gridTemplateColumns: '200px repeat(' + daysInMonth + ', 1fr)' }}
                >
                  {/* Employee info */}
                  <div className="p-3 border-r border-border">
                    <div className="font-medium text-sm">{employee.first_name} {employee.last_name}</div>
                    <div className="text-xs text-muted-foreground">{employee.position}</div>
                    <div className="text-xs text-muted-foreground">{employee.department}</div>
                  </div>
                  
                  {/* Days container with absence timeline */}
                  <div className="relative h-20" style={{ gridColumn: `2 / ${daysInMonth + 2}` }}>
                    {/* Background grid for days */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${daysInMonth}, 1fr)` }}>
                      {days.map(day => (
                        <div
                          key={day}
                          className="border-r border-border last:border-r-0"
                        />
                      ))}
                    </div>
                    
                    {/* Absence timeline bars */}
                    {employeeAbsences.map((absence, absenceIndex) => {
                      const absenceStart = new Date(absence.start_date)
                      const absenceEnd = new Date(absence.end_date)
                      const monthStart = new Date(currentYear, currentMonth, 1)
                      const monthEnd = new Date(currentYear, currentMonth + 1, 0)
                      
                      // Calculate start and end positions within the month
                      const effectiveStart = absenceStart < monthStart ? 1 : absenceStart.getDate()
                      const effectiveEnd = absenceEnd > monthEnd ? daysInMonth : absenceEnd.getDate()
                      
                      const width = ((effectiveEnd - effectiveStart + 1) / daysInMonth) * 100
                      const left = ((effectiveStart - 1) / daysInMonth) * 100
                      
                      // Calculate vertical position for multiple absences
                      const topOffset = 2 + (absenceIndex * 16) // 16px spacing between bars
                      
                      return (
                        <div
                          key={absence.id}
                          className={`absolute h-12 rounded-md flex items-center px-3 text-white text-xs font-medium shadow-md z-10 ${getColorForAbsenceType(absence.type)}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: `${topOffset}px`,
                            minWidth: '60px'
                          }}
                          title={`${absence.type} (${format(absenceStart, 'dd.MM.yyyy')} - ${format(absenceEnd, 'dd.MM.yyyy')}) - ${absence.status}${absence.reason ? ` - ${absence.reason}` : ''}`}
                        >
                          {getIconForAbsenceType(absence.type)}
                          <span className="ml-2 truncate">{absence.type}</span>
                          <div className="ml-auto flex items-center space-x-1">
                            {getStatusIcon(absence.status)}
                            <span className="text-xs opacity-90">
                              {format(absenceStart, 'dd.MM')} - {format(absenceEnd, 'dd.MM')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Project assignments as small indicators at bottom */}
                    {days.map(day => {
                      const dayAssignments = projectAssignments.filter(assignment => {
                        const assignStart = new Date(assignment.start_date)
                        const assignEnd = assignment.end_date ? new Date(assignment.end_date) : assignStart
                        const date = new Date(currentYear, currentMonth, day)
                        
                        return assignment.employee_id === employee.id &&
                               date >= assignStart && 
                               date <= assignEnd
                      })
                      
                      if (dayAssignments.length === 0) return null
                      
                      const dayLeft = ((day - 1) / daysInMonth) * 100
                      const dayWidth = (1 / daysInMonth) * 100
                      
                      return (
                        <div
                          key={`assignments-${day}`}
                          className="absolute bottom-1 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded flex items-center justify-center"
                          style={{
                            left: `${dayLeft}%`,
                            width: `${dayWidth - 1}%`,
                            minWidth: '20px'
                          }}
                          title={`${dayAssignments.length} Projekt(e): ${dayAssignments.map(a => `${a.project?.name} (${a.hours_per_day}h)`).join(', ')}`}
                        >
                          <Briefcase className="w-2 h-2 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs ml-1 text-blue-600 dark:text-blue-400">{dayAssignments.length}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
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
              {renderEmployeeCalendarView()}
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