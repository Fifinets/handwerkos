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
  Timer,
  Phone
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
  const { activeTime, isLoading, startTracking, stopTracking, switchProject, startBreak, endBreak } = useTimeTracking()
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
    customer?: {name: string, phone?: string},
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
    // Clear any old localStorage data on component mount
    localStorage.removeItem('selectedProject')
    setSelectedProject(null)
    console.log('TodayScreen: Cleared old localStorage data')
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
          // Don't use mock projects - force real data instead
          console.log('Database connection issue, but trying to continue:', testError.message)
          // Continue to try loading real data below
          // return  // REMOVED - don't return early
        }
        
        // Start with simplest query possible
        let { data, error } = await supabase
          .from('projects')
          .select('id, name')
          .order('name')
          .limit(10)

        console.log('Simple projects query result:', { data, error })

        if (error) {
          console.error('Even simplest query failed:', error.message)
          throw error
        }

        // If basic query works, try to get more fields
        if (data && data.length > 0) {
          const { data: fullData, error: fullError } = await supabase
            .from('projects')
            .select('id, name, customer_id, location, status, start_date, end_date, description')
            .order('name')

          if (!fullError && fullData) {
            console.log('✅ Full project data loaded successfully')
            console.log('📊 Sample full project:', fullData[0])
            data = fullData
          } else {
            console.error('❌ Full project query failed:', fullError?.message || fullError)
          }
        }
        
        // If we got projects, try to add customer names
        if (data && data.length > 0) {
          try {
            // Get customer info separately to avoid join issues
            const customerIds = [...new Set(data.map(p => p.customer_id).filter(Boolean))]
            let customerMap = new Map()
            
            if (customerIds.length > 0) {
              console.log('📊 Loading customers for IDs:', customerIds)
              const { data: customers, error: customerError } = await supabase
                .from('customers')
                .select('id, name, phone')
                .in('id', customerIds)

              if (customerError) {
                console.error('❌ Customer query failed:', customerError.message)
              } else if (customers) {
                console.log('✅ Customers loaded:', customers.length)
                console.log('📊 Sample customer:', customers[0])
                customers.forEach(c => customerMap.set(c.id, c))
              }
            }

            // Add customer info to projects
            data = data.map(project => ({
              ...project,
              customer: project.customer_id && customerMap.has(project.customer_id)
                ? {
                    name: customerMap.get(project.customer_id).name,
                    phone: customerMap.get(project.customer_id).phone
                  }
                : null
            }))
            console.log('✅ Projects with customer data merged')
            console.log('📊 Sample merged project:', data[0])
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

      // First check how many rows exist for this company_id
      const { data: allSettings, error: checkError } = await supabase
        .from('company_settings')
        .select('id, company_id, default_break_duration')
        .eq('company_id', data.company_id)

      console.log('All company_settings for company_id:', JSON.stringify({ allSettings, checkError, count: allSettings?.length }))

      // Also try without company_id filter to see all rows
      const { data: allRows } = await supabase
        .from('company_settings')
        .select('id, company_id, default_break_duration')

      console.log('ALL company_settings in database:', JSON.stringify(allRows))

      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('default_break_duration')
        .eq('company_id', data.company_id)
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
      let workMinutes = segments
        ?.filter(s => s.segment_type === 'work' && s.ended_at)
        .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0) || 0

      let breakMinutes = segments
        ?.filter(s => s.segment_type === 'break' && s.ended_at)
        .reduce((sum, s) => sum + (s.duration_minutes_computed || 0), 0) || 0

      const segmentCount = segments?.length || 0

      // Berechne aktuellen Streak (längste kontinuierliche Arbeitszeit)
      let currentStreak = 0
      if (activeTime.active && activeTime.segment && activeTime.segment.started_at) {
        const startTime = new Date(activeTime.segment.started_at)
        const elapsedMinutes = differenceInMinutes(new Date(), startTime)

        // Füge das aktive Segment zur entsprechenden Zeit hinzu
        if (activeTime.segment.segment_type === 'work') {
          // Für work: Verwende getCurrentDuration() (mit Pausenabzug)
          currentStreak = getCurrentDuration()
          workMinutes += currentStreak
        } else if (activeTime.segment.segment_type === 'break') {
          // Für break: Addiere zur Pausenzeit, NICHT zur Arbeitszeit
          breakMinutes += elapsedMinutes
        }
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

  // Berechne Live-Timer für aktives Segment (mit Pausenabzug)
  const getCurrentDuration = () => {
    if (!activeTime.active || !activeTime.segment || !activeTime.segment.started_at) return 0
    // Nur Arbeitszeit zählen, nicht Pausen oder Fahrten
    if (activeTime.segment.segment_type !== 'work') return 0

    // Berechne Gesamtzeit seit Start
    const startTime = new Date(activeTime.segment.started_at)
    let totalMinutes = differenceInMinutes(currentTime, startTime)

    // Ziehe laufende Pause ab (wenn aktiv)
    if (activeTime.onBreak && activeTime.segment.break_started_at) {
      const breakStart = new Date(activeTime.segment.break_started_at)
      const breakMinutes = differenceInMinutes(currentTime, breakStart)
      totalMinutes = Math.max(0, totalMinutes - breakMinutes)
    }

    // Ziehe bereits beendete Pausen ab (aus localStorage)
    const activeEntryStr = localStorage.getItem('activeTimeEntry')
    if (activeEntryStr) {
      try {
        const activeEntry = JSON.parse(activeEntryStr)
        if (activeEntry.breaks && Array.isArray(activeEntry.breaks)) {
          const completedBreakMinutes = activeEntry.breaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0)
          totalMinutes = Math.max(0, totalMinutes - completedBreakMinutes)
        }
      } catch (e) {
        console.error('Error parsing activeTimeEntry:', e)
      }
    }

    return Math.max(0, totalMinutes)
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
      // Verwende die Hook-Funktion
      await startBreak()

      // Lade Company Settings für Break-Timer Display
      let breakDuration = 15 // Fallback

      if (companySettings?.default_break_duration) {
        breakDuration = companySettings.default_break_duration
      } else {
        // Lade Settings direkt aus DB
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('company_id')
              .eq('id', user.id)
              .single()

            if (profile?.company_id) {
              const { data: settings } = await supabase
                .from('company_settings')
                .select('default_break_duration')
                .eq('company_id', profile.company_id)
                .single()

              if (settings?.default_break_duration) {
                breakDuration = settings.default_break_duration
                console.log('🟢 Loaded break duration from DB:', breakDuration)
              }
            }
          }
        } catch (dbError) {
          console.error('Error loading break duration:', dbError)
        }
      }

      const totalSeconds = breakDuration * 60 // Convert to seconds

      setBreakTimer({
        isActive: true,
        remainingSeconds: totalSeconds,
        totalSeconds: totalSeconds
      })

    } catch (error) {
      console.error('Break error:', error)
      toast.error('Fehler beim Starten der Pause')
    }
  }

  const handleEndBreak = async () => {
    try {
      // Beende Pause-Timer
      setBreakTimer({ isActive: false, remainingSeconds: 0, totalSeconds: 0 })

      // Verwende die Hook-Funktion
      await endBreak()

    } catch (error) {
      console.error('Error ending break:', error)
      toast.error('Fehler beim Beenden der Pause')
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
      <Card className={`scroll-snap-start min-h-[250px] ${breakTimer.isActive ? 'ring-2 ring-orange-500' : activeTime.active ? 'ring-2 ring-green-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className={`h-5 w-5 ${breakTimer.isActive ? 'text-orange-500' : activeTime.active ? 'text-green-500' : 'text-gray-400'}`} />
              {breakTimer.isActive ? 'Pause' : activeTime.active ? 'Läuft' : 'Zeiterfassung'}
            </CardTitle>
            {breakTimer.isActive && (
              <Badge variant="outline" className="bg-orange-50">
                Pause
              </Badge>
            )}
            {activeTime.active && activeTime.segment && !breakTimer.isActive && (
              <Badge variant="outline">
                {activeTime.segment.segment_type === 'work' ? 'Arbeit' :
                 activeTime.segment.segment_type === 'break' ? 'Pause' : 'Fahrt'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {breakTimer.isActive ? (
            <div className="space-y-4">
              {/* Pause Timer Display */}
              <div className="text-center bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-700 mb-2">Pause läuft</p>
                <div className="text-4xl font-mono font-bold text-orange-600 mb-2">
                  {formatTime(breakTimer.remainingSeconds)}
                </div>
                <p className="text-xs text-orange-700 mb-3">
                  Pausenzeit verbleibt
                </p>
                {/* Progress bar for break time */}
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: `${((breakTimer.totalSeconds - breakTimer.remainingSeconds) / breakTimer.totalSeconds) * 100}%`
                    }}
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleEndBreak}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  Pause beenden & Arbeit fortsetzen
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Die Zeiterfassung ist pausiert
              </p>
            </div>
          ) : activeTime.active && activeTime.segment ? (
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
                <div>Gestartet: {activeTime.segment.started_at ? format(new Date(activeTime.segment.started_at), 'HH:mm') : 'k.A.'}</div>
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
              {/* Projekt Info Card - BLAUE CARD nach Projektauswahl */}
              {selectedProject ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  {/* DEBUG INFO - Zeigt wichtige Projektdaten */}
                  <div className="text-xs bg-blue-100 p-3 rounded mb-2 border border-blue-300">
                    <div className="font-bold mb-2 text-blue-900">DEBUG: Geladene Projektdaten</div>
                    <div className="space-y-1 font-mono text-blue-800">
                      <div><span className="font-semibold">ID:</span> {selectedProject.id}</div>
                      <div><span className="font-semibold">Name:</span> {selectedProject.name}</div>
                      {selectedProject.location && (
                        <div><span className="font-semibold">Adresse:</span> {selectedProject.location}</div>
                      )}
                      {selectedProject.customer?.name && (
                        <div><span className="font-semibold">Kunde:</span> {selectedProject.customer.name}</div>
                      )}
                      {selectedProject.customer?.phone && (
                        <div><span className="font-semibold">Telefon:</span> {selectedProject.customer.phone}</div>
                      )}
                    </div>
                  </div>

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

                      {/* Kunde */}
                      {selectedProject?.customer?.name && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Kunde:</span> {selectedProject.customer.name}
                        </p>
                      )}

                      {/* Standort */}
                      {selectedProject?.location && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Standort:</span> {selectedProject.location}
                        </p>
                      )}

                      {/* Telefon */}
                      {selectedProject?.customer?.phone && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Telefon:</span>
                          <a href={`tel:${selectedProject.customer.phone}`} className="text-blue-600 ml-1">
                            {selectedProject.customer.phone}
                          </a>
                        </p>
                      )}

                      {/* Status */}
                      {selectedProject?.status && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Status:</span>
                          <span className="ml-1">
                            {selectedProject.status === 'active' ? 'Aktiv' :
                             selectedProject.status === 'in_bearbeitung' ? 'In Bearbeitung' :
                             selectedProject.status === 'geplant' ? 'Geplant' :
                             selectedProject.status === 'abgeschlossen' ? 'Abgeschlossen' :
                             selectedProject.status === 'completed' ? 'Abgeschlossen' :
                             selectedProject.status === 'planning' ? 'In Planung' :
                             selectedProject.status}
                          </span>
                        </p>
                      )}

                      {/* Zeitraum */}
                      {(selectedProject?.start_date || selectedProject?.end_date) && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Zeitraum:</span> {
                            `${selectedProject.start_date ? format(new Date(selectedProject.start_date), 'dd.MM.yyyy', { locale: de }) : 'k.A.'} -
                             ${selectedProject.end_date ? format(new Date(selectedProject.end_date), 'dd.MM.yyyy', { locale: de }) : 'k.A.'}`
                          }
                        </p>
                      )}

                      {/* Geplante Dauer */}
                      {selectedProject?.estimated_hours && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Geplante Dauer:</span> {selectedProject.estimated_hours} Stunden
                        </p>
                      )}

                      {/* Budget */}
                      {selectedProject?.budget && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Budget:</span> {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(selectedProject.budget)}
                        </p>
                      )}

                      {/* Team Mitglieder Anzahl */}
                      {selectedProject?.team_count && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Team:</span> {selectedProject.team_count} Mitarbeiter
                        </p>
                      )}
                    </div>

                    {/* Beschreibung */}
                    {selectedProject.description && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 font-medium mb-1">Beschreibung:</p>
                        <p className="text-sm text-gray-700">{selectedProject.description}</p>
                      </div>
                    )}

                    {/* Projekt wechseln Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowQuickSwitch(!showQuickSwitch)}
                      className="w-full mt-3"
                    >
                      Projekt wechseln
                    </Button>
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
        onProjectSelect={async (projectId, projectData) => {
          try {
            console.log('onProjectSelect called with:', projectId, projectData)

            // Use the passed projectData if available
            let project = projectData || null

            // Only fallback to searching if projectData wasn't passed
            if (!project) {
              // Wait for projects to be loaded (max 5 seconds)
              let waitCount = 0
              while ((!projects || !Array.isArray(projects) || projects.length === 0) && waitCount < 50) {
                await new Promise(resolve => setTimeout(resolve, 100))
                waitCount++
              }

              console.log('projects state after wait:', projects)
              console.log('projects length:', projects?.length)

              // Try to find project in our loaded projects
              try {
                if (projects && Array.isArray(projects) && projects.length > 0) {
                  project = projects.find(p => p && p.id === projectId)
                  console.log('Found project in list:', project)
                } else {
                  console.log('Projects still not ready after wait:', projects)
                }
              } catch (findError) {
                console.error('Error in projects.find:', findError)
              }
            }
            
            // If not found, try to load it directly from database
            if (!project) {
              try {
                const { data: dbProject, error } = await supabase
                  .from('projects')
                  .select('id, name, customer_id, location, status, start_date, end_date, description')
                  .eq('id', projectId)
                  .single()

                if (!error && dbProject) {
                  // Try to load customer info separately if needed
                  if (dbProject.customer_id) {
                    try {
                      const { data: customer } = await supabase
                        .from('customers')
                        .select('id, name, phone')
                        .eq('id', dbProject.customer_id)
                        .single()

                      if (customer) {
                        dbProject.customer = { name: customer.name, phone: customer.phone }
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
                console.log('📱 SELECTED PROJECT DATA:', project)
                console.log('📱 Customer data:', project.customer)
                console.log('📱 Location:', project.location)
                console.log('📱 Dates:', project.start_date, project.end_date)
                setSelectedProject(project)
                // Save to localStorage for persistence
                localStorage.setItem('selectedProject', JSON.stringify(project))
              } else {
                // No fallback - if project not found, show error
                console.error('Project not found:', projectId)
                toast.error('Projekt konnte nicht geladen werden')
                setSelectedProject(null)
                // Clear invalid data from localStorage
                localStorage.removeItem('selectedProject')
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