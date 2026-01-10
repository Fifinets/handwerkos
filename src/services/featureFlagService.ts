/**
 * Feature Flag Service
 * Manages feature flags for opt-in beta features
 *
 * Usage:
 *   const isDualModeEnabled = await FeatureFlagService.isEnabled('ff_dual_time_tracking')
 */

import { supabase } from '@/integrations/supabase/client'

export interface FeatureFlag {
  id: string
  flag_name: string
  description: string | null
  enabled: boolean
  company_id: string | null
  created_at: string
  updated_at: string
}

export class FeatureFlagService {
  /**
   * Check if a feature flag is enabled
   * Checks company-specific flag first, then falls back to global flag
   */
  static async isEnabled(
    flagName: string,
    companyId?: string
  ): Promise<boolean> {
    try {
      // Use the database function for proper logic
      const { data, error } = await supabase
        .rpc('is_feature_enabled', {
          p_flag_name: flagName,
          p_company_id: companyId || null
        })

      if (error) {
        console.error('Error checking feature flag:', error)
        return false
      }

      return data as boolean
    } catch (error) {
      console.error('Feature flag check failed:', error)
      return false
    }
  }

  /**
   * Get all flags for a company (or global flags)
   */
  static async getFlags(companyId?: string): Promise<FeatureFlag[]> {
    try {
      let query = supabase
        .from('feature_flags')
        .select('*')
        .order('flag_name')

      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`)
      } else {
        query = query.is('company_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching feature flags:', error)
      return []
    }
  }

  /**
   * Enable a feature flag (admin only)
   */
  static async enableFlag(
    flagName: string,
    companyId?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled: true })
        .eq('flag_name', flagName)
        .eq('company_id', companyId || null)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error enabling feature flag:', error)
      return false
    }
  }

  /**
   * Disable a feature flag (admin only)
   */
  static async disableFlag(
    flagName: string,
    companyId?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled: false })
        .eq('flag_name', flagName)
        .eq('company_id', companyId || null)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error disabling feature flag:', error)
      return false
    }
  }

  /**
   * Create a new feature flag
   */
  static async createFlag(
    flagName: string,
    description: string,
    enabled: boolean = false,
    companyId?: string
  ): Promise<FeatureFlag | null> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .insert({
          flag_name: flagName,
          description,
          enabled,
          company_id: companyId || null
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating feature flag:', error)
      return null
    }
  }
}

// Shortcut functions for common flags
export const DualTimeTrackingFlag = {
  async isEnabled(companyId?: string): Promise<boolean> {
    return FeatureFlagService.isEnabled('ff_dual_time_tracking', companyId)
  },

  async enable(companyId?: string): Promise<boolean> {
    return FeatureFlagService.enableFlag('ff_dual_time_tracking', companyId)
  },

  async disable(companyId?: string): Promise<boolean> {
    return FeatureFlagService.disableFlag('ff_dual_time_tracking', companyId)
  }
}
