import React, { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isWithinInterval, eachDayOfInterval } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, Users, Briefcase, Plus, Filter, User, Clock, MapPin, AlertCircle, CheckCircle, XCircle, CalendarIcon, TrendingUp, UserCheck, Building2, Activity, Zap, Eye } from 'lucide-react'
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

  // Calculate statistics for dashboard
  const activeProjectsCount = projects.filter(p => p.status.toLowerCase() === 'aktiv').length
  const totalEmployees = employees.length
  const activeEmployeesCount = employees.filter(emp => emp.status === 'aktiv').length
  const currentAbsencesCount = absences.filter(absence => {
    const today = new Date()
    const start = new Date(absence.start_date)
    const end = new Date(absence.end_date)
    return start <= today && end >= today && absence.status === 'genehmigt'
  }).length

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Statistics */}
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3 mb-2">
              <Calendar className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              Ressourcenplaner
            </h1>
            <p className="text-muted-foreground">Zentrale Übersicht für Projekte, Mitarbeiter und Kapazitäten</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button onClick={loadAllData} variant="outline" size="sm" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Aktualisieren</span>
            </Button>
            <Button variant="default" size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Neu erstellen</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-soft rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aktive Projekte</p>
                  <p className="text-2xl font-bold">{activeProjectsCount}</p>
                  <p className="text-xs text-muted-foreground">von {projects.length} gesamt</p>
                </div>
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Verfügbare Mitarbeiter</p>
                  <p className="text-2xl font-bold">{activeEmployeesCount - currentAbsencesCount}</p>
                  <p className="text-xs text-muted-foreground">von {activeEmployeesCount} aktiv</p>
                </div>
                <UserCheck className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kapazitätsauslastung</p>
                  <p className="text-2xl font-bold">
                    {totalEmployees > 0 ? Math.round(((activeProjectsCount * 2.5) / totalEmployees) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">durchschnittlich</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Laufende Abwesenheiten</p>
                  <p className="text-2xl font-bold">{currentAbsencesCount}</p>
                  <p className="text-xs text-muted-foreground">heute aktiv</p>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-800 rounded-lg border">
          <div className="flex items-center space-x-4">
            {activeTab === 'overview' && (
              <>
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-48 bg-background/80 backdrop-blur">
                      <SelectValue placeholder="Alle Abteilungen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Abteilungen</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                    <SelectTrigger className="w-40 bg-background/80 backdrop-blur">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle anzeigen</SelectItem>
                      <SelectItem value="projects">Nur Projekte</SelectItem>
                      <SelectItem value="absences">Nur Abwesenheiten</SelectItem>
                      <SelectItem value="events">Nur Termine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
                <SelectTrigger className="w-32 bg-background/80 backdrop-blur">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">📅 Woche</SelectItem>
                  <SelectItem value="month">🗓️ Monat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Übersicht</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center space-x-2">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">Projekte</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Mitarbeiter</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Ressourcen</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card className="shadow-soft rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <span className="text-lg font-bold">
                      {viewMode === 'week' 
                        ? `${format(start, 'dd.MM', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`
                        : format(currentDate, 'MMMM yyyy', { locale: de })
                      }
                    </span>
                    <p className="text-xs text-muted-foreground">Jahresübersicht</p>
                  </div>
                </CardTitle>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={navigatePrevious}
                    className="bg-background/80 backdrop-blur hover:bg-blue-50 transition-all duration-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Zurück</span>
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "min-w-[140px] sm:w-[180px] justify-start text-left font-normal bg-background/80 backdrop-blur hover:bg-purple-50 transition-all duration-200"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-purple-500" />
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {format(currentDate, 'MMM yyyy', { locale: de })}
                        </span>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={navigateNext}
                    className="bg-background/80 backdrop-blur hover:bg-blue-50 transition-all duration-200"
                  >
                    <span className="hidden sm:inline mr-1">Vor</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Mobile/Tablet optimized view */}
              <div className="lg:hidden mb-6">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Activity className="w-5 h-5 text-orange-600" />
                    <span className="font-medium text-orange-800 dark:text-orange-200">Mobile Ansicht</span>
                  </div>
                  <p className="text-sm text-orange-600 dark:text-orange-300">
                    Für die vollständige Kalenderansicht verwenden Sie bitte ein größeres Display oder wechseln Sie zu den spezifischen Tabs.
                  </p>
                </div>
              </div>

              {/* Desktop calendar view */}
              <div className="hidden lg:block">
                {renderYearCalendarOverview()}
              </div>
              
              {/* Legend */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Legende & Status</h4>
                  <Badge variant="outline" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    Live-Daten
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Urlaub</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">Krank</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Projekte</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                    <span className="text-sm font-medium">Elternzeit</span>
                  </div>
                </div>
                
                <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />
                
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-700 dark:text-green-300">✅ Genehmigt</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-700 dark:text-yellow-300">⏳ Beantragt</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-700 dark:text-red-300">❌ Abgelehnt</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="projects">
          <Card className="shadow-soft rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle className="flex items-center space-x-3">
                  <Briefcase className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <span className="text-lg font-bold">
                      Projektkalender - {format(currentDate, 'yyyy', { locale: de })}
                    </span>
                    <p className="text-xs text-muted-foreground">Projektzeitleisten und Ressourcenzuteilung</p>
                  </div>
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
          <Card className="shadow-soft rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle className="flex items-center space-x-3">
                  <Users className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <span className="text-lg font-bold">
                      Mitarbeiterkalender - {format(currentDate, 'yyyy', { locale: de })}
                    </span>
                    <p className="text-xs text-muted-foreground">Verfügbarkeit und Abwesenheiten</p>
                  </div>
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
          <Card className="shadow-soft rounded-xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3">
                <MapPin className="w-6 h-6 text-muted-foreground" />
                <div>
                  <span className="text-lg font-bold">Ressourcenplanung</span>
                  <p className="text-xs text-muted-foreground">Materialien, Werkzeuge und Fahrzeuge</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <Zap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Ressourcenplanung in Entwicklung
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Die erweiterte Ressourcenverwaltung für Materialien, Werkzeuge und Fahrzeuge wird hier implementiert. 
                  Bald verfügbar mit intelligenter Zuordnung und Verfügbarkeitsprüfung.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <h4 className="font-medium text-sm">Materialverwaltung</h4>
                    <p className="text-xs text-muted-foreground">Lagerbestände & Bestellungen</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <h4 className="font-medium text-sm">Werkzeugplanung</h4>
                    <p className="text-xs text-muted-foreground">Verfügbarkeit & Wartung</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <h4 className="font-medium text-sm">Fahrzeugflotte</h4>
                    <p className="text-xs text-muted-foreground">Einsatzplanung & Tracking</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PlannerModule