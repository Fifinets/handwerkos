import React, { useState } from 'react'
import { TodayScreen } from './TodayScreen'
import { TodayTimeline } from './TodayTimeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  BarChart3,
  ListChecks,
  Timer
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { de } from 'date-fns/locale'

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

export const TodayScreenTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'today' | 'stats' | 'timeline'>('today')
  const [weeklyStats] = useState<WeeklyStats>({
    totalHours: 35.5,
    totalProjects: 4,
    totalBreaks: 12,
    avgDailyHours: 7.1,
    efficiency: 87
  })
  const [monthlyStats] = useState<MonthlyStats>({
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

  const renderStatisticsTab = () => (
    <div className="h-full scroll-snap-container">
      <div className="space-y-6 p-4 max-w-md mx-auto">
        {/* Wochen-Statistik */}
      <Card className="scroll-snap-start min-h-[300px]">
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
      <Card className="scroll-snap-start min-h-[400px]">
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
    </div>
  )

  const renderTimelineTab = () => (
    <div className="h-full scroll-snap-container">
      <TodayTimeline />
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-background">

      {/* Tab Navigation */}
      <div className="flex-none bg-background border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Stats
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'today'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Timer className="h-4 w-4" />
            Heute
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListChecks className="h-4 w-4" />
            Timeline
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'stats' && renderStatisticsTab()}
        {activeTab === 'today' && (
          <div className="h-full scroll-snap-container">
            <TodayScreen />
          </div>
        )}
        {activeTab === 'timeline' && renderTimelineTab()}
      </div>
    </div>
  )
}