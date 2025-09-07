import { useState, useEffect, useCallback } from 'react'
import { toast } from "sonner"
import { androidTimeTracking } from '@/utils/androidPlugins'
import { Capacitor } from '@capacitor/core'

export interface TimeSegment {
  id: string
  employee_id: string
  project_id: string
  started_at: string
  ended_at?: string
  duration_minutes_computed?: number
  segment_type: 'work' | 'break' | 'drive'
  status: 'active' | 'completed' | 'cancelled'
  description?: string
  notes?: string
  location?: { lat: number; lng: number; address: string }
  project?: {
    id: string
    name: string
    customer?: {
      name: string
    }
  }
}

export interface ActiveTimeData {
  active: boolean
  projectId?: string
  projectName?: string
  segmentType?: 'work' | 'break' | 'drive'
  startTime?: string
  duration?: number
  description?: string
}

// Mobile-optimized time tracking hook using only native Android functionality
export const useMobileTimeTracking = () => {
  const [activeTime, setActiveTime] = useState<ActiveTimeData>({ active: false })
  const [segments, setSegments] = useState<TimeSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const isNative = Capacitor.isNativePlatform()

  // Fetch active time tracking from native plugin
  const fetchActiveTime = useCallback(async () => {
    if (!isNative) {
      console.log('Not on native platform, using mock data')
      setActiveTime({ active: false })
      return
    }

    try {
      setIsLoading(true)
      const result = await androidTimeTracking.getActiveTimeTracking()
      
      if (result?.active && result?.session) {
        setActiveTime({
          active: true,
          projectId: result.session.projectId,
          projectName: result.session.projectName,
          segmentType: 'work',
          startTime: new Date(result.session.startTime).toISOString(),
          duration: result.session.durationMinutes,
          description: result.session.description
        })
      } else {
        setActiveTime({ active: false })
      }
    } catch (error) {
      console.warn('Native time tracking check failed:', error)
      setActiveTime({ active: false })
    } finally {
      setIsLoading(false)
    }
  }, [isNative])

  // Load stored time segments from local storage
  const fetchTimeSegments = useCallback(async () => {
    try {
      // For mobile, use local storage for now
      const storedSegments = localStorage.getItem('timeSegments')
      if (storedSegments) {
        const segments = JSON.parse(storedSegments) as TimeSegment[]
        // Sort by started_at descending
        segments.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        setSegments(segments.slice(0, 50)) // Last 50 entries
      } else {
        // Initialize with demo data
        setSegments([
          {
            id: 'demo-1',
            employee_id: 'user-1',
            project_id: 'project-1',
            started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            ended_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            duration_minutes_computed: 60,
            segment_type: 'work',
            status: 'completed',
            description: 'Installation Elektrik',
            project: {
              id: 'project-1',
              name: 'Baustelle Nord',
              customer: {
                name: 'Mustermann GmbH'
              }
            }
          }
        ])
      }
    } catch (error) {
      console.error('Error loading time segments:', error)
      setSegments([])
    }
  }, [])

  // Start time tracking using native plugin
  const startTracking = useCallback(async (
    projectId: string,
    segmentType: 'work' | 'break' | 'drive' = 'work',
    description?: string,
    projectName?: string
  ) => {
    if (!isNative) {
      toast.error('Zeiterfassung nur auf mobilen Geräten verfügbar')
      return false
    }

    try {
      setIsLoading(true)
      
      const result = await androidTimeTracking.startTimeTracking(
        projectId,
        projectName || 'Unbenanntes Projekt',
        description || ''
      )
      
      if (result?.success) {
        toast.success('Zeiterfassung gestartet')
        
        // Update active time
        setActiveTime({
          active: true,
          projectId,
          projectName,
          segmentType,
          startTime: new Date(result.startTime).toISOString(),
          duration: 0,
          description
        })
        
        // Create new segment
        const newSegment: TimeSegment = {
          id: `mobile-${Date.now()}`,
          employee_id: 'current-user',
          project_id: projectId,
          started_at: new Date(result.startTime).toISOString(),
          segment_type: segmentType,
          status: 'active',
          description,
          project: {
            id: projectId,
            name: projectName || 'Unbenanntes Projekt'
          }
        }
        
        // Add to segments and save to local storage
        const updatedSegments = [newSegment, ...segments]
        setSegments(updatedSegments)
        localStorage.setItem('timeSegments', JSON.stringify(updatedSegments))
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error starting time tracking:', error)
      toast.error('Fehler beim Starten der Zeiterfassung')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isNative, segments])

  // Stop time tracking using native plugin
  const stopTracking = useCallback(async (notes?: string) => {
    if (!isNative) {
      toast.error('Zeiterfassung nur auf mobilen Geräten verfügbar')
      return false
    }

    try {
      setIsLoading(true)
      
      const result = await androidTimeTracking.stopTimeTracking(notes || '')
      
      if (result?.success) {
        toast.success('Zeiterfassung beendet')
        
        // Update the active segment to completed
        const updatedSegments = segments.map(seg => {
          if (seg.status === 'active') {
            return {
              ...seg,
              ended_at: new Date(result.endTime).toISOString(),
              duration_minutes_computed: result.durationMinutes,
              status: 'completed' as const,
              notes
            }
          }
          return seg
        })
        
        setSegments(updatedSegments)
        localStorage.setItem('timeSegments', JSON.stringify(updatedSegments))
        
        // Clear active time
        setActiveTime({ active: false })
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error stopping time tracking:', error)
      toast.error('Fehler beim Beenden der Zeiterfassung')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isNative, segments])

  // Pause time tracking
  const pauseTracking = useCallback(async () => {
    if (!isNative) {
      toast.error('Zeiterfassung nur auf mobilen Geräten verfügbar')
      return false
    }

    try {
      // For now, pause is treated as stop
      // In the future, implement proper pause/resume
      await androidTimeTracking.pauseTimeTracking()
      toast.info('Zeiterfassung pausiert')
      return true
    } catch (error) {
      console.error('Error pausing time tracking:', error)
      toast.error('Fehler beim Pausieren')
      return false
    }
  }, [isNative])

  // Load data on mount - nur beim ersten Mount
  useEffect(() => {
    fetchActiveTime()
    fetchTimeSegments()
    
    // Set up interval to refresh active time
    const interval = setInterval(() => {
      fetchActiveTime()
    }, 30000) // Every 30 seconds
    
    return () => clearInterval(interval)
  }, []) // Leere Abhängigkeiten = nur beim Mount

  return {
    activeTime,
    segments,
    isLoading,
    startTracking,
    stopTracking,
    pauseTracking,
    refreshData: () => {
      fetchActiveTime()
      fetchTimeSegments()
    }
  }
}