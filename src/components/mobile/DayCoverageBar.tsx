/**
 * Day Coverage Bar Component
 * Visual representation of time coverage for a day
 * Shows attendance, breaks, projects, and cost centers with color-coded status
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { ReconciliationService, ReconciliationResult } from '@/services/reconciliationService'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface DayCoverageBarProps {
  employeeId: string
  date: string
  onRefresh?: () => void
  compact?: boolean
}

export const DayCoverageBar: React.FC<DayCoverageBarProps> = ({
  employeeId,
  date,
  onRefresh,
  compact = false
}) => {
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadReconciliation()
  }, [employeeId, date])

  const loadReconciliation = async () => {
    try {
      setIsLoading(true)
      const result = await ReconciliationService.calculateCoverage(employeeId, date)
      setReconciliation(result)
      onRefresh?.()
    } catch (error) {
      console.error('Error loading reconciliation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !reconciliation) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-24"></CardContent>
      </Card>
    )
  }

  if (reconciliation.status === 'no_attendance') {
    return null // Don't show if no attendance
  }

  // Format minutes to hours
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}h`
    }
    return `${mins}min`
  }

  // Status colors
  const statusConfig = {
    green: {
      color: 'bg-green-500',
      textColor: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: CheckCircle2,
      label: 'Gut'
    },
    yellow: {
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: AlertCircle,
      label: 'OK'
    },
    red: {
      color: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: AlertCircle,
      label: 'Unvollständig'
    }
  }

  const status = statusConfig[reconciliation.status] || statusConfig.red
  const StatusIcon = status.icon

  // Calculate percentages for layer visualization
  const total = reconciliation.attendance_minutes
  const projectPercent = total > 0 ? (reconciliation.project_minutes / total) * 100 : 0
  const costCenterPercent = total > 0 ? (reconciliation.cost_center_minutes / total) * 100 : 0
  const breakPercent = total > 0 ? (reconciliation.break_minutes / total) * 100 : 0

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 ${status.bgColor} ${status.borderColor}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${status.textColor}`} />
            <span className="text-sm font-medium">
              Deckung: {Math.round(reconciliation.coverage_percent)}%
            </span>
          </div>
          <Badge variant="outline" className={status.textColor}>
            {status.label}
          </Badge>
        </div>

        {/* Simple progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${status.color} transition-all duration-500`}
            style={{ width: `${Math.min(reconciliation.coverage_percent, 100)}%` }}
          />
        </div>

        {/* Time breakdown */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Arbeitszeit: {formatDuration(reconciliation.attendance_minutes)}</span>
          <span>Gebucht: {formatDuration(reconciliation.total_accounted_minutes)}</span>
        </div>
      </div>
    )
  }

  // Full card view
  return (
    <Card className={`${status.borderColor} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Deckungsgrad
          </CardTitle>
          <Badge variant="outline" className={status.textColor}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage percentage */}
        <div className="text-center">
          <div className={`text-4xl font-bold ${status.textColor}`}>
            {Math.round(reconciliation.coverage_percent)}%
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(date), 'dd. MMMM', { locale: de })}
          </p>
        </div>

        {/* Layer visualization */}
        <div className="space-y-2">
          {/* Attendance base */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-700">Arbeitszeit</span>
              <span className="font-medium">{formatDuration(reconciliation.attendance_minutes)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
              {/* Attendance background (full width) */}
              <div className="absolute inset-0 bg-gray-300" />

              {/* Project time layer */}
              {projectPercent > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-blue-500 opacity-80"
                  style={{ width: `${projectPercent}%` }}
                  title={`Projekt: ${formatDuration(reconciliation.project_minutes)}`}
                />
              )}

              {/* Cost center layer */}
              {costCenterPercent > 0 && (
                <div
                  className="absolute h-full bg-purple-500 opacity-80"
                  style={{
                    left: `${projectPercent}%`,
                    width: `${costCenterPercent}%`
                  }}
                  title={`Kostenstellen: ${formatDuration(reconciliation.cost_center_minutes)}`}
                />
              )}

              {/* Break layer */}
              {breakPercent > 0 && (
                <div
                  className="absolute h-full bg-orange-500 opacity-80"
                  style={{
                    left: `${projectPercent + costCenterPercent}%`,
                    width: `${breakPercent}%`
                  }}
                  title={`Pausen: ${formatDuration(reconciliation.break_minutes)}`}
                />
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Projekt</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-purple-500" />
              <span>Kostenstelle</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>Pause</span>
            </div>
          </div>
        </div>

        {/* Time breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Projektzeit:</span>
            <span className="font-medium text-blue-600">
              {formatDuration(reconciliation.project_minutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kostenstellen:</span>
            <span className="font-medium text-purple-600">
              {formatDuration(reconciliation.cost_center_minutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pausen:</span>
            <span className="font-medium text-orange-600">
              {formatDuration(reconciliation.break_minutes)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">Gesamt gebucht:</span>
            <span className="font-bold">
              {formatDuration(reconciliation.total_accounted_minutes)}
            </span>
          </div>
        </div>

        {/* Status message */}
        {reconciliation.difference_minutes !== 0 && (
          <div className={`text-xs text-center p-2 rounded ${status.bgColor}`}>
            {reconciliation.difference_minutes > 0 ? (
              <span>
                Noch {formatDuration(Math.abs(reconciliation.difference_minutes))} nicht zugeordnet
              </span>
            ) : (
              <span>
                {formatDuration(Math.abs(reconciliation.difference_minutes))} mehr gebucht als Arbeitszeit
              </span>
            )}
          </div>
        )}

        {/* Gaps warning */}
        {reconciliation.has_gaps && (
          <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
            <AlertCircle className="h-4 w-4" />
            <span>Lücken in der Zeiterfassung erkannt</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
