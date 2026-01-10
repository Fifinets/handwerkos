-- Migration: Cost Centers (Kostenstellen)
-- Purpose: Track non-project time (Fahrt, Werkstatt, Schulung, etc.)
-- Idempotent: Can be run multiple times safely

-- ============================================================================
-- 1. CREATE COST_CENTERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Company reference
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Identifier and name
  code TEXT NOT NULL, -- e.g., "FAHRT", "WERK", "SCHUL"
  name TEXT NOT NULL, -- e.g., "Fahrtzeit", "Werkstatt", "Schulung"
  description TEXT,

  -- Accounting flags
  billable BOOLEAN DEFAULT false, -- Wird dem Kunden berechnet?
  payroll BOOLEAN DEFAULT true,   -- Zählt als Arbeitszeit (Lohnabrechnung)?

  -- UI customization
  color TEXT DEFAULT '#6b7280', -- Hex color for UI
  icon TEXT DEFAULT 'Clock',     -- Lucide icon name

  -- Sorting and visibility
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint
  CONSTRAINT unique_cost_center_code UNIQUE (company_id, code)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON public.cost_centers(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON public.cost_centers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cost_centers_code ON public.cost_centers(code);
CREATE INDEX IF NOT EXISTS idx_cost_centers_sort ON public.cost_centers(sort_order);

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- Employees can view cost centers of their company
CREATE POLICY IF NOT EXISTS "Employees can view company cost centers" ON public.cost_centers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = cost_centers.company_id
    )
  );

-- Only managers can manage cost centers
CREATE POLICY IF NOT EXISTS "Managers can manage cost centers" ON public.cost_centers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = cost_centers.company_id
      AND employees.role IN ('manager', 'admin')
    )
  );

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cost_centers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cost_centers_updated_at_trigger
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION update_cost_centers_updated_at();

-- ============================================================================
-- 5. SEED STANDARD COST CENTERS
-- ============================================================================

-- Get all company IDs to seed cost centers for each
DO $$
DECLARE
  company_record RECORD;
BEGIN
  -- Loop through all companies
  FOR company_record IN SELECT id FROM companies LOOP
    -- Fahrtzeit (billable, payroll)
    INSERT INTO public.cost_centers (company_id, code, name, description, billable, payroll, color, icon, sort_order)
    VALUES (
      company_record.id,
      'FAHRT',
      'Fahrtzeit',
      'Zeit für Fahrten zwischen Baustellen und Standorten',
      true,  -- billable
      true,  -- payroll
      '#3b82f6', -- blue
      'Car',
      10
    )
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Werkstatt (not billable, but payroll)
    INSERT INTO public.cost_centers (company_id, code, name, description, billable, payroll, color, icon, sort_order)
    VALUES (
      company_record.id,
      'WERKSTATT',
      'Werkstatt',
      'Arbeit in der Werkstatt (Vorbereitung, Wartung, etc.)',
      false, -- not billable
      true,  -- payroll
      '#6b7280', -- gray
      'Wrench',
      20
    )
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Schulung (not billable, but payroll)
    INSERT INTO public.cost_centers (company_id, code, name, description, billable, payroll, color, icon, sort_order)
    VALUES (
      company_record.id,
      'SCHULUNG',
      'Schulung/Weiterbildung',
      'Teilnahme an Schulungen und Fortbildungen',
      false, -- not billable
      true,  -- payroll
      '#10b981', -- green
      'GraduationCap',
      30
    )
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Urlaub (not billable, but payroll)
    INSERT INTO public.cost_centers (company_id, code, name, description, billable, payroll, color, icon, sort_order)
    VALUES (
      company_record.id,
      'URLAUB',
      'Urlaub',
      'Urlaubszeit',
      false, -- not billable
      true,  -- payroll
      '#f59e0b', -- orange
      'Palmtree',
      40
    )
    ON CONFLICT (company_id, code) DO NOTHING;

    -- Krankheit (not billable, not payroll - handled separately)
    INSERT INTO public.cost_centers (company_id, code, name, description, billable, payroll, color, icon, sort_order)
    VALUES (
      company_record.id,
      'KRANK',
      'Krankheit',
      'Krankheitsbedingte Abwesenheit',
      false, -- not billable
      false, -- not payroll (handled by Krankenkasse)
      '#ef4444', -- red
      'HeartPulse',
      50
    )
    ON CONFLICT (company_id, code) DO NOTHING;

  END LOOP;
END $$;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Get active cost centers for company
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
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.cost_centers IS 'Cost centers for non-project time (Fahrt, Werkstatt, Schulung, etc.)';
COMMENT ON COLUMN public.cost_centers.billable IS 'If true, time can be billed to customer';
COMMENT ON COLUMN public.cost_centers.payroll IS 'If true, time counts as work time for payroll';
COMMENT ON COLUMN public.cost_centers.code IS 'Short code for API/exports (FAHRT, WERK, etc.)';

-- ============================================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================================
-- SELECT * FROM cost_centers ORDER BY company_id, sort_order;
-- SELECT get_active_cost_centers('<company_id>');
