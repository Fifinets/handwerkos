/**
 * Attendance Controls Component
 * Provides clock-in/out buttons and current shift display
 * Only visible when dual time tracking feature flag is enabled
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, LogIn, LogOut, Coffee } from 'lucide-react'
import { AttendanceService } from '@/services/attendanceService'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { differenceInMinutes, format } from 'date-fns'
import { de } from 'date-fns/locale'

interface AttendanceControlsProps {
  employeeId: string
  onStatusChange?: () => void
}

export const AttendanceControls: React.FC<AttendanceControlsProps> = ({
  employeeId,
  onStatusChange
}) => {
  const [currentAttendance, setCurrentAttendance] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isOnBreak, setIsOnBreak] = useState(false)

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Load current attendance
  const loadCurrentAttendance = async () => {
    try {
      const attendance = await AttendanceService.getCurrentAttendance(employeeId)
      setCurrentAttendance(attendance)

      // Check if on break
      if (attendance?.breaks && Array.isArray(attendance.breaks)) {
        const activeBreak = attendance.breaks.find((b: any) => !b.ended_at)
        setIsOnBreak(!!activeBreak)
      }

      onStatusChange?.()
    } catch (error) {
      console.error('Error loading attendance:', error)
    }
  }

  useEffect(() => {
    loadCurrentAttendance()

    // Refresh every 30 seconds
    const interval = setInterval(loadCurrentAttendance, 30000)
    return () => clearInterval(interval)
  }, [employeeId])

  // Clock In
  const handleClockIn = async () => {
    try {
      setIsLoading(true)

      // Get location if available
      let location: { lat: number; lng: number; accuracy?: number } | undefined

      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 0
            })
          })

          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        } catch (geoError) {
          console.warn('Could not get location:', geoError)
          // Continue without location
        }
      }

      await AttendanceService.clockIn({
        employeeId,
        location
      })

      toast.success('Schicht gestartet')
      await loadCurrentAttendance()
    } catch (error: any) {
      console.error('Clock in error:', error)
      toast.error(error.message || 'Fehler beim Stempeln')
    } finally {
      setIsLoading(false)
    }
  }

  // Clock Out
  const handleClockOut = async () => {
    try {
      if (!currentAttendance) return

      setIsLoading(true)

      // Get location if available
      let location: { lat: number; lng: number; accuracy?: number } | undefined

      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 0
            })
          })

          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        } catch (geoError) {
          console.warn('Could not get location:', geoError)
        }
      }

      await AttendanceService.clockOut({
        attendanceId: currentAttendance.id,
        location
      })

      toast.success('Schicht beendet')
      await loadCurrentAttendance()
    } catch (error: any) {
      console.error('Clock out error:', error)
      toast.error(error.message || 'Fehler beim Ausstempeln')
    } finally {
      setIsLoading(false)
    }
  }

  // Start Break
  const handleStartBreak = async () => {
    try {
      if (!currentAttendance) return

      setIsLoading(true)
      await AttendanceService.startBreak(currentAttendance.id)
      toast.success('Pause gestartet')
      await loadCurrentAttendance()
    } catch (error: any) {
      console.error('Start break error:', error)
      toast.error(error.message || 'Fehler beim Starten der Pause')
    } finally {
      setIsLoading(false)
    }
  }

  // End Break
  const handleEndBreak = async () => {
    try {
      if (!currentAttendance) return

      setIsLoading(true)
      await AttendanceService.endBreak(currentAttendance.id)
      toast.success('Pause beendet')
      await loadCurrentAttendance()
    } catch (error: any) {
      console.error('End break error:', error)
      toast.error(error.message || 'Fehler beim Beenden der Pause')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate current work duration
  const getCurrentWorkMinutes = () => {
    if (!currentAttendance || !currentAttendance.clock_in) return 0

    const clockIn = new Date(currentAttendance.clock_in)
    let totalMinutes = differenceInMinutes(currentTime, clockIn)

    // Subtract break minutes
    const breakMinutes = currentAttendance.break_minutes || 0
    totalMinutes -= breakMinutes

    // Subtract current break if active
    if (isOnBreak && currentAttendance.breaks) {
      const activeBreak = currentAttendance.breaks.find((b: any) => !b.ended_at)
      if (activeBreak) {
        const breakStart = new Date(activeBreak.started_at)
        const currentBreakMinutes = differenceInMinutes(currentTime, breakStart)
        totalMinutes -= currentBreakMinutes
      }
    }

    return Math.max(0, totalMinutes)
  }

  // Format minutes to HH:MM
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}h`
  }

  // Not clocked in
  if (!currentAttendance) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Arbeitszeit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nicht eingestempelt
          </p>
          <Button
            onClick={handleClockIn}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Schicht starten
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Clocked in
  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-600" />
            Arbeitszeit
          </CardTitle>
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Aktiv
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current duration */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-green-700">
            {formatDuration(getCurrentWorkMinutes())}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestartet: {format(new Date(currentAttendance.clock_in), 'HH:mm', { locale: de })}
          </p>
        </div>

        {/* Break info */}
        {currentAttendance.break_minutes > 0 && (
          <div className="text-xs text-center text-muted-foreground">
            Pause: {currentAttendance.break_minutes} Min
          </div>
        )}

        {/* Current break indicator */}
        {isOnBreak && (
          <div className="bg-orange-100 border border-orange-200 rounded-lg p-2 text-center">
            <p className="text-sm font-medium text-orange-800">
              ⏸️ In Pause
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isOnBreak && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartBreak}
              disabled={isLoading}
              className="flex-1"
            >
              <Coffee className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}

          {isOnBreak && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndBreak}
              disabled={isLoading}
              className="flex-1 border-orange-300"
            >
              ▶️ Pause beenden
            </Button>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={handleClockOut}
            disabled={isLoading}
            className="flex-1"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Schicht beenden
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
