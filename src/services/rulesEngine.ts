/**
 * Rules Engine
 * Validates time entries, applies rounding rules, calculates auto-breaks
 */

import { supabase } from '@/integrations/supabase/client'

export interface TimeRules {
  id: string
  company_id: string
  round_to_minutes: number
  round_direction: 'up' | 'down' | 'nearest'
  min_work_duration_minutes: number
  min_break_duration_minutes: number
  auto_break_after_minutes: number | null
  auto_break_duration_minutes: number | null
  reconciliation_tolerance_percent: number
  require_reconciliation: boolean
  min_breaks_minutes: number
  overtime_daily_minutes: number
  overtime_weekly_minutes: number
  max_work_day_minutes: number
  max_work_week_minutes: number
  coverage_green_min: number
  coverage_yellow_min: number
}

export interface OverlapCheck {
  hasOverlap: boolean
  conflictingEntry?: {
    id: string
    start_time: string
    end_time: string
    project_id?: string
  }
}

export interface OvertimeCheck {
  violates_daily: boolean
  violates_weekly: boolean
  daily_limit: number
  weekly_limit: number
  daily_total: number
  weekly_total: number
}

export class RulesEngine {
  /**
   * Get active rules for a company
   */
  static async getRules(companyId: string): Promise<TimeRules | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_time_rules', { p_company_id: companyId })
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Get rules error:', error)
      return null
    }
  }

  /**
   * Apply rounding to minutes
   */
  static applyRounding(
    minutes: number,
    roundTo: number,
    direction: 'up' | 'down' | 'nearest'
  ): number {
    if (roundTo <= 1) return minutes

    switch (direction) {
      case 'up':
        return Math.ceil(minutes / roundTo) * roundTo
      case 'down':
        return Math.floor(minutes / roundTo) * roundTo
      case 'nearest':
      default:
        return Math.round(minutes / roundTo) * roundTo
    }
  }

  /**
   * Calculate auto-break based on work duration
   */
  static calculateAutoBreak(
    clockIn: Date,
    clockOut: Date,
    rules: TimeRules
  ): number {
    if (!rules.auto_break_after_minutes || !rules.auto_break_duration_minutes) {
      return 0
    }

    const workMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000 / 60)

    // If work duration exceeds threshold, apply auto-break
    if (workMinutes >= rules.auto_break_after_minutes) {
      return rules.auto_break_duration_minutes
    }

    return 0
  }

  /**
   * Check for overlapping time entries
   */
  static async checkOverlap(
    employeeId: string,
    startTime: string,
    endTime: string,
    excludeEntryId?: string
  ): Promise<OverlapCheck> {
    try {
      let query = supabase
        .from('time_entries')
        .select('id, start_time, end_time, project_id')
        .eq('employee_id', employeeId)
        .not('end_time', 'is', null)

      if (excludeEntryId) {
        query = query.neq('id', excludeEntryId)
      }

      const { data, error } = await query

      if (error) throw error

      // Check for overlaps
      const start = new Date(startTime)
      const end = new Date(endTime)

      for (const entry of data || []) {
        const entryStart = new Date(entry.start_time)
        const entryEnd = new Date(entry.end_time!)

        // Check if ranges overlap
        if (
          (start >= entryStart && start < entryEnd) ||
          (end > entryStart && end <= entryEnd) ||
          (start <= entryStart && end >= entryEnd)
        ) {
          return {
            hasOverlap: true,
            conflictingEntry: entry
          }
        }
      }

      return { hasOverlap: false }
    } catch (error) {
      console.error('Check overlap error:', error)
      return { hasOverlap: false }
    }
  }

  /**
   * Check overtime limits
   */
  static async checkOvertimeLimits(
    employeeId: string,
    date: string,
    workMinutes: number
  ): Promise<OvertimeCheck | null> {
    try {
      const { data, error } = await supabase
        .rpc('check_overtime_limits', {
          p_employee_id: employeeId,
          p_date: date,
          p_work_minutes: workMinutes
        })
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Check overtime limits error:', error)
      return null
    }
  }

  /**
   * Validate minimum break requirement
   */
  static validateMinBreak(
    workMinutes: number,
    breakMinutes: number,
    rules: TimeRules
  ): { isValid: boolean; required: number; actual: number } {
    // Check if minimum break is required
    const required = rules.min_breaks_minutes

    return {
      isValid: breakMinutes >= required,
      required,
      actual: breakMinutes
    }
  }

  /**
   * Validate minimum work duration
   */
  static validateMinWorkDuration(
    workMinutes: number,
    rules: TimeRules
  ): boolean {
    return workMinutes >= rules.min_work_duration_minutes
  }

  /**
   * Check if week is locked
   */
  static async isWeekLocked(
    employeeId: string,
    date: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('is_week_locked', {
          p_employee_id: employeeId,
          p_date: date
        })

      if (error) throw error
      return data as boolean
    } catch (error) {
      console.error('Check week locked error:', error)
      return false
    }
  }

  /**
   * Validate time entry against all rules
   */
  static async validateTimeEntry(
    employeeId: string,
    startTime: string,
    endTime: string,
    breakMinutes: number = 0,
    companyId: string,
    excludeEntryId?: string
  ): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Get rules
      const rules = await this.getRules(companyId)
      if (!rules) {
        errors.push('Could not load company rules')
        return { isValid: false, errors, warnings }
      }

      // Calculate work minutes
      const start = new Date(startTime)
      const end = new Date(endTime)
      const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 1000 / 60)
      const workMinutes = totalMinutes - breakMinutes

      // Check week lock
      const isLocked = await this.isWeekLocked(employeeId, startTime.split('T')[0])
      if (isLocked) {
        errors.push('Week is locked. Cannot modify time entries.')
        return { isValid: false, errors, warnings }
      }

      // Check overlap
      const overlapCheck = await this.checkOverlap(employeeId, startTime, endTime, excludeEntryId)
      if (overlapCheck.hasOverlap) {
        errors.push('Time entry overlaps with existing entry')
      }

      // Check minimum work duration
      if (!this.validateMinWorkDuration(workMinutes, rules)) {
        warnings.push(`Work duration (${workMinutes} min) is below minimum (${rules.min_work_duration_minutes} min)`)
      }

      // Check minimum break
      const breakValidation = this.validateMinBreak(workMinutes, breakMinutes, rules)
      if (!breakValidation.isValid && workMinutes >= 360) { // Only check for shifts >= 6h
        warnings.push(`Break duration (${breakMinutes} min) is below minimum (${rules.min_breaks_minutes} min)`)
      }

      // Check overtime
      const overtimeCheck = await this.checkOvertimeLimits(
        employeeId,
        startTime.split('T')[0],
        workMinutes
      )

      if (overtimeCheck) {
        if (overtimeCheck.violates_daily) {
          warnings.push(`Daily work time (${overtimeCheck.daily_total} min) exceeds limit (${overtimeCheck.daily_limit} min)`)
        }
        if (overtimeCheck.violates_weekly) {
          warnings.push(`Weekly work time (${overtimeCheck.weekly_total} min) exceeds limit (${overtimeCheck.weekly_limit} min)`)
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      console.error('Validate time entry error:', error)
      errors.push('Validation failed')
      return { isValid: false, errors, warnings }
    }
  }
}
