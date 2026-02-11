-- Migration: Extend time_rules for reconciliation
-- Purpose: Add reconciliation and overtime rules
-- IMPORTANT: ONLY ADD COLUMN - NO CHANGES TO EXISTING DATA
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. ADD NEW COLUMNS TO time_rules (ADDITIVE ONLY!)
-- ============================================================================

-- Reconciliation settings
ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS reconciliation_tolerance_percent DECIMAL(5,2) DEFAULT 5.00
  CHECK (reconciliation_tolerance_percent >= 0 AND reconciliation_tolerance_percent <= 100);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS require_reconciliation BOOLEAN DEFAULT true;

-- Minimum break rules
ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS min_breaks_minutes INTEGER DEFAULT 30
  CHECK (min_breaks_minutes >= 0);

-- Overtime limits
ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS overtime_daily_minutes INTEGER DEFAULT 600 -- 10h
  CHECK (overtime_daily_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS overtime_weekly_minutes INTEGER DEFAULT 2880 -- 48h
  CHECK (overtime_weekly_minutes >= 0);

-- Work time limits (optional)
ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS max_work_day_minutes INTEGER DEFAULT 600 -- 10h
  CHECK (max_work_day_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS max_work_week_minutes INTEGER DEFAULT 2880 -- 48h
  CHECK (max_work_week_minutes >= 0);

-- Reconciliation workflow
ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS auto_submit_on_coverage BOOLEAN DEFAULT false; -- Auto-submit if coverage is good

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS coverage_green_min DECIMAL(5,2) DEFAULT 95.00; -- >=95% = green
ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS coverage_yellow_min DECIMAL(5,2) DEFAULT 90.00; -- 90-95% = yellow
-- <90% = red

-- ============================================================================
-- 2. BACKFILL DEFAULTS FOR EXISTING RULES
-- ============================================================================

-- Set defaults for existing records (where NULL)
UPDATE public.time_rules
SET
  reconciliation_tolerance_percent = 5.00,
  require_reconciliation = true,
  min_breaks_minutes = 30,
  overtime_daily_minutes = 600,
  overtime_weekly_minutes = 2880,
  max_work_day_minutes = 600,
  max_work_week_minutes = 2880,
  auto_submit_on_coverage = false,
  coverage_green_min = 95.00,
  coverage_yellow_min = 90.00
WHERE
  reconciliation_tolerance_percent IS NULL
  OR require_reconciliation IS NULL
  OR min_breaks_minutes IS NULL
  OR overtime_daily_minutes IS NULL
  OR overtime_weekly_minutes IS NULL;

-- ============================================================================
-- 3. HELPER FUNCTION: Get active rules for company
-- ============================================================================

CREATE OR REPLACE FUNCTION get_time_rules(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  round_to_minutes INTEGER,
  round_direction TEXT,
  min_work_duration_minutes INTEGER,
  min_break_duration_minutes INTEGER,
  auto_break_after_minutes INTEGER,
  auto_break_duration_minutes INTEGER,
  reconciliation_tolerance_percent DECIMAL,
  require_reconciliation BOOLEAN,
  min_breaks_minutes INTEGER,
  overtime_daily_minutes INTEGER,
  overtime_weekly_minutes INTEGER,
  max_work_day_minutes INTEGER,
  max_work_week_minutes INTEGER,
  coverage_green_min DECIMAL,
  coverage_yellow_min DECIMAL
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    id,
    round_to_minutes,
    round_direction,
    min_work_duration_minutes,
    min_break_duration_minutes,
    auto_break_after_minutes,
    auto_break_duration_minutes,
    reconciliation_tolerance_percent,
    require_reconciliation,
    min_breaks_minutes,
    overtime_daily_minutes,
    overtime_weekly_minutes,
    max_work_day_minutes,
    max_work_week_minutes,
    coverage_green_min,
    coverage_yellow_min
  FROM time_rules
  WHERE company_id = p_company_id
  AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- ============================================================================
-- 4. VALIDATION FUNCTION: Check overtime limits
-- ============================================================================

CREATE OR REPLACE FUNCTION check_overtime_limits(
  p_employee_id UUID,
  p_date DATE,
  p_work_minutes INTEGER
)
RETURNS TABLE (
  violates_daily BOOLEAN,
  violates_weekly BOOLEAN,
  daily_limit INTEGER,
  weekly_limit INTEGER,
  daily_total INTEGER,
  weekly_total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_rules RECORD;
  v_daily_total INTEGER;
  v_weekly_total INTEGER;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  -- Get employee's company
  SELECT company_id INTO v_company_id
  FROM employees
  WHERE id = p_employee_id;

  -- Get rules
  SELECT * INTO v_rules
  FROM get_time_rules(v_company_id);

  -- Calculate week boundaries (Monday to Sunday)
  v_week_start := DATE_TRUNC('week', p_date)::DATE;
  v_week_end := v_week_start + INTERVAL '6 days';

  -- Calculate daily total (including new minutes)
  SELECT COALESCE(SUM(work_minutes), 0) + p_work_minutes
  INTO v_daily_total
  FROM attendance
  WHERE employee_id = p_employee_id
  AND date = p_date;

  -- Calculate weekly total (including new minutes)
  SELECT COALESCE(SUM(work_minutes), 0) + p_work_minutes
  INTO v_weekly_total
  FROM attendance
  WHERE employee_id = p_employee_id
  AND date >= v_week_start
  AND date <= v_week_end;

  -- Return results
  RETURN QUERY SELECT
    v_daily_total > v_rules.overtime_daily_minutes AS violates_daily,
    v_weekly_total > v_rules.overtime_weekly_minutes AS violates_weekly,
    v_rules.overtime_daily_minutes AS daily_limit,
    v_rules.overtime_weekly_minutes AS weekly_limit,
    v_daily_total AS daily_total,
    v_weekly_total AS weekly_total;
END;
$$;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.time_rules.reconciliation_tolerance_percent IS 'Allowed difference between attendance and project time (e.g., 5% = 5 minutes per 100 minutes)';
COMMENT ON COLUMN public.time_rules.require_reconciliation IS 'If true, employees must reconcile attendance with project time before submission';
COMMENT ON COLUMN public.time_rules.min_breaks_minutes IS 'Minimum required break time per day (e.g., 30 minutes)';
COMMENT ON COLUMN public.time_rules.overtime_daily_minutes IS 'Maximum work minutes per day (e.g., 600 = 10 hours)';
COMMENT ON COLUMN public.time_rules.overtime_weekly_minutes IS 'Maximum work minutes per week (e.g., 2880 = 48 hours)';
COMMENT ON COLUMN public.time_rules.coverage_green_min IS 'Coverage >= this % = GREEN (e.g., 95%)';
COMMENT ON COLUMN public.time_rules.coverage_yellow_min IS 'Coverage >= this % = YELLOW (e.g., 90%)';

COMMENT ON FUNCTION check_overtime_limits IS 'Check if work time violates daily/weekly overtime limits';
COMMENT ON FUNCTION get_time_rules IS 'Get active time rules for a company';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- SELECT * FROM time_rules;
-- SELECT * FROM get_time_rules('<company_id>');
-- SELECT * FROM check_overtime_limits('<employee_id>', CURRENT_DATE, 600);
