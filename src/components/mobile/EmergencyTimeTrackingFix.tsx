/**
 * Emergency Fix Component für Zeiterfassung
 * Zeigt Debug-Info und bietet Reset-Funktionen
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export const EmergencyTimeTrackingFix: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)

  const runDiagnostics = async () => {
    setIsChecking(true)
    const results: any = {
      timestamp: new Date().toISOString(),
      issues: [],
      info: {}
    }

    try {
      // 1. Check localStorage
      const activeEntry = localStorage.getItem('activeTimeEntry')
      const activeBreak = localStorage.getItem('activeBreak')

      results.info.localStorage = {
        activeEntry: activeEntry ? 'VORHANDEN' : 'LEER',
        activeBreak: activeBreak ? 'VORHANDEN' : 'LEER',
        activeEntryData: activeEntry ? JSON.parse(activeEntry) : null
      }

      if (activeEntry) {
        try {
          const parsed = JSON.parse(activeEntry)
          if (!parsed.start_time) {
            results.issues.push('❌ start_time fehlt in activeEntry')
          }
          if (!parsed.date) {
            results.issues.push('❌ date fehlt in activeEntry')
          }
        } catch (e) {
          results.issues.push('❌ activeEntry ist korrupt')
        }
      }

      // 2. Check user authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError) {
        results.issues.push(`❌ Auth Fehler: ${userError.message}`)
      } else if (!user) {
        results.issues.push('❌ Nicht angemeldet')
      } else {
        results.info.user = {
          id: user.id,
          email: user.email
        }
      }

      // 3. Check employee record
      if (user) {
        const { data: employee, error: empError } = await supabase
          .from('employees')
          .select('id, user_id, first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle()

        if (empError) {
          results.issues.push(`❌ Employee Query Error: ${empError.message}`)
        } else if (!employee) {
          results.issues.push('❌ Kein Employee-Eintrag gefunden')
        } else {
          results.info.employee = employee
        }
      }

      // 4. Check timesheets table access
      const { error: timesheetsError } = await supabase
        .from('timesheets')
        .select('id')
        .limit(1)

      if (timesheetsError) {
        results.issues.push(`❌ Timesheets Zugriff: ${timesheetsError.message}`)
      } else {
        results.info.timesheetsAccess = '✅ OK'
      }

      // 5. Check attendance table
      const { error: attendanceError } = await supabase
        .from('attendance')
        .select('id')
        .limit(1)

      if (attendanceError) {
        results.issues.push(`❌ Attendance Zugriff: ${attendanceError.message}`)
      } else {
        results.info.attendanceAccess = '✅ OK'
      }

      // 6. Test insert permissions (dry run)
      if (user) {
        const testData = {
          employee_id: user.id,
          date: new Date().toISOString().split('T')[0],
          start_time: '08:00:00',
          end_time: '09:00:00',
          hours: 1,
          is_billable: true,
          task_category: 'test'
        }

        // Try to insert and immediately delete
        const { data: testInsert, error: insertError } = await supabase
          .from('timesheets')
          .insert(testData)
          .select()
          .single()

        if (insertError) {
          results.issues.push(`❌ Insert Permission: ${insertError.message}`)
        } else {
          // Delete the test entry
          if (testInsert) {
            await supabase.from('timesheets').delete().eq('id', testInsert.id)
          }
          results.info.insertPermission = '✅ OK'
        }
      }

      setDiagnostics(results)

      if (results.issues.length === 0) {
        toast.success('✅ Keine Probleme gefunden!')
      } else {
        toast.error(`${results.issues.length} Probleme gefunden`)
      }

    } catch (error: any) {
      results.issues.push(`❌ Unerwarteter Fehler: ${error.message}`)
      setDiagnostics(results)
      toast.error('Diagnose fehlgeschlagen')
    } finally {
      setIsChecking(false)
    }
  }

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem('activeTimeEntry')
      localStorage.removeItem('activeBreak')
      localStorage.removeItem('selectedProject')
      toast.success('LocalStorage gelöscht')
      runDiagnostics()
    } catch (error: any) {
      toast.error(`Fehler: ${error.message}`)
    }
  }

  const forceStopTimeTracking = async () => {
    try {
      // Get active entry
      const activeEntryStr = localStorage.getItem('activeTimeEntry')
      if (!activeEntryStr) {
        toast.info('Keine aktive Zeiterfassung')
        return
      }

      const activeEntry = JSON.parse(activeEntryStr)
      const now = new Date()
      const endTime = now.toTimeString().split(' ')[0] // HH:MM:SS

      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Nicht angemeldet')
        return
      }

      // Calculate hours
      const startParts = activeEntry.start_time.split(':')
      const endParts = endTime.split(':')
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])
      const hours = (endMinutes - startMinutes) / 60

      // Try to save
      const { data, error } = await supabase
        .from('timesheets')
        .insert({
          employee_id: user.id, // Use user.id directly
          project_id: activeEntry.project_id || null,
          date: activeEntry.date,
          start_time: activeEntry.start_time,
          end_time: endTime,
          hours: Math.max(0.1, hours),
          break_minutes: 0,
          description: 'EMERGENCY STOP',
          task_category: 'general',
          is_billable: true
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Clear localStorage
      localStorage.removeItem('activeTimeEntry')
      localStorage.removeItem('activeBreak')

      toast.success('✅ Zeiterfassung erzwungen beendet!')
      runDiagnostics()

    } catch (error: any) {
      toast.error(`Force Stop Fehler: ${error.message}`)
      console.error('Force stop error:', error)
    }
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  return (
    <div className="space-y-4 p-4">
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            Emergency Zeiterfassung Fix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={runDiagnostics}
              disabled={isChecking}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Diagnose durchführen
            </Button>

            <Button
              onClick={clearLocalStorage}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              LocalStorage löschen
            </Button>

            <Button
              onClick={forceStopTimeTracking}
              variant="default"
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Zeiterfassung erzwingen beenden
            </Button>
          </div>

          {/* Diagnostics Display */}
          {diagnostics && (
            <div className="mt-4 space-y-3">
              {/* Issues */}
              {diagnostics.issues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <h3 className="font-semibold text-red-800 mb-2">
                    Probleme ({diagnostics.issues.length}):
                  </h3>
                  <ul className="text-xs space-y-1 font-mono">
                    {diagnostics.issues.map((issue: string, i: number) => (
                      <li key={i} className="text-red-700">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <h3 className="font-semibold text-blue-800 mb-2">System Info:</h3>
                <pre className="text-xs font-mono overflow-auto max-h-96">
                  {JSON.stringify(diagnostics.info, null, 2)}
                </pre>
              </div>

              {/* Status Summary */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">
                  Status:
                </span>
                <span className={`text-sm font-bold ${
                  diagnostics.issues.length === 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {diagnostics.issues.length === 0 ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Alles OK
                    </span>
                  ) : (
                    `${diagnostics.issues.length} Fehler`
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            <p className="font-semibold mb-1">Anweisungen:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Klicke "Diagnose durchführen"</li>
              <li>Schaue welche Probleme gefunden wurden</li>
              <li>Wenn LocalStorage Problem: "LocalStorage löschen"</li>
              <li>Wenn Zeiterfassung hängt: "Erzwingen beenden"</li>
              <li>Screenshot von "System Info" machen</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
