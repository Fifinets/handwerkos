-- Migration: Timesheet Locks (Wochensperren)
-- Purpose: Lock weeks to prevent further changes after approval
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. CREATE TIMESHEET_LOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.timesheet_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- References
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Week identification (Monday of the week)
  week_start_date DATE NOT NULL,

  -- Lock information
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  locked_by UUID NOT NULL REFERENCES public.employees(id),

  -- Optional: Unlock (for corrections)
  unlocked_at TIMESTAMP WITH TIME ZONE,
  unlocked_by UUID REFERENCES public.employees(id),
  unlock_reason TEXT,

  -- Reason for lock
  reason TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint: One lock per employee per week
  CONSTRAINT unique_lock_per_employee_week UNIQUE (employee_id, week_start_date)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_timesheet_locks_employee ON public.timesheet_locks(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_locks_company ON public.timesheet_locks(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_locks_week ON public.timesheet_locks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_locks_active ON public.timesheet_locks(unlocked_at) WHERE unlocked_at IS NULL;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE public.timesheet_locks ENABLE ROW LEVEL SECURITY;

-- Employees can view their own locks
CREATE POLICY IF NOT EXISTS "Employees can view own locks" ON public.timesheet_locks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = timesheet_locks.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Only managers can create/manage locks
CREATE POLICY IF NOT EXISTS "Managers can manage locks" ON public.timesheet_locks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = timesheet_locks.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Check if a week is locked for an employee
CREATE OR REPLACE FUNCTION is_week_locked(
  p_employee_id UUID,
  p_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start DATE;
  v_locked BOOLEAN;
BEGIN
  -- Calculate week start (Monday)
  v_week_start := DATE_TRUNC('week', p_date)::DATE;

  -- Check if lock exists and is active (not unlocked)
  SELECT EXISTS (
    SELECT 1 FROM timesheet_locks
    WHERE employee_id = p_employee_id
    AND week_start_date = v_week_start
    AND unlocked_at IS NULL
  ) INTO v_locked;

  RETURN v_locked;
END;
$$;

-- Lock a week for an employee
CREATE OR REPLACE FUNCTION lock_week(
  p_employee_id UUID,
  p_week_start_date DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_id UUID;
  v_locked_by UUID;
BEGIN
  -- Get current user's employee ID
  SELECT id INTO v_locked_by
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_locked_by IS NULL THEN
    RAISE EXCEPTION 'Only employees can lock weeks'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Insert lock (or do nothing if already exists)
  INSERT INTO timesheet_locks (
    employee_id,
    company_id,
    week_start_date,
    locked_by,
    reason
  )
  SELECT
    p_employee_id,
    e.company_id,
    DATE_TRUNC('week', p_week_start_date)::DATE,
    v_locked_by,
    p_reason
  FROM employees e
  WHERE e.id = p_employee_id
  ON CONFLICT (employee_id, week_start_date) DO NOTHING
  RETURNING id INTO v_lock_id;

  RETURN v_lock_id;
END;
$$;

-- Unlock a week (for corrections)
CREATE OR REPLACE FUNCTION unlock_week(
  p_employee_id UUID,
  p_week_start_date DATE,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unlocked_by UUID;
BEGIN
  -- Get current user's employee ID
  SELECT id INTO v_unlocked_by
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_unlocked_by IS NULL THEN
    RAISE EXCEPTION 'Only employees can unlock weeks'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Update lock
  UPDATE timesheet_locks
  SET
    unlocked_at = timezone('utc'::text, now()),
    unlocked_by = v_unlocked_by,
    unlock_reason = p_reason
  WHERE employee_id = p_employee_id
  AND week_start_date = DATE_TRUNC('week', p_week_start_date)::DATE
  AND unlocked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- 5. TRIGGERS: Prevent modification of locked time entries
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_locked_week_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id UUID;
  v_date DATE;
BEGIN
  -- Determine employee_id and date based on table
  IF TG_TABLE_NAME = 'attendance' THEN
    v_employee_id := NEW.employee_id;
    v_date := NEW.date;
  ELSIF TG_TABLE_NAME = 'time_entries' THEN
    v_employee_id := NEW.employee_id;
    v_date := NEW.start_time::DATE;
  ELSE
    RETURN NEW; -- Unknown table, skip
  END IF;

  -- Check if week is locked
  IF is_week_locked(v_employee_id, v_date) THEN
    RAISE EXCEPTION 'Week is locked. Cannot modify % for employee % on date %',
      TG_TABLE_NAME, v_employee_id, v_date
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'prevent_locked_week_modification_attendance'
  ) THEN
    CREATE TRIGGER prevent_locked_week_modification_attendance
      BEFORE INSERT OR UPDATE ON public.attendance
      FOR EACH ROW
      EXECUTE FUNCTION prevent_locked_week_modification();
  END IF;
END $$;

-- Apply trigger to time_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'prevent_locked_week_modification_time_entries'
  ) THEN
    CREATE TRIGGER prevent_locked_week_modification_time_entries
      BEFORE INSERT OR UPDATE ON public.time_entries
      FOR EACH ROW
      EXECUTE FUNCTION prevent_locked_week_modification();
  END IF;
END $$;

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.timesheet_locks IS 'Week-level locks to prevent modifications after approval';
COMMENT ON COLUMN public.timesheet_locks.week_start_date IS 'Monday of the locked week';
COMMENT ON FUNCTION is_week_locked IS 'Check if a week is locked for an employee (true if locked and not unlocked)';
COMMENT ON FUNCTION lock_week IS 'Lock a week for an employee. Returns lock ID.';
COMMENT ON FUNCTION unlock_week IS 'Unlock a week for corrections. Returns true if successful.';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- SELECT * FROM timesheet_locks;
-- SELECT is_week_locked('<employee_id>', CURRENT_DATE);
-- SELECT lock_week('<employee_id>', CURRENT_DATE, 'Weekly approval');
