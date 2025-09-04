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
  const [isLoading, setIsLoading] = useState(false)
  const [segments, setSegments] = useState<TimeSegment[]>([])

  // Fallback function with error handling
  const fetchActiveTime = useCallback(async () => {
    try {
      setIsLoading(true)
      
      try {
        const { data, error } = await supabase.rpc('rpc_get_active_time_tracking')
        
        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          throw error
        }
        
        setActiveTime(data || { active: false })
      } catch (error: any) {
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('RPC function not found, using mock active time')
          // Mock active time for demo
          setActiveTime({ active: false })
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('Error fetching active time:', error)
      setActiveTime({ active: false })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch time segments with fallback
  const fetchTimeSegments = useCallback(async () => {
    try {
      try {
        const { data, error } = await supabase
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
          .limit(50)
        
        if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
          throw error
        }
        
        setSegments(data || [])
      } catch (error: any) {
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          console.warn('Time segments table not found, using mock data')
          // Mock time segments for demo
          setSegments([
            {
              id: 'mock-segment-1',
              employee_id: 'mock-employee-1',
              project_id: 'mock-project-1',
              started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              ended_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
              duration_minutes_computed: 60,
              segment_type: 'work',
              status: 'completed',
              description: 'Demo Arbeitszeit',
              notes: 'Test-Zeiterfassung',
              project: {
                id: 'mock-project-1',
                name: 'Beispiel Baustelle',
                customer: {
                  name: 'Max Mustermann GmbH'
                }
              }
            }
          ])
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('Error fetching time segments:', error)
      setSegments([])
    }
  }, [])

  // Start tracking with fallback
  const startTracking = useCallback(async (
    projectId: string, 
    segmentType: 'work' | 'break' | 'drive' = 'work', 
    description?: string
  ) => {
    try {
      setIsLoading(true)
      
      try {
        const { data, error } = await supabase.rpc('rpc_start_time_tracking', {
          p_project_id: projectId,
          p_segment_type: segmentType,
          p_description: description
        })
        
        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          throw error
        }
        
        toast.success('Zeiterfassung gestartet')
        await fetchActiveTime()
      } catch (error: any) {
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('RPC function not found, using mock time tracking')
          // Mock start tracking
          setActiveTime({
            active: true,
            segment: {
              id: `mock-${Date.now()}`,
              project_id: projectId,
              project_name: 'Demo Projekt',
              customer_name: 'Demo Kunde',
              segment_type: segmentType,
              started_at: new Date().toISOString(),
              current_duration_minutes: 0,
              description: description || null
            }
          })
          toast.success('Zeiterfassung gestartet (Demo-Modus)')
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('Error starting time tracking:', error)
      toast.error('Fehler beim Starten der Zeiterfassung')
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveTime])

  // Stop tracking with fallback
  const stopTracking = useCallback(async (notes?: string) => {
    try {
      setIsLoading(true)
      
      try {
        const { data, error } = await supabase.rpc('rpc_stop_time_tracking', {
          p_notes: notes
        })
        
        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          throw error
        }
        
        toast.success('Zeiterfassung beendet')
        setActiveTime({ active: false })
        await fetchTimeSegments()
      } catch (error: any) {
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('RPC function not found, using mock stop tracking')
          // Mock stop tracking
          setActiveTime({ active: false })
          toast.success('Zeiterfassung beendet (Demo-Modus)')
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('Error stopping time tracking:', error)
      toast.error('Fehler beim Beenden der Zeiterfassung')
    } finally {
      setIsLoading(false)
    }
  }, [fetchTimeSegments])

  // Switch project with fallback
  const switchProject = useCallback(async (
    projectId: string, 
    segmentType: 'work' | 'break' | 'drive' = 'work', 
    description?: string,
    notes?: string
  ) => {
    try {
      setIsLoading(true)
      
      try {
        const { data, error } = await supabase.rpc('rpc_switch_time_tracking', {
          p_project_id: projectId,
          p_segment_type: segmentType,
          p_description: description,
          p_notes: notes
        })
        
        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          throw error
        }
        
        toast.success('Projekt gewechselt')
        await fetchActiveTime()
      } catch (error: any) {
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('RPC function not found, using mock project switch')
          // Mock switch project
          setActiveTime({
            active: true,
            segment: {
              id: `mock-${Date.now()}`,
              project_id: projectId,
              project_name: 'Neues Demo Projekt',
              customer_name: 'Demo Kunde',
              segment_type: segmentType,
              started_at: new Date().toISOString(),
              current_duration_minutes: 0,
              description: description || null
            }
          })
          toast.success('Projekt gewechselt (Demo-Modus)')
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('Error switching project:', error)
      toast.error('Fehler beim Projektwechsel')
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveTime])

  // Initialize data
  useEffect(() => {
    fetchActiveTime()
    fetchTimeSegments()
  }, [fetchActiveTime, fetchTimeSegments])

  return {
    activeTime,
    isLoading,
    segments,
    fetchActiveTime,
    fetchTimeSegments,
    startTracking,
    stopTracking,
    switchProject
  }
}