-- Migration: Time Audit Log
-- Purpose: Track all changes to time-related tables (GoBD compliance)
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. CREATE TIME_AUDIT_LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Entity information
  entity_type TEXT NOT NULL, -- 'attendance', 'time_entries', 'timesheet_locks'
  entity_id UUID NOT NULL,

  -- Action performed
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted',
    'submitted', 'approved', 'rejected',
    'locked', 'unlocked'
  )),

  -- Change details
  old_values JSONB, -- Previous values (for updates/deletes)
  new_values JSONB, -- New values (for creates/updates)

  -- Change metadata
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Request context
  ip_address INET,
  user_agent TEXT,

  -- Additional context
  reason TEXT,
  company_id UUID REFERENCES public.companies(id),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.time_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.time_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.time_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_company ON public.time_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.time_audit_log(action);

-- GIN index for JSONB search
CREATE INDEX IF NOT EXISTS idx_audit_log_old_values ON public.time_audit_log USING GIN (old_values);
CREATE INDEX IF NOT EXISTS idx_audit_log_new_values ON public.time_audit_log USING GIN (new_values);

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE public.time_audit_log ENABLE ROW LEVEL SECURITY;

-- Employees can view audit logs for their own records
CREATE POLICY IF NOT EXISTS "Employees can view own audit logs" ON public.time_audit_log
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

-- Only system can INSERT into audit log (via triggers)
CREATE POLICY IF NOT EXISTS "System can insert audit logs" ON public.time_audit_log
  FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed (immutable log)
CREATE POLICY IF NOT EXISTS "No updates to audit log" ON public.time_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY IF NOT EXISTS "No deletes from audit log" ON public.time_audit_log
  FOR DELETE
  USING (false);

-- ============================================================================
-- 4. HELPER FUNCTION: Log audit entry
-- ============================================================================

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
  -- Try to get company_id from new_values or old_values
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

-- ============================================================================
-- 5. TRIGGERS: Auto-log changes to attendance
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_attendance_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
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

  -- Log the change
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

-- Apply trigger
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

-- ============================================================================
-- 6. TRIGGERS: Auto-log changes to time_entries
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_time_entries_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
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

  -- Get company_id from employee
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

-- Apply trigger
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

-- ============================================================================
-- 7. TRIGGERS: Auto-log timesheet locks
-- ============================================================================

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

-- Apply trigger
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

-- ============================================================================
-- 8. HELPER QUERIES
-- ============================================================================

-- Get audit trail for entity
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
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.time_audit_log IS 'Immutable audit log for all time-related changes (GoBD compliant)';
COMMENT ON COLUMN public.time_audit_log.entity_type IS 'Table name: attendance, time_entries, timesheet_locks';
COMMENT ON COLUMN public.time_audit_log.old_values IS 'Previous row values (JSONB)';
COMMENT ON COLUMN public.time_audit_log.new_values IS 'New row values (JSONB)';
COMMENT ON FUNCTION get_audit_trail IS 'Get complete audit trail for an entity';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- SELECT * FROM time_audit_log ORDER BY changed_at DESC LIMIT 10;
-- SELECT get_audit_trail('attendance', '<attendance_id>');
