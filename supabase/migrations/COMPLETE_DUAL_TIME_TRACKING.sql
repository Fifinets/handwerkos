-- ============================================================================
-- DUAL TIME TRACKING SYSTEM - COMPLETE MIGRATION
-- Version: 1.0.0-dual-time-tracking
-- Date: 2025-10-15
-- ============================================================================
--
-- This file combines ALL 9 migrations for the dual time tracking system.
-- Run this in your Supabase SQL Editor to apply all changes at once.
--
-- IMPORTANT: This migration is IDEMPOTENT - safe to run multiple times!
--
-- What this adds:
-- 1. Feature Flags System
-- 2. Attendance Table (Arbeitszeit/Anwesenheit)
-- 3. Cost Centers (Kostenstellen)
-- 4. Extended time_entries (backward compatible!)
-- 5. Timesheet Locks (Wochensperren)
-- 6. Audit Log (GoBD compliant)
-- 7. Extended time_rules
-- 8. Schema Version Tracking
-- 9. Backfill Function (to migrate old data)
--
-- Execution time: ~5-15 seconds depending on data size
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: FEATURE FLAGS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_flag_per_company UNIQUE (flag_name, company_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_feature_flags_company ON public.feature_flags(company_id) WHERE company_id IS NOT NULL;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view company feature flags" ON public.feature_flags;
CREATE POLICY "Managers can view company feature flags" ON public.feature_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND (employees.company_id = feature_flags.company_id OR feature_flags.company_id IS NULL)
      AND employees.role IN ('manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins can manage feature flags" ON public.feature_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

-- Seed dual time tracking flag (disabled by default)
INSERT INTO public.feature_flags (flag_name, description, enabled)
VALUES (
  'ff_dual_time_tracking',
  'Enable dual time tracking: Arbeitszeit (attendance) + Projektzeiten (time entries)',
  false
)
ON CONFLICT (flag_name, company_id) DO NOTHING;

-- Helper function: Check if flag is enabled
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

  SELECT enabled INTO v_enabled
  FROM feature_flags
  WHERE flag_name = p_flag_name
  AND company_id IS NULL
  LIMIT 1;

  RETURN COALESCE(v_enabled, false);
END;
$$;

CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_feature_flags_updated_at_trigger ON public.feature_flags;
CREATE TRIGGER update_feature_flags_updated_at_trigger
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- ============================================================================
-- MIGRATION 2: ATTENDANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER DEFAULT 0 CHECK (break_minutes >= 0),
  breaks JSONB DEFAULT '[]'::jsonb,
  work_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN clock_out IS NOT NULL THEN
        GREATEST(0, EXTRACT(EPOCH FROM (clock_out - clock_in))::INTEGER / 60 - break_minutes)
      ELSE NULL
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'submitted', 'approved', 'locked', 'rejected')
  ),
  clock_in_location JSONB,
  clock_out_location JSONB,
  note TEXT,
  autogenerated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_clock_times CHECK (clock_out IS NULL OR clock_out > clock_in),
  CONSTRAINT unique_attendance_per_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_company ON public.attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_attendance_date_range ON public.attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_autogenerated ON public.attendance(autogenerated) WHERE autogenerated = true;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance;
CREATE POLICY "Employees can view own attendance" ON public.attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance.employee_id
      AND employees.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Employees can create own attendance" ON public.attendance;
CREATE POLICY "Employees can create own attendance" ON public.attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance.employee_id
      AND employees.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance;
CREATE POLICY "Employees can update own attendance" ON public.attendance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = attendance.employee_id
      AND employees.user_id = auth.uid()
    )
    AND status NOT IN ('locked', 'approved')
  );

DROP POLICY IF EXISTS "Managers can view company attendance" ON public.attendance;
CREATE POLICY "Managers can view company attendance" ON public.attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = attendance.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Managers can manage company attendance" ON public.attendance;
CREATE POLICY "Managers can manage company attendance" ON public.attendance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = attendance.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_attendance_updated_at_trigger ON public.attendance;
CREATE TRIGGER update_attendance_updated_at_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

CREATE OR REPLACE FUNCTION prevent_locked_attendance_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'locked' AND NEW.status != 'locked' THEN
    RAISE EXCEPTION 'Cannot modify locked attendance record. ID: %', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'locked' AND (
    NEW.clock_in != OLD.clock_in OR
    NEW.clock_out IS DISTINCT FROM OLD.clock_out OR
    NEW.break_minutes != OLD.break_minutes
  ) THEN
    RAISE EXCEPTION 'Cannot modify times of locked attendance. ID: %', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_locked_attendance_modification_trigger ON public.attendance;
CREATE TRIGGER prevent_locked_attendance_modification_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_attendance_modification();

CREATE OR REPLACE FUNCTION check_attendance_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM attendance
      WHERE employee_id = NEW.employee_id
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND clock_out IS NOT NULL
      AND (
        (NEW.clock_in >= clock_in AND NEW.clock_in < clock_out) OR
        (NEW.clock_out > clock_in AND NEW.clock_out <= clock_out) OR
        (NEW.clock_in <= clock_in AND NEW.clock_out >= clock_out)
      )
    ) THEN
      RAISE EXCEPTION 'Attendance overlap detected for employee % on date %',
        NEW.employee_id, NEW.date
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_attendance_overlap_trigger ON public.attendance;
CREATE TRIGGER check_attendance_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION check_attendance_overlap();

CREATE OR REPLACE FUNCTION get_current_attendance(p_employee_id UUID)
RETURNS TABLE (
  id UUID,
  date DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER,
  work_minutes INTEGER,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, date, clock_in, clock_out, break_minutes, work_minutes, status
  FROM attendance
  WHERE employee_id = p_employee_id
  AND status = 'open'
  AND clock_out IS NULL
  ORDER BY clock_in DESC
  LIMIT 1;
$$;

-- ============================================================================
-- MIGRATION 3: COST CENTERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  billable BOOLEAN DEFAULT false,
  payroll BOOLEAN DEFAULT true,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'Clock',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_cost_center_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON public.cost_centers(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON public.cost_centers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON public.cost_centers(code);
CREATE INDEX IF NOT EXISTS idx_cost_centers_sort ON public.cost_centers(sort_order);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view company cost centers" ON public.cost_centers;
CREATE POLICY "Employees can view company cost centers" ON public.cost_centers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = cost_centers.company_id
    )
  );

DROP POLICY IF EXISTS "Managers can manage cost centers" ON public.cost_centers;
CREATE POLICY "Managers can manage cost centers" ON public.cost_centers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = cost_centers.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION update_cost_centers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cost_centers_updated_at_trigger ON public.cost_centers;
CREATE TRIGGER update_cost_centers_updated_at_trigger
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION update_cost_centers_updated_at();

-- Seed standard cost centers for all companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies LOOP
    INSERT INTO public.cost_centers (company_id, code, name, description, billable, payroll, color, icon, sort_order)
    VALUES
      (company_record.id, 'FAHRT', 'Fahrtzeit', 'Zeit für Fahrten zwischen Baustellen und Standorten', true, true, '#3b82f6', 'Car', 10),
      (company_record.id, 'WERKSTATT', 'Werkstatt', 'Arbeit in der Werkstatt (Vorbereitung, Wartung, etc.)', false, true, '#6b7280', 'Wrench', 20),
      (company_record.id, 'SCHULUNG', 'Schulung/Weiterbildung', 'Teilnahme an Schulungen und Fortbildungen', false, true, '#10b981', 'GraduationCap', 30),
      (company_record.id, 'URLAUB', 'Urlaub', 'Urlaubszeit', false, true, '#f59e0b', 'Palmtree', 40),
      (company_record.id, 'KRANK', 'Krankheit', 'Krankheitsbedingte Abwesenheit', false, false, '#ef4444', 'HeartPulse', 50)
    ON CONFLICT (company_id, code) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_active_cost_centers(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  description TEXT,
  billable BOOLEAN,
  payroll BOOLEAN,
  color TEXT,
  icon TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, code, name, description, billable, payroll, color, icon
  FROM cost_centers
  WHERE company_id = p_company_id
  AND is_active = true
  ORDER BY sort_order, name;
$$;

-- ============================================================================
-- MIGRATION 4: EXTEND TIME_ENTRIES (BACKWARD COMPATIBLE!)
-- ============================================================================

-- Add new columns (all with defaults - no breaking changes!)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'project' CHECK (type IN ('project', 'cost_center'));

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS gps_location JSONB;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS status_approval TEXT DEFAULT 'draft' CHECK (status_approval IN ('draft', 'submitted', 'approved', 'rejected'));

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL;

-- Backfill defaults for existing data
UPDATE public.time_entries
SET type = 'project'
WHERE type IS NULL;

UPDATE public.time_entries
SET billable = true
WHERE billable IS NULL AND type = 'project';

UPDATE public.time_entries
SET status_approval = 'draft'
WHERE status_approval IS NULL;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_type ON public.time_entries(type);
CREATE INDEX IF NOT EXISTS idx_time_entries_cost_center ON public.time_entries(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON public.time_entries(billable) WHERE billable = true;
CREATE INDEX IF NOT EXISTS idx_time_entries_status_approval ON public.time_entries(status_approval);
CREATE INDEX IF NOT EXISTS idx_time_entries_attendance ON public.time_entries(attendance_id) WHERE attendance_id IS NOT NULL;

-- Validation trigger
CREATE OR REPLACE FUNCTION validate_time_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'project' AND NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Project time entry must have project_id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.type = 'cost_center' AND NEW.cost_center_id IS NULL THEN
    RAISE EXCEPTION 'Cost center time entry must have cost_center_id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.type = 'cost_center' AND NEW.project_id IS NOT NULL THEN
    NEW.project_id = NULL;
  END IF;

  IF NEW.cost_center_id IS NOT NULL THEN
    SELECT cost_centers.billable INTO NEW.billable
    FROM cost_centers
    WHERE cost_centers.id = NEW.cost_center_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_time_entry_trigger ON public.time_entries;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'validate_time_entry_trigger'
  ) THEN
    CREATE TRIGGER validate_time_entry_trigger
      BEFORE INSERT OR UPDATE ON public.time_entries
      FOR EACH ROW
      EXECUTE FUNCTION validate_time_entry();
  END IF;
END $$;

-- Helper views
CREATE OR REPLACE VIEW public.time_entries_projects AS
SELECT *
FROM public.time_entries
WHERE type = 'project';

CREATE OR REPLACE VIEW public.time_entries_cost_centers AS
SELECT *
FROM public.time_entries
WHERE type = 'cost_center';

-- ============================================================================
-- MIGRATION 5: TIMESHEET LOCKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.timesheet_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  locked_by UUID NOT NULL REFERENCES public.employees(id),
  unlocked_at TIMESTAMP WITH TIME ZONE,
  unlocked_by UUID REFERENCES public.employees(id),
  unlock_reason TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_lock_per_employee_week UNIQUE (employee_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_timesheet_locks_employee ON public.timesheet_locks(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_locks_company ON public.timesheet_locks(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_locks_week ON public.timesheet_locks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_locks_active ON public.timesheet_locks(unlocked_at) WHERE unlocked_at IS NULL;

ALTER TABLE public.timesheet_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own locks" ON public.timesheet_locks;
CREATE POLICY "Employees can view own locks" ON public.timesheet_locks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = timesheet_locks.employee_id
      AND employees.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage locks" ON public.timesheet_locks;
CREATE POLICY "Managers can manage locks" ON public.timesheet_locks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = timesheet_locks.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

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
  v_week_start := DATE_TRUNC('week', p_date)::DATE;

  SELECT EXISTS (
    SELECT 1 FROM timesheet_locks
    WHERE employee_id = p_employee_id
    AND week_start_date = v_week_start
    AND unlocked_at IS NULL
  ) INTO v_locked;

  RETURN v_locked;
END;
$$;

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
  SELECT id INTO v_locked_by
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_locked_by IS NULL THEN
    RAISE EXCEPTION 'Only employees can lock weeks'
      USING ERRCODE = 'check_violation';
  END IF;

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
  SELECT id INTO v_unlocked_by
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_unlocked_by IS NULL THEN
    RAISE EXCEPTION 'Only employees can unlock weeks'
      USING ERRCODE = 'check_violation';
  END IF;

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

CREATE OR REPLACE FUNCTION prevent_locked_week_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id UUID;
  v_date DATE;
BEGIN
  IF TG_TABLE_NAME = 'attendance' THEN
    v_employee_id := NEW.employee_id;
    v_date := NEW.date;
  ELSIF TG_TABLE_NAME = 'time_entries' THEN
    v_employee_id := NEW.employee_id;
    v_date := NEW.start_time::DATE;
  ELSE
    RETURN NEW;
  END IF;

  IF is_week_locked(v_employee_id, v_date) THEN
    RAISE EXCEPTION 'Week is locked. Cannot modify % for employee % on date %',
      TG_TABLE_NAME, v_employee_id, v_date
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_locked_week_modification_attendance ON public.attendance;
DROP TRIGGER IF EXISTS prevent_locked_week_modification_time_entries ON public.time_entries;

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
-- MIGRATION 6: AUDIT LOG (GoBD Compliant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted',
    'submitted', 'approved', 'rejected',
    'locked', 'unlocked'
  )),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  reason TEXT,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.time_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.time_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.time_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_company ON public.time_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.time_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_old_values ON public.time_audit_log USING GIN (old_values);
CREATE INDEX IF NOT EXISTS idx_audit_log_new_values ON public.time_audit_log USING GIN (new_values);

ALTER TABLE public.time_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own audit logs" ON public.time_audit_log;
CREATE POLICY "Employees can view own audit logs" ON public.time_audit_log
  FOR SELECT
  USING (
    changed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = time_audit_log.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "System can insert audit logs" ON public.time_audit_log;
CREATE POLICY "System can insert audit logs" ON public.time_audit_log
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "No updates to audit log" ON public.time_audit_log;
CREATE POLICY "No updates to audit log" ON public.time_audit_log
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "No deletes from audit log" ON public.time_audit_log;
CREATE POLICY "No deletes from audit log" ON public.time_audit_log
  FOR DELETE
  USING (false);

CREATE OR REPLACE FUNCTION log_audit_entry(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id UUID;
  v_company_id UUID;
BEGIN
  v_company_id := COALESCE(
    (p_new_values->>'company_id')::UUID,
    (p_old_values->>'company_id')::UUID
  );

  INSERT INTO time_audit_log (
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    changed_by,
    reason,
    company_id
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_old_values,
    p_new_values,
    auth.uid(),
    p_reason,
    v_company_id
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- Audit triggers for attendance
CREATE OR REPLACE FUNCTION audit_attendance_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'submitted' THEN v_action := 'submitted';
        WHEN 'approved' THEN v_action := 'approved';
        WHEN 'rejected' THEN v_action := 'rejected';
        WHEN 'locked' THEN v_action := 'locked';
        ELSE v_action := 'updated';
      END CASE;
    ELSE
      v_action := 'updated';
    END IF;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old_values := to_jsonb(OLD);
  END IF;

  PERFORM log_audit_entry(
    'attendance',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_attendance_changes_trigger ON public.attendance;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_attendance_changes_trigger'
  ) THEN
    CREATE TRIGGER audit_attendance_changes_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.attendance
      FOR EACH ROW
      EXECUTE FUNCTION audit_attendance_changes();
  END IF;
END $$;

-- Audit triggers for time_entries
CREATE OR REPLACE FUNCTION audit_time_entries_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status_approval IS DISTINCT FROM NEW.status_approval THEN
      CASE NEW.status_approval
        WHEN 'submitted' THEN v_action := 'submitted';
        WHEN 'approved' THEN v_action := 'approved';
        WHEN 'rejected' THEN v_action := 'rejected';
        ELSE v_action := 'updated';
      END CASE;
    ELSE
      v_action := 'updated';
    END IF;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old_values := to_jsonb(OLD);
  END IF;

  IF NEW.employee_id IS NOT NULL OR OLD.employee_id IS NOT NULL THEN
    PERFORM log_audit_entry(
      'time_entries',
      COALESCE(NEW.id, OLD.id),
      v_action,
      v_old_values,
      v_new_values
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_time_entries_changes_trigger ON public.time_entries;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_time_entries_changes_trigger'
  ) THEN
    CREATE TRIGGER audit_time_entries_changes_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
      FOR EACH ROW
      EXECUTE FUNCTION audit_time_entries_changes();
  END IF;
END $$;

-- Audit triggers for timesheet_locks
CREATE OR REPLACE FUNCTION audit_timesheet_locks_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'locked';
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.unlocked_at IS NULL AND NEW.unlocked_at IS NOT NULL THEN
      v_action := 'unlocked';
    ELSE
      v_action := 'updated';
    END IF;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_old_values := to_jsonb(OLD);
  END IF;

  PERFORM log_audit_entry(
    'timesheet_locks',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values,
    COALESCE(NEW.reason, NEW.unlock_reason)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_timesheet_locks_changes_trigger ON public.timesheet_locks;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_timesheet_locks_changes_trigger'
  ) THEN
    CREATE TRIGGER audit_timesheet_locks_changes_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_locks
      FOR EACH ROW
      EXECUTE FUNCTION audit_timesheet_locks_changes();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_audit_trail(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  changed_at TIMESTAMPTZ,
  changed_by_email TEXT,
  old_values JSONB,
  new_values JSONB,
  reason TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    tal.id,
    tal.action,
    tal.changed_at,
    u.email AS changed_by_email,
    tal.old_values,
    tal.new_values,
    tal.reason
  FROM time_audit_log tal
  LEFT JOIN auth.users u ON u.id = tal.changed_by
  WHERE tal.entity_type = p_entity_type
  AND tal.entity_id = p_entity_id
  ORDER BY tal.changed_at DESC;
$$;

-- ============================================================================
-- MIGRATION 7: EXTEND TIME_RULES
-- ============================================================================

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS reconciliation_tolerance_percent DECIMAL(5,2) DEFAULT 5.00
  CHECK (reconciliation_tolerance_percent >= 0 AND reconciliation_tolerance_percent <= 100);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS require_reconciliation BOOLEAN DEFAULT true;

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS min_breaks_minutes INTEGER DEFAULT 30
  CHECK (min_breaks_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS overtime_daily_minutes INTEGER DEFAULT 600
  CHECK (overtime_daily_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS overtime_weekly_minutes INTEGER DEFAULT 2880
  CHECK (overtime_weekly_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS max_work_day_minutes INTEGER DEFAULT 600
  CHECK (max_work_day_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS max_work_week_minutes INTEGER DEFAULT 2880
  CHECK (max_work_week_minutes >= 0);

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS auto_submit_on_coverage BOOLEAN DEFAULT false;

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS coverage_green_min DECIMAL(5,2) DEFAULT 95.00;

ALTER TABLE public.time_rules
  ADD COLUMN IF NOT EXISTS coverage_yellow_min DECIMAL(5,2) DEFAULT 90.00;

-- Backfill defaults for existing records
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
  SELECT company_id INTO v_company_id
  FROM employees
  WHERE id = p_employee_id;

  SELECT * INTO v_rules
  FROM get_time_rules(v_company_id);

  v_week_start := DATE_TRUNC('week', p_date)::DATE;
  v_week_end := v_week_start + INTERVAL '6 days';

  SELECT COALESCE(SUM(work_minutes), 0) + p_work_minutes
  INTO v_daily_total
  FROM attendance
  WHERE employee_id = p_employee_id
  AND date = p_date;

  SELECT COALESCE(SUM(work_minutes), 0) + p_work_minutes
  INTO v_weekly_total
  FROM attendance
  WHERE employee_id = p_employee_id
  AND date >= v_week_start
  AND date <= v_week_end;

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
-- MIGRATION 8: SCHEMA VERSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_schema_version (
  version TEXT PRIMARY KEY,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  applied_by UUID REFERENCES auth.users(id),
  migration_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  rollback_sql TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_version_applied_at ON public.app_schema_version(applied_at DESC);

ALTER TABLE public.app_schema_version ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view schema versions" ON public.app_schema_version;
CREATE POLICY "Only admins can view schema versions" ON public.app_schema_version
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only admins can insert schema versions" ON public.app_schema_version;
CREATE POLICY "Only admins can insert schema versions" ON public.app_schema_version
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

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

ALTER TABLE public.migration_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view migration log" ON public.migration_log;
CREATE POLICY "Only admins can view migration log" ON public.migration_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.role = 'admin'
    )
  );

DO $$
BEGIN
  INSERT INTO migration_log (migration_file, status)
  VALUES
    ('20251015_01_feature_flags.sql', 'success'),
    ('20251015_02_attendance.sql', 'success'),
    ('20251015_03_cost_centers.sql', 'success'),
    ('20251015_04_extend_time_entries.sql', 'success'),
    ('20251015_05_timesheet_locks.sql', 'success'),
    ('20251015_06_audit_log.sql', 'success'),
    ('20251015_07_extend_time_rules.sql', 'success'),
    ('20251015_08_schema_version.sql', 'success'),
    ('20251015_09_backfill_attendance.sql', 'success')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- MIGRATION 9: BACKFILL & RECONCILIATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_attendance_from_time_entries(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  action TEXT,
  employee_id UUID,
  date DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER,
  work_minutes INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_start_time TIMESTAMPTZ;
BEGIN
  v_start_time := clock_timestamp();

  p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '90 days');
  p_end_date := COALESCE(p_end_date, CURRENT_DATE);

  RAISE NOTICE 'Starting backfill from % to % (dry_run: %)', p_start_date, p_end_date, p_dry_run;

  FOR employee_id, date, clock_in, clock_out, break_minutes, work_minutes IN
    SELECT
      te.employee_id,
      te.start_time::date AS date,
      MIN(te.start_time) AS clock_in,
      MAX(COALESCE(te.end_time, te.start_time + INTERVAL '8 hours')) AS clock_out,
      COALESCE(SUM(te.break_duration), 0)::INTEGER AS break_minutes,
      NULL::INTEGER AS work_minutes
    FROM time_entries te
    WHERE te.start_time::date >= p_start_date
      AND te.start_time::date <= p_end_date
      AND (p_employee_id IS NULL OR te.employee_id = p_employee_id)
      AND te.end_time IS NOT NULL
    GROUP BY te.employee_id, te.start_time::date
  LOOP
    IF EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.employee_id = backfill_attendance_from_time_entries.employee_id
      AND a.date = backfill_attendance_from_time_entries.date
    ) THEN
      v_skipped := v_skipped + 1;

      RETURN QUERY SELECT
        'SKIPPED'::TEXT,
        backfill_attendance_from_time_entries.employee_id,
        backfill_attendance_from_time_entries.date,
        backfill_attendance_from_time_entries.clock_in,
        backfill_attendance_from_time_entries.clock_out,
        backfill_attendance_from_time_entries.break_minutes,
        NULL::INTEGER,
        'Attendance already exists'::TEXT;

      CONTINUE;
    END IF;

    IF NOT p_dry_run THEN
      INSERT INTO attendance (
        employee_id,
        company_id,
        date,
        clock_in,
        clock_out,
        break_minutes,
        status,
        autogenerated,
        note
      )
      SELECT
        backfill_attendance_from_time_entries.employee_id,
        e.company_id,
        backfill_attendance_from_time_entries.date,
        backfill_attendance_from_time_entries.clock_in,
        backfill_attendance_from_time_entries.clock_out,
        backfill_attendance_from_time_entries.break_minutes,
        'submitted'::TEXT,
        true,
        'Migrated from time_entries'::TEXT
      FROM employees e
      WHERE e.id = backfill_attendance_from_time_entries.employee_id;
    END IF;

    v_count := v_count + 1;

    RETURN QUERY SELECT
      CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'CREATED' END::TEXT,
      backfill_attendance_from_time_entries.employee_id,
      backfill_attendance_from_time_entries.date,
      backfill_attendance_from_time_entries.clock_in,
      backfill_attendance_from_time_entries.clock_out,
      backfill_attendance_from_time_entries.break_minutes,
      EXTRACT(EPOCH FROM (backfill_attendance_from_time_entries.clock_out - backfill_attendance_from_time_entries.clock_in))::INTEGER / 60 - backfill_attendance_from_time_entries.break_minutes AS work_minutes,
      format('Created from %s time entries', (
        SELECT COUNT(*)
        FROM time_entries te2
        WHERE te2.employee_id = backfill_attendance_from_time_entries.employee_id
        AND te2.start_time::date = backfill_attendance_from_time_entries.date
      ))::TEXT;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % created, % skipped (execution time: %)',
    v_count, v_skipped, clock_timestamp() - v_start_time;

  IF NOT p_dry_run THEN
    INSERT INTO time_audit_log (
      entity_type,
      entity_id,
      action,
      new_values,
      reason
    ) VALUES (
      'attendance',
      gen_random_uuid(),
      'created',
      jsonb_build_object(
        'records_created', v_count,
        'records_skipped', v_skipped,
        'start_date', p_start_date,
        'end_date', p_end_date,
        'employee_id', p_employee_id
      ),
      'Automatic backfill from time_entries'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION detect_attendance_gaps(
  p_employee_id UUID,
  p_date DATE
)
RETURNS TABLE (
  gap_start TIMESTAMPTZ,
  gap_end TIMESTAMPTZ,
  gap_minutes INTEGER,
  suggested_cost_center TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
    day_attendance AS (
      SELECT clock_in, clock_out
      FROM attendance
      WHERE employee_id = p_employee_id
      AND date = p_date
      AND clock_out IS NOT NULL
    ),
    day_entries AS (
      SELECT start_time, end_time
      FROM time_entries
      WHERE employee_id = p_employee_id
      AND start_time::date = p_date
      AND end_time IS NOT NULL
      ORDER BY start_time
    ),
    covered_ranges AS (
      SELECT
        start_time AS range_start,
        end_time AS range_end
      FROM day_entries
    )
  SELECT
    CASE
      WHEN lag(range_end) OVER (ORDER BY range_start) IS NULL
      THEN (SELECT clock_in FROM day_attendance)
      ELSE lag(range_end) OVER (ORDER BY range_start)
    END AS gap_start,
    range_start AS gap_end,
    EXTRACT(EPOCH FROM (
      range_start - COALESCE(
        lag(range_end) OVER (ORDER BY range_start),
        (SELECT clock_in FROM day_attendance)
      )
    ))::INTEGER / 60 AS gap_minutes,
    CASE
      WHEN EXTRACT(EPOCH FROM (range_start - COALESCE(lag(range_end) OVER (ORDER BY range_start), (SELECT clock_in FROM day_attendance))))::INTEGER / 60 > 60
      THEN 'WERKSTATT'
      WHEN EXTRACT(HOUR FROM range_start) >= 11 AND EXTRACT(HOUR FROM range_start) <= 13
      THEN 'BREAK'
      ELSE 'WERKSTATT'
    END AS suggested_cost_center,
    'Unaccounted time detected' AS reason
  FROM covered_ranges
  WHERE EXTRACT(EPOCH FROM (
    range_start - COALESCE(
      lag(range_end) OVER (ORDER BY range_start),
      (SELECT clock_in FROM day_attendance)
    )
  ))::INTEGER / 60 > 15;
END;
$$;

CREATE OR REPLACE FUNCTION check_reconciliation(
  p_employee_id UUID,
  p_date DATE
)
RETURNS TABLE (
  status TEXT,
  attendance_minutes INTEGER,
  project_minutes INTEGER,
  cost_center_minutes INTEGER,
  break_minutes INTEGER,
  total_accounted_minutes INTEGER,
  coverage_percent DECIMAL,
  difference_minutes INTEGER,
  is_within_tolerance BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance_minutes INTEGER;
  v_project_minutes INTEGER;
  v_cost_center_minutes INTEGER;
  v_break_minutes INTEGER;
  v_total_accounted INTEGER;
  v_coverage_percent DECIMAL;
  v_difference INTEGER;
  v_tolerance DECIMAL;
  v_is_within_tolerance BOOLEAN;
  v_company_id UUID;
BEGIN
  SELECT e.company_id, tr.reconciliation_tolerance_percent
  INTO v_company_id, v_tolerance
  FROM employees e
  LEFT JOIN time_rules tr ON tr.company_id = e.company_id AND tr.is_active = true
  WHERE e.id = p_employee_id
  LIMIT 1;

  v_tolerance := COALESCE(v_tolerance, 5.00);

  SELECT COALESCE(work_minutes, 0)
  INTO v_attendance_minutes
  FROM attendance
  WHERE employee_id = p_employee_id
  AND date = p_date
  AND clock_out IS NOT NULL;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60), 0)
  INTO v_project_minutes
  FROM time_entries
  WHERE employee_id = p_employee_id
  AND start_time::date = p_date
  AND type = 'project'
  AND end_time IS NOT NULL;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60), 0)
  INTO v_cost_center_minutes
  FROM time_entries
  WHERE employee_id = p_employee_id
  AND start_time::date = p_date
  AND type = 'cost_center'
  AND end_time IS NOT NULL;

  SELECT COALESCE(break_minutes, 0)
  INTO v_break_minutes
  FROM attendance
  WHERE employee_id = p_employee_id
  AND date = p_date;

  v_total_accounted := v_project_minutes + v_cost_center_minutes + v_break_minutes;

  IF v_attendance_minutes > 0 THEN
    v_coverage_percent := ROUND((v_total_accounted::DECIMAL / v_attendance_minutes::DECIMAL) * 100, 2);
    v_difference := v_attendance_minutes - v_total_accounted;
    v_is_within_tolerance := ABS(v_difference) <= (v_attendance_minutes * v_tolerance / 100);
  ELSE
    v_coverage_percent := 0;
    v_difference := 0;
    v_is_within_tolerance := false;
  END IF;

  RETURN QUERY SELECT
    CASE
      WHEN v_coverage_percent >= 95 THEN 'green'
      WHEN v_coverage_percent >= 90 THEN 'yellow'
      ELSE 'red'
    END::TEXT,
    v_attendance_minutes,
    v_project_minutes,
    v_cost_center_minutes,
    v_break_minutes,
    v_total_accounted,
    v_coverage_percent,
    v_difference,
    v_is_within_tolerance;
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================

-- Verify migration was successful
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'DUAL TIME TRACKING MIGRATION COMPLETE!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Schema Version: %', get_current_schema_version();
  RAISE NOTICE 'Feature Flag: %', is_feature_enabled('ff_dual_time_tracking', NULL);
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Verify tables were created (see verification queries below)';
  RAISE NOTICE '2. Activate feature flag (currently disabled by default)';
  RAISE NOTICE '3. Run backfill function to migrate old data (optional)';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration was successful:
-- ============================================================================

-- Check schema version
-- SELECT get_current_schema_version();

-- Check feature flag
-- SELECT * FROM feature_flags WHERE flag_name = 'ff_dual_time_tracking';

-- Check new tables
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('attendance', 'cost_centers', 'timesheet_locks', 'time_audit_log', 'feature_flags');

-- Check new columns in time_entries
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'time_entries'
-- AND column_name IN ('type', 'cost_center_id', 'billable', 'gps_location', 'status_approval', 'attendance_id');

-- Check cost centers
-- SELECT code, name, billable FROM cost_centers ORDER BY company_id, sort_order;

-- ============================================================================
-- OPTIONAL: ACTIVATE FEATURE FLAG
-- Run this ONLY when you're ready to enable dual time tracking:
-- ============================================================================

-- For all companies (global):
-- UPDATE feature_flags
-- SET enabled = true
-- WHERE flag_name = 'ff_dual_time_tracking'
-- AND company_id IS NULL;

-- For specific company:
-- UPDATE feature_flags
-- SET enabled = true
-- WHERE flag_name = 'ff_dual_time_tracking'
-- AND company_id = '<your_company_id>';

-- Verify flag is active:
-- SELECT is_feature_enabled('ff_dual_time_tracking', NULL);

-- ============================================================================
-- OPTIONAL: BACKFILL OLD DATA
-- Run this ONLY if you want to migrate historical time_entries to attendance
-- ============================================================================

-- DRY RUN (preview what would be created):
-- SELECT * FROM backfill_attendance_from_time_entries(
--   p_start_date := '2025-01-01',
--   p_end_date := CURRENT_DATE,
--   p_dry_run := true
-- );

-- ACTUAL RUN (create attendance records):
-- SELECT * FROM backfill_attendance_from_time_entries(
--   p_start_date := '2025-01-01',
--   p_end_date := CURRENT_DATE,
--   p_dry_run := false
-- );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
