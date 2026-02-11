-- Migration: Feature Flags System
-- Purpose: Enable/disable features per company (opt-in for dual time tracking)
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. CREATE FEATURE_FLAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Flag identifier
  flag_name TEXT UNIQUE NOT NULL,

  -- Description for admins
  description TEXT,

  -- Global enable/disable
  enabled BOOLEAN DEFAULT false,

  -- Optional: Enable per company
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint: One flag per company (or global if company_id is NULL)
  CONSTRAINT unique_flag_per_company UNIQUE (flag_name, company_id)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_feature_flags_company ON public.feature_flags(company_id) WHERE company_id IS NOT NULL;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Managers can view flags for their company
CREATE POLICY IF NOT EXISTS "Managers can view company feature flags" ON public.feature_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND (employees.company_id = feature_flags.company_id OR feature_flags.company_id IS NULL)
      AND employees.role IN ('manager', 'admin')
    )
  );

-- Only admins can manage flags
CREATE POLICY IF NOT EXISTS "Admins can manage feature flags" ON public.feature_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- ============================================================================
-- 4. SEED DUAL TIME TRACKING FLAG (disabled by default)
-- ============================================================================

INSERT INTO public.feature_flags (flag_name, description, enabled)
VALUES (
  'ff_dual_time_tracking',
  'Enable dual time tracking: Arbeitszeit (attendance) + Projektzeiten (time entries)',
  false
)
ON CONFLICT (flag_name, company_id) DO NOTHING;

-- ============================================================================
-- 5. HELPER FUNCTION: Check if flag is enabled
-- ============================================================================

CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_name TEXT,
  p_company_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  -- Check company-specific flag first
  IF p_company_id IS NOT NULL THEN
    SELECT enabled INTO v_enabled
    FROM feature_flags
    WHERE flag_name = p_flag_name
    AND company_id = p_company_id
    LIMIT 1;

    IF FOUND THEN
      RETURN v_enabled;
    END IF;
  END IF;

  -- Fallback to global flag
  SELECT enabled INTO v_enabled
  FROM feature_flags
  WHERE flag_name = p_flag_name
  AND company_id IS NULL
  LIMIT 1;

  RETURN COALESCE(v_enabled, false);
END;
$$;

-- ============================================================================
-- 6. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_updated_at_trigger
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.feature_flags IS 'Feature flags for opt-in beta features. Use is_feature_enabled() to check.';
COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature flag is enabled. Checks company-specific first, then global.';

-- ============================================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================================
-- SELECT flag_name, enabled, company_id FROM feature_flags;
-- SELECT is_feature_enabled('ff_dual_time_tracking'); -- Should return false
