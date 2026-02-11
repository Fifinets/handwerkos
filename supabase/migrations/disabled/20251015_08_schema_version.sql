-- Migration: Schema Version Tracking
-- Purpose: Track database schema versions for safe migrations
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. CREATE SCHEMA_VERSION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_schema_version (
  version TEXT PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  applied_by UUID REFERENCES auth.users(id),
  migration_time_ms INTEGER, -- How long did migration take?
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT -- Optional: SQL to rollback this migration
);

-- ============================================================================
-- 2. CREATE INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_schema_version_applied_at ON public.app_schema_version(applied_at DESC);

-- ============================================================================
-- 3. ENABLE RLS (Only admins can view)
-- ============================================================================

ALTER TABLE public.app_schema_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Only admins can view schema versions" ON public.app_schema_version
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Only admins can insert schema versions" ON public.app_schema_version
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Get current schema version
CREATE OR REPLACE FUNCTION get_current_schema_version()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT version
  FROM app_schema_version
  WHERE success = true
  ORDER BY applied_at DESC
  LIMIT 1;
$$;

-- Check if version is applied
CREATE OR REPLACE FUNCTION is_version_applied(p_version TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_schema_version
    WHERE version = p_version
    AND success = true
  );
$$;

-- Register new version
CREATE OR REPLACE FUNCTION register_schema_version(
  p_version TEXT,
  p_description TEXT,
  p_migration_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO app_schema_version (
    version,
    description,
    applied_by,
    migration_time_ms,
    success
  ) VALUES (
    p_version,
    p_description,
    auth.uid(),
    p_migration_time_ms,
    true
  )
  ON CONFLICT (version) DO UPDATE SET
    applied_at = timezone('utc'::text, now()),
    applied_by = auth.uid(),
    migration_time_ms = EXCLUDED.migration_time_ms,
    success = true;
END;
$$;

-- ============================================================================
-- 5. REGISTER DUAL TIME TRACKING SCHEMA
-- ============================================================================

-- Register this migration
DO $$
BEGIN
  IF NOT is_version_applied('1.0.0-dual-time-tracking') THEN
    PERFORM register_schema_version(
      '1.0.0-dual-time-tracking',
      'Initial dual time tracking system: attendance, cost_centers, extended time_entries, audit_log, timesheet_locks'
    );
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE MIGRATION_LOG TABLE (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.migration_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_file TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  execution_time_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'rolled_back')),
  error_message TEXT,
  executed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_migration_log_executed_at ON public.migration_log(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_log_status ON public.migration_log(status);

-- Enable RLS
ALTER TABLE public.migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Only admins can view migration log" ON public.migration_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- ============================================================================
-- 7. LOG ALL DUAL TIME TRACKING MIGRATIONS
-- ============================================================================

DO $$
BEGIN
  -- Log feature_flags migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_01_feature_flags.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log attendance migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_02_attendance.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log cost_centers migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_03_cost_centers.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log extend_time_entries migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_04_extend_time_entries.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log timesheet_locks migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_05_timesheet_locks.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log audit_log migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_06_audit_log.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log extend_time_rules migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_07_extend_time_rules.sql', 'success')
  ON CONFLICT DO NOTHING;

  -- Log schema_version migration
  INSERT INTO migration_log (migration_file, status)
  VALUES ('20251015_08_schema_version.sql', 'success')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.app_schema_version IS 'Track major schema versions for safe migrations and rollbacks';
COMMENT ON TABLE public.migration_log IS 'Detailed log of individual migration file executions';
COMMENT ON FUNCTION get_current_schema_version IS 'Returns the latest successfully applied schema version';
COMMENT ON FUNCTION is_version_applied IS 'Check if a specific version has been applied';
COMMENT ON FUNCTION register_schema_version IS 'Register a new schema version after successful migration';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- SELECT get_current_schema_version();
-- SELECT * FROM app_schema_version ORDER BY applied_at DESC;
-- SELECT * FROM migration_log ORDER BY executed_at DESC;
-- SELECT is_version_applied('1.0.0-dual-time-tracking');
