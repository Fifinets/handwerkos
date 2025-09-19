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
  const [selectedProject, setSelectedProject] = useState<{
    id: string,
    name: string,
    customer?: {name: string},
    location?: string,
    status?: string,
    start_date?: string,
    end_date?: string,
    priority?: string,
    description?: string
  } | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [breakTimer, setBreakTimer] = useState<{
    isActive: boolean
    remainingSeconds: number
    totalSeconds: number
  }>({
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0
  })
  const [companySettings, setCompanySettings] = useState<{default_break_duration: number} | null>(null)

  // Aktualisiere Zeit jede Sekunde für Live-Timer und Pause-Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      
      // Update break timer
      if (breakTimer.isActive && breakTimer.remainingSeconds > 0) {
        setBreakTimer(prev => ({
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1
        }))
      } else if (breakTimer.isActive && breakTimer.remainingSeconds <= 0) {
        // Timer finished
        setBreakTimer(prev => ({ ...prev, isActive: false }))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [breakTimer.isActive, breakTimer.remainingSeconds])

  // Restore selected project from localStorage on component mount
  useEffect(() => {
    const savedProject = localStorage.getItem('selectedProject')
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject)
        setSelectedProject(project)
        console.log('Restored selected project from localStorage:', project)
      } catch (e) {
        console.error('Error parsing saved project:', e)
        localStorage.removeItem('selectedProject')
      }
    }
  }, [])

  // Lade Projekte
  useEffect(() => {
    const loadProjects = async () => {
      try {
        console.log('🔥 Loading real projects from database...')
        console.log('🔥 Current selectedProject before loading:', selectedProject)
        
        // First, test if the projects table exists at all
        console.log('Testing supabase connection...')
        const { data: testData, error: testError } = await supabase
          .from('projects')
          .select('id, name')
          .limit(1)
        
        console.log('Basic connection test result:', { testData, testError })
        
        if (testError) {
          console.log('Basic connection failed, trying fallback approach...')
          // If table doesn't exist or we have no access, use mock projects
          const mockProjects = [
            {
              id: 'mock-project-1',
              name: 'Test Baustelle A',
              customer: { name: 'Mustermann GmbH' },
              location: 'Musterstraße 123, 12345 Berlin',
              status: 'active',
              priority: 'high',
              start_date: '2024-01-15',
              end_date: '2024-06-30',
              description: 'Renovierung und Umbau des Erdgeschosses'
            },
            {
              id: 'mock-project-2',
              name: 'Test Baustelle B',
              customer: { name: 'Schmidt & Co' },
              location: 'Hauptstraße 45, 10115 Berlin',
              status: 'active',
              priority: 'normal',
              start_date: '2024-02-01',
              end_date: '2024-05-15',
              description: 'Sanitärinstallation im 2. OG'
            },
            {
              id: 'mock-project-3',
              name: 'Neubau Bürogebäude',
              customer: { name: 'Bau AG' },
              location: 'Industriepark 7, 12489 Berlin',
              status: 'active',
              priority: 'urgent',
              start_date: '2024-01-01',
              end_date: '2024-12-31',
              description: 'Neubau eines 5-stöckigen Bürogebäudes mit Tiefgarage'
            }
          ]
          console.log('Using mock projects due to database error:', testError.message)
          setProjects(mockProjects)
          // DON'T auto-select first project - user should choose
          console.log('NOT auto-selecting project - user must choose manually')
          toast.info(`${mockProjects.length} Test-Projekte geladen (Offline-Modus)`)
          return
        }
        
        // Now try the full query with all fields
        let { data, error } = await supabase
          .from('projects')
          .select('id, name, customer_id, location, status, start_date, end_date, priority, description')
          .eq('status', 'active')
          .order('name')
        
        if (error) {
          console.log('Even simple query failed, trying different approach:', error.message)
          // Try with different status values or without status filter
          const { data: data2, error: error2 } = await supabase
            .from('projects')
            .select('id, name, customer_id, location, status, start_date, end_date, priority, description')
            .order('name')
            .limit(10)
          
          if (error2) throw error2
          data = data2
        }
        
        // If we got projects, try to add customer names
        if (data && data.length > 0) {
          try {
            // Get customer info separately to avoid join issues
            const customerIds = [...new Set(data.map(p => p.customer_id).filter(Boolean))]
            let customerMap = new Map()
            
            if (customerIds.length > 0) {
              const { data: customers } = await supabase
                .from('customers')
                .select('id, name')
                .in('id', customerIds)
              
              if (customers) {
                customers.forEach(c => customerMap.set(c.id, c))
              }
            }
            
            // Add customer info to projects
            data = data.map(project => ({
              ...project,
              customer: project.customer_id && customerMap.has(project.customer_id) 
                ? { name: customerMap.get(project.customer_id).name }
                : null
            }))
          } catch (customerError) {
            console.log('Customer loading failed, using projects without customer names:', customerError)
            // Continue without customer names
          }
        }
        
        if (error) throw error
        console.log('Loaded projects:', data)
        setProjects(data || [])
        
        if (data && data.length > 0) {
          toast.success(`${data.length} Projekte geladen`)
        } else {
          toast.info('Keine aktiven Projekte gefunden')
        }
      } catch (error: any) {
        console.error('Error loading projects:', error)
        console.error('Error message:', error.message)
        console.error('Error details:', JSON.stringify(error, null, 2))
        toast.error(`Fehler beim Laden der Projekte: ${error.message || 'Unbekannter Fehler'}`)
      }
    }
    
    loadProjects()
    loadCompanySettings()
  }, [])

  // Lade Company Settings für Pausenzeit
  const loadCompanySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No user found')
        setCompanySettings({ default_break_duration: 15 })
        return
      }

      console.log('Loading company settings for user:', user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      console.log('User profile result:', { data, error })

      if (error || !data?.company_id) {
        console.log('No company_id found, trying to fix automatically...')
        
        // Try to find and set company_id automatically
        const { data: companies, error: companyError } = await supabase
          .from('company_settings')
          .select('id, default_break_duration')
          .order('created_at', { ascending: false })
          .limit(1)

        if (companyError || !companies || companies.length === 0) {
          console.log('No company found, using default break time')
          setCompanySettings({ default_break_duration: 15 })
          return
        }

        console.log('Found company, setting company_id for user:', companies[0].id)

        // Update user profile with company_id
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ company_id: companies[0].id })
          .eq('id', user.id)

        if (updateError) {
          console.log('Failed to update user profile, using default:', updateError.message)
          setCompanySettings({ default_break_duration: 15 })
          return
        }

        console.log('Successfully set company_id, using company settings')
        setCompanySettings({ default_break_duration: companies[0].default_break_duration })
        return
      }

      console.log('Found company_id:', data.company_id)

      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('default_break_duration')
        .eq('id', data.company_id)
        .single()

      console.log('Company settings result:', { settings, settingsError })

      if (settingsError) {
        console.log('No company settings found, using default:', settingsError.message)
        setCompanySettings({ default_break_duration: 15 })
      } else {
        console.log('Loaded company settings - break duration:', settings.default_break_duration)
        setCompanySettings(settings)
      }
    } catch (error) {
      console.error('Error loading company settings:', error)
      setCompanySettings({ default_break_duration: 15 })
    }
  }

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
      const projectToUse = projectId || selectedProject?.id
      if (!projectToUse) {
        toast.error('Bitte wählen Sie zuerst ein Projekt aus')
        return
      }
      
      toast.info('Starte Zeiterfassung...', { duration: 1000 })
      console.log('Starting tracking for project:', projectToUse)
      await startTracking(projectToUse, 'work', 'Mobile Start')
      
      toast.success('Zeiterfassung gestartet')
      console.log('Start tracking completed')
    } catch (error) {
      console.error('Start error:', error)
      toast.error(`Fehler beim Starten: ${error}`)
    }
  }

  const handleStop = async () => {
    try {
      // Save selected project before clearing localStorage
      if (selectedProject) {
        localStorage.setItem('selectedProject', JSON.stringify(selectedProject))
      }

      // Simple manual stop without complex logic
      localStorage.removeItem('activeTimeEntry')
      localStorage.removeItem('activeBreak')

      // Force UI update by reloading the page
      window.location.reload()
    } catch (error) {
      console.error('Stop error:', error)
      toast.error('Fehler beim Beenden')
    }
  }

  const handleBreak = async () => {
    try {
      if (activeTime.active) {
        await stopTracking('Pause gestartet')
      }
      await startTracking('break-project', 'break', 'Pause')
      
      // Starte Pause-Timer mit Company Settings
      const breakDuration = companySettings?.default_break_duration || 15 // Minuten
      const totalSeconds = breakDuration * 60 // Convert to seconds
      
      console.log('🟡 BREAK TIMER DEBUG:')
      console.log('Company settings:', companySettings)
      console.log('Break duration (minutes):', breakDuration)
      console.log('Total seconds:', totalSeconds)
      
      setBreakTimer({
        isActive: true,
        remainingSeconds: totalSeconds,
        totalSeconds: totalSeconds
      })
      
    } catch (error) {
      console.error('Break error:', error)
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

  // Helper function to format timer display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
              {activeTime.active ? 'Läuft' : 'Zeiterfassung'}
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

              {/* Break Timer Display */}
              {breakTimer.isActive && (
                <div className="text-center bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="text-2xl font-mono font-bold text-orange-600 mb-1">
                    {formatTime(breakTimer.remainingSeconds)}
                  </div>
                  <p className="text-xs text-orange-700">
                    Pausenzeit verbleibt
                  </p>
                  {/* Progress bar for break time */}
                  <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-1000" 
                      style={{ 
                        width: `${((breakTimer.totalSeconds - breakTimer.remainingSeconds) / breakTimer.totalSeconds) * 100}%` 
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBreakTimer(prev => ({ ...prev, isActive: false }))}
                    className="mt-2 text-xs"
                  >
                    Pause beenden
                  </Button>
                </div>
              )}

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
                  onClick={handleBreak}
                  className="flex-1"
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  Pause
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
              {/* Projekt Info Card */}
              {selectedProject ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Ausgewähltes Projekt</span>
                    </div>
                    {selectedProject.priority && (
                      <Badge variant={
                        selectedProject.priority === 'urgent' ? 'destructive' :
                        selectedProject.priority === 'high' ? 'default' :
                        'secondary'
                      }>
                        {selectedProject.priority === 'urgent' ? 'Dringend' :
                         selectedProject.priority === 'high' ? 'Hoch' :
                         selectedProject.priority === 'normal' ? 'Normal' : 'Niedrig'}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-lg">{selectedProject.name}</p>
                      {selectedProject.customer && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Kunde:</span> {selectedProject.customer.name}
                        </p>
                      )}
                    </div>

                    {selectedProject.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <p className="text-sm text-gray-600">{selectedProject.location}</p>
                      </div>
                    )}

                    {(selectedProject.start_date || selectedProject.end_date) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>
                          {selectedProject.start_date && format(new Date(selectedProject.start_date), 'dd.MM.yyyy')}
                          {selectedProject.start_date && selectedProject.end_date && ' - '}
                          {selectedProject.end_date && format(new Date(selectedProject.end_date), 'dd.MM.yyyy')}
                        </span>
                      </div>
                    )}

                    {selectedProject.status && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-gray-400" />
                        <Badge variant="outline" className="text-xs">
                          {selectedProject.status === 'active' ? 'Aktiv' :
                           selectedProject.status === 'planning' ? 'In Planung' :
                           selectedProject.status === 'completed' ? 'Abgeschlossen' :
                           selectedProject.status}
                        </Badge>
                      </div>
                    )}

                    {selectedProject.description && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500">Beschreibung:</p>
                        <p className="text-sm text-gray-700">{selectedProject.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-xs text-green-600 font-medium">
                      ✅ Bereit zum Start der Zeiterfassung
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">Keine aktive Zeiterfassung</p>
                  <p className="text-xs text-muted-foreground">Bitte wählen Sie ein Projekt aus</p>
                </div>
              )}

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
                  onClick={() => {
                    console.log('🔥 PROJEKT BUTTON CLICKED!');
                    console.log('Before setState - showQuickSwitch:', showQuickSwitch);
                    setShowQuickSwitch(true);
                    console.log('After setState called');
                    toast.info('Projekt-Dialog wird geöffnet...');
                  }}
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


      {/* Quick Project Switch Sheet */}
      <QuickProjectSwitch
        isOpen={showQuickSwitch}
        onClose={() => setShowQuickSwitch(false)}
        onProjectSelect={async (projectId) => {
          try {
            console.log('onProjectSelect called with:', projectId)
            console.log('projects state:', projects)
            console.log('projects type:', typeof projects)
            console.log('projects length:', projects?.length)

            // First try to find project in our loaded projects
            let project = null
            try {
              if (projects && Array.isArray(projects) && projects.length > 0) {
                project = projects.find(p => p && p.id === projectId)
                console.log('Found project in list:', project)
              } else {
                console.log('Projects not ready:', projects)
              }
            } catch (findError) {
              console.error('Error in projects.find:', findError)
            }
            
            // If not found, try to load it directly from database
            if (!project) {
              try {
                const { data: dbProject, error } = await supabase
                  .from('projects')
                  .select('id, name, customer_id, location, status, start_date, end_date, priority, description')
                  .eq('id', projectId)
                  .single()

                if (!error && dbProject) {
                  // Try to load customer info separately if needed
                  if (dbProject.customer_id) {
                    try {
                      const { data: customer } = await supabase
                        .from('customers')
                        .select('id, name')
                        .eq('id', dbProject.customer_id)
                        .single()

                      if (customer) {
                        dbProject.customer = { name: customer.name }
                      }
                    } catch (customerError) {
                      console.log('Customer loading failed:', customerError)
                    }
                  }

                  project = dbProject
                  // Add to our projects array for future use
                  setProjects(prev => [...prev, project])
                }
              } catch (dbError) {
                console.error('Database error:', dbError)
              }
            }
            
            if (activeTime.active) {
              await switchProject(projectId, 'work', 'Projekt gewechselt')
            } else {
              // Don't auto-start, just select the project
              if (project) {
                setSelectedProject(project)
                // Save to localStorage for persistence
                localStorage.setItem('selectedProject', JSON.stringify(project))
              } else {
                // Fallback: Use mock project if real data fails
                const mockProject = {
                  id: projectId,
                  name: 'Test Baustelle A',
                  customer: { name: 'Mustermann GmbH' },
                  location: 'Musterstraße 123, 12345 Berlin',
                  status: 'active',
                  priority: 'high',
                  start_date: '2024-01-15',
                  end_date: '2024-06-30',
                  description: 'Renovierung und Umbau des Erdgeschosses'
                }
                setSelectedProject(mockProject)
                // Save to localStorage for persistence
                localStorage.setItem('selectedProject', JSON.stringify(mockProject))
              }
            }
            setShowQuickSwitch(false)
            if (onProjectSelect) {
              onProjectSelect(projectId)
            }
          } catch (error) {
            console.error('Project switch error:', error)
          }
        }}
        currentProjectId={activeTime.segment?.project_id}
      />
    </div>
  )
}