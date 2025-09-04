-- Migration: Zeiterfassung und Lieferscheine für HandwerkOS
-- Ziel: Solides Datenfundament mit RLS, Constraints, Trigger und Nummernkreis

-- ============================================================================
-- 0. FEHLENDE BASIS-TABELLEN UND SPALTEN (falls nicht vorhanden)
-- ============================================================================

-- Füge role Spalte zu employees hinzu (falls nicht vorhanden)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin'));

-- Materials Tabelle (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  unit TEXT DEFAULT 'Stk',
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  stock INTEGER DEFAULT 0,
  category TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Customers Tabelle (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Projects Tabelle (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'on_hold')),
  budget DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 1. TIME_SEGMENTS - Zeiterfassung mit Start/Stop/Wechsel
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Zeitstempel
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Computed duration (wird per Trigger berechnet)
  duration_minutes_computed INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN ended_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER / 60
      ELSE NULL
    END
  ) STORED,
  
  -- Status und Typ
  segment_type TEXT NOT NULL DEFAULT 'work' CHECK (segment_type IN ('work', 'break', 'drive')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  -- Beschreibung/Notizen
  description TEXT,
  notes TEXT,
  
  -- Metadaten
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- ============================================================================
-- 2. TIME_RULES - Rundungsregeln (optional, für spätere Freigabe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Rundungsregeln
  round_to_minutes INTEGER DEFAULT 15 CHECK (round_to_minutes IN (1, 5, 6, 10, 15, 30, 60)),
  round_direction TEXT DEFAULT 'nearest' CHECK (round_direction IN ('up', 'down', 'nearest')),
  
  -- Mindestzeiten
  min_work_duration_minutes INTEGER DEFAULT 0,
  min_break_duration_minutes INTEGER DEFAULT 0,
  
  -- Pausenregeln
  auto_break_after_minutes INTEGER, -- Automatische Pause nach X Minuten
  auto_break_duration_minutes INTEGER, -- Dauer der automatischen Pause
  
  -- Aktiv-Flag
  is_active BOOLEAN DEFAULT true,
  
  -- Metadaten
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 3. DELIVERY_NOTES - Lieferscheine
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  -- Nummer (wird per Trigger generiert: LS-YYYY-000001)
  number TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
  
  -- Daten
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_address JSONB, -- Strukturierte Adressdaten
  
  -- Zeiten (aggregiert von time_segments)
  total_work_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  
  -- Signatur
  signature_data JSONB, -- Base64 oder SVG-Path
  signed_at TIMESTAMP WITH TIME ZONE,
  signed_by_name TEXT,
  
  -- PDF-Speicherung
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadaten
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  
  -- Unique constraint für Nummer pro Mandant
  CONSTRAINT unique_delivery_note_number_per_company UNIQUE (company_id, number)
);

-- ============================================================================
-- 4. DELIVERY_NOTE_ITEMS - Positionen im Lieferschein
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  
  -- Typ der Position
  item_type TEXT NOT NULL CHECK (item_type IN ('time', 'material', 'service')),
  
  -- Referenzen (je nach Typ)
  time_segment_id UUID REFERENCES public.time_segments(id) ON DELETE SET NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  
  -- Beschreibung
  description TEXT NOT NULL,
  
  -- Mengen und Einheiten
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT DEFAULT 'Stk',
  
  -- Preise (optional, für spätere Abrechnung)
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  
  -- Sortierung
  sort_order INTEGER DEFAULT 0,
  
  -- Metadaten
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 5. TRIGGER: Keine Zeitüberlappungen pro Mitarbeiter
-- ============================================================================

CREATE OR REPLACE FUNCTION check_time_segment_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Prüfe nur bei aktiven Segmenten
  IF NEW.status = 'active' THEN
    -- Prüfe ob es Überlappungen gibt
    IF EXISTS (
      SELECT 1 FROM time_segments
      WHERE employee_id = NEW.employee_id
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND status = 'active'
      AND (
        -- Neue Startzeit liegt in bestehendem Segment
        (NEW.started_at >= started_at AND (ended_at IS NULL OR NEW.started_at < ended_at))
        OR
        -- Neue Endzeit liegt in bestehendem Segment (falls vorhanden)
        (NEW.ended_at IS NOT NULL AND NEW.ended_at > started_at AND (ended_at IS NULL OR NEW.ended_at <= ended_at))
        OR
        -- Neues Segment umschließt bestehendes Segment
        (NEW.started_at <= started_at AND (NEW.ended_at IS NULL OR ended_at IS NULL OR NEW.ended_at >= ended_at))
      )
    ) THEN
      RAISE EXCEPTION 'Zeitüberlappung erkannt für Mitarbeiter % zwischen % und %', 
        NEW.employee_id, NEW.started_at, NEW.ended_at
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_time_segment_overlap_trigger
  BEFORE INSERT OR UPDATE ON time_segments
  FOR EACH ROW
  EXECUTE FUNCTION check_time_segment_overlap();

-- ============================================================================
-- 6. TRIGGER: Automatische Lieferschein-Nummer (LS-YYYY-000001)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_delivery_note_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Nur bei neuen Einträgen ohne Nummer
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Finde die höchste Nummer des Jahres für diesen Mandanten
    SELECT COALESCE(MAX(SUBSTRING(number FROM 9 FOR 6)::INTEGER), 0) + 1
    INTO v_next_number
    FROM delivery_notes
    WHERE company_id = NEW.company_id
    AND number LIKE 'LS-' || v_year || '-%';
    
    -- Formatiere Nummer mit führenden Nullen
    v_formatted_number := 'LS-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
    
    NEW.number := v_formatted_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_delivery_note_number_trigger
  BEFORE INSERT ON delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION generate_delivery_note_number();

-- ============================================================================
-- 7. TRIGGER: Updated_at automatisch setzen
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_time_segments_updated_at
  BEFORE UPDATE ON time_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_delivery_notes_updated_at
  BEFORE UPDATE ON delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_time_rules_updated_at
  BEFORE UPDATE ON time_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. INDIZES für Performance
-- ============================================================================

-- Time Segments
CREATE INDEX IF NOT EXISTS idx_time_segments_employee_started 
  ON time_segments(employee_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_segments_project 
  ON time_segments(project_id) 
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_time_segments_status 
  ON time_segments(status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_time_segments_company 
  ON time_segments(company_id);

-- Delivery Notes
CREATE INDEX IF NOT EXISTS idx_delivery_notes_company 
  ON delivery_notes(company_id);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_project 
  ON delivery_notes(project_id) 
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_notes_status 
  ON delivery_notes(status);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_number 
  ON delivery_notes(number);

-- Delivery Note Items
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note 
  ON delivery_note_items(delivery_note_id);

-- ============================================================================
-- 9. RLS (Row Level Security) - Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE time_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9.1 TIME_SEGMENTS Policies
-- ============================================================================

-- Employee: Kann nur eigene Segmente sehen und bearbeiten
CREATE POLICY time_segments_employee_select ON time_segments
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM employees 
      WHERE id = time_segments.employee_id
    )
  );

CREATE POLICY time_segments_employee_insert ON time_segments
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM employees 
      WHERE id = time_segments.employee_id
    )
  );

CREATE POLICY time_segments_employee_update ON time_segments
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM employees 
      WHERE id = time_segments.employee_id
    )
  );

-- Manager: Kann alle Segmente der Company sehen und bearbeiten
CREATE POLICY time_segments_manager_all ON time_segments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = time_segments.company_id
      AND employees.role = 'manager'
    )
  );

-- ============================================================================
-- 9.2 DELIVERY_NOTES Policies
-- ============================================================================

-- Employee: Kann Lieferscheine sehen, die mit eigenen Projekten verknüpft sind
CREATE POLICY delivery_notes_employee_select ON delivery_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = delivery_notes.company_id
    )
  );

-- Manager: Volle Kontrolle über Lieferscheine der Company
CREATE POLICY delivery_notes_manager_all ON delivery_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = delivery_notes.company_id
      AND employees.role = 'manager'
    )
  );

-- ============================================================================
-- 9.3 DELIVERY_NOTE_ITEMS Policies
-- ============================================================================

-- Inherit from delivery_notes permissions
CREATE POLICY delivery_note_items_select ON delivery_note_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM delivery_notes
      WHERE delivery_notes.id = delivery_note_items.delivery_note_id
      AND EXISTS (
        SELECT 1 FROM employees
        WHERE employees.user_id = auth.uid()
        AND employees.company_id = delivery_notes.company_id
      )
    )
  );

CREATE POLICY delivery_note_items_manager_all ON delivery_note_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM delivery_notes
      JOIN employees ON employees.company_id = delivery_notes.company_id
      WHERE delivery_notes.id = delivery_note_items.delivery_note_id
      AND employees.user_id = auth.uid()
      AND employees.role = 'manager'
    )
  );

-- ============================================================================
-- 9.4 TIME_RULES Policies
-- ============================================================================

-- Nur Manager können Zeitregeln verwalten
CREATE POLICY time_rules_manager_all ON time_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = time_rules.company_id
      AND employees.role = 'manager'
    )
  );

-- Employees können Regeln nur lesen
CREATE POLICY time_rules_employee_select ON time_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.user_id = auth.uid()
      AND employees.company_id = time_rules.company_id
    )
  );

-- ============================================================================
-- 10. SMOKE TEST Dokumentation
-- ============================================================================

COMMENT ON TABLE time_segments IS '
SMOKE TEST:
1. Als Employee einloggen
2. Erstes Segment erstellen (09:00 - 12:00) → Sollte erfolgreich sein
3. Zweites Segment erstellen (13:00 - 17:00) → Sollte erfolgreich sein
4. Drittes Segment mit Überlappung (11:00 - 14:00) → Sollte mit Fehler abgelehnt werden
5. Als Manager: Alle Segmente der Company sichtbar

ERWARTETER FEHLER bei Überlappung:
"Zeitüberlappung erkannt für Mitarbeiter..."
';

COMMENT ON TABLE delivery_notes IS '
SMOKE TEST:
1. Lieferschein ohne Nummer anlegen
2. Prüfen: Automatische Nummer LS-2025-000001 wurde generiert
3. Zweiten Lieferschein anlegen → LS-2025-000002
4. Jahreswechsel simulieren → LS-2026-000001

RLS TEST:
- Employee: Kann nur eigene Company-Lieferscheine sehen
- Manager: Kann alle bearbeiten und löschen (status = cancelled)
';