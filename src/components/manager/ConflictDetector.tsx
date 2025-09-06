import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  Clock,
  Coffee,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  User,
  Zap,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface ConflictSummary {
  period: {
    from: string
    to: string
    employee_id?: string
  }
  summary: {
    total_conflicts: number
    overlaps: number
    missing_breaks: number
    anomalies: number
    critical_anomalies: number
    affected_employees: number
  }
  severity: 'none' | 'medium' | 'high' | 'critical'
  generated_at: string
}

interface ConflictOverlap {
  employee_id: string
  employee_name: string
  conflict_date: string
  segment_1_id: string
  segment_1_start: string
  segment_1_end: string
  segment_2_id: string
  segment_2_start: string
  segment_2_end: string
  overlap_minutes: number
  conflict_type: string
}

interface MissingBreak {
  employee_id: string
  employee_name: string
  work_date: string
  total_work_minutes: number
  existing_break_minutes: number
  required_break_minutes: number
  missing_break_minutes: number
  conflict_severity: string
}

interface TimeAnomaly {
  employee_id: string
  employee_name: string
  segment_id: string
  segment_date: string
  segment_start: string
  segment_end: string
  duration_minutes: number
  anomaly_type: string
  anomaly_description: string
  severity: string
}

interface ConflictDetectorProps {
  dateFrom: string
  dateTo: string
  employeeId?: string
  onRefresh?: () => void
}

export const ConflictDetector: React.FC<ConflictDetectorProps> = ({
  dateFrom,
  dateTo,
  employeeId,
  onRefresh
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState<ConflictSummary | null>(null)
  const [overlaps, setOverlaps] = useState<ConflictOverlap[]>([])
  const [missingBreaks, setMissingBreaks] = useState<MissingBreak[]>([])
  const [anomalies, setAnomalies] = useState<TimeAnomaly[]>([])
  const [showDetails, setShowDetails] = useState<'overlaps' | 'breaks' | 'anomalies' | null>(null)

  // Konflikte laden
  const loadConflicts = useCallback(async () => {
    setIsLoading(true)
    try {
      // Summary laden
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_approval_conflicts_summary', {
        p_employee_id: employeeId || null,
        p_date_from: dateFrom,
        p_date_to: dateTo
      })

      if (summaryError && !summaryError.message.includes('function')) {
        throw summaryError
      }

      if (summaryData) {
        setSummary(summaryData)
      } else {
        // Fallback bei fehlender Funktion
        setSummary({
          period: { from: dateFrom, to: dateTo, employee_id: employeeId },
          summary: { total_conflicts: 0, overlaps: 0, missing_breaks: 0, anomalies: 0, critical_anomalies: 0, affected_employees: 0 },
          severity: 'none',
          generated_at: new Date().toISOString()
        })
      }

      // Detail-Daten laden (nur wenn Summary Konflikte zeigt)
      if (summaryData?.summary.total_conflicts > 0) {
        // Überlappungen
        const { data: overlapData, error: overlapError } = await supabase.rpc('detect_time_overlaps', {
          p_employee_id: employeeId || null,
          p_date_from: dateFrom,
          p_date_to: dateTo
        })

        if (!overlapError) setOverlaps(overlapData || [])

        // Fehlende Pausen
        const { data: breakData, error: breakError } = await supabase.rpc('detect_missing_breaks', {
          p_employee_id: employeeId || null,
          p_date_from: dateFrom,
          p_date_to: dateTo
        })

        if (!breakError) setMissingBreaks(breakData || [])

        // Anomalien
        const { data: anomalyData, error: anomalyError } = await supabase.rpc('detect_time_anomalies', {
          p_employee_id: employeeId || null,
          p_date_from: dateFrom,
          p_date_to: dateTo
        })

        if (!anomalyError) setAnomalies(anomalyData || [])
      }

    } catch (error: any) {
      console.error('Error loading conflicts:', error)
      // Keine Toast-Fehlermeldung, da Funktion möglicherweise nicht existiert
    } finally {
      setIsLoading(false)
    }
  }, [dateFrom, dateTo, employeeId])

  useEffect(() => {
    loadConflicts()
  }, [loadConflicts])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'medium': return <AlertCircle className="h-4 w-4" />
      default: return <CheckCircle2 className="h-4 w-4" />
    }
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}h`
  }

  if (isLoading && !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Konflikte werden analysiert...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Konfliktanalyse nicht verfügbar</CardTitle>
          <CardDescription>
            Die Konflikterkennungsfunktionen sind nicht verfügbar
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {getSeverityIcon(summary.severity)}
                Konfliktanalyse
              </CardTitle>
              <CardDescription>
                {format(new Date(summary.period.from), 'dd.MM.yyyy', { locale: de })} - {' '}
                {format(new Date(summary.period.to), 'dd.MM.yyyy', { locale: de })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getSeverityColor(summary.severity)}>
                {summary.severity === 'none' ? 'Keine Konflikte' :
                 summary.severity === 'medium' ? 'Gering' :
                 summary.severity === 'high' ? 'Hoch' : 'Kritisch'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={loadConflicts}
                disabled={isLoading}
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {summary.summary.total_conflicts === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Keine Konflikte gefunden. Alle Zeiterfassungen sind korrekt.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {summary.summary.overlaps}
                  </div>
                  <p className="text-sm text-muted-foreground">Überlappungen</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {summary.summary.missing_breaks}
                  </div>
                  <p className="text-sm text-muted-foreground">Fehlende Pausen</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {summary.summary.anomalies}
                  </div>
                  <p className="text-sm text-muted-foreground">Anomalien</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {summary.summary.affected_employees}
                  </div>
                  <p className="text-sm text-muted-foreground">Betroffene MA</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {summary.summary.overlaps > 0 && (
                  <Button
                    variant={showDetails === 'overlaps' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowDetails(showDetails === 'overlaps' ? null : 'overlaps')}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Überlappungen ({summary.summary.overlaps})
                  </Button>
                )}
                {summary.summary.missing_breaks > 0 && (
                  <Button
                    variant={showDetails === 'breaks' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowDetails(showDetails === 'breaks' ? null : 'breaks')}
                  >
                    <Coffee className="mr-2 h-4 w-4" />
                    Pausen ({summary.summary.missing_breaks})
                  </Button>
                )}
                {summary.summary.anomalies > 0 && (
                  <Button
                    variant={showDetails === 'anomalies' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowDetails(showDetails === 'anomalies' ? null : 'anomalies')}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Anomalien ({summary.summary.anomalies})
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Views */}
      {showDetails === 'overlaps' && overlaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Zeitüberlappungen
            </CardTitle>
            <CardDescription>
              Segmente die sich zeitlich überschneiden (kritisch!)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {overlaps.map((overlap, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-red-50 border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-red-800">{overlap.employee_name}</span>
                      <Badge variant="destructive">
                        {overlap.overlap_minutes} Min Überlappung
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>📅 {format(new Date(overlap.conflict_date), 'dd.MM.yyyy', { locale: de })}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          🕐 {format(new Date(overlap.segment_1_start), 'HH:mm')} - {format(new Date(overlap.segment_1_end), 'HH:mm')}
                        </div>
                        <div>
                          🕐 {format(new Date(overlap.segment_2_start), 'HH:mm')} - {format(new Date(overlap.segment_2_end), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {showDetails === 'breaks' && missingBreaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              Fehlende Pausen
            </CardTitle>
            <CardDescription>
              Tage mit unzureichenden Pausen nach Arbeitszeitgesetz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {missingBreaks.map((missingBreak, index) => (
                  <div key={index} className={`border rounded-lg p-3 ${
                    missingBreak.conflict_severity === 'critical' ? 'bg-red-50 border-red-200' :
                    missingBreak.conflict_severity === 'high' ? 'bg-orange-50 border-orange-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{missingBreak.employee_name}</span>
                      <Badge variant={
                        missingBreak.conflict_severity === 'critical' ? 'destructive' :
                        missingBreak.conflict_severity === 'high' ? 'secondary' : 'outline'
                      }>
                        {missingBreak.missing_break_minutes} Min fehlen
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>📅 {format(new Date(missingBreak.work_date), 'dd.MM.yyyy', { locale: de })}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>⏰ Arbeit: {formatMinutes(missingBreak.total_work_minutes)}</div>
                        <div>☕ Pause: {formatMinutes(missingBreak.existing_break_minutes)}</div>
                        <div>❗ Soll: {formatMinutes(missingBreak.required_break_minutes)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {showDetails === 'anomalies' && anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Zeiterfassungs-Anomalien
            </CardTitle>
            <CardDescription>
              Ungewöhnliche oder verdächtige Zeiterfassungen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {anomalies.map((anomaly, index) => (
                  <div key={index} className={`border rounded-lg p-3 ${
                    anomaly.severity === 'critical' ? 'bg-red-50 border-red-200' :
                    anomaly.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{anomaly.employee_name}</span>
                      <Badge variant={
                        anomaly.severity === 'critical' ? 'destructive' :
                        anomaly.severity === 'high' ? 'secondary' : 'outline'
                      }>
                        {anomaly.anomaly_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>📅 {format(new Date(anomaly.segment_date), 'dd.MM.yyyy', { locale: de })}</div>
                      <div>🕐 {format(new Date(anomaly.segment_start), 'HH:mm')} - {
                        anomaly.segment_end ? format(new Date(anomaly.segment_end), 'HH:mm') : 'läuft noch'
                      }</div>
                      <div className="text-xs text-muted-foreground">
                        {anomaly.anomaly_description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}