import React, { useState, useRef, useEffect } from 'react'
import { TodayScreen } from './TodayScreen'
import { TodayTimeline } from './TodayTimeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  ListChecks,
  Timer
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'
import { Progress } from '@/components/ui/progress'

interface WeeklyStats {
  totalHours: number
  totalProjects: number
  totalBreaks: number
  avgDailyHours: number
  efficiency: number
}

interface MonthlyStats {
  totalHours: number
  totalDays: number
  totalProjects: number
  avgDailyHours: number
  topProjects: Array<{
    name: string
    hours: number
  }>
}

export const TodayScreenSwipeable: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1) // 0: Statistik, 1: Heute, 2: Timeline
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalHours: 0,
    totalProjects: 0,
    totalBreaks: 0,
    avgDailyHours: 0,
    efficiency: 0
  })
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalHours: 0,
    totalDays: 0,
    totalProjects: 0,
    avgDailyHours: 0,
    topProjects: []
  })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const isDragging = useRef(false)

  // Load statistics
  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    try {
      const now = new Date()
      const weekStart = startOfWeek(now, { locale: de })
      const weekEnd = endOfWeek(now, { locale: de })
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)

      // Load weekly stats
      const { data: weekSegments } = await supabase
        .from('time_segments')
        .select('*')
        .gte('started_at', weekStart.toISOString())
        .lte('started_at', weekEnd.toISOString())

      if (weekSegments) {
        const workMinutes = weekSegments
          .filter(s => s.segment_type === 'work' && s.ended_at)
          .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0)
        
        const breakMinutes = weekSegments
          .filter(s => s.segment_type === 'break' && s.ended_at)
          .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0)
        
        const uniqueProjects = new Set(weekSegments.map(s => s.project_id)).size
        const totalMinutes = workMinutes + breakMinutes
        const efficiency = totalMinutes > 0 ? Math.round((workMinutes / totalMinutes) * 100) : 0

        setWeeklyStats({
          totalHours: Math.round(workMinutes / 60 * 10) / 10,
          totalProjects: uniqueProjects,
          totalBreaks: weekSegments.filter(s => s.segment_type === 'break').length,
          avgDailyHours: Math.round(workMinutes / 60 / 5 * 10) / 10, // 5 work days
          efficiency
        })
      }

      // Load monthly stats
      const { data: monthSegments } = await supabase
        .from('time_segments')
        .select('*')
        .gte('started_at', monthStart.toISOString())
        .lte('started_at', monthEnd.toISOString())

      if (monthSegments) {
        const workMinutes = monthSegments
          .filter(s => s.segment_type === 'work' && s.ended_at)
          .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0)
        
        const uniqueDays = new Set(monthSegments.map(s => 
          new Date(s.started_at).toDateString()
        )).size

        const uniqueProjects = new Set(monthSegments.map(s => s.project_id)).size

        // Calculate top projects
        const projectMinutes: Record<string, number> = {}
        monthSegments
          .filter(s => s.segment_type === 'work' && s.ended_at)
          .forEach(s => {
            const project = s.project_name || 'Allgemein'
            projectMinutes[project] = (projectMinutes[project] || 0) + (s.duration_minutes_computed || 0)
          })
        
        const topProjects = Object.entries(projectMinutes)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name, minutes]) => ({
            name,
            hours: Math.round(minutes / 60 * 10) / 10
          }))

        setMonthlyStats({
          totalHours: Math.round(workMinutes / 60 * 10) / 10,
          totalDays: uniqueDays,
          totalProjects: uniqueProjects,
          avgDailyHours: uniqueDays > 0 ? Math.round(workMinutes / 60 / uniqueDays * 10) / 10 : 0,
          topProjects
        })
      }
    } catch (error) {
      console.error('Error loading statistics:', error)
      // Use mock data if database is not available
      setWeeklyStats({
        totalHours: 35.5,
        totalProjects: 4,
        totalBreaks: 12,
        avgDailyHours: 7.1,
        efficiency: 87
      })
      setMonthlyStats({
        totalHours: 142.3,
        totalDays: 18,
        totalProjects: 8,
        avgDailyHours: 7.9,
        topProjects: [
          { name: 'Projekt A', hours: 45.2 },
          { name: 'Projekt B', hours: 32.1 },
          { name: 'Projekt C', hours: 28.5 }
        ]
      })
    }
  }

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    isDragging.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    currentX.current = e.touches[0].clientX
    
    const diff = currentX.current - startX.current
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(${diff}px)`
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging.current) return
    isDragging.current = false
    
    const diff = currentX.current - startX.current
    const threshold = 50 // Minimum swipe distance
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentPage > 0) {
        // Swipe right - go to previous page
        setCurrentPage(currentPage - 1)
      } else if (diff < 0 && currentPage < 2) {
        // Swipe left - go to next page
        setCurrentPage(currentPage + 1)
      }
    }
    
    // Reset position
    if (containerRef.current) {
      containerRef.current.style.transform = 'translateX(0)'
    }
  }

  const renderStatisticsPage = () => (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Statistiken</h1>
        <p className="text-muted-foreground">Ihre Arbeitszeit-Übersicht</p>
      </div>

      {/* Wochen-Statistik */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Diese Woche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{weeklyStats.totalHours}h</p>
              <p className="text-xs text-muted-foreground">Gesamt</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{weeklyStats.avgDailyHours}h</p>
              <p className="text-xs text-muted-foreground">Ø pro Tag</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{weeklyStats.totalProjects}</p>
              <p className="text-xs text-muted-foreground">Projekte</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{weeklyStats.efficiency}%</p>
              <p className="text-xs text-muted-foreground">Effizienz</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Wochenziel</span>
              <span className="text-sm text-muted-foreground">{weeklyStats.totalHours}/40h</span>
            </div>
            <Progress value={(weeklyStats.totalHours / 40) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Monats-Statistik */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dieser Monat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-2xl font-bold">{monthlyStats.totalHours}h</p>
              <p className="text-xs text-muted-foreground">Gesamt</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{monthlyStats.avgDailyHours}h</p>
              <p className="text-xs text-muted-foreground">Ø pro Tag</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{monthlyStats.totalDays}</p>
              <p className="text-xs text-muted-foreground">Arbeitstage</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{monthlyStats.totalProjects}</p>
              <p className="text-xs text-muted-foreground">Projekte</p>
            </div>
          </div>

          {/* Top Projekte */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Top Projekte</h4>
            <div className="space-y-2">
              {monthlyStats.topProjects.map((project, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm truncate flex-1">{project.name}</span>
                  <Badge variant="secondary" className="ml-2">{project.hours}h</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderTimelinePage = () => (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-muted-foreground">Heutiger Tagesverlauf</p>
      </div>
      <TodayTimeline />
    </div>
  )

  return (
    <div className="relative h-full overflow-hidden">
      {/* Page content container */}
      <div
        ref={containerRef}
        className="h-full transition-transform duration-300 ease-out"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${currentPage * 100}%)`,
          display: 'flex',
          width: '300%'
        }}
      >
        {/* Page 1: Statistics */}
        <div className="w-full h-full overflow-y-auto" style={{ width: '33.333%' }}>
          {renderStatisticsPage()}
        </div>

        {/* Page 2: Today (Main) */}
        <div className="w-full h-full overflow-y-auto" style={{ width: '33.333%' }}>
          <TodayScreen />
        </div>

        {/* Page 3: Timeline */}
        <div className="w-full h-full overflow-y-auto" style={{ width: '33.333%' }}>
          {renderTimelinePage()}
        </div>
      </div>

      {/* Page indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
        {[0, 1, 2].map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={`h-2 transition-all duration-300 rounded-full ${
              currentPage === page 
                ? 'w-6 bg-primary' 
                : 'w-2 bg-muted-foreground/30'
            }`}
            aria-label={`Go to page ${page + 1}`}
          />
        ))}
      </div>

      {/* Optional: Navigation buttons for desktop/tablet */}
      <div className="hidden md:flex absolute top-1/2 transform -translate-y-1/2 w-full justify-between px-2 pointer-events-none">
        <Button
          size="icon"
          variant="ghost"
          className="pointer-events-auto"
          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="pointer-events-auto"
          onClick={() => setCurrentPage(Math.min(2, currentPage + 1))}
          disabled={currentPage === 2}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}