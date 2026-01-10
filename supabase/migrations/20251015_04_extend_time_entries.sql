-- Migration: Extend time_entries for dual time tracking
-- Purpose: Add columns to support project time vs cost center time
-- IMPORTANT: ONLY ADD COLUMN - NO CHANGES TO EXISTING DATA
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. ADD NEW COLUMNS TO time_entries (ADDITIVE ONLY!)
-- ============================================================================

-- Type: Distinguish between project time and cost center time
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'project' CHECK (type IN ('project', 'cost_center'));

-- Cost center reference (NULL for project time)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- Billable flag (can time be billed to customer?)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true;

-- GPS location (optional)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS gps_location JSONB;

-- Enhanced status (separate from old 'status' to avoid conflicts)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS status_approval TEXT DEFAULT 'draft' CHECK (status_approval IN ('draft', 'submitted', 'approved', 'rejected'));

-- Link to attendance (if entry was created from attendance shift)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. BACKFILL DEFAULTS FOR EXISTING DATA
-- ============================================================================

-- Set type='project' for all existing entries (where NULL)
UPDATE public.time_entries
SET type = 'project'
WHERE type IS NULL;

-- Set billable=true for all existing project entries
UPDATE public.time_entries
SET billable = true
WHERE billable IS NULL AND type = 'project';

-- Set status_approval='draft' for existing entries
UPDATE public.time_entries
SET status_approval = 'draft'
WHERE status_approval IS NULL;

-- ============================================================================
-- 3. CREATE NEW INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_time_entries_type ON public.time_entries(type);
CREATE INDEX IF NOT EXISTS idx_time_entries_cost_center ON public.time_entries(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON public.time_entries(billable) WHERE billable = true;
CREATE INDEX IF NOT EXISTS idx_time_entries_status_approval ON public.time_entries(status_approval);
CREATE INDEX IF NOT EXISTS idx_time_entries_attendance ON public.time_entries(attendance_id) WHERE attendance_id IS NOT NULL;

-- ============================================================================
-- 4. ADD VALIDATION CONSTRAINTS
-- ============================================================================

-- Business rule: If type='project', must have project_id
-- Business rule: If type='cost_center', must have cost_center_id
-- We'll add these as application-level checks, not DB constraints (to avoid migration issues)

-- ============================================================================
-- 5. HELPER FUNCTION: Validate time entry
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_time_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate project entries
  IF NEW.type = 'project' AND NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Project time entry must have project_id'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate cost center entries
  IF NEW.type = 'cost_center' AND NEW.cost_center_id IS NULL THEN
    RAISE EXCEPTION 'Cost center time entry must have cost_center_id'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cost center entries should not have project_id
  IF NEW.type = 'cost_center' AND NEW.project_id IS NOT NULL THEN
    NEW.project_id = NULL; -- Auto-fix: Remove project_id from cost center entries
  END IF;

  -- Set billable flag based on cost center (if cost_center_id is set)
  IF NEW.cost_center_id IS NOT NULL THEN
    SELECT cost_centers.billable INTO NEW.billable
    FROM cost_centers
    WHERE cost_centers.id = NEW.cost_center_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger (only if not exists)
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

-- ============================================================================
-- 6. UPDATE RLS POLICIES (extend existing)
-- ============================================================================

-- Allow employees to create cost center entries
-- (This extends the existing INSERT policy, no changes needed if using WITH CHECK)

-- ============================================================================
-- 7. HELPER VIEWS
-- ============================================================================

-- View: Project time entries only
CREATE OR REPLACE VIEW public.time_entries_projects AS
SELECT *
FROM public.time_entries
WHERE type = 'project';

-- View: Cost center time entries only
CREATE OR REPLACE VIEW public.time_entries_cost_centers AS
SELECT *
FROM public.time_entries
WHERE type = 'cost_center';

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.time_entries.type IS 'Type: "project" for project work, "cost_center" for non-project time';
COMMENT ON COLUMN public.time_entries.cost_center_id IS 'Reference to cost center (only for type=cost_center)';
COMMENT ON COLUMN public.time_entries.billable IS 'Can this time be billed to customer? Auto-set from cost_center.billable';
COMMENT ON COLUMN public.time_entries.gps_location IS 'GPS coordinates: {lat, lng, accuracy, timestamp}';
COMMENT ON COLUMN public.time_entries.status_approval IS 'Approval status: draft → submitted → approved/rejected';
COMMENT ON COLUMN public.time_entries.attendance_id IS 'Link to attendance shift (if created from attendance)';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
-- SELECT type, COUNT(*) FROM time_entries GROUP BY type;
-- SELECT * FROM time_entries WHERE type = 'cost_center' LIMIT 5;
-- SELECT * FROM time_entries_projects LIMIT 5;
