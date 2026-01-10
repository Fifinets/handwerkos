/**
 * Auto Debug Fix - Läuft automatisch beim Laden
 * Zeigt detaillierte Fehler in der Console
 */

import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const AutoDebugFix: React.FC = () => {
  useEffect(() => {
    const runEmergencyFix = async () => {
      console.log('🚨🚨🚨 EMERGENCY FIX GESTARTET')

      try {
        // 1. Hole aktive Zeiterfassung
        const activeEntryStr = localStorage.getItem('activeTimeEntry')

        if (!activeEntryStr) {
          console.log('✅ Keine aktive Zeiterfassung gefunden - nichts zu fixen')
          return
        }

        const activeEntry = JSON.parse(activeEntryStr)
        console.log('📋 Aktive Zeiterfassung gefunden:', activeEntry)
        console.log('  - Project ID:', activeEntry.project_id)
        console.log('  - Date:', activeEntry.date)
        console.log('  - Start Time:', activeEntry.start_time)

        // Zeige Toast
        toast.info('Hängende Zeiterfassung gefunden - versuche automatisch zu speichern...')

        // 2. Berechne Endzeit
        const now = new Date()
        const endTime = now.toTimeString().split(' ')[0] // HH:MM:SS

        const startParts = activeEntry.start_time.split(':')
        const endParts = endTime.split(':')
        const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
        const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])
        const hours = (endMinutes - startMinutes) / 60

        console.log('⏰ Start Zeit:', activeEntry.start_time)
        console.log('⏰ End Zeit:', endTime)
        console.log('⏰ Berechnete Stunden:', hours)

        // 3. Hole User
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error('❌ User Fehler:', userError)
          toast.error('Nicht angemeldet - kann nicht speichern')
          return
        }

        console.log('👤 User ID:', user.id)
        console.log('👤 User Email:', user.email)

        // 4. Versuche zu speichern
        console.log('💾 Versuche in timesheets zu speichern...')

        const timesheetData = {
          employee_id: user.id,
          project_id: activeEntry.project_id || null,
          date: activeEntry.date,
          start_time: activeEntry.start_time,
          end_time: endTime,
          hours: Math.max(0.1, hours),
          break_minutes: 30, // Standard-Pause
          description: 'AUTO SAVED (Emergency Fix)',
          task_category: 'general',
          is_billable: true
        }

        console.log('💾 Daten zum Speichern:', timesheetData)

        const { data, error } = await supabase
          .from('timesheets')
          .insert(timesheetData)
          .select()
          .single()

        if (error) {
          console.error('❌❌❌ FEHLER BEIM SPEICHERN:')
          console.error('Error Object:', error)
          console.error('Error Code:', error.code)
          console.error('Error Message:', error.message)
          console.error('Error Details:', error.details)
          console.error('Error Hint:', error.hint)
          console.error('Full Error JSON:', JSON.stringify(error, null, 2))

          // Zeige detaillierten Fehler
          toast.error(`SPEICHERN FEHLGESCHLAGEN!\n\nCode: ${error.code}\nMessage: ${error.message}\n\nBitte Screenshot von Console machen (F12)`, {
            duration: 15000
          })

          // ABER: Lösche localStorage trotzdem, um Stuck-State zu verhindern
          console.log('🧹 Lösche localStorage trotz Fehler, um Stuck-State zu verhindern')
          localStorage.removeItem('activeTimeEntry')
          localStorage.removeItem('activeBreak')

        } else {
          console.log('✅✅✅ ERFOLGREICH GESPEICHERT:')
          console.log('Saved Data:', data)

          // Lösche localStorage
          localStorage.removeItem('activeTimeEntry')
          localStorage.removeItem('activeBreak')

          toast.success(`✅ Zeiterfassung automatisch gespeichert!\n\nStart: ${activeEntry.start_time}\nEnde: ${endTime}\nStunden: ${hours.toFixed(2)}h`, {
            duration: 8000
          })
        }

      } catch (error: any) {
        console.error('❌❌❌ KRITISCHER FEHLER im Emergency Fix:')
        console.error('Error:', error)
        console.error('Error Name:', error?.name)
        console.error('Error Message:', error?.message)
        console.error('Error Stack:', error?.stack)

        toast.error(`Kritischer Fehler: ${error?.message || 'Unbekannt'}`, {
          duration: 10000
        })
      }

      console.log('🚨🚨🚨 EMERGENCY FIX BEENDET')
    }

    // Starte Fix nach 2 Sekunden (damit App geladen ist)
    const timer = setTimeout(() => {
      runEmergencyFix()
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return null // Rendert nichts
}
