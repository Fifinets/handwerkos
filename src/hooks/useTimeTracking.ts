import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { isAndroid, useAndroidTimeTracking } from '@/utils/androidPlugins'

// Verwende timesheets Tabelle für Kompatibilität mit Manager Dashboard
interface TimeEntry {
  id: string
  employee_id: string
  project_id: string | null
  date: string  // DATE field
  start_time: string  // TIME field
  end_time: string | null  // TIME field
  hours: number
  break_minutes?: number
  description: string | null
  is_billable: boolean
  task_category?: string
}

interface ActiveTimeStatus {
  active: boolean
  onBreak?: boolean
  segment?: {
    id: string
    project_id: string | null
    project_name: string | null
    customer_name: string | null
    segment_type: string
    started_at: string
    current_duration_minutes: number
    description: string | null
    break_started_at?: string
    break_duration_minutes?: number
  }
}

// Hilfsfunktionen für Zeit-Konvertierung
const getTimeFromDate = (date: Date): string => {
  // Format: HH:MM:SS
  return date.toTimeString().split(' ')[0]
}

const getDateFromDate = (date: Date): string => {
  // Format: YYYY-MM-DD
  return date.toISOString().split('T')[0]
}

const calculateHours = (startTime: string, endTime: string): number => {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)

  const totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes)
  return Math.round((totalMinutes / 60) * 100) / 100 // Round to 2 decimal places
}

export const useTimeTracking = () => {
  const [activeTime, setActiveTime] = useState<ActiveTimeStatus>({ active: false, onBreak: false })
  const [isLoading, setIsLoading] = useState(false)
  const [segments, setSegments] = useState<TimeEntry[]>([])
  const [activeEntryData, setActiveEntryData] = useState<any>(null)

  // Get Android-specific hooks if on Android platform
  const androidTimeTracking = isAndroid() ? useAndroidTimeTracking() : null

  // Fetch active time entry from localStorage (temporary storage for active entries)
  const fetchActiveTime = useCallback(async () => {
    try {
      setIsLoading(true)

      // Check localStorage for active entry (since timesheets table doesn't support "active" status)
      const activeEntry = localStorage.getItem('activeTimeEntry')
      const activeBreak = localStorage.getItem('activeBreak')

      if (activeEntry) {
        const entry = JSON.parse(activeEntry)
        const startTime = new Date(entry.startedAt)
        const now = new Date()
        let durationMinutes = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60)

        // Check if currently on break
        let onBreak = false
        let breakDurationMinutes = 0
        let breakStartedAt = null

        if (activeBreak) {
          const breakData = JSON.parse(activeBreak)
          breakStartedAt = breakData.startedAt
          const breakStart = new Date(breakStartedAt)
          breakDurationMinutes = Math.floor((now.getTime() - breakStart.getTime()) / 1000 / 60)
          onBreak = true

          // Subtract break time from work duration
          durationMinutes = Math.max(0, durationMinutes - breakDurationMinutes)
        }

        setActiveTime({
          active: true,
          onBreak,
          segment: {
            id: entry.id,
            project_id: entry.project_id,
            project_name: entry.project_name || null,
            customer_name: entry.customer_name || null,
            segment_type: 'work',
            started_at: entry.startedAt,
            current_duration_minutes: durationMinutes,
            description: entry.description,
            break_started_at: breakStartedAt,
            break_duration_minutes: breakDurationMinutes
          }
        })
        setActiveEntryData(entry)
      } else {
        setActiveTime({ active: false, onBreak: false })
        setActiveEntryData(null)
      }

    } catch (error: any) {
      console.error('Error in fetchActiveTime:', error)
      setActiveTime({ active: false })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Start time tracking
  const startTracking = useCallback(async (
    projectId: string | null,
    segmentType: 'work' | 'break' | 'drive' = 'work',
    description?: string
  ) => {
    try {
      setIsLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Nicht angemeldet')
        return
      }

      const now = new Date()

      // Store active entry in localStorage
      const activeEntry = {
        id: crypto.randomUUID(),
        employee_id: user.id,
        project_id: projectId,
        project_name: null, // Will be fetched if needed
        startedAt: now.toISOString(),
        date: getDateFromDate(now),
        start_time: getTimeFromDate(now),
        description: description || null,
        segment_type: segmentType
      }

      // Get project name if projectId exists
      if (projectId) {
        const { data: project } = await supabase
          .from('projects')
          .select('name, customers(name)')
          .eq('id', projectId)
          .single()

        if (project) {
          activeEntry.project_name = project.name
        }
      }

      localStorage.setItem('activeTimeEntry', JSON.stringify(activeEntry))

      toast.success('Zeiterfassung gestartet')
      await fetchActiveTime()

    } catch (error: any) {
      console.error('Error starting time tracking:', error)
      toast.error('Fehler beim Starten der Zeiterfassung')
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveTime])

  // Fetch recent time segments
  const fetchTimeSegments = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Try to get employee_id first
      let employeeId = user.id
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (employees) {
        employeeId = employees.id
      }

      const { data, error } = await supabase
        .from('timesheets')
        .select(`
          *,
          projects(id, name, customers(name))
        `)
        .eq('employee_id', employeeId)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(20)

      if (error && error.message && !error.message.includes('relation')) {
        console.error('Error fetching time segments:', error)

        // Try with user.id if employee_id fails
        const { data: fallbackData } = await supabase
          .from('timesheets')
          .select(`
            *,
            projects(id, name, customers(name))
          `)
          .eq('employee_id', user.id)
          .order('date', { ascending: false })
          .order('start_time', { ascending: false })
          .limit(20)

        setSegments(fallbackData || [])
        return
      }

      setSegments(data || [])
    } catch (error) {
      console.error('Error in fetchTimeSegments:', error)
    }
  }, [])

  // Stop time tracking and save to timesheets
  const stopTracking = useCallback(async (notes?: string) => {
    try {
      setIsLoading(true)

      const activeEntryStr = localStorage.getItem('activeTimeEntry')
      if (!activeEntryStr) {
        console.log('No active time entry found in localStorage')
        // Clear the active state anyway
        setActiveTime({
          active: false,
          onBreak: false,
          segment: null
        })
        setActiveEntryData(null)
        toast.success('Zeiterfassung beendet')
        return
      }

      const activeEntry = JSON.parse(activeEntryStr)
      const now = new Date()
      const endTime = getTimeFromDate(now)

      // Calculate hours
      const hours = calculateHours(activeEntry.start_time, endTime)

      // Calculate break minutes - check for manual breaks first
      let breakMinutes = 0
      let hasManualBreaks = false

      // Check if there were any manual breaks during this work session
      if (activeEntry.breaks && Array.isArray(activeEntry.breaks)) {
        for (const manualBreak of activeEntry.breaks) {
          breakMinutes += manualBreak.durationMinutes || 0

          // Check if manual break was during lunch time (11:00-13:00)
          const breakStart = new Date(manualBreak.startedAt)
          const breakHour = breakStart.getHours()
          if (breakHour >= 11 && breakHour <= 13) {
            hasManualBreaks = true
          }
        }
        console.log(`Manual breaks found: ${activeEntry.breaks.length}, total: ${breakMinutes} minutes, lunch time break: ${hasManualBreaks}`)
      }

      // Only add automatic lunch break if no manual break during lunch time
      if (!hasManualBreaks) {
        try {
          // First get the user's company_id from profiles
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('company_id')
              .eq('id', user.id)
              .single()

            if (profile?.company_id) {
              // Get company settings
              const { data: companySettings } = await supabase
                .from('company_settings')
                .select('default_break_duration, default_break_start_time')
                .eq('company_id', profile.company_id)
                .single()

              // Use company settings or defaults
              const breakDuration = companySettings?.default_break_duration || 30
              const breakStartTime = companySettings?.default_break_start_time || '12:00'

              // Parse break start time
              const [breakHour, breakMinute] = breakStartTime.split(':').map(Number)
              const [startHour, startMinute] = activeEntry.start_time.split(':').map(Number)
              const [endHour, endMinute] = endTime.split(':').map(Number)

              // Calculate break end time (break start + duration)
              let breakEndHour = breakHour
              let breakEndMinute = breakMinute + breakDuration
              if (breakEndMinute >= 60) {
                breakEndHour += Math.floor(breakEndMinute / 60)
                breakEndMinute = breakEndMinute % 60
              }

              // Check if work period overlaps with break period
              const startBeforeBreak = startHour < breakHour || (startHour === breakHour && startMinute < breakMinute)
              const endAfterBreakEnd = endHour > breakEndHour || (endHour === breakEndHour && endMinute >= breakEndMinute)

              if (startBeforeBreak && endAfterBreakEnd) {
                breakMinutes += breakDuration
                console.log(`Automatische Mittagspause (${breakDuration} Min) hinzugefügt - keine manuelle Pause erkannt`)
              }
            }
          }
        } catch (error) {
          console.error('Error fetching company settings:', error)
          // Fallback to default 30 min break at 12:00
          const [startHour] = activeEntry.start_time.split(':').map(Number)
          const [endHour, endMinute] = endTime.split(':').map(Number)

          if (startHour < 12 && (endHour > 12 || (endHour === 12 && endMinute >= 30))) {
            breakMinutes += 30
            console.log('Automatische Mittagspause (30 Min) hinzugefügt (Fallback) - keine manuelle Pause erkannt')
          }
        }
      } else {
        console.log('Keine automatische Mittagspause - manuelle Pause bereits vorhanden')
      }

      // Adjust hours for break time
      const adjustedHours = Math.max(0, hours - (breakMinutes / 60))

      // Get current user (to get employee_id)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Nicht angemeldet')
        return
      }

      // Get employee record
      let employeeId = user.id
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (employees) {
        employeeId = employees.id
      }

      // Save to timesheets table
      const { data, error } = await supabase
        .from('timesheets')
        .insert({
          employee_id: employeeId,
          project_id: activeEntry.project_id,
          date: activeEntry.date,
          start_time: activeEntry.start_time,
          end_time: endTime,
          hours: adjustedHours,
          break_minutes: breakMinutes,
          description: notes ?
            (activeEntry.description ?
              `${activeEntry.description}\n${notes}` : notes)
            : activeEntry.description,
          task_category: 'general',
          is_billable: true
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving timesheet:', error)
        // Try without employee_id constraint
        if (error.message && error.message.includes('employees')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('timesheets')
            .insert({
              employee_id: user.id, // Use user.id directly
              project_id: activeEntry.project_id,
              date: activeEntry.date,
              start_time: activeEntry.start_time,
              end_time: endTime,
              hours: adjustedHours,
              break_minutes: breakMinutes,
              description: notes ?
                (activeEntry.description ?
                  `${activeEntry.description}\n${notes}` : notes)
                : activeEntry.description,
              task_category: 'general',
              is_billable: true
            })
            .select()
            .single()

          if (fallbackError) throw fallbackError
        } else {
          throw error
        }
      }

      // Clear active entry
      localStorage.removeItem('activeTimeEntry')
      localStorage.removeItem('activeBreak')

      console.log('🛑 HOOK: stopTracking - Clearing localStorage and updating state')

      // Show appropriate success message
      if (breakMinutes > 0) {
        toast.success(`Zeiterfassung beendet und gespeichert (${breakMinutes} Min Mittagspause automatisch abgezogen)`)
      } else {
        toast.success('Zeiterfassung beendet und gespeichert')
      }

      // Reset activeTime state completely
      setActiveTime({
        active: false,
        onBreak: false,
        segment: null
      })
      setActiveEntryData(null)

      console.log('🛑 HOOK: stopTracking - State updated to inactive')

      // Refresh segments
      await fetchTimeSegments()

    } catch (error: any) {
      console.error('Error stopping time tracking:', error)
      toast.error('Fehler beim Beenden der Zeiterfassung')
    } finally {
      setIsLoading(false)
    }
  }, [fetchTimeSegments])

  // Switch project
  const switchProject = useCallback(async (
    newProjectId: string,
    segmentType: 'work' | 'break' | 'drive' = 'work',
    description?: string,
    notes?: string
  ) => {
    try {
      setIsLoading(true)

      // Stop current tracking
      if (activeTime.active) {
        await stopTracking(notes)
      }

      // Start new tracking
      await startTracking(newProjectId, segmentType, description)

    } catch (error: any) {
      console.error('Error switching project:', error)
      toast.error('Fehler beim Projektwechsel')
    } finally {
      setIsLoading(false)
    }
  }, [activeTime, stopTracking, startTracking])

  // Start break
  const startBreak = useCallback(async () => {
    try {
      setIsLoading(true)

      if (!activeTime.active || activeTime.onBreak) {
        toast.error('Keine aktive Zeiterfassung oder bereits in Pause')
        return
      }

      const now = new Date()
      const breakData = {
        id: crypto.randomUUID(),
        startedAt: now.toISOString(),
        type: 'manual'
      }

      localStorage.setItem('activeBreak', JSON.stringify(breakData))
      toast.success('⏸️ Pause gestartet')
      await fetchActiveTime()

    } catch (error: any) {
      console.error('Error starting break:', error)
      toast.error('Fehler beim Starten der Pause')
    } finally {
      setIsLoading(false)
    }
  }, [activeTime, fetchActiveTime])

  // End break
  const endBreak = useCallback(async () => {
    try {
      setIsLoading(true)

      if (!activeTime.active || !activeTime.onBreak) {
        toast.error('Keine aktive Pause')
        return
      }

      const activeBreak = localStorage.getItem('activeBreak')
      if (!activeBreak) {
        toast.error('Keine aktive Pause gefunden')
        return
      }

      const breakData = JSON.parse(activeBreak)
      const now = new Date()
      const breakStart = new Date(breakData.startedAt)
      const breakMinutes = Math.floor((now.getTime() - breakStart.getTime()) / 1000 / 60)

      // Store break information in activeTimeEntry for later use
      const activeEntry = localStorage.getItem('activeTimeEntry')
      if (activeEntry) {
        const entry = JSON.parse(activeEntry)
        if (!entry.breaks) entry.breaks = []
        entry.breaks.push({
          type: breakData.type || 'manual',
          startedAt: breakData.startedAt,
          endedAt: now.toISOString(),
          durationMinutes: breakMinutes
        })
        localStorage.setItem('activeTimeEntry', JSON.stringify(entry))
      }

      localStorage.removeItem('activeBreak')
      toast.success(`▶️ Pause beendet (${breakMinutes} Min)`)
      await fetchActiveTime()

    } catch (error: any) {
      console.error('Error ending break:', error)
      toast.error('Fehler beim Beenden der Pause')
    } finally {
      setIsLoading(false)
    }
  }, [activeTime, fetchActiveTime])

  // Auto-refresh active time
  useEffect(() => {
    fetchActiveTime()
    fetchTimeSegments()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (activeTime.active) {
        fetchActiveTime()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, []) // Remove dependencies to avoid re-creating interval

  return {
    activeTime,
    isLoading,
    segments,
    startTracking,
    stopTracking,
    switchProject,
    startBreak,
    endBreak,
    fetchActiveTime,
    fetchTimeSegments
  }
}