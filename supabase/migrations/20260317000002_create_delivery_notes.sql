-- Delivery notes: work documentation with materials and photos
-- Status flow: draft → submitted → approved / rejected → invoiced

CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  customer_id UUID REFERENCES customers(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  delivery_note_number TEXT,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  break_minutes INT DEFAULT 0,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'invoiced')),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Signature
  signature_data TEXT,
  signature_name TEXT,
  signed_at TIMESTAMPTZ,
  -- Additional workers on this delivery note
  additional_employee_ids UUID[] DEFAULT '{}',
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-number trigger: LS-YYYY-000001
CREATE OR REPLACE FUNCTION generate_delivery_note_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  year_str TEXT;
BEGIN
  year_str := EXTRACT(YEAR FROM NEW.work_date)::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(delivery_note_number FROM 'LS-' || year_str || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_num
  FROM delivery_notes
  WHERE company_id = NEW.company_id
    AND delivery_note_number LIKE 'LS-' || year_str || '-%';
  NEW.delivery_note_number := 'LS-' || year_str || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delivery_note_number
  BEFORE INSERT ON delivery_notes
  FOR EACH ROW
  WHEN (NEW.delivery_note_number IS NULL)
  EXECUTE FUNCTION generate_delivery_note_number();

-- Line items (materials + photos)
CREATE TABLE IF NOT EXISTS delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('material', 'photo')),
  -- Material fields
  material_name TEXT,
  material_quantity NUMERIC,
  material_unit TEXT,
  unit_price NUMERIC,
  -- Photo fields
  photo_url TEXT,
  photo_caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_delivery_notes_company_status ON delivery_notes(company_id, status);
CREATE INDEX idx_delivery_notes_employee_date ON delivery_notes(employee_id, work_date DESC);
CREATE INDEX idx_delivery_notes_project ON delivery_notes(project_id);
CREATE INDEX idx_delivery_note_items_note ON delivery_note_items(delivery_note_id);

-- RLS
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

-- Delivery notes: company-wide access through profiles
CREATE POLICY "delivery_notes_company_access" ON delivery_notes
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Items: accessible if the parent delivery note is accessible
CREATE POLICY "delivery_note_items_access" ON delivery_note_items
  FOR ALL USING (
    delivery_note_id IN (
      SELECT id FROM delivery_notes WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
