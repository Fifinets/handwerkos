/**
 * Reconciliation Service
 * Calculates coverage between attendance (work time) and time entries (project + cost center)
 * Provides gap detection and reconciliation status (green/yellow/red)
 */

import { supabase } from '@/integrations/supabase/client'
import { RulesEngine, TimeRules } from './rulesEngine'

export interface ReconciliationResult {
  date: string
  employee_id: string

  // Time breakdown
  attendance_minutes: number
  project_minutes: number
  cost_center_minutes: number
  break_minutes: number
  total_accounted_minutes: number

  // Coverage calculation
  coverage_percent: number
  difference_minutes: number
  is_within_tolerance: boolean

  // Status
  status: 'green' | 'yellow' | 'red' | 'no_attendance'

  // Details
  attendance_id?: string
  has_gaps: boolean
}

export interface GapPeriod {
  gap_start: string
  gap_end: string
  gap_minutes: number
  suggested_cost_center: string
  reason: string
}

export interface WeekReconciliation {
  week_start: string
  days: ReconciliationResult[]
  total_attendance_minutes: number
  total_project_minutes: number
  total_cost_center_minutes: number
  total_break_minutes: number
  week_coverage_percent: number
  week_status: 'green' | 'yellow' | 'red'
}

export class ReconciliationService {
  /**
   * Calculate coverage for a specific date
   */
  static async calculateCoverage(
    employeeId: string,
    date: string
  ): Promise<ReconciliationResult> {
    try {
      const { data, error } = await supabase
        .rpc('check_reconciliation', {
          p_employee_id: employeeId,
          p_date: date
        })
        .single()

      if (error) throw error

      // Check for gaps
      const gaps = await this.detectGaps(employeeId, date)

      return {
        date,
        employee_id: employeeId,
        attendance_minutes: data.attendance_minutes || 0,
        project_minutes: data.project_minutes || 0,
        cost_center_minutes: data.cost_center_minutes || 0,
        break_minutes: data.break_minutes || 0,
        total_accounted_minutes: data.total_accounted_minutes || 0,
        coverage_percent: data.coverage_percent || 0,
        difference_minutes: data.difference_minutes || 0,
        is_within_tolerance: data.is_within_tolerance || false,
        status: data.status === 'no_attendance' ? 'no_attendance' : data.status,
        has_gaps: gaps.length > 0
      }
    } catch (error) {
      console.error('Calculate coverage error:', error)

      // Return empty result on error
      return {
        date,
        employee_id: employeeId,
        attendance_minutes: 0,
        project_minutes: 0,
        cost_center_minutes: 0,
        break_minutes: 0,
        total_accounted_minutes: 0,
        coverage_percent: 0,
        difference_minutes: 0,
        is_within_tolerance: false,
        status: 'no_attendance',
        has_gaps: false
      }
    }
  }

  /**
   * Detect gaps between attendance and time entries
   */
  static async detectGaps(
    employeeId: string,
    date: string
  ): Promise<GapPeriod[]> {
    try {
      const { data, error } = await supabase
        .rpc('detect_attendance_gaps', {
          p_employee_id: employeeId,
          p_date: date
        })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Detect gaps error:', error)
      return []
    }
  }

  /**
   * Get reconciliation for a week
   */
  static async getWeekReconciliation(
    employeeId: string,
    weekStartDate: string
  ): Promise<WeekReconciliation> {
    try {
      const weekStart = new Date(weekStartDate)
      const days: ReconciliationResult[] = []

      // Calculate reconciliation for each day of the week
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart)
        currentDate.setDate(currentDate.getDate() + i)
        const dateStr = currentDate.toISOString().split('T')[0]

        const dayReconciliation = await this.calculateCoverage(employeeId, dateStr)
        days.push(dayReconciliation)
      }

      // Calculate week totals
      const totalAttendance = days.reduce((sum, d) => sum + d.attendance_minutes, 0)
      const totalProject = days.reduce((sum, d) => sum + d.project_minutes, 0)
      const totalCostCenter = days.reduce((sum, d) => sum + d.cost_center_minutes, 0)
      const totalBreak = days.reduce((sum, d) => sum + d.break_minutes, 0)

      const weekCoverage = totalAttendance > 0
        ? Math.round(((totalProject + totalCostCenter + totalBreak) / totalAttendance) * 100)
        : 0

      // Determine week status
      let weekStatus: 'green' | 'yellow' | 'red' = 'red'
      if (weekCoverage >= 95) {
        weekStatus = 'green'
      } else if (weekCoverage >= 90) {
        weekStatus = 'yellow'
      }

      return {
        week_start: weekStartDate,
        days,
        total_attendance_minutes: totalAttendance,
        total_project_minutes: totalProject,
        total_cost_center_minutes: totalCostCenter,
        total_break_minutes: totalBreak,
        week_coverage_percent: weekCoverage,
        week_status: weekStatus
      }
    } catch (error) {
      console.error('Get week reconciliation error:', error)

      return {
        week_start: weekStartDate,
        days: [],
        total_attendance_minutes: 0,
        total_project_minutes: 0,
        total_cost_center_minutes: 0,
        total_break_minutes: 0,
        week_coverage_percent: 0,
        week_status: 'red'
      }
    }
  }

  /**
   * Suggest cost centers for gaps
   */
  static suggestCostCenters(gaps: GapPeriod[]): {
    gap: GapPeriod
    suggestions: string[]
  }[] {
    return gaps.map(gap => {
      const suggestions: string[] = []

      // Already has a suggestion from DB function
      if (gap.suggested_cost_center) {
        suggestions.push(gap.suggested_cost_center)
      }

      // Add additional suggestions based on time and duration
      const gapStart = new Date(gap.gap_start)
      const hour = gapStart.getHours()

      // Morning time (before 9am)
      if (hour < 9 && gap.gap_minutes > 30) {
        suggestions.push('WERKSTATT')
      }

      // Lunch time (11am - 2pm)
      if (hour >= 11 && hour <= 14 && gap.gap_minutes >= 15 && gap.gap_minutes <= 60) {
        // Already suggested as BREAK
      }

      // Evening time (after 5pm)
      if (hour >= 17) {
        suggestions.push('WERKSTATT')
      }

      // Long gaps (> 2 hours)
      if (gap.gap_minutes > 120) {
        suggestions.push('SCHULUNG')
      }

      return {
        gap,
        suggestions: [...new Set(suggestions)] // Remove duplicates
      }
    })
  }

  /**
   * Auto-fill gaps with cost centers (suggestion only, not automatic)
   */
  static async suggestGapFilling(
    employeeId: string,
    date: string
  ): Promise<{
    gap: GapPeriod
    suggested_entry: {
      employee_id: string
      type: 'cost_center'
      cost_center_code: string
      start_time: string
      end_time: string
      description: string
    }
  }[]> {
    const gaps = await this.detectGaps(employeeId, date)
    const suggestions = this.suggestCostCenters(gaps)

    return suggestions.map(({ gap, suggestions: costCenterSuggestions }) => ({
      gap,
      suggested_entry: {
        employee_id: employeeId,
        type: 'cost_center' as const,
        cost_center_code: costCenterSuggestions[0] || 'WERKSTATT',
        start_time: gap.gap_start,
        end_time: gap.gap_end,
        description: `Auto-suggested: ${gap.reason}`
      }
    }))
  }

  /**
   * Check if week is ready for submission
   */
  static async isWeekReadyForSubmission(
    employeeId: string,
    weekStartDate: string,
    companyId: string
  ): Promise<{
    ready: boolean
    reasons: string[]
  }> {
    const reasons: string[] = []

    try {
      // Get rules
      const rules = await RulesEngine.getRules(companyId)
      if (!rules) {
        reasons.push('Could not load company rules')
        return { ready: false, reasons }
      }

      // Get week reconciliation
      const weekRec = await this.getWeekReconciliation(employeeId, weekStartDate)

      // Check if reconciliation is required
      if (rules.require_reconciliation) {
        // Check each day
        for (const day of weekRec.days) {
          if (day.status === 'no_attendance') {
            continue // Skip days without attendance
          }

          if (day.status === 'red') {
            reasons.push(`${day.date}: Coverage too low (${day.coverage_percent}%)`)
          }

          if (!day.is_within_tolerance) {
            reasons.push(`${day.date}: Time difference (${day.difference_minutes} min) exceeds tolerance`)
          }

          if (day.has_gaps) {
            reasons.push(`${day.date}: Has unaccounted time gaps`)
          }
        }
      }

      // Check if all attendance is clocked out
      const { data: openAttendance } = await supabase
        .from('attendance')
        .select('id, date')
        .eq('employee_id', employeeId)
        .gte('date', weekStartDate)
        .is('clock_out', null)

      if (openAttendance && openAttendance.length > 0) {
        reasons.push('Some shifts are not clocked out yet')
      }

      return {
        ready: reasons.length === 0,
        reasons
      }
    } catch (error) {
      console.error('Check week ready error:', error)
      reasons.push('Error checking week status')
      return { ready: false, reasons }
    }
  }

  /**
   * Get reconciliation summary (for dashboard)
   */
  static async getSummary(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total_days: number
    days_with_attendance: number
    green_days: number
    yellow_days: number
    red_days: number
    average_coverage: number
    total_gaps: number
  }> {
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days: ReconciliationResult[] = []

      // Calculate for each day
      let currentDate = new Date(start)
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayRec = await this.calculateCoverage(employeeId, dateStr)
        days.push(dayRec)

        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Calculate summary
      const daysWithAttendance = days.filter(d => d.status !== 'no_attendance')
      const greenDays = days.filter(d => d.status === 'green').length
      const yellowDays = days.filter(d => d.status === 'yellow').length
      const redDays = days.filter(d => d.status === 'red').length

      const avgCoverage = daysWithAttendance.length > 0
        ? Math.round(daysWithAttendance.reduce((sum, d) => sum + d.coverage_percent, 0) / daysWithAttendance.length)
        : 0

      const totalGaps = days.filter(d => d.has_gaps).length

      return {
        total_days: days.length,
        days_with_attendance: daysWithAttendance.length,
        green_days: greenDays,
        yellow_days: yellowDays,
        red_days: redDays,
        average_coverage: avgCoverage,
        total_gaps: totalGaps
      }
    } catch (error) {
      console.error('Get summary error:', error)
      return {
        total_days: 0,
        days_with_attendance: 0,
        green_days: 0,
        yellow_days: 0,
        red_days: 0,
        average_coverage: 0,
        total_gaps: 0
      }
    }
  }
}
