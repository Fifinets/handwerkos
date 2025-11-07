/**
 * Feature Flag Hook
 * React hook for checking feature flags
 *
 * Usage:
 *   const isDualModeEnabled = useDualTimeTracking()
 *   const isEnabled = useFeatureFlag('ff_some_feature')
 */

import { useState, useEffect } from 'react'
import { FeatureFlagService } from '@/services/featureFlagService'
import { supabase } from '@/integrations/supabase/client'

/**
 * Generic feature flag hook
 */
export function useFeatureFlag(flagName: string): boolean {
  const [isEnabled, setIsEnabled] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true

    const checkFlag = async () => {
      try {
        setIsLoading(true)

        // Get user's company_id
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsEnabled(false)
          return
        }

        // Get profile with company_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        const companyId = profile?.company_id

        // Check flag
        const enabled = await FeatureFlagService.isEnabled(flagName, companyId)

        if (mounted) {
          setIsEnabled(enabled)
        }
      } catch (error) {
        console.error('Error checking feature flag:', error)
        if (mounted) {
          setIsEnabled(false)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    checkFlag()

    return () => {
      mounted = false
    }
  }, [flagName])

  return isEnabled
}

/**
 * Shortcut hook for dual time tracking feature
 */
export function useDualTimeTracking(): {
  enabled: boolean
  isLoading: boolean
} {
  const [enabled, setEnabled] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true

    const checkFlag = async () => {
      try {
        setIsLoading(true)

        // Get user's company_id
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setEnabled(false)
          setIsLoading(false)
          return
        }

        // Get profile with company_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        const companyId = profile?.company_id

        // Check flag
        const isEnabled = await FeatureFlagService.isEnabled('ff_dual_time_tracking', companyId)

        if (mounted) {
          setEnabled(isEnabled)
        }
      } catch (error) {
        console.error('Error checking dual time tracking flag:', error)
        if (mounted) {
          setEnabled(false)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    checkFlag()

    return () => {
      mounted = false
    }
  }, [])

  return { enabled, isLoading }
}

/**
 * Hook with caching for better performance
 */
export function useFeatureFlagCached(flagName: string): {
  enabled: boolean
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const [enabled, setEnabled] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const checkFlag = async () => {
    try {
      setIsLoading(true)

      // Check cache first
      const cacheKey = `ff_${flagName}`
      const cached = sessionStorage.getItem(cacheKey)
      const cacheTime = sessionStorage.getItem(`${cacheKey}_time`)

      // Use cache if less than 5 minutes old
      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime)
        if (age < 5 * 60 * 1000) {
          setEnabled(cached === 'true')
          setIsLoading(false)
          return
        }
      }

      // Get user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setEnabled(false)
        return
      }

      // Get profile with company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      const companyId = profile?.company_id

      // Check flag
      const isEnabled = await FeatureFlagService.isEnabled(flagName, companyId)

      // Update cache
      sessionStorage.setItem(cacheKey, isEnabled.toString())
      sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString())

      setEnabled(isEnabled)
    } catch (error) {
      console.error('Error checking feature flag:', error)
      setEnabled(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkFlag()
  }, [flagName])

  return {
    enabled,
    isLoading,
    refresh: checkFlag
  }
}
