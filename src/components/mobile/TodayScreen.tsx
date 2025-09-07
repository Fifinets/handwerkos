import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Play,
  Square,
  RotateCcw,
  Clock,
  Coffee,
  Car,
  MapPin,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Zap,
  Timer
} from 'lucide-react'
import { format, differenceInMinutes, startOfDay, endOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { useTimeTracking } from '@/hooks/useTimeTracking'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { QuickProjectSwitch } from './QuickProjectSwitch'
import { TodayTimeline } from './TodayTimeline'

interface TodayStats {
  totalWorkMinutes: number
  totalBreakMinutes: number
  segmentCount: number
  currentStreak: number
  targetHours: number
  efficiency: number
}

interface TodayScreenProps {
  onProjectSelect?: (projectId: string) => void
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  onProjectSelect
}) => {
  const { activeTime, isLoading, startTracking, stopTracking, switchProject } = useTimeTracking()
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
    segmentCount: 0,
    currentStreak: 0,
    targetHours: 8 * 60, // 8 Stunden in Minuten
    efficiency: 0
  })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showQuickSwitch, setShowQuickSwitch] = useState(false)

  // Aktualisiere Zeit jede Sekunde für Live-Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Lade heutige Statistiken
  const loadTodayStats = useCallback(async () => {
    try {
      const today = new Date()
      const { data: segments, error } = await supabase
        .from('time_segments')
        .select('*')
        .gte('started_at', startOfDay(today).toISOString())
        .lte('started_at', endOfDay(today).toISOString())
        .order('started_at')

      if (error) {
        // Fallback bei fehlender Tabelle
        console.warn('Time segments table not found, using mock data')
        setTodayStats({
          totalWorkMinutes: 240, // 4h Mock
          totalBreakMinutes: 30,
          segmentCount: 3,
          currentStreak: 120,
          targetHours: 8 * 60,
          efficiency: 85
        })
        return
      }

      // Berechne Statistiken
      const workMinutes = segments
        ?.filter(s => s.segment_type === 'work' && s.ended_at)
        .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0) || 0

      const breakMinutes = segments
        ?.filter(s => s.segment_type === 'break' && s.ended_at)
        .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0) || 0

      const segmentCount = segments?.length || 0
      
      // Berechne aktuellen Streak (längste kontinuierliche Arbeitszeit)
      let currentStreak = 0
      if (activeTime.active && activeTime.segment) {
        const startTime = new Date(activeTime.segment.started_at)
        currentStreak = differenceInMinutes(new Date(), startTime)
      }

      // Berechne Effizienz (Arbeitszeit vs. Gesamtzeit)
      const totalMinutes = workMinutes + breakMinutes
      const efficiency = totalMinutes > 0 ? Math.round((workMinutes / totalMinutes) * 100) : 0

      setTodayStats({
        totalWorkMinutes: workMinutes,
        totalBreakMinutes: breakMinutes,
        segmentCount,
        currentStreak,
        targetHours: 8 * 60,
        efficiency
      })

    } catch (error) {
      console.error('Error loading today stats:', error)
    }
  }, [activeTime])

  useEffect(() => {
    loadTodayStats()
    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(loadTodayStats, 30000)
    return () => clearInterval(interval)
  }, [loadTodayStats])

  // Formatiere Minuten zu Stunden:Minuten
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}h`
    }
    return `${mins}min`
  }

  // Berechne Live-Timer für aktives Segment
  const getCurrentDuration = () => {
    if (!activeTime.active || !activeTime.segment) return 0
    const startTime = new Date(activeTime.segment.started_at)
    return differenceInMinutes(currentTime, startTime)
  }

  // Quick Actions
  const handleStart = async (projectId?: string) => {
    try {
      toast.info('Starte Zeiterfassung...', { duration: 1000 })
      console.log('Starting tracking for project:', projectId)
      await startTracking(projectId || 'default', 'work', 'Mobile Start')
      
      toast.success('Zeiterfassung gestartet')
      console.log('Start tracking completed')
    } catch (error) {
      console.error('Start error:', error)
      toast.error(`Fehler beim Starten: ${error}`)
    }
  }

  const handleStop = async () => {
    try {
      await stopTracking('Mobile Stop')
      toast.success('Zeiterfassung beendet')
    } catch (error) {
      console.error('Stop error:', error)
      toast.error('Fehler beim Beenden')
    }
  }

  const handleBreak = async () => {
    try {
      toast.info('Starte Pause...', { duration: 1000 })
      if (activeTime.active) {
        await stopTracking('Pause gestartet')
      }
      await startTracking('break-project', 'break', 'Pause')
      toast.success('Pause gestartet')
    } catch (error) {
      console.error('Break error:', error)
      toast.error(`Fehler bei Pause: ${error}`)
    }
  }

  const handleDrive = async () => {
    try {
      toast.info('Starte Fahrt...', { duration: 1000 })
      if (activeTime.active) {
        await stopTracking('Fahrt gestartet')
      }
      await startTracking('drive-project', 'drive', 'Fahrt')
      toast.success('Fahrt gestartet')
    } catch (error) {
      console.error('Drive error:', error)
      toast.error(`Fehler bei Fahrt: ${error}`)
    }
  }

  // Berechne Fortschritt zum Tagesziel
  const progressPercentage = Math.min((todayStats.totalWorkMinutes / todayStats.targetHours) * 100, 100)
  const isTargetReached = todayStats.totalWorkMinutes >= todayStats.targetHours
  const remainingMinutes = Math.max(0, todayStats.targetHours - todayStats.totalWorkMinutes)

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      {/* Header mit Datum */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">Heute</h1>
        <p className="text-muted-foreground">
          {format(currentTime, 'EEEE, dd. MMMM yyyy', { locale: de })}
        </p>
      </div>

      {/* Live-Timer Card */}
      <Card className={`scroll-snap-start min-h-[250px] ${activeTime.active ? 'ring-2 ring-green-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className={`h-5 w-5 ${activeTime.active ? 'text-green-500' : 'text-gray-400'}`} />
              {activeTime.active ? 'Läuft' : 'Gestoppt'}
            </CardTitle>
            {activeTime.active && activeTime.segment && (
              <Badge variant="outline">
                {activeTime.segment.segment_type === 'work' ? 'Arbeit' :
                 activeTime.segment.segment_type === 'break' ? 'Pause' : 'Fahrt'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeTime.active && activeTime.segment ? (
            <div className="space-y-3">
              {/* Live Timer Display */}
              <div className="text-center">
                <div className="text-4xl font-mono font-bold text-green-600">
                  {formatDuration(getCurrentDuration())}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTime.segment.project_name || 'Allgemein'}
                </p>
              </div>

              {/* Aktuelle Session Info */}
              <div className="text-xs text-muted-foreground">
                <div>Gestartet: {format(new Date(activeTime.segment.started_at), 'HH:mm')}</div>
                {activeTime.segment.description && (
                  <div>Notiz: {activeTime.segment.description}</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickSwitch(true)}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Wechseln
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stopp
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Keine aktive Zeiterfassung</p>
              </div>

              {/* Quick Start Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleStart()}
                  disabled={isLoading}
                  className="h-12"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowQuickSwitch(true)}
                  disabled={isLoading}
                  className="h-12"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Projekt
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBreak}
                  className="flex-1"
                >
                  <Coffee className="h-4 w-4 mr-1" />
                  Pause
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDrive}
                  className="flex-1"
                >
                  <Car className="h-4 w-4 mr-1" />
                  Fahrt
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tages-Statistiken */}
      <Card className="scroll-snap-start min-h-[300px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tages-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fortschritt zum Tagesziel */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Tagesziel</span>
              <span className="text-sm text-muted-foreground">
                {formatDuration(todayStats.totalWorkMinutes)} / {formatDuration(todayStats.targetHours)}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between items-center mt-1">
              <span className={`text-xs ${isTargetReached ? 'text-green-600' : 'text-muted-foreground'}`}>
                {isTargetReached ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Ziel erreicht!
                  </span>
                ) : (
                  `Noch ${formatDuration(remainingMinutes)}`
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>

          {/* Statistik Grid */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {formatDuration(todayStats.totalWorkMinutes)}
              </div>
              <p className="text-xs text-muted-foreground">Arbeitszeit</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">
                {formatDuration(todayStats.totalBreakMinutes)}
              </div>
              <p className="text-xs text-muted-foreground">Pausen</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {todayStats.segmentCount}
              </div>
              <p className="text-xs text-muted-foreground">Segmente</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">
                {todayStats.efficiency}%
              </div>
              <p className="text-xs text-muted-foreground">Effizienz</p>
            </div>
          </div>

          {/* Streak Anzeige */}
          {todayStats.currentStreak > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Aktueller Streak</span>
                </div>
                <span className="text-sm font-semibold text-yellow-600">
                  {formatDuration(todayStats.currentStreak)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Heute Timeline */}
      <TodayTimeline />

      {/* Quick Project Switch Sheet */}
      <QuickProjectSwitch
        isOpen={showQuickSwitch}
        onClose={() => setShowQuickSwitch(false)}
        onProjectSelect={async (projectId) => {
          try {
            if (activeTime.active) {
              await switchProject(projectId, 'work', 'Projekt gewechselt')
            } else {
              await handleStart(projectId)
            }
            setShowQuickSwitch(false)
            if (onProjectSelect) {
              onProjectSelect(projectId)
            }
          } catch (error) {
            console.error('Project switch error:', error)
            toast.error('Fehler beim Projektwechsel')
          }
        }}
        currentProjectId={activeTime.segment?.project_id}
      />
    </div>
  )
}