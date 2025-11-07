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

        // Subtract all completed breaks from work duration
        let totalCompletedBreakMinutes = 0
        if (entry.breaks && Array.isArray(entry.breaks)) {
          totalCompletedBreakMinutes = entry.breaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0)
        }

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
        }

        // Subtract both completed breaks and current break from work duration
        durationMinutes = Math.max(0, durationMinutes - totalCompletedBreakMinutes - breakDurationMinutes)

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
    console.log('🛑🛑🛑 stopTracking START')

    // ALWAYS clear state first to prevent stuck state
    const clearState = () => {
      console.log('🧹 Clearing state...')
      localStorage.removeItem('activeTimeEntry')
      localStorage.removeItem('activeBreak')
      setActiveTime({
        active: false,
        onBreak: false,
        segment: null
      })
      setActiveEntryData(null)
      console.log('✅ State cleared')
    }

    try {
      setIsLoading(true)
      console.log('🛑 Loading set to true')

      const activeEntryStr = localStorage.getItem('activeTimeEntry')
      console.log('🛑 activeEntryStr:', activeEntryStr)

      if (!activeEntryStr) {
        console.log('⚠️ No active time entry found in localStorage')
        clearState()
        toast.success('Zeiterfassung beendet (keine aktive Session)')
        setIsLoading(false)
        return
      }

      let activeEntry
      try {
        activeEntry = JSON.parse(activeEntryStr)
        console.log('🛑 Parsed active entry:', activeEntry)
      } catch (parseError) {
        console.error('❌ Failed to parse activeEntry:', parseError)
        clearState()
        toast.error('Korrupte Zeiterfassung gelöscht')
        setIsLoading(false)
        return
      }

      const now = new Date()
      const endTime = getTimeFromDate(now)
      console.log('🛑 Current time:', now)
      console.log('🛑 End time formatted:', endTime)

      // Validate required fields
      if (!activeEntry.start_time) {
        console.error('❌ Missing start_time in activeEntry')
        clearState()
        toast.error('Fehlerhafte Zeiterfassung (keine Startzeit)')
        setIsLoading(false)
        return
      }

      if (!activeEntry.date) {
        console.error('❌ Missing date in activeEntry')
        clearState()
        toast.error('Fehlerhafte Zeiterfassung (kein Datum)')
        setIsLoading(false)
        return
      }

      // Calculate hours
      console.log('🛑 Calculating hours from', activeEntry.start_time, 'to', endTime)
      let hours
      try {
        hours = calculateHours(activeEntry.start_time, endTime)
        console.log('🛑 Hours calculated:', hours)
      } catch (calcError) {
        console.error('❌ Failed to calculate hours:', calcError)
        clearState()
        toast.error('Fehler bei Zeitberechnung')
        setIsLoading(false)
        return
      }

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
      console.log('🛑 Getting user...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('❌ Error getting user:', userError)
        toast.error('Fehler: Benutzer nicht gefunden')
        return
      }
      if (!user) {
        console.error('❌ No user logged in')
        toast.error('Nicht angemeldet')
        return
      }
      console.log('✅ User ID:', user.id)

      // Get employee record - CRITICAL: timesheets table requires valid employee_id AND company_id!
      let employeeId = user.id
      let companyId = null
      console.log('🛑 Getting employee record with company_id...')
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, company_id')
        .eq('user_id', user.id)
        .single()

      if (empError) {
        console.error('❌ NO EMPLOYEE RECORD FOUND!')
        console.error('❌ This user does not have an employee record in the database')
        console.error('❌ Error:', empError.message)

        // Try to find if ANY employee record exists with this ID directly
        const { data: directEmployee, error: directError } = await supabase
          .from('employees')
          .select('id, company_id')
          .eq('id', user.id)
          .single()

        if (directError || !directEmployee) {
          // No employee record at all - clear state and show error
          clearState()
          throw new Error('Kein Mitarbeiter-Profil gefunden. Bitte kontaktiere den Administrator, um ein Mitarbeiter-Profil zu erstellen.')
        } else {
          console.log('✅ Found direct employee record, using user.id')
          employeeId = user.id
          companyId = directEmployee.company_id
          console.log('✅ Company ID (from direct):', companyId)
        }
      } else if (employees) {
        employeeId = employees.id
        companyId = employees.company_id
        console.log('✅ Employee ID:', employeeId)
        console.log('✅ Company ID:', companyId)
      }

      // Validate project_id - timesheets table requires NOT NULL project_id
      if (!activeEntry.project_id) {
        console.error('❌ NO PROJECT_ID!')
        console.error('❌ The timesheets table requires a project_id (NOT NULL constraint)')
        clearState()
        throw new Error('Keine Projekt-ID gefunden. Die Zeiterfassung kann nur mit einem ausgewählten Projekt gespeichert werden.')
      }

      // Validate company_id - RLS policy requires company_id for access control
      if (!companyId) {
        console.error('❌ NO COMPANY_ID!')
        console.error('❌ RLS policy requires company_id for timesheets access control')
        clearState()
        throw new Error('Keine Company-ID gefunden. Bitte kontaktiere den Administrator.')
      }

      const timesheetData = {
        employee_id: employeeId,
        project_id: activeEntry.project_id,
        company_id: companyId,
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
      }

      console.log('🛑 Saving to timesheets:', timesheetData)
      console.log('🛑 Detailed data validation:')
      console.log('  - employee_id:', employeeId, 'type:', typeof employeeId)
      console.log('  - project_id:', activeEntry.project_id, 'type:', typeof activeEntry.project_id)
      console.log('  - company_id:', companyId, 'type:', typeof companyId)
      console.log('  - date:', activeEntry.date, 'type:', typeof activeEntry.date)
      console.log('  - start_time:', activeEntry.start_time, 'type:', typeof activeEntry.start_time)
      console.log('  - end_time:', endTime, 'type:', typeof endTime)
      console.log('  - hours:', adjustedHours, 'type:', typeof adjustedHours)
      console.log('  - break_minutes:', breakMinutes, 'type:', typeof breakMinutes)

      // CRITICAL: Check if user's profile has the same company_id
      // The RLS policy requires: user_has_company_access(company_id)
      // This checks if auth.uid() has a profile with matching company_id
      console.log('🔍 Checking user profile company_id for RLS policy...')
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('id', user.id)
        .single()

      console.log('🔍 User Profile:', userProfile)
      console.log('🔍 Profile Error:', profileError)

      if (!userProfile) {
        console.error('❌ NO USER PROFILE FOUND!')
        throw new Error('Kein Benutzerprofil gefunden. Bitte kontaktiere den Administrator.')
      }

      console.log('🔍 User Profile company_id:', userProfile.company_id)
      console.log('🔍 Employee company_id:', companyId)

      if (userProfile.company_id !== companyId) {
        console.error('❌ COMPANY_ID MISMATCH!')
        console.error(`❌ User profile company_id: ${userProfile.company_id}`)
        console.error(`❌ Employee company_id: ${companyId}`)
        console.error('❌ RLS policy will REJECT this insert!')
        throw new Error('Company-ID Konflikt! Benutzerprofil und Mitarbeiter haben unterschiedliche Firmen.')
      }

      if (!userProfile.company_id) {
        console.error('❌ USER PROFILE HAS NO COMPANY_ID!')
        console.error('❌ RLS policy requires user profile to have company_id set')
        throw new Error('Benutzerprofil hat keine Firma zugewiesen. Bitte kontaktiere den Administrator.')
      }

      console.log('✅ RLS Check PASSED: User profile company_id matches employee company_id')

      // Save to timesheets table
      console.log('🛑 About to call supabase.from(timesheets).insert()')

      const { data, error } = await supabase
        .from('timesheets')
        .insert(timesheetData)
        .select()
        .single()

      console.log('🛑 Supabase response received')
      console.log('🛑 data:', data)
      console.log('🛑 error:', error)

      if (error) {
        console.error('❌ Error saving timesheet:', error)
        console.error('Error type:', typeof error)
        console.error('Error constructor:', error.constructor.name)
        console.error('Error keys:', Object.keys(error))
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        console.error('Error toString:', error.toString())

        // Try to get all properties including non-enumerable ones
        const allProps = Object.getOwnPropertyNames(error)
        console.error('All error properties:', allProps)
        allProps.forEach(prop => {
          console.error(`  ${prop}:`, error[prop])
        })

        console.error('Data that failed:', timesheetData)

        // Analyze error and provide helpful message
        let errorMessage = error.message || 'Unbekannter Datenbankfehler'

        if (error.message && error.message.includes('employees')) {
          errorMessage = 'Mitarbeiter-Profil nicht gefunden. Bitte kontaktiere den Administrator.'
        } else if (error.message && error.message.includes('projects')) {
          errorMessage = 'Projekt nicht gefunden oder ungültig. Bitte wähle ein anderes Projekt.'
        } else if (error.message && error.message.includes('violates foreign key')) {
          errorMessage = 'Datenbankfehler: Ungültige Referenz (Foreign Key). Überprüfe Mitarbeiter und Projekt.'
        } else if (error.message && error.message.includes('null value')) {
          errorMessage = 'Pflichtfeld fehlt. Stelle sicher, dass ein Projekt ausgewählt ist.'
        }

        // Don't try fallback - just fail clearly
        clearState()
        throw new Error(`Zeiterfassung konnte nicht gespeichert werden: ${errorMessage}`)
      } else {
        console.log('✅ Timesheet saved successfully:', data)
      }

      console.log('🛑 Save successful, now clearing state...')

      // Clear state AFTER successful save
      clearState()

      // Show appropriate success message
      if (breakMinutes > 0) {
        toast.success(`Zeiterfassung gespeichert! (${breakMinutes} Min Pause abgezogen)`)
      } else {
        toast.success('Zeiterfassung gespeichert!')
      }

      console.log('🛑 Refreshing time segments...')
      // Refresh segments
      await fetchTimeSegments()

      console.log('✅✅✅ stopTracking COMPLETE - SUCCESS')

    } catch (error: any) {
      console.error('❌❌❌ CRITICAL ERROR in stopTracking')
      console.error('Error object:', error)
      console.error('Error name:', error?.name)
      console.error('Error message:', error?.message)
      console.error('Error code:', error?.code)
      console.error('Error details:', error?.details)
      console.error('Error hint:', error?.hint)
      console.error('Error stack:', error?.stack)
      console.error('Full error JSON:', JSON.stringify(error, null, 2))

      // EMERGENCY FALLBACK: Clear localStorage anyway to prevent stuck state
      console.log('🚨🚨🚨 EMERGENCY FALLBACK ACTIVATED')

      // Save start_time BEFORE clearing state
      let startTime = '?'
      try {
        const activeEntryStr = localStorage.getItem('activeTimeEntry')
        if (activeEntryStr) {
          const entry = JSON.parse(activeEntryStr)
          startTime = entry.start_time || '?'
        }
      } catch (e) {
        console.error('Failed to get start_time:', e)
      }

      try {
        clearState()

        // Show detailed error to user with EXACT error message
        const errorMessage = error?.message || error?.toString() || 'Unbekannter Fehler'
        const errorCode = error?.code ? ` (Code: ${error.code})` : ''
        const errorDetails = error?.details ? `\nDetails: ${error.details}` : ''
        const errorHint = error?.hint ? `\nHinweis: ${error.hint}` : ''

        toast.error(`Zeiterfassung NICHT gespeichert!`, {
          duration: 15000,
          description: `FEHLER: ${errorMessage}${errorCode}${errorDetails}${errorHint}\n\n⚠️ Die Zeiterfassung wurde gestoppt, aber NICHT in der Datenbank gespeichert!\n\nBitte notiere:\nStart: ${startTime}\nEnde: ${new Date().toTimeString().split(' ')[0]}\n\nUnd trage die Zeit manuell nach!\n\nÖffne Console (F12) für Details.`
        })

        console.log('✅ Emergency fallback completed - state cleared')
      } catch (fallbackError) {
        console.error('❌ EVEN FALLBACK FAILED:', fallbackError)
        toast.error('KRITISCHER FEHLER! Bitte:\n1. Screenshot machen\n2. App neu laden\n3. Support kontaktieren', {
          duration: 15000
        })
      }
    } finally {
      console.log('🛑 Setting loading to false')
      setIsLoading(false)
      console.log('🛑🛑🛑 stopTracking END')
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

  // Check if work end time or maximum work time has been reached
  const checkMaxWorkTime = useCallback(async () => {
    if (!activeTime.active || !activeTime.segment?.started_at) return

    const MAX_WORK_MINUTES = 10 * 60 // 10 Stunden - gesetzliche Grenze (automatischer Stop)
    const FINAL_WARNING_MINUTES = 9.5 * 60 // 9:30 Stunden - letzte Warnung

    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTimeInMinutes = currentHour * 60 + currentMinute

    // Berechne totale Arbeitszeit heute
    const today = new Date()
    const { data: segments } = await supabase
      .from('timesheets')
      .select('hours, break_minutes')
      .eq('employee_id', activeTime.segment.employee_id || '')
      .eq('date', today.toISOString().split('T')[0])

    // Summiere bereits gespeicherte Arbeitszeit
    let totalMinutesToday = segments?.reduce((sum, s) => {
      const minutes = (s.hours || 0) * 60
      return sum + minutes
    }, 0) || 0

    // Addiere aktuelle laufende Zeit
    const startTime = new Date(activeTime.segment.started_at)
    const currentMinutes = Math.floor((new Date().getTime() - startTime.getTime()) / 1000 / 60)
    totalMinutesToday += currentMinutes

    console.log(`⏱️ Total work time today: ${totalMinutesToday} minutes (${Math.floor(totalMinutesToday / 60)}h ${totalMinutesToday % 60}m)`)
    console.log(`🕐 Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`)

    // Lade Company Settings für Arbeitsende
    let workEndTimeMinutes = 17 * 60 // Default: 17:00
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
            .select('default_working_hours_end')
            .eq('company_id', profile.company_id)
            .single()

          if (settings?.default_working_hours_end) {
            // Parse time string (format: "HH:MM:SS")
            const [endHour, endMinute] = settings.default_working_hours_end.split(':').map(Number)
            workEndTimeMinutes = endHour * 60 + endMinute
            console.log(`📅 Company work end time: ${endHour}:${endMinute.toString().padStart(2, '0')} (${workEndTimeMinutes} minutes)`)
          }
        }
      }
    } catch (error) {
      console.error('Error loading company work end time:', error)
    }

    // ERSTE Warnung: Was zuerst kommt - Arbeitsende-ZEIT oder 8 STUNDEN gearbeitet
    const STANDARD_WORK_HOURS = 8 * 60 // 8 Stunden
    const endHour = Math.floor(workEndTimeMinutes / 60)
    const endMin = workEndTimeMinutes % 60

    // Check 1: Hat Arbeitsende-UHRZEIT erreicht UND noch keine Warnung gezeigt?
    const reachedWorkEndTime = currentTimeInMinutes >= workEndTimeMinutes && currentTimeInMinutes < workEndTimeMinutes + 2

    // Check 2: Hat 8 STUNDEN gearbeitet UND noch keine Warnung gezeigt?
    const reachedEightHours = totalMinutesToday >= STANDARD_WORK_HOURS && totalMinutesToday < STANDARD_WORK_HOURS + 2

    if (reachedWorkEndTime || reachedEightHours) {
      if (reachedWorkEndTime && totalMinutesToday >= STANDARD_WORK_HOURS) {
        // Fall A: Beide gleichzeitig (z.B. 8:00 Start, 16:00 Ende = genau 8h)
        console.log(`⚠️ BOTH: Work end time (${endHour}:${endMin.toString().padStart(2, '0')}) AND 8 hours reached`)
        toast.warning(`✋ Arbeitsende erreicht (${endHour}:${endMin.toString().padStart(2, '0')}) - 8 Stunden gearbeitet!`, {
          duration: 15000,
          description: 'Bitte beenden Sie Ihren Arbeitstag. Bei 10 Arbeitsstunden erfolgt ein automatischer Stop.'
        })
      } else if (reachedWorkEndTime) {
        // Fall B: Nur Arbeitsende-Zeit erreicht (z.B. später gestartet)
        const workedHours = Math.floor(totalMinutesToday / 60)
        const workedMins = totalMinutesToday % 60
        console.log(`⚠️ WORK END TIME REACHED - ${endHour}:${endMin.toString().padStart(2, '0')} (worked: ${workedHours}h ${workedMins}m)`)
        toast.warning(`✋ Firmen-Arbeitsende erreicht (${endHour}:${endMin.toString().padStart(2, '0')})!`, {
          duration: 15000,
          description: `Sie haben ${workedHours}h ${workedMins}m gearbeitet. Bitte beenden Sie Ihren Arbeitstag.`
        })
      } else if (reachedEightHours) {
        // Fall C: Nur 8 Stunden erreicht (z.B. vor Firmen-Arbeitsende)
        console.log(`⚠️ 8 HOURS WORKED (work end time: ${endHour}:${endMin.toString().padStart(2, '0')})`)
        toast.warning(`✋ 8 Stunden gearbeitet! Bitte beenden Sie Ihren Arbeitstag.`, {
          duration: 15000,
          description: `Firmen-Arbeitsende ist um ${endHour}:${endMin.toString().padStart(2, '0')}} Uhr. Bei 10 Stunden erfolgt automatischer Stop.`
        })
      }
    }

    // ZWEITE Warnung bei 9:30 Stunden - letzte Chance vor Auto-Stop
    if (totalMinutesToday >= FINAL_WARNING_MINUTES && totalMinutesToday < FINAL_WARNING_MINUTES + 2) {
      const remainingMinutes = MAX_WORK_MINUTES - totalMinutesToday
      console.log(`⚠️⚠️ 9:30 HOURS REACHED - Final warning (${remainingMinutes} min remaining)`)
      toast.error(`⚠️⚠️ LETZTE WARNUNG! Noch ${remainingMinutes} Min bis zum automatischen Stop!`, {
        duration: 15000,
        description: 'Bei 10 Arbeitsstunden wird die Zeiterfassung automatisch beendet.'
      })
    }

    // AUTOMATISCHER STOP bei 10 Stunden (gesetzliche Grenze)
    if (totalMinutesToday >= MAX_WORK_MINUTES) {
      console.log('🛑🛑🛑 MAX 10 HOURS REACHED - AUTO-STOPPING NOW!')
      toast.error('🛑 10-Stunden-Grenze erreicht! Arbeitstag wird JETZT automatisch beendet.', {
        duration: 20000,
        description: 'Die gesetzliche Höchstarbeitszeit wurde erreicht.'
      })
      await stopTracking('Automatisch beendet - 10 Stunden Höchstarbeitszeit erreicht')
      return true // Indicate that auto-stop occurred
    }

    return false
  }, [activeTime, stopTracking])

  // Auto-refresh active time
  useEffect(() => {
    fetchActiveTime()
    fetchTimeSegments()

    // Refresh every 30 seconds AND check max work time
    const interval = setInterval(async () => {
      if (activeTime.active) {
        await fetchActiveTime()
        // Check if max work time reached
        const stopped = await checkMaxWorkTime()
        if (stopped) {
          // Clear interval if auto-stopped
          clearInterval(interval)
        }
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [activeTime.active, fetchActiveTime, checkMaxWorkTime]) // Add dependencies

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