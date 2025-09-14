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
  segment?: {
    id: string
    project_id: string | null
    project_name: string | null
    customer_name: string | null
    segment_type: string
    started_at: string
    current_duration_minutes: number
    description: string | null
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
  const [activeTime, setActiveTime] = useState<ActiveTimeStatus>({ active: false })
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
      if (activeEntry) {
        const entry = JSON.parse(activeEntry)
        const startTime = new Date(entry.startedAt)
        const now = new Date()
        const durationMinutes = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60)

        setActiveTime({
          active: true,
          segment: {
            id: entry.id,
            project_id: entry.project_id,
            project_name: entry.project_name || null,
            customer_name: entry.customer_name || null,
            segment_type: 'work',
            started_at: entry.startedAt,
            current_duration_minutes: durationMinutes,
            description: entry.description
          }
        })
        setActiveEntryData(entry)
      } else {
        setActiveTime({ active: false })
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

  // Stop time tracking and save to timesheets
  const stopTracking = useCallback(async (notes?: string) => {
    try {
      setIsLoading(true)

      const activeEntryStr = localStorage.getItem('activeTimeEntry')
      if (!activeEntryStr) {
        toast.error('Keine aktive Zeiterfassung')
        return
      }

      const activeEntry = JSON.parse(activeEntryStr)
      const now = new Date()
      const endTime = getTimeFromDate(now)

      // Calculate hours
      const hours = calculateHours(activeEntry.start_time, endTime)

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
          hours: hours,
          break_minutes: 0,
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
        if (error.message.includes('employees')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('timesheets')
            .insert({
              employee_id: user.id, // Use user.id directly
              project_id: activeEntry.project_id,
              date: activeEntry.date,
              start_time: activeEntry.start_time,
              end_time: endTime,
              hours: hours,
              break_minutes: 0,
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

      toast.success('Zeiterfassung beendet und gespeichert')
      setActiveTime({ active: false })
      setActiveEntryData(null)

      // Refresh segments
      await fetchTimeSegments()

    } catch (error: any) {
      console.error('Error stopping time tracking:', error)
      toast.error(`Fehler beim Beenden: ${error.message}`)
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

      if (error && !error.message.includes('relation')) {
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
    fetchActiveTime,
    fetchTimeSegments
  }
}