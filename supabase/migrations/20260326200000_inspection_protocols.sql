-- VDE Pruefprotokolle & DGUV V3 Inspection Module

-- ENUM TYPES
CREATE TYPE inspection_device_type AS ENUM ('anlage', 'geraet');
CREATE TYPE inspection_protection_class AS ENUM ('I', 'II', 'III');
CREATE TYPE inspection_device_status AS ENUM ('active', 'inactive', 'disposed');
CREATE TYPE inspection_protocol_type AS ENUM ('vde_0100_600', 'vde_0105_100', 'vde_0701_0702');
CREATE TYPE inspection_result AS ENUM ('pass', 'fail', 'conditional');
CREATE TYPE inspection_measurement_type AS ENUM (
  'insulation_resistance','loop_impedance','rcd_trip_time','rcd_trip_current',
  'protective_conductor','earth_resistance','voltage_drop','leakage_current','touch_current');
CREATE TYPE inspection_measurement_result AS ENUM ('pass', 'fail');
CREATE TYPE inspection_limit_type AS ENUM ('min', 'max');
CREATE TYPE inspection_defect_severity AS ENUM ('minor', 'major', 'critical');

-- TABLES
CREATE TABLE inspection_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  device_name TEXT NOT NULL,
  device_type inspection_device_type NOT NULL DEFAULT 'geraet',
  manufacturer TEXT, model TEXT, serial_number TEXT, location TEXT,
  protection_class inspection_protection_class DEFAULT 'I',
  next_inspection_date DATE,
  inspection_interval_months INTEGER DEFAULT 12,
  status inspection_device_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inspection_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID REFERENCES inspection_devices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  protocol_number TEXT NOT NULL,
  protocol_type inspection_protocol_type NOT NULL,
  inspector_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_result inspection_result, notes TEXT,
  is_finalized BOOLEAN NOT NULL DEFAULT false, finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, protocol_number)
);

CREATE TABLE inspection_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES inspection_protocols(id) ON DELETE CASCADE,
  measurement_type inspection_measurement_type NOT NULL,
  circuit_label TEXT, measured_value NUMERIC NOT NULL, unit TEXT NOT NULL,
  limit_value NUMERIC, limit_type inspection_limit_type,
  result inspection_measurement_result NOT NULL, test_voltage NUMERIC, notes TEXT
);

CREATE TABLE inspection_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES inspection_protocols(id) ON DELETE CASCADE,
  severity inspection_defect_severity NOT NULL,
  description TEXT NOT NULL, location TEXT, recommendation TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false, resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE inspection_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES inspection_devices(id) ON DELETE CASCADE,
  next_due_date DATE NOT NULL, interval_months INTEGER NOT NULL DEFAULT 12,
  reminder_days_before INTEGER[] NOT NULL DEFAULT '{30,14,7,1}',
  last_notified_at TIMESTAMPTZ, is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(device_id)
);

CREATE TABLE inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES inspection_protocols(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_insp_devices_company ON inspection_devices(company_id);
CREATE INDEX idx_insp_devices_next ON inspection_devices(next_inspection_date);
CREATE INDEX idx_insp_proto_company ON inspection_protocols(company_id);
CREATE INDEX idx_insp_proto_device ON inspection_protocols(device_id);
CREATE INDEX idx_insp_proto_date ON inspection_protocols(inspection_date);
CREATE INDEX idx_insp_meas_proto ON inspection_measurements(protocol_id);
CREATE INDEX idx_insp_defects_proto ON inspection_defects(protocol_id);
CREATE INDEX idx_insp_sched_due ON inspection_schedules(next_due_date) WHERE is_active;

-- UPDATED_AT TRIGGER (reuse if exists, otherwise create)
CREATE OR REPLACE FUNCTION update_inspection_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_insp_devices_upd BEFORE UPDATE ON inspection_devices
  FOR EACH ROW EXECUTE FUNCTION update_inspection_updated_at();
CREATE TRIGGER trg_insp_proto_upd BEFORE UPDATE ON inspection_protocols
  FOR EACH ROW EXECUTE FUNCTION update_inspection_updated_at();

-- RLS HELPER
CREATE OR REPLACE FUNCTION get_user_company_id() RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: enable on all tables
ALTER TABLE inspection_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

-- RLS: company-scoped tables (devices, protocols, schedules)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inspection_devices','inspection_protocols','inspection_schedules'] LOOP
    EXECUTE format('CREATE POLICY %I_sel ON %I FOR SELECT USING (company_id = get_user_company_id())', t, t);
    EXECUTE format('CREATE POLICY %I_ins ON %I FOR INSERT WITH CHECK (company_id = get_user_company_id())', t, t);
    EXECUTE format('CREATE POLICY %I_upd ON %I FOR UPDATE USING (company_id = get_user_company_id())', t, t);
    EXECUTE format('CREATE POLICY %I_del ON %I FOR DELETE USING (company_id = get_user_company_id())', t, t);
  END LOOP;
END $$;

-- RLS: protocol-child tables (measurements, defects, photos)
DO $$
DECLARE t TEXT; ops TEXT[] := ARRAY['SELECT','INSERT','UPDATE','DELETE'];
        op TEXT; check_clause TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inspection_measurements','inspection_defects','inspection_photos'] LOOP
    check_clause := format('EXISTS(SELECT 1 FROM inspection_protocols p WHERE p.id=%I.protocol_id AND p.company_id=get_user_company_id())', t);
    FOREACH op IN ARRAY ops LOOP
      IF op IN ('SELECT','UPDATE','DELETE') THEN
        EXECUTE format('CREATE POLICY %I_%s ON %I FOR %s USING (%s)', t, lower(op), t, op, check_clause);
      ELSE
        EXECUTE format('CREATE POLICY %I_%s ON %I FOR %s WITH CHECK (%s)', t, lower(op), t, op, check_clause);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos','inspection-photos',false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "insp_photos_sel" ON storage.objects FOR SELECT
  USING (bucket_id='inspection-photos' AND auth.role()='authenticated');
CREATE POLICY "insp_photos_ins" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='inspection-photos' AND auth.role()='authenticated');
CREATE POLICY "insp_photos_del" ON storage.objects FOR DELETE
  USING (bucket_id='inspection-photos' AND auth.role()='authenticated');

-- PROTOCOL NUMBER SEQUENCE
CREATE TABLE inspection_number_sequences (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL, last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);
ALTER TABLE inspection_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insp_seq_all" ON inspection_number_sequences
  FOR ALL USING (company_id = get_user_company_id());

CREATE OR REPLACE FUNCTION next_protocol_number(p_company_id UUID) RETURNS TEXT AS $$
DECLARE v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE); v_next INTEGER;
BEGIN
  INSERT INTO inspection_number_sequences (company_id, year, last_number)
  VALUES (p_company_id, v_year, 1)
  ON CONFLICT (company_id, year)
  DO UPDATE SET last_number = inspection_number_sequences.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN 'PRF-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
END; $$ LANGUAGE plpgsql;
