-- Migration 4.1: Constraints aktivieren
-- 1. NOT NULL constraints for critical IDs (safe: skip if nulls exist in production)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM offers WHERE project_id IS NULL LIMIT 1) THEN
    ALTER TABLE offers ALTER COLUMN project_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE project_id IS NULL LIMIT 1) THEN
    ALTER TABLE invoices ALTER COLUMN project_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE offer_id IS NULL LIMIT 1) THEN
    ALTER TABLE invoices ALTER COLUMN offer_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE project_id IS NULL LIMIT 1) THEN
    ALTER TABLE orders ALTER COLUMN project_id SET NOT NULL;
  END IF;
END $$;

-- 2. CHECK constraints for status
-- Note: skipping status constraints as production data uses German status values
-- (anfrage, besichtigung, geplant, in_bearbeitung, abgeschlossen, etc.)
-- Adding strict English-only constraints would break existing data.

-- 3. Hard FK constraints for project_sites (if any were optional before)
-- Note: delivery_notes table not found, skipped.

-- Migration 4.2: Cleanup
-- NOTE: projects.location is still used by many components (MobileTimeTracker,
-- LocationBasedTimeTracking, DesktopEmployeePage, etc.) — DO NOT DROP IT.
-- NOTE: projects.contact_person can be dropped (superseded by customer_contacts).
DROP VIEW IF EXISTS employee_assigned_projects;

ALTER TABLE projects DROP COLUMN IF EXISTS contact_person;

-- Recreate view
CREATE OR REPLACE VIEW employee_assigned_projects AS
SELECT
  p.*,
  pta.role as employee_role,
  pta.hourly_rate as employee_hourly_rate,
  pta.is_active as assignment_active
FROM projects p
JOIN project_team_assignments pta ON p.id = pta.project_id
WHERE pta.is_active = true;

GRANT SELECT ON employee_assigned_projects TO authenticated;

-- Add offer_id where quote_id was used
ALTER TABLE workflow_chains ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES offers(id);
