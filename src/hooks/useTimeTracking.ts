import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface TimeSegment {
  id: string
  employee_id: string
  project_id: string | null
  started_at: string
  ended_at: string | null
  duration_minutes_computed: number | null
  segment_type: 'work' | 'break' | 'drive'
  status: 'active' | 'completed' | 'paused'
  description: string | null
  notes: string | null
  project?: {
    id: string
    name: string
    customer?: {
      name: string
    }
  }
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

export const useTimeTracking = () => {
  const [activeTime, setActiveTime] = useState<ActiveTimeStatus>({ active: false })
  const [isLoading, setIsLoading] = useState(true)
  const [segments, setSegments] = useState<TimeSegment[]>([])

  // Aktuelle Zeiterfassung abrufen
  const fetchActiveTime = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('rpc_get_active_time_tracking')
      
      if (error) throw error
      
      setActiveTime(data)
    } catch (error: any) {
      console.error('Error fetching active time:', error)
      if (error.code !== 'PGRST301') { // Ignore "No rows returned" error
        toast.error('Fehler beim Laden der aktiven Zeiterfassung')
      }
    }
  }, [])

  // Zeiterfassung starten
  const startTracking = useCallback(async (
    projectId: string | null,
    segmentType: 'work' | 'break' | 'drive' = 'work',
    description?: string
  ) => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase.rpc('rpc_start_time_tracking', {
        p_project_id: projectId,
        p_segment_type: segmentType,
        p_description: description
      })
      
      if (error) throw error
      
      if (data.action === 'already_active') {
        toast.info('Zeiterfassung läuft bereits für dieses Projekt')
      } else {
        toast.success(
          data.previous_segment_id 
            ? 'Zeiterfassung gewechselt und gestartet' 
            : 'Zeiterfassung gestartet'
        )
      }
      
      await fetchActiveTime()
      return data
      
    } catch (error: any) {
      console.error('Error starting time tracking:', error)
      toast.error(error.message || 'Fehler beim Starten der Zeiterfassung')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveTime])

  // Zeiterfassung stoppen
  const stopTracking = useCallback(async (notes?: string) => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase.rpc('rpc_stop_time_tracking', {
        p_notes: notes
      })
      
      if (error) throw error
      
      if (data.action === 'nothing_to_stop') {
        toast.info('Keine aktive Zeiterfassung vorhanden')
      } else {
        const duration = Math.round(data.duration_minutes || 0)
        toast.success(`Zeiterfassung gestoppt (${duration} Minuten)`)
      }
      
      await fetchActiveTime()
      return data
      
    } catch (error: any) {
      console.error('Error stopping time tracking:', error)
      toast.error(error.message || 'Fehler beim Stoppen der Zeiterfassung')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveTime])

  // Zu anderem Projekt wechseln
  const switchProject = useCallback(async (
    newProjectId: string | null,
    segmentType: 'work' | 'break' | 'drive' = 'work',
    description?: string,
    notesForPrevious?: string
  ) => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase.rpc('rpc_switch_time_tracking', {
        p_new_project_id: newProjectId,
        p_segment_type: segmentType,
        p_description: description,
        p_notes_for_previous: notesForPrevious
      })
      
      if (error) throw error
      
      toast.success('Projekt gewechselt')
      await fetchActiveTime()
      return data
      
    } catch (error: any) {
      console.error('Error switching project:', error)
      toast.error(error.message || 'Fehler beim Projektwechsel')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveTime])

  // Zeitübersicht für Periode abrufen
  const getTimeSummary = useCallback(async (
    startDate: string,
    endDate: string,
    employeeId?: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('rpc_get_time_summary', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_employee_id: employeeId
      })
      
      if (error) throw error
      return data
      
    } catch (error: any) {
      console.error('Error fetching time summary:', error)
      toast.error('Fehler beim Laden der Zeitübersicht')
      throw error
    }
  }, [])

  // Zeitsegmente laden
  const fetchTimeSegments = useCallback(async (
    startDate?: string,
    endDate?: string,
    limit: number = 50
  ) => {
    try {
      let query = supabase
        .from('time_segments')
        .select(`
          *,
          project:projects(
            id,
            name,
            customer:customers(name)
          )
        `)
        .order('started_at', { ascending: false })
        .limit(limit)

      if (startDate) {
        query = query.gte('started_at', startDate)
      }
      if (endDate) {
        query = query.lte('started_at', endDate)
      }

      const { data, error } = await query

      if (error) throw error
      
      setSegments(data || [])
      return data
      
    } catch (error: any) {
      console.error('Error fetching time segments:', error)
      toast.error('Fehler beim Laden der Zeitsegmente')
      throw error
    }
  }, [])

  // Real-time Updates für aktive Zeiterfassung
  useEffect(() => {
    const channel = supabase
      .channel('time_segments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_segments',
          filter: 'status=eq.active'
        },
        () => {
          fetchActiveTime()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchActiveTime])

  // Initial load
  useEffect(() => {
    fetchActiveTime().finally(() => setIsLoading(false))
  }, [fetchActiveTime])

  // Laufzeiten-Updates (alle 30 Sekunden)
  useEffect(() => {
    if (!activeTime.active) return

    const interval = setInterval(() => {
      fetchActiveTime()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [activeTime.active, fetchActiveTime])

  return {
    // State
    activeTime,
    isLoading,
    segments,
    
    // Actions
    startTracking,
    stopTracking,
    switchProject,
    
    // Data fetching
    fetchActiveTime,
    fetchTimeSegments,
    getTimeSummary,
    
    // Utils
    isTracking: activeTime.active,
    currentDuration: activeTime.segment?.current_duration_minutes || 0
  }
}