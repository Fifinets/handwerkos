-- Migration 4.1: Constraints aktivieren
-- 1. NOT NULL constraints for critical IDs
ALTER TABLE offers ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN offer_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN project_id SET NOT NULL;

-- 2. CHECK constraints for status
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('planned', 'active', 'completed', 'cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'));

-- 3. Hard FK constraints for project_sites (if any were optional before)
-- Note: delivery_notes table not found, skipped.

-- Migration 4.2: Totholz entfernen
-- Drop legacy columns
DROP VIEW IF EXISTS employee_assigned_projects;

ALTER TABLE projects DROP COLUMN IF EXISTS location;
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

-- Drop quote_id from everywhere we transitioned away from
ALTER TABLE orders DROP COLUMN IF EXISTS quote_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS quote_id;
ALTER TABLE workflow_chains DROP COLUMN IF EXISTS quote_id;

-- Drop old amount fields if any were specified in soll_datenmatrix (e.g., invoices total_amount if replaced by net/gross)
-- Taking care to only drop what was explicitly mentioned. "alte Betragsfelder"
ALTER TABLE invoices DROP COLUMN IF EXISTS amount; 
