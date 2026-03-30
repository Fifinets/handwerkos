# VDE-Pruefprotokolle & DGUV V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Digital VDE inspection protocols with DGUV V3 scheduling for German electricians.

**Architecture:** New inspection module with DB tables for protocols/measurements/defects/devices/schedules. Service + hook + component pattern matching existing offerService/OfferModuleV2 patterns. GoBD-compliant via existing auditLogService.

**Tech Stack:** Supabase (PostgreSQL + RLS + Storage), React 18, Zod, jsPDF, TanStack Query

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260326200000_inspection_protocols.sql` | All inspection tables, RLS, indexes, triggers, storage bucket |
| `src/types/inspection.ts` | Zod schemas + TS types for all inspection entities |
| `src/services/inspectionService.ts` | CRUD + workflow operations for inspections |
| `src/hooks/useInspections.ts` | TanStack Query hooks for inspection data |
| `src/lib/vde-evaluation.ts` | Pure VDE limit-checking logic |
| `src/lib/protocol-number.ts` | Sequential protocol number generator |

### Files to Modify
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `export * from './inspection'` |
| `src/services/auditLogService.ts` | Add `'inspection_protocol'` to `AuditEntityType` |

---

## Task 1: Database Migration

**File:** `supabase/migrations/20260326200000_inspection_protocols.sql`

- [ ] Create migration file
- [ ] Run migration via Supabase MCP or `supabase db push`
- [ ] Verify tables exist with `SELECT * FROM information_schema.tables WHERE table_name LIKE 'inspection_%'`

```sql
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
```

---

## Task 2: Types

**File:** `src/types/inspection.ts`

- [ ] Create types file matching `src/types/offer.ts` pattern
- [ ] Add `export * from './inspection'` to `src/types/index.ts` after the `offer` export
- [ ] Verify: `npx tsc --noEmit`

```typescript
import { z } from 'zod';

// ENUMS
export const DeviceTypeEnum = z.enum(['anlage', 'geraet']);
export const ProtectionClassEnum = z.enum(['I', 'II', 'III']);
export const DeviceStatusEnum = z.enum(['active', 'inactive', 'disposed']);
export const ProtocolTypeEnum = z.enum(['vde_0100_600', 'vde_0105_100', 'vde_0701_0702']);
export const OverallResultEnum = z.enum(['pass', 'fail', 'conditional']);
export const MeasurementTypeEnum = z.enum([
  'insulation_resistance','loop_impedance','rcd_trip_time','rcd_trip_current',
  'protective_conductor','earth_resistance','voltage_drop','leakage_current','touch_current',
]);
export const MeasurementResultEnum = z.enum(['pass', 'fail']);
export const LimitTypeEnum = z.enum(['min', 'max']);
export const DefectSeverityEnum = z.enum(['minor', 'major', 'critical']);

export type DeviceType = z.infer<typeof DeviceTypeEnum>;
export type ProtectionClass = z.infer<typeof ProtectionClassEnum>;
export type DeviceStatus = z.infer<typeof DeviceStatusEnum>;
export type ProtocolType = z.infer<typeof ProtocolTypeEnum>;
export type OverallResult = z.infer<typeof OverallResultEnum>;
export type MeasurementType = z.infer<typeof MeasurementTypeEnum>;
export type MeasurementResult = z.infer<typeof MeasurementResultEnum>;
export type DefectSeverity = z.infer<typeof DefectSeverityEnum>;

// DEVICE
export const InspectionDeviceCreateSchema = z.object({
  customer_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  device_name: z.string().min(1, 'Geraetename ist erforderlich'),
  device_type: DeviceTypeEnum.default('geraet'),
  manufacturer: z.string().optional(), model: z.string().optional(),
  serial_number: z.string().optional(), location: z.string().optional(),
  protection_class: ProtectionClassEnum.default('I'),
  next_inspection_date: z.string().optional(),
  inspection_interval_months: z.number().int().min(1).default(12),
  status: DeviceStatusEnum.default('active'),
});
export const InspectionDeviceUpdateSchema = InspectionDeviceCreateSchema.partial();
export const InspectionDeviceSchema = z.object({
  id: z.string().uuid(), company_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable(), project_id: z.string().uuid().nullable(),
  device_name: z.string(), device_type: DeviceTypeEnum,
  manufacturer: z.string().nullable(), model: z.string().nullable(),
  serial_number: z.string().nullable(), location: z.string().nullable(),
  protection_class: ProtectionClassEnum.nullable(),
  next_inspection_date: z.string().nullable(),
  inspection_interval_months: z.number().int().nullable(),
  status: DeviceStatusEnum,
  created_at: z.string().datetime(), updated_at: z.string().datetime(),
});

// PROTOCOL
export const InspectionProtocolCreateSchema = z.object({
  device_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  protocol_type: ProtocolTypeEnum,
  inspector_id: z.string().uuid().optional(),
  inspection_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  notes: z.string().optional(),
});
export const InspectionProtocolUpdateSchema = InspectionProtocolCreateSchema.partial();
export const InspectionProtocolSchema = z.object({
  id: z.string().uuid(), company_id: z.string().uuid(),
  device_id: z.string().uuid().nullable(), customer_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  protocol_number: z.string(), protocol_type: ProtocolTypeEnum,
  inspector_id: z.string().uuid().nullable(), inspection_date: z.string(),
  overall_result: OverallResultEnum.nullable(), notes: z.string().nullable(),
  is_finalized: z.boolean(), finalized_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(), updated_at: z.string().datetime(),
});

// MEASUREMENT
export const InspectionMeasurementCreateSchema = z.object({
  protocol_id: z.string().uuid(), measurement_type: MeasurementTypeEnum,
  circuit_label: z.string().optional(), measured_value: z.number(),
  unit: z.string().min(1), limit_value: z.number().optional(),
  limit_type: LimitTypeEnum.optional(), result: MeasurementResultEnum,
  test_voltage: z.number().optional(), notes: z.string().optional(),
});
export const InspectionMeasurementSchema = z.object({
  id: z.string().uuid(), protocol_id: z.string().uuid(),
  measurement_type: MeasurementTypeEnum, circuit_label: z.string().nullable(),
  measured_value: z.number(), unit: z.string(),
  limit_value: z.number().nullable(), limit_type: LimitTypeEnum.nullable(),
  result: MeasurementResultEnum, test_voltage: z.number().nullable(),
  notes: z.string().nullable(),
});

// DEFECT
export const InspectionDefectCreateSchema = z.object({
  protocol_id: z.string().uuid(), severity: DefectSeverityEnum,
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  location: z.string().optional(), recommendation: z.string().optional(),
});
export const InspectionDefectUpdateSchema = z.object({
  severity: DefectSeverityEnum.optional(), description: z.string().optional(),
  location: z.string().optional(), recommendation: z.string().optional(),
  resolved: z.boolean().optional(), resolved_by: z.string().uuid().optional(),
});
export const InspectionDefectSchema = z.object({
  id: z.string().uuid(), protocol_id: z.string().uuid(),
  severity: DefectSeverityEnum, description: z.string(),
  location: z.string().nullable(), recommendation: z.string().nullable(),
  resolved: z.boolean(), resolved_at: z.string().datetime().nullable(),
  resolved_by: z.string().uuid().nullable(),
});

// SCHEDULE
export const InspectionScheduleCreateSchema = z.object({
  device_id: z.string().uuid(), next_due_date: z.string(),
  interval_months: z.number().int().min(1).default(12),
  reminder_days_before: z.array(z.number().int()).default([30, 14, 7, 1]),
});
export const InspectionScheduleSchema = z.object({
  id: z.string().uuid(), company_id: z.string().uuid(),
  device_id: z.string().uuid(), next_due_date: z.string(),
  interval_months: z.number().int(),
  reminder_days_before: z.array(z.number().int()),
  last_notified_at: z.string().datetime().nullable(), is_active: z.boolean(),
});

// PHOTO
export const InspectionPhotoSchema = z.object({
  id: z.string().uuid(), protocol_id: z.string().uuid(),
  storage_path: z.string(), caption: z.string().nullable(),
  created_at: z.string().datetime(),
});

// EXTENDED: protocol with nested relations
export const ProtocolWithRelationsSchema = InspectionProtocolSchema.extend({
  measurements: z.array(InspectionMeasurementSchema).optional(), defects: z.array(InspectionDefectSchema).optional(),
  photos: z.array(InspectionPhotoSchema).optional(), device: InspectionDeviceSchema.optional(),
});

// TS TYPES (z.infer for each schema above)
export type InspectionDevice = z.infer<typeof InspectionDeviceSchema>;
export type InspectionDeviceCreate = z.infer<typeof InspectionDeviceCreateSchema>;
export type InspectionDeviceUpdate = z.infer<typeof InspectionDeviceUpdateSchema>;
export type InspectionProtocol = z.infer<typeof InspectionProtocolSchema>;
export type InspectionProtocolCreate = z.infer<typeof InspectionProtocolCreateSchema>;
export type InspectionProtocolUpdate = z.infer<typeof InspectionProtocolUpdateSchema>;
export type ProtocolWithRelations = z.infer<typeof ProtocolWithRelationsSchema>;
export type InspectionMeasurement = z.infer<typeof InspectionMeasurementSchema>;
export type InspectionMeasurementCreate = z.infer<typeof InspectionMeasurementCreateSchema>;
export type InspectionDefect = z.infer<typeof InspectionDefectSchema>;
export type InspectionDefectCreate = z.infer<typeof InspectionDefectCreateSchema>;
export type InspectionDefectUpdate = z.infer<typeof InspectionDefectUpdateSchema>;
export type InspectionSchedule = z.infer<typeof InspectionScheduleSchema>;
export type InspectionScheduleCreate = z.infer<typeof InspectionScheduleCreateSchema>;
export type InspectionPhoto = z.infer<typeof InspectionPhotoSchema>;
export type InspectionFilter = { protocol_type?: ProtocolType; overall_result?: OverallResult; customer_id?: string; device_id?: string; search?: string; from_date?: string; to_date?: string; };

// CONSTANTS (German labels for UI)
export const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = { vde_0100_600: 'VDE 0100-600 (Erstpruefung)', vde_0105_100: 'VDE 0105-100 (Wiederk. Pruefung)', vde_0701_0702: 'VDE 0701/0702 (Geraete)' };
export const RESULT_LABELS: Record<OverallResult, string> = { pass: 'Bestanden', fail: 'Nicht bestanden', conditional: 'Bedingt bestanden' };
export const RESULT_COLORS: Record<OverallResult, string> = { pass: 'green', fail: 'red', conditional: 'orange' };
export const SEVERITY_LABELS: Record<DefectSeverity, string> = { minor: 'Gering', major: 'Erheblich', critical: 'Kritisch / Gefahr' };
export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = { insulation_resistance: 'Isolationswiderstand', loop_impedance: 'Schleifenimpedanz', rcd_trip_time: 'RCD Ausloeszeit', rcd_trip_current: 'RCD Ausloesstrom', protective_conductor: 'Schutzleiterwiderstand', earth_resistance: 'Erdungswiderstand', voltage_drop: 'Spannungsfall', leakage_current: 'Ableitstrom', touch_current: 'Beruehrungsstrom' };
```

**Modify `src/types/index.ts`** -- add after `export * from './offer'`:
```typescript
export * from './inspection';
```

---

## Task 3: Service

**File:** `src/services/inspectionService.ts`

- [ ] Create service following `offerService.ts` pattern (static class + `apiCall` wrapper)
- [ ] Verify: `npx tsc --noEmit`

```typescript
import { supabase } from '@/integrations/supabase/client';
import { apiCall, ApiError, API_ERROR_CODES } from '@/utils/api';
import type {
  InspectionDevice, InspectionDeviceCreate, InspectionDeviceUpdate,
  InspectionProtocol, InspectionProtocolCreate, InspectionProtocolUpdate,
  ProtocolWithRelations, InspectionMeasurement, InspectionMeasurementCreate,
  InspectionDefect, InspectionDefectCreate, InspectionDefectUpdate,
  InspectionSchedule, InspectionScheduleCreate, InspectionFilter,
} from '@/types/inspection';
import { AuditLogService } from './auditLogService';

export class InspectionService {
  // Same getCompanyId() pattern as OfferService (profiles -> employees -> fallback)
  private static async getCompanyId(): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.user.id).single();
    if (profile?.company_id) return profile.company_id;
    const { data: emp } = await supabase
      .from('employees').select('company_id').eq('user_id', user.user.id).single();
    return emp?.company_id || '00000000-0000-0000-0000-000000000000';
  }

  // DEVICES: standard CRUD (getDevices, getDevice, createDevice, updateDevice, deleteDevice)
  // Pattern: apiCall wrapper, supabase.from('inspection_devices'), company_id on insert
  static async getDevices(customerId?: string): Promise<InspectionDevice[]> {
    return apiCall(async () => {
      let q = supabase.from('inspection_devices').select('*').order('device_name');
      if (customerId) q = q.eq('customer_id', customerId);
      const { data, error } = await q; if (error) throw error; return data || [];
    }, 'Get devices');
  }
  static async getDevice(id: string): Promise<InspectionDevice> {
    return apiCall(async () => {
      const { data, error } = await supabase.from('inspection_devices').select('*').eq('id', id).single();
      if (error) throw error; return data;
    }, `Get device ${id}`);
  }
  static async createDevice(input: InspectionDeviceCreate): Promise<InspectionDevice> {
    return apiCall(async () => {
      const cid = await this.getCompanyId();
      const { data, error } = await supabase.from('inspection_devices')
        .insert({ ...input, company_id: cid }).select().single();
      if (error) throw error; return data;
    }, 'Create device');
  }
  static async updateDevice(id: string, input: InspectionDeviceUpdate): Promise<InspectionDevice> {
    return apiCall(async () => {
      const { data, error } = await supabase.from('inspection_devices').update(input).eq('id', id).select().single();
      if (error) throw error; return data;
    }, `Update device ${id}`);
  }
  static async deleteDevice(id: string): Promise<void> {
    return apiCall(async () => {
      const { error } = await supabase.from('inspection_devices').delete().eq('id', id);
      if (error) throw error;
    }, `Delete device ${id}`);
  }

  // PROTOCOLS
  static async getProtocols(filters?: InspectionFilter): Promise<InspectionProtocol[]> {
    return apiCall(async () => {
      let q = supabase.from('inspection_protocols').select('*');
      if (filters?.protocol_type) q = q.eq('protocol_type', filters.protocol_type);
      if (filters?.overall_result) q = q.eq('overall_result', filters.overall_result);
      if (filters?.customer_id) q = q.eq('customer_id', filters.customer_id);
      if (filters?.device_id) q = q.eq('device_id', filters.device_id);
      if (filters?.from_date) q = q.gte('inspection_date', filters.from_date);
      if (filters?.to_date) q = q.lte('inspection_date', filters.to_date);
      if (filters?.search) q = q.or(`protocol_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
      const { data, error } = await q.order('inspection_date', { ascending: false });
      if (error) throw error; return data || [];
    }, 'Get protocols');
  }
  static async getProtocol(id: string): Promise<ProtocolWithRelations> {
    return apiCall(async () => {
      const { data: p, error } = await supabase.from('inspection_protocols').select('*').eq('id', id).single();
      if (error) throw error;
      const [m, d, ph, dev] = await Promise.all([
        supabase.from('inspection_measurements').select('*').eq('protocol_id', id),
        supabase.from('inspection_defects').select('*').eq('protocol_id', id),
        supabase.from('inspection_photos').select('*').eq('protocol_id', id),
        p.device_id ? supabase.from('inspection_devices').select('*').eq('id', p.device_id).single()
          : Promise.resolve({ data: null }),
      ]);
      return { ...p, measurements: m.data||[], defects: d.data||[], photos: ph.data||[], device: dev.data||undefined } as ProtocolWithRelations;
    }, `Get protocol ${id}`);
  }
  static async createProtocol(input: InspectionProtocolCreate): Promise<InspectionProtocol> {
    return apiCall(async () => {
      const cid = await this.getCompanyId();
      // @ts-ignore
      const { data: num, error: seqErr } = await supabase.rpc('next_protocol_number', { p_company_id: cid });
      if (seqErr) throw seqErr;
      const { data, error } = await supabase.from('inspection_protocols')
        .insert({ ...input, company_id: cid, protocol_number: num }).select().single();
      if (error) throw error; return data;
    }, 'Create protocol');
  }
  static async updateProtocol(id: string, input: InspectionProtocolUpdate): Promise<InspectionProtocol> {
    return apiCall(async () => {
      const existing = await this.getProtocol(id);
      if (existing.is_finalized) throw new ApiError(API_ERROR_CODES.IMMUTABLE_RECORD, 'Finalisiertes Protokoll nicht editierbar.');
      const { data, error } = await supabase.from('inspection_protocols').update(input).eq('id', id).select().single();
      if (error) throw error; return data;
    }, `Update protocol ${id}`);
  }
  static async finalizeProtocol(id: string): Promise<InspectionProtocol> {
    return apiCall(async () => {
      const proto = await this.getProtocol(id);
      if (proto.is_finalized) throw new ApiError(API_ERROR_CODES.IMMUTABLE_RECORD, 'Bereits finalisiert.');
      const hasFail = proto.measurements?.some(m => m.result === 'fail');
      const hasCritical = proto.defects?.some(d => d.severity === 'critical' && !d.resolved);
      let overall: 'pass'|'fail'|'conditional' = 'pass';
      if (hasFail || hasCritical) overall = 'fail';
      else if (proto.defects?.some(d => !d.resolved)) overall = 'conditional';
      const { data, error } = await supabase.from('inspection_protocols').update({
        is_finalized: true, finalized_at: new Date().toISOString(), overall_result: overall,
      }).eq('id', id).select().single();
      if (error) throw error;
      // Update device next_inspection_date + schedule
      if (proto.device_id && proto.device) {
        const next = new Date(proto.inspection_date);
        next.setMonth(next.getMonth() + (proto.device.inspection_interval_months || 12));
        const nextStr = next.toISOString().split('T')[0];
        await supabase.from('inspection_devices').update({ next_inspection_date: nextStr }).eq('id', proto.device_id);
        await supabase.from('inspection_schedules').update({ next_due_date: nextStr }).eq('device_id', proto.device_id);
      }
      // GoBD audit (non-blocking)
      try { await AuditLogService.createAuditLog({ entity_type: 'document' as any, entity_id: id, action: 'APPROVE',
        new_values: { protocol_number: data.protocol_number, overall_result: overall }, reason: 'Pruefprotokoll finalisiert' }); } catch { }
      return data;
    }, `Finalize protocol ${id}`);
  }

  // MEASUREMENTS + DEFECTS: simple insert/delete/update via apiCall
  static async addMeasurement(input: InspectionMeasurementCreate): Promise<InspectionMeasurement> {
    return apiCall(async () => { const { data, error } = await supabase.from('inspection_measurements').insert(input).select().single(); if (error) throw error; return data; }, 'Add measurement');
  }
  static async deleteMeasurement(id: string): Promise<void> {
    return apiCall(async () => { const { error } = await supabase.from('inspection_measurements').delete().eq('id', id); if (error) throw error; }, `Delete measurement ${id}`);
  }
  static async addDefect(input: InspectionDefectCreate): Promise<InspectionDefect> {
    return apiCall(async () => { const { data, error } = await supabase.from('inspection_defects').insert(input).select().single(); if (error) throw error; return data; }, 'Add defect');
  }
  static async updateDefect(id: string, input: InspectionDefectUpdate): Promise<InspectionDefect> {
    return apiCall(async () => {
      const upd: any = { ...input }; if (input.resolved) upd.resolved_at = new Date().toISOString();
      const { data, error } = await supabase.from('inspection_defects').update(upd).eq('id', id).select().single();
      if (error) throw error; return data;
    }, `Update defect ${id}`);
  }

  // SCHEDULING
  static async getUpcomingInspections(withinDays = 30): Promise<InspectionDevice[]> {
    return apiCall(async () => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + withinDays);
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('inspection_devices').select('*')
        .eq('status', 'active').not('next_inspection_date', 'is', null)
        .gte('next_inspection_date', today).lte('next_inspection_date', cutoff.toISOString().split('T')[0])
        .order('next_inspection_date');
      if (error) throw error; return data || [];
    }, 'Get upcoming inspections');
  }
  static async getOverdueInspections(): Promise<InspectionDevice[]> {
    return apiCall(async () => {
      const { data, error } = await supabase.from('inspection_devices').select('*')
        .eq('status', 'active').not('next_inspection_date', 'is', null)
        .lt('next_inspection_date', new Date().toISOString().split('T')[0]).order('next_inspection_date');
      if (error) throw error; return data || [];
    }, 'Get overdue inspections');
  }
  static async createSchedule(input: InspectionScheduleCreate): Promise<InspectionSchedule> {
    return apiCall(async () => {
      const cid = await this.getCompanyId();
      const { data, error } = await supabase.from('inspection_schedules').insert({ ...input, company_id: cid }).select().single();
      if (error) throw error; return data;
    }, 'Create schedule');
  }
}
export const inspectionService = new InspectionService();
```

---

## Task 4: Hooks

**File:** `src/hooks/useInspections.ts`

- [ ] Create hooks following `useApi.ts` pattern (query keys + useQuery + useMutation + toast)
- [ ] Verify: `npx tsc --noEmit`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { InspectionService } from '@/services/inspectionService';
import type {
  InspectionDeviceCreate, InspectionDeviceUpdate, InspectionProtocolCreate, InspectionProtocolUpdate,
  InspectionMeasurementCreate, InspectionDefectCreate, InspectionDefectUpdate,
  InspectionScheduleCreate, InspectionFilter,
} from '@/types/inspection';

export const INSPECTION_KEYS = {
  devices: ['inspection-devices'] as const,
  device: (id: string) => ['inspection-devices', id] as const,
  protocols: ['inspection-protocols'] as const,
  protocol: (id: string) => ['inspection-protocols', id] as const,
  upcoming: ['inspection-upcoming'] as const,
  overdue: ['inspection-overdue'] as const,
};

// Helper for mutation error toasts
const errHandler = (toast: any) => (e: Error) => toast({ title: 'Fehler', description: e.message, variant: 'destructive' });

// DEVICE hooks
export const useInspectionDevices = (cid?: string) => useQuery({ queryKey: [...INSPECTION_KEYS.devices, cid], queryFn: () => InspectionService.getDevices(cid) });
export const useInspectionDevice = (id: string) => useQuery({ queryKey: INSPECTION_KEYS.device(id), queryFn: () => InspectionService.getDevice(id), enabled: !!id });
export function useCreateDevice() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: (d: InspectionDeviceCreate) => InspectionService.createDevice(d), onSuccess: () => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.devices }); toast({ title: 'Geraet angelegt' }); }, onError: errHandler(toast) }); }
export function useUpdateDevice() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: ({ id, data }: { id: string; data: InspectionDeviceUpdate }) => InspectionService.updateDevice(id, data), onSuccess: (_, { id }) => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.devices }); qc.invalidateQueries({ queryKey: INSPECTION_KEYS.device(id) }); toast({ title: 'Geraet aktualisiert' }); }, onError: errHandler(toast) }); }
export function useDeleteDevice() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: (id: string) => InspectionService.deleteDevice(id), onSuccess: () => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.devices }); toast({ title: 'Geraet geloescht' }); }, onError: errHandler(toast) }); }

// PROTOCOL hooks
export const useInspectionProtocols = (f?: InspectionFilter) => useQuery({ queryKey: [...INSPECTION_KEYS.protocols, f], queryFn: () => InspectionService.getProtocols(f) });
export const useInspectionProtocol = (id: string) => useQuery({ queryKey: INSPECTION_KEYS.protocol(id), queryFn: () => InspectionService.getProtocol(id), enabled: !!id });
export function useCreateProtocol() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: (d: InspectionProtocolCreate) => InspectionService.createProtocol(d), onSuccess: () => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocols }); toast({ title: 'Pruefprotokoll erstellt' }); }, onError: errHandler(toast) }); }
export function useUpdateProtocol() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: ({ id, data }: { id: string; data: InspectionProtocolUpdate }) => InspectionService.updateProtocol(id, data), onSuccess: (_, { id }) => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocols }); qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(id) }); toast({ title: 'Protokoll aktualisiert' }); }, onError: errHandler(toast) }); }
export function useFinalizeProtocol() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: (id: string) => InspectionService.finalizeProtocol(id), onSuccess: (data) => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocols }); qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(data.id) }); qc.invalidateQueries({ queryKey: INSPECTION_KEYS.devices }); toast({ title: 'Protokoll finalisiert', description: `Ergebnis: ${data.overall_result}` }); }, onError: errHandler(toast) }); }

// MEASUREMENT & DEFECT hooks
export function useAddMeasurement() { const qc = useQueryClient(); return useMutation({ mutationFn: (d: InspectionMeasurementCreate) => InspectionService.addMeasurement(d), onSuccess: (data) => qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(data.protocol_id) }) }); }
export function useDeleteMeasurement(pid: string) { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => InspectionService.deleteMeasurement(id), onSuccess: () => qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(pid) }) }); }
export function useAddDefect() { const qc = useQueryClient(); return useMutation({ mutationFn: (d: InspectionDefectCreate) => InspectionService.addDefect(d), onSuccess: (data) => qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(data.protocol_id) }) }); }
export function useUpdateDefect(pid: string) { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: ({ id, data }: { id: string; data: InspectionDefectUpdate }) => InspectionService.updateDefect(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.protocol(pid) }); toast({ title: 'Mangel aktualisiert' }); }, onError: errHandler(toast) }); }

// SCHEDULE & DASHBOARD hooks
export const useUpcomingInspections = (days?: number) => useQuery({ queryKey: [...INSPECTION_KEYS.upcoming, days], queryFn: () => InspectionService.getUpcomingInspections(days) });
export const useOverdueInspections = () => useQuery({ queryKey: INSPECTION_KEYS.overdue, queryFn: () => InspectionService.getOverdueInspections() });
export function useCreateSchedule() { const qc = useQueryClient(); const { toast } = useToast(); return useMutation({ mutationFn: (d: InspectionScheduleCreate) => InspectionService.createSchedule(d), onSuccess: () => { qc.invalidateQueries({ queryKey: INSPECTION_KEYS.upcoming }); toast({ title: 'Pruefplan erstellt' }); }, onError: errHandler(toast) }); }
```

---

## Task 5: Auto-Evaluation Logic

**File:** `src/lib/vde-evaluation.ts`

- [ ] Create pure function -- no Supabase calls, unit-testable
- [ ] Verify with inline test values in verification checklist below

```typescript
import type { InspectionMeasurement, MeasurementType, MeasurementResult } from '@/types/inspection';

// VDE LIMIT TABLES
const INSULATION_LIMITS: Record<number, number> = { 250: 0.25, 500: 1.0, 1000: 1.0 };

const LOOP_IMPEDANCE_LIMITS: Record<string, number> = {
  'B6':7.67,'B10':4.60,'B13':3.54,'B16':2.87,'B20':2.30,'B25':1.84,'B32':1.44,
  'C6':3.83,'C10':2.30,'C13':1.77,'C16':1.44,'C20':1.15,'C25':0.92,'C32':0.72,
  'K6':1.92,'K10':1.15,'K13':0.88,'K16':0.72,'K20':0.58,'K25':0.46,'K32':0.36,
};

const RCD_TRIP_TIME_LIMITS: Record<string, number> = {
  '30_standard': 200, '30_fast': 40, '300_standard': 200,
};

export interface EvaluationInput {
  measurement_type: MeasurementType;
  measured_value: number;
  unit: string;
  /** insulation: test voltage (V). loop impedance: fuse label e.g. "B16". rcd: "30_standard"|"30_fast" */
  context?: string;
  device_type?: 'anlage' | 'geraet';
}

export interface EvaluationResult {
  result: MeasurementResult;
  limit_value: number;
  limit_type: 'min' | 'max';
  unit: string;
  description: string;
}

export function evaluateMeasurement(input: EvaluationInput): EvaluationResult {
  const { measurement_type: mt, measured_value: v, context: ctx, device_type: dt } = input;

  if (mt === 'insulation_resistance') {
    const tv = Number(ctx) || 500; const lim = INSULATION_LIMITS[tv] ?? 1.0;
    return { result: v >= lim ? 'pass':'fail', limit_value: lim, limit_type: 'min', unit: 'MOhm',
      description: `>= ${lim} MOhm bei ${tv}V` };
  }
  if (mt === 'loop_impedance') {
    const fuse = ctx || 'B16'; const lim = LOOP_IMPEDANCE_LIMITS[fuse];
    if (!lim) return { result:'fail', limit_value:0, limit_type:'max', unit:'Ohm', description:`Unbekannt: ${fuse}` };
    return { result: v <= lim ? 'pass':'fail', limit_value: lim, limit_type: 'max', unit: 'Ohm',
      description: `<= ${lim} Ohm (${fuse})` };
  }
  if (mt === 'rcd_trip_time') {
    const lim = RCD_TRIP_TIME_LIMITS[ctx||'30_standard'] ?? 200;
    return { result: v <= lim ? 'pass':'fail', limit_value: lim, limit_type: 'max', unit: 'ms',
      description: `<= ${lim} ms` };
  }
  if (mt === 'rcd_trip_current') {
    const rated = Number(ctx) || 30; const max = rated; const min = rated * 0.5;
    return { result: v >= min && v <= max ? 'pass':'fail', limit_value: max, limit_type: 'max', unit: 'mA',
      description: `${min}-${max} mA` };
  }
  if (mt === 'protective_conductor') {
    const lim = dt === 'anlage' ? 1.0 : 0.3;
    return { result: v <= lim ? 'pass':'fail', limit_value: lim, limit_type: 'max', unit: 'Ohm',
      description: `<= ${lim} Ohm` };
  }
  if (mt === 'earth_resistance') {
    return { result: v <= 2.0 ? 'pass':'fail', limit_value: 2.0, limit_type: 'max', unit: 'Ohm', description: '<= 2.0 Ohm' };
  }
  if (mt === 'voltage_drop') {
    return { result: v <= 4.0 ? 'pass':'fail', limit_value: 4.0, limit_type: 'max', unit: '%', description: '<= 4%' };
  }
  if (mt === 'leakage_current') {
    return { result: v <= 3.5 ? 'pass':'fail', limit_value: 3.5, limit_type: 'max', unit: 'mA', description: '<= 3.5 mA' };
  }
  if (mt === 'touch_current') {
    return { result: v <= 0.5 ? 'pass':'fail', limit_value: 0.5, limit_type: 'max', unit: 'mA', description: '<= 0.5 mA' };
  }
  return { result:'fail', limit_value:0, limit_type:'max', unit:'', description:'Unbekannter Messtyp' };
}

/** Batch: returns overall result from array of measurements. */
export function evaluateResults(
  measurements: Pick<InspectionMeasurement, 'result'>[]
): 'pass' | 'fail' | 'conditional' {
  if (measurements.length === 0) return 'conditional';
  return measurements.some(m => m.result === 'fail') ? 'fail' : 'pass';
}

export { LOOP_IMPEDANCE_LIMITS, INSULATION_LIMITS, RCD_TRIP_TIME_LIMITS };
```

---

## Task 6: Protocol Number Generator

**File:** `src/lib/protocol-number.ts`

- [ ] Create client-side helper (DB function does actual sequencing from Task 1)

```typescript
import { supabase } from '@/integrations/supabase/client';

/** Generate next protocol number via DB sequence (race-safe). Format: PRF-YYYY-NNNN */
export async function generateProtocolNumber(companyId: string): Promise<string> {
  // @ts-ignore
  const { data, error } = await supabase.rpc('next_protocol_number', { p_company_id: companyId });
  if (error) throw error;
  return data as string;
}

/** Preview-only formatter (does NOT increment sequence). */
export function formatProtocolNumber(year: number, sequence: number): string {
  return `PRF-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Parse protocol number back to components. */
export function parseProtocolNumber(num: string): { year: number; sequence: number } | null {
  const m = num.match(/^PRF-(\d{4})-(\d{4})$/);
  return m ? { year: parseInt(m[1], 10), sequence: parseInt(m[2], 10) } : null;
}
```

---

## Modify: Audit Entity Type

**File:** `src/services/auditLogService.ts`

- [ ] Add `| 'inspection_protocol'` to `AuditEntityType` type (after `'payment'` on line 31)
- [ ] Add `'inspection_protocol'` to the Zod enum array in `AuditLogCreateSchema` (line 86)
- [ ] Add `inspection_protocol: 0` to `logsByEntityType` in `getAuditStatistics` (line 312)

---

## Verification Checklist

- [ ] Migration applies cleanly (`supabase db push` or MCP)
- [ ] `npx tsc --noEmit` passes for all new files
- [ ] `SELECT * FROM inspection_protocols LIMIT 0` shows correct columns
- [ ] RLS: unauthenticated query returns 0 rows
- [ ] `evaluateMeasurement({ measurement_type:'insulation_resistance', measured_value:0.5, unit:'MOhm', context:'500' })` -> `result:'fail', limit_value:1.0`
- [ ] `evaluateMeasurement({ measurement_type:'loop_impedance', measured_value:2.0, unit:'Ohm', context:'B16' })` -> `result:'pass', limit_value:2.87`

---
---

# Part 2: Tasks 7-12 (UI Components, PDF, Integration)

---

## Task 7: InspectionForm Component

**File:** `src/components/inspections/InspectionForm.tsx`

- [ ] Create with React Hook Form + Zod validation
- [ ] Dynamic form based on `protocol_type`
- [ ] Measurement rows with auto pass/fail via `evaluateMeasurement()`
- [ ] Defect section with severity dropdown
- [ ] Photo upload via Supabase Storage
- [ ] "Prufung abschliessen" finalize button (locks editing)

```tsx
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Lock, Camera, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { evaluateMeasurement } from '@/lib/vde-evaluation';
import {
  useCreateProtocol, useUpdateProtocol, useFinalizeProtocol,
} from '@/hooks/useInspections';
import type {
  ProtocolWithRelations, InspectionProtocolCreate, InspectionMeasurement,
  MeasurementType, ProtocolType,
} from '@/types/inspection';

// ── Sichtpruefung default checklist ──────────────────────────────────
const DEFAULT_VISUAL_CHECKS = [
  'Schutzmaßnahmen vorhanden und korrekt',
  'Leitungsverlegung ordnungsgemaess',
  'Kennzeichnung der Stromkreise',
  'Ueberspannungsschutz vorhanden',
  'Fehlerstromschutzeinrichtung vorhanden',
  'Isolierung unbeschaedigt',
  'Klemmen und Verbindungen fest',
  'Gehaeuse und Abdeckungen intakt',
  'Warnhinweise und Schilder vorhanden',
  'Zugaenglichkeit der Betriebsmittel',
];

const formSchema = z.object({
  protocol_type: z.enum(['VDE_0100_600', 'VDE_0105_100', 'VDE_0701_0702']),
  inspection_date: z.string().min(1),
  inspector_name: z.string().min(1, 'Prufer angeben'),
  notes: z.string().optional(),
  device_name: z.string().optional(),
  device_manufacturer: z.string().optional(),
  device_serial: z.string().optional(),
  schutzklasse: z.enum(['I', 'II', 'III']).optional(),
});
type FormData = z.infer<typeof formSchema>;

interface InspectionFormProps {
  protocol?: ProtocolWithRelations;
  deviceId?: string;
  customerId?: string;
  projectId?: string;
  defaultType?: ProtocolType;
  onClose: () => void;
}

export default function InspectionForm({
  protocol, deviceId, customerId, projectId, defaultType, onClose,
}: InspectionFormProps) {
  const { toast } = useToast();
  const isLocked = protocol?.is_finalized === true;
  const isNew = !protocol;

  const createProtocol = useCreateProtocol();
  const updateProtocol = useUpdateProtocol();
  const finalizeProtocol = useFinalizeProtocol();

  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [visualChecks, setVisualChecks] = useState(
    DEFAULT_VISUAL_CHECKS.map(label => ({ label, checked: false, note: '' }))
  );
  const [measurements, setMeasurements] = useState<Partial<InspectionMeasurement>[]>(
    protocol?.measurements ?? []
  );
  const [defects, setDefects] = useState(protocol?.defects ?? []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      protocol_type: protocol?.protocol_type ?? defaultType ?? 'VDE_0100_600',
      inspection_date: protocol?.inspection_date ?? new Date().toISOString().split('T')[0],
      inspector_name: protocol?.inspector_name ?? '',
      notes: protocol?.notes ?? '',
      schutzklasse: 'I',
    },
  });

  const pType = form.watch('protocol_type');
  const isDevice = pType === 'VDE_0701_0702';

  // Measurement section config per protocol type
  const MEAS_SECTIONS: { type: MeasurementType; label: string; unit: string }[] = isDevice
    ? [
        { type: 'protective_conductor', label: 'PE-Widerstand', unit: 'Ohm' },
        { type: 'insulation_resistance', label: 'Isolation', unit: 'MOhm' },
        { type: 'leakage_current', label: 'Ableitstrom', unit: 'mA' },
      ]
    : [
        { type: 'insulation_resistance', label: 'Isolation', unit: 'MOhm' },
        { type: 'loop_impedance', label: 'Schleifenimpedanz', unit: 'Ohm' },
        { type: 'rcd_trip_time', label: 'RCD Ausloesezeit', unit: 'ms' },
        { type: 'protective_conductor', label: 'PE-Widerstand', unit: 'Ohm' },
        { type: 'earth_resistance', label: 'Erdung', unit: 'Ohm' },
      ];

  // ── Measurement row helpers ────────────────────────────────────────
  const addMeasRow = (type: MeasurementType) => {
    setMeasurements(prev => [...prev, {
      measurement_type: type, circuit_label: '',
      test_voltage: type === 'insulation_resistance' ? 500 : undefined,
      measured_value: 0, unit: MEAS_SECTIONS.find(s => s.type === type)?.unit ?? '',
      result: 'pending',
    }]);
  };

  const updateMeasRow = (idx: number, field: string, value: any) => {
    setMeasurements(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      // Auto-evaluate on value change
      if (field === 'measured_value' || field === 'test_voltage') {
        const row = next[idx];
        const ev = evaluateMeasurement({
          measurement_type: row.measurement_type!,
          measured_value: Number(row.measured_value),
          unit: row.unit ?? '',
          context: row.test_voltage?.toString(),
          device_type: isDevice ? 'geraet' : 'anlage',
        });
        next[idx] = { ...row, result: ev.result, limit_value: ev.limit_value };
      }
      return next;
    });
  };

  // ── Photo upload ───────────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const path = `inspections/${protocol?.id ?? 'draft'}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('inspection-photos').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('inspection-photos').getPublicUrl(path);
      setPhotos(prev => [...prev, publicUrl]);
    } catch { toast({ title: 'Upload fehlgeschlagen', variant: 'destructive' }); }
    finally { setUploadingPhoto(false); }
  };

  // ── Submit ─────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    try {
      if (isNew) {
        await createProtocol.mutateAsync({
          ...data, device_id: deviceId ?? null,
          customer_id: customerId ?? null, project_id: projectId ?? null,
          visual_checks: !isDevice ? visualChecks : undefined,
        } as InspectionProtocolCreate);
      } else {
        await updateProtocol.mutateAsync({ id: protocol!.id, data: {
          ...data, visual_checks: !isDevice ? visualChecks : undefined,
        }});
      }
      onClose();
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
  };

  const handleFinalize = async () => {
    if (!protocol?.id) return;
    try {
      await finalizeProtocol.mutateAsync(protocol.id);
      setShowFinalizeDialog(false);
      onClose();
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
  };

  const PassBadge = ({ result }: { result?: string }) => {
    if (result === 'pass') return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>;
    if (result === 'fail') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Fail</Badge>;
    return <Badge variant="secondary">-</Badge>;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {isLocked && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <Lock className="h-4 w-4" /> Protokoll ist abgeschlossen und gesperrt.
        </div>
      )}

      {/* Header fields */}
      <Card>
        <CardHeader><CardTitle className="text-base">Allgemeine Angaben</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Protokolltyp</Label>
            <Controller control={form.control} name="protocol_type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isLocked || !isNew}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VDE_0100_600">VDE 0100-600 Erstprufung</SelectItem>
                  <SelectItem value="VDE_0105_100">VDE 0105-100 Wiederholung</SelectItem>
                  <SelectItem value="VDE_0701_0702">VDE 0701/0702 Geraete</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <div><Label>Prufdatum</Label><Input type="date" {...form.register('inspection_date')} disabled={isLocked} /></div>
          <div><Label>Prufer</Label><Input {...form.register('inspector_name')} disabled={isLocked} /></div>
        </CardContent>
      </Card>

      {/* Device data (0701/0702 only) */}
      {isDevice && (
        <Card>
          <CardHeader><CardTitle className="text-base">Geraetedaten</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><Label>Geraet</Label><Input {...form.register('device_name')} disabled={isLocked} /></div>
            <div><Label>Hersteller</Label><Input {...form.register('device_manufacturer')} disabled={isLocked} /></div>
            <div><Label>Seriennr.</Label><Input {...form.register('device_serial')} disabled={isLocked} /></div>
            <div><Label>Schutzklasse</Label>
              <Controller control={form.control} name="schutzklasse" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isLocked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">Klasse I</SelectItem>
                    <SelectItem value="II">Klasse II</SelectItem>
                    <SelectItem value="III">Klasse III</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sichtpruefung (0100/0105 only) */}
      {!isDevice && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sichtprufung</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {visualChecks.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-1 border-b border-slate-100 last:border-0">
                <Checkbox checked={item.checked} disabled={isLocked}
                  onCheckedChange={(v) => { const n = [...visualChecks]; n[idx] = { ...n[idx], checked: !!v }; setVisualChecks(n); }} />
                <span className="text-sm flex-1">{item.label}</span>
                <Input value={item.note} placeholder="Bemerkung" className="w-48 h-7 text-xs" disabled={isLocked}
                  onChange={(e) => { const n = [...visualChecks]; n[idx] = { ...n[idx], note: e.target.value }; setVisualChecks(n); }} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Measurement tabs */}
      <Tabs defaultValue={MEAS_SECTIONS[0]?.type}>
        <TabsList>
          {MEAS_SECTIONS.map(s => <TabsTrigger key={s.type} value={s.type}>{s.label}</TabsTrigger>)}
        </TabsList>
        {MEAS_SECTIONS.map(sec => {
          const rows = measurements.filter(m => m.measurement_type === sec.type);
          return (
            <TabsContent key={sec.type} value={sec.type}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{sec.label}</CardTitle>
                    {!isLocked && <Button variant="outline" size="sm" type="button" onClick={() => addMeasRow(sec.type)}><Plus className="h-3 w-3 mr-1" />Zeile</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1 mb-2">
                    <div className="col-span-3">Stromkreis</div>
                    <div className="col-span-2">{sec.type === 'insulation_resistance' ? 'Prufspannung' : sec.type === 'loop_impedance' ? 'Sicherung' : ''}</div>
                    <div className="col-span-2">Messwert ({sec.unit})</div>
                    <div className="col-span-2">Grenzwert</div>
                    <div className="col-span-2">Ergebnis</div>
                    <div className="col-span-1"></div>
                  </div>
                  {rows.map((row) => {
                    const gi = measurements.indexOf(row);
                    return (
                      <div key={gi} className="grid grid-cols-12 gap-2 items-center mb-2">
                        <div className="col-span-3">
                          <Input value={row.circuit_label ?? ''} placeholder="z.B. SK1" disabled={isLocked} className="h-8 text-sm"
                            onChange={e => updateMeasRow(gi, 'circuit_label', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          {sec.type === 'insulation_resistance' && (
                            <Select value={String(row.test_voltage ?? 500)} disabled={isLocked}
                              onValueChange={v => updateMeasRow(gi, 'test_voltage', Number(v))}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="250">250V</SelectItem>
                                <SelectItem value="500">500V</SelectItem>
                                <SelectItem value="1000">1000V</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {sec.type === 'loop_impedance' && (
                            <Input value={row.test_voltage?.toString() ?? 'B16'} placeholder="B16" disabled={isLocked} className="h-8 text-sm"
                              onChange={e => updateMeasRow(gi, 'test_voltage', e.target.value)} />
                          )}
                        </div>
                        <div className="col-span-2">
                          <Input type="number" step="0.01" value={row.measured_value ?? ''} disabled={isLocked} className="h-8 text-sm"
                            onChange={e => updateMeasRow(gi, 'measured_value', Number(e.target.value))} />
                        </div>
                        <div className="col-span-2 text-xs text-slate-500 px-2">
                          {row.limit_value !== undefined ? `${row.limit_value} ${sec.unit}` : '-'}
                        </div>
                        <div className="col-span-2"><PassBadge result={row.result} /></div>
                        <div className="col-span-1">
                          {!isLocked && <Button variant="ghost" size="sm" type="button" onClick={() => setMeasurements(p => p.filter((_, i) => i !== gi))}><Trash2 className="h-3 w-3 text-red-500" /></Button>}
                        </div>
                      </div>
                    );
                  })}
                  {rows.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Keine Messungen.</p>}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* VDE 0105 hint */}
      {pType === 'VDE_0105_100' && (
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-200 p-3 rounded-lg">
          VDE 0105-100: Vergleichswerte der letzten Prufung werden automatisch angezeigt, sobald ein vorheriges Protokoll existiert.
        </div>
      )}

      {/* Defects */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Maengel</CardTitle>
            {!isLocked && <Button variant="outline" size="sm" type="button"
              onClick={() => setDefects(p => [...p, { id: crypto.randomUUID(), protocol_id: protocol?.id ?? '', description: '', severity: 'minor' as const, location: '', resolved: false }])}>
              <Plus className="h-3 w-3 mr-1" />Mangel</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {defects.map((d, idx) => (
            <div key={d.id ?? idx} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5"><Input value={d.description} placeholder="Beschreibung" disabled={isLocked} className="text-sm"
                onChange={e => { const n = [...defects]; n[idx] = { ...n[idx], description: e.target.value }; setDefects(n); }} /></div>
              <div className="col-span-3"><Input value={d.location ?? ''} placeholder="Ort" disabled={isLocked} className="text-sm"
                onChange={e => { const n = [...defects]; n[idx] = { ...n[idx], location: e.target.value }; setDefects(n); }} /></div>
              <div className="col-span-3">
                <Select value={d.severity} disabled={isLocked}
                  onValueChange={v => { const n = [...defects]; n[idx] = { ...n[idx], severity: v as any }; setDefects(n); }}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="minor">Gering</SelectItem>
                    <SelectItem value="major">Erheblich</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">{!isLocked && <Button variant="ghost" size="sm" type="button"
                onClick={() => setDefects(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-red-500" /></Button>}</div>
            </div>
          ))}
          {defects.length === 0 && <p className="text-sm text-slate-400 text-center py-2">Keine Maengel.</p>}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {photos.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {!isLocked && <button type="button" className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                  onClick={() => setPhotos(p => p.filter((_, i) => i !== idx))}>x</button>}
              </div>
            ))}
            {!isLocked && (
              <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                <Camera className="h-5 w-5 text-slate-400" /><span className="text-xs text-slate-400 mt-1">Foto</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes + Actions */}
      <Card><CardContent className="pt-4"><Label>Bemerkungen</Label><Textarea {...form.register('notes')} rows={3} disabled={isLocked} /></CardContent></Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" type="button" onClick={onClose}>Abbrechen</Button>
        <div className="flex gap-2">
          {!isLocked && <Button type="submit" disabled={createProtocol.isPending || updateProtocol.isPending}>Speichern</Button>}
          {!isLocked && !isNew && (
            <Button type="button" variant="destructive" onClick={() => setShowFinalizeDialog(true)}>
              <Lock className="h-4 w-4 mr-1" />Prufung abschliessen</Button>
          )}
        </div>
      </div>

      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prufung abschliessen?</AlertDialogTitle>
            <AlertDialogDescription>Protokoll wird gesperrt. Gesamtergebnis wird automatisch berechnet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>Abschliessen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
```

---

## Task 8: InspectionProtocolPDF

**File:** `src/components/inspections/InspectionProtocolPDF.tsx`

- [ ] Install jsPDF if missing: `npm i jspdf`
- [ ] Header: company logo + name, protocol number, date
- [ ] Measurement results table with pass/fail marks
- [ ] Defects list with severity
- [ ] Overall result (BESTANDEN / NICHT BESTANDEN)
- [ ] Signature line
- [ ] Footer: "Erstellt mit HandwerkOS" + timestamp

```tsx
import jsPDF from 'jspdf';
import type { ProtocolWithRelations } from '@/types/inspection';

const SEV_DE: Record<string, string> = { info: 'Info', minor: 'Gering', major: 'Erheblich', critical: 'Kritisch' };
const TYPE_DE: Record<string, string> = {
  VDE_0100_600: 'VDE 0100-600 Erstprufung',
  VDE_0105_100: 'VDE 0105-100 Wiederkehrende Prufung',
  VDE_0701_0702: 'VDE 0701/0702 Geraetepruefung',
};
const RESULT_DE: Record<string, string> = { pass: 'BESTANDEN', fail: 'NICHT BESTANDEN', conditional: 'BEDINGT BESTANDEN' };
const MEAS_DE: Record<string, string> = {
  insulation_resistance: 'Isolationswiderstand', loop_impedance: 'Schleifenimpedanz',
  rcd_trip_time: 'RCD Ausloesezeit', rcd_trip_current: 'RCD Ausloesstrom',
  protective_conductor: 'Schutzleiterwiderstand', earth_resistance: 'Erdungswiderstand',
  leakage_current: 'Ableitstrom', touch_current: 'Beruehrungsstrom', voltage_drop: 'Spannungsfall',
};

interface PDFOptions { protocol: ProtocolWithRelations; companyName: string; companyLogo?: string; }

export async function generateInspectionPDF({ protocol, companyName, companyLogo }: PDFOptions): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const M = 15;
  let y = M;
  const ln = (yy: number) => { doc.setDrawColor(200); doc.line(M, yy, 195, yy); };
  const sec = (t: string) => { y += 4; doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(t, M, y); y += 2; ln(y); y += 5; };
  const rw = (l: string, v: string) => { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(l, M, y); doc.text(v, M + 55, y); y += 5; };
  const pg = () => { if (y > 270) { doc.addPage(); y = M; } };

  // Header
  if (companyLogo) { try { doc.addImage(companyLogo, 'PNG', M, y, 28, 10); } catch {} }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(companyName, companyLogo ? M + 32 : M, y + 5); y += 14;
  doc.setFontSize(16); doc.text('Pruefprotokoll', M, y); y += 7;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(TYPE_DE[protocol.protocol_type] ?? protocol.protocol_type, M, y); y += 8;
  rw('Protokoll-Nr.:', protocol.protocol_number ?? '-');
  rw('Prufdatum:', protocol.inspection_date);
  rw('Prufer:', protocol.inspector_name);

  // Device info (0701/0702)
  if (protocol.protocol_type === 'VDE_0701_0702' && protocol.device) {
    sec('Geraetedaten');
    rw('Geraet:', protocol.device.name);
    rw('Hersteller:', protocol.device.manufacturer ?? '-');
    rw('Seriennr.:', protocol.device.serial_number ?? '-');
  }

  // Visual checks
  if (protocol.visual_checks?.length) {
    sec('Sichtprufung');
    doc.setFontSize(8);
    for (const item of protocol.visual_checks) {
      doc.text(item.checked ? '[x]' : '[ ]', M, y);
      doc.text(item.label, M + 8, y);
      if (item.note) doc.text(item.note, M + 115, y);
      y += 4; pg();
    }
  }

  // Measurements grouped by type
  if (protocol.measurements?.length) {
    const byType = new Map<string, typeof protocol.measurements>();
    for (const m of protocol.measurements) {
      const arr = byType.get(m.measurement_type) ?? [];
      arr.push(m); byType.set(m.measurement_type, arr);
    }
    for (const [type, rows] of byType) {
      sec(MEAS_DE[type] ?? type);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('Stromkreis', M, y); doc.text('Messwert', M + 45, y);
      doc.text('Grenzwert', M + 80, y); doc.text('Ergebnis', M + 115, y);
      y += 1; ln(y); y += 4; doc.setFont('helvetica', 'normal');
      for (const m of rows) {
        doc.text(m.circuit_label ?? '-', M, y);
        doc.text(`${m.measured_value} ${m.unit}`, M + 45, y);
        doc.text(m.limit_value ? `${m.limit_value} ${m.unit}` : '-', M + 80, y);
        doc.text(m.result === 'pass' ? 'OK' : m.result === 'fail' ? 'FAIL' : '-', M + 115, y);
        y += 4; pg();
      }
    }
  }

  // Defects
  if (protocol.defects?.length) {
    sec('Festgestellte Maengel');
    doc.setFontSize(8);
    for (const d of protocol.defects) {
      doc.setFont('helvetica', 'bold'); doc.text(`[${SEV_DE[d.severity]}]`, M, y);
      doc.setFont('helvetica', 'normal'); doc.text(`${d.description}${d.location ? ` (${d.location})` : ''}`, M + 22, y);
      y += 5; pg();
    }
  }

  // Overall result
  y += 6; ln(y); y += 6;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(`Gesamtergebnis: ${RESULT_DE[protocol.overall_result ?? ''] ?? 'OFFEN'}`, M, y); y += 12;

  // Signature
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  ln(y); y += 4; doc.text('Ort, Datum', M, y); doc.text('Unterschrift Prufer', M + 80, y);

  // Footer all pages
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Erstellt mit HandwerkOS | ${new Date().toLocaleString('de-DE')}`, M, 290);
    doc.text(`Seite ${p} / ${pages}`, 170, 290); doc.setTextColor(0);
  }
  return doc;
}

// Download button component
import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function InspectionPDFDownloadButton({ protocol, companyName, companyLogo }: PDFOptions) {
  const handle = async () => {
    const doc = await generateInspectionPDF({ protocol, companyName, companyLogo });
    doc.save(`Pruefprotokoll_${protocol.protocol_number ?? protocol.id.slice(0, 8)}.pdf`);
  };
  return <Button variant="outline" size="sm" onClick={handle}><Download className="h-4 w-4 mr-1" />PDF</Button>;
}
```

---

## Task 9: DeviceInventory Component

**File:** `src/components/inspections/DeviceInventory.tsx`

- [ ] List/grid toggle view
- [ ] Filter by device_type, overdue status
- [ ] Add/edit device dialog
- [ ] "Neue Prufung starten" quick action per row
- [ ] Badge showing days until next inspection

```tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Edit, Trash2, ClipboardList, AlertTriangle, Zap, Monitor, Wrench, LayoutGrid, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInspectionDevices, useCreateDevice, useUpdateDevice, useDeleteDevice } from '@/hooks/useInspections';
import type { InspectionDevice, InspectionDeviceCreate } from '@/types/inspection';
import { differenceInDays, format } from 'date-fns';

const TYPE_ICONS: Record<string, React.ElementType> = { electrical_installation: Zap, portable_device: Monitor, machinery: Wrench };
const TYPE_LABELS: Record<string, string> = { electrical_installation: 'Elektr. Anlage', portable_device: 'Geraet', machinery: 'Maschine' };

function DueBadge({ date }: { date?: string | null }) {
  if (!date) return <Badge variant="secondary">Kein Termin</Badge>;
  const d = differenceInDays(new Date(date), new Date());
  if (d < 0) return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{Math.abs(d)}d ueberfaellig</Badge>;
  if (d <= 7) return <Badge className="bg-red-100 text-red-800">{d}d</Badge>;
  if (d <= 30) return <Badge className="bg-yellow-100 text-yellow-800">{d}d</Badge>;
  return <Badge className="bg-green-100 text-green-800">{d}d</Badge>;
}

interface Props { customerId?: string; onStartInspection: (d: InspectionDevice) => void; }

export default function DeviceInventory({ customerId, onStartInspection }: Props) {
  const { toast } = useToast();
  const { data: devices = [] } = useInspectionDevices(customerId);
  const createDev = useCreateDevice();
  const updateDev = useUpdateDevice();
  const deleteDev = useDeleteDevice();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editItem, setEditItem] = useState<InspectionDevice | null>(null);
  const [fd, setFd] = useState<Partial<InspectionDeviceCreate>>({});

  const filtered = useMemo(() => {
    let r = devices;
    if (search) { const s = search.toLowerCase(); r = r.filter(d => d.name.toLowerCase().includes(s) || d.serial_number?.toLowerCase().includes(s)); }
    if (typeFilter !== 'all') r = r.filter(d => d.device_type === typeFilter);
    if (statusFilter === 'overdue') r = r.filter(d => d.next_inspection_date && differenceInDays(new Date(d.next_inspection_date), new Date()) < 0);
    if (statusFilter === 'due_soon') r = r.filter(d => { if (!d.next_inspection_date) return false; const dd = differenceInDays(new Date(d.next_inspection_date), new Date()); return dd >= 0 && dd <= 30; });
    return r;
  }, [devices, search, typeFilter, statusFilter]);

  const handleSave = async () => {
    if (!fd.name) { toast({ title: 'Name erforderlich', variant: 'destructive' }); return; }
    if (editItem) await updateDev.mutateAsync({ id: editItem.id, data: fd });
    else await createDev.mutateAsync(fd as InspectionDeviceCreate);
    setDlgOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle</SelectItem><SelectItem value="electrical_installation">Anlagen</SelectItem><SelectItem value="portable_device">Geraete</SelectItem><SelectItem value="machinery">Maschinen</SelectItem></SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle</SelectItem><SelectItem value="overdue">Ueberfaellig</SelectItem><SelectItem value="due_soon">Bald faellig</SelectItem></SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-md p-0.5">
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
        </div>
        <Button onClick={() => { setEditItem(null); setFd({ device_type: 'portable_device', inspection_interval_months: 12 }); setDlgOpen(true); }}><Plus className="h-4 w-4 mr-1" />Geraet</Button>
      </div>

      {view === 'list' ? (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <th className="p-3">Geraet</th><th className="p-3">Typ</th><th className="p-3">Standort</th><th className="p-3">Naechste</th><th className="p-3"></th>
            </tr></thead>
            <tbody>{filtered.map(d => {
              const Icon = TYPE_ICONS[d.device_type] ?? Zap;
              return (<tr key={d.id} className="border-b hover:bg-slate-50">
                <td className="p-3 font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-slate-400" />{d.name}</td>
                <td className="p-3 text-slate-600">{TYPE_LABELS[d.device_type]}</td>
                <td className="p-3 text-slate-600">{d.location ?? '-'}</td>
                <td className="p-3"><DueBadge date={d.next_inspection_date} /></td>
                <td className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onStartInspection(d)}><ClipboardList className="h-4 w-4 mr-2" />Neue Prufung</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setEditItem(d); setFd(d); setDlgOpen(true); }}><Edit className="h-4 w-4 mr-2" />Bearbeiten</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={() => deleteDev.mutate(d.id)}><Trash2 className="h-4 w-4 mr-2" />Loeschen</DropdownMenuItem>
                  </DropdownMenuContent></DropdownMenu></td>
              </tr>);
            })}</tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Keine Geraete.</p>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(d => {
          const Icon = TYPE_ICONS[d.device_type] ?? Zap;
          return (<Card key={d.id} className="hover:shadow-md cursor-pointer" onClick={() => onStartInspection(d)}>
            <CardContent className="pt-4">
              <div className="flex justify-between"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-blue-500" /><span className="font-medium">{d.name}</span></div><DueBadge date={d.next_inspection_date} /></div>
              <div className="mt-2 text-xs text-slate-500">{TYPE_LABELS[d.device_type]}{d.location && ` | ${d.location}`}</div>
            </CardContent></Card>);
        })}</div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editItem ? 'Bearbeiten' : 'Neues Geraet'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div><Label>Name *</Label><Input value={fd.name ?? ''} onChange={e => setFd(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Typ</Label><Select value={fd.device_type ?? 'portable_device'} onValueChange={v => setFd(p => ({ ...p, device_type: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="electrical_installation">Anlage</SelectItem><SelectItem value="portable_device">Geraet</SelectItem><SelectItem value="machinery">Maschine</SelectItem>
            </SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Hersteller</Label><Input value={fd.manufacturer ?? ''} onChange={e => setFd(p => ({ ...p, manufacturer: e.target.value }))} /></div>
            <div><Label>Seriennr.</Label><Input value={fd.serial_number ?? ''} onChange={e => setFd(p => ({ ...p, serial_number: e.target.value }))} /></div>
          </div>
          <div><Label>Standort</Label><Input value={fd.location ?? ''} onChange={e => setFd(p => ({ ...p, location: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Intervall (Monate)</Label><Input type="number" value={fd.inspection_interval_months ?? 12} onChange={e => setFd(p => ({ ...p, inspection_interval_months: Number(e.target.value) }))} /></div>
            <div><Label>Naechste Prufung</Label><Input type="date" value={fd.next_inspection_date ?? ''} onChange={e => setFd(p => ({ ...p, next_inspection_date: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDlgOpen(false)}>Abbrechen</Button><Button onClick={handleSave}>{editItem ? 'Speichern' : 'Anlegen'}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
```

---

## Task 10: DGUVScheduleDashboard

**File:** `src/components/inspections/DGUVScheduleDashboard.tsx`

- [ ] 4 stats cards (total, overdue, due this month, ok)
- [ ] Monthly timeline with color coding
- [ ] Filter by customer, device type

```tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, Calendar, Search } from "lucide-react";
import { useInspectionDevices } from '@/hooks/useInspections';
import type { InspectionDevice } from '@/types/inspection';
import { differenceInDays, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  customers: { id: string; name: string }[];
  onDeviceClick: (d: InspectionDevice) => void;
}

export default function DGUVScheduleDashboard({ customers, onDeviceClick }: Props) {
  const { data: allDevices = [] } = useInspectionDevices();
  const [custFilter, setCustFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let r = allDevices;
    if (custFilter !== 'all') r = r.filter(d => d.customer_id === custFilter);
    if (typeFilter !== 'all') r = r.filter(d => d.device_type === typeFilter);
    if (search) { const s = search.toLowerCase(); r = r.filter(d => d.name.toLowerCase().includes(s)); }
    return r;
  }, [allDevices, custFilter, typeFilter, search]);

  const stats = useMemo(() => {
    let overdue = 0, soon = 0, ok = 0;
    for (const d of filtered) {
      if (!d.next_inspection_date) continue;
      const days = differenceInDays(new Date(d.next_inspection_date), new Date());
      if (days < 0) overdue++; else if (days <= 30) soon++; else ok++;
    }
    return { total: filtered.length, overdue, soon, ok };
  }, [filtered]);

  const timeline = useMemo(() => {
    const groups: Record<string, InspectionDevice[]> = {};
    const overdue: InspectionDevice[] = [];
    for (const d of filtered) {
      if (!d.next_inspection_date) continue;
      if (differenceInDays(new Date(d.next_inspection_date), new Date()) < 0) { overdue.push(d); continue; }
      const key = format(new Date(d.next_inspection_date), 'yyyy-MM');
      (groups[key] ??= []).push(d);
    }
    return { overdue, months: Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)) };
  }, [filtered]);

  const cc = (date?: string | null) => {
    if (!date) return 'bg-slate-50';
    const d = differenceInDays(new Date(date), new Date());
    if (d < 0) return 'bg-red-50 border-red-200 text-red-800';
    if (d <= 30) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    return 'bg-green-50 border-green-200 text-green-800';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-slate-500">Gesamt</div></CardContent></Card>
        <Card className="border-red-200"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{stats.overdue}</div><div className="text-xs text-red-500 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Ueberfaellig</div></CardContent></Card>
        <Card className="border-yellow-200"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-yellow-600">{stats.soon}</div><div className="text-xs text-yellow-600 flex items-center justify-center gap-1"><Clock className="h-3 w-3" />Diesen Monat</div></CardContent></Card>
        <Card className="border-green-200"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.ok}</div><div className="text-xs text-green-600 flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" />OK</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={custFilter} onValueChange={setCustFilter}><SelectTrigger className="w-[200px]"><SelectValue placeholder="Kunde" /></SelectTrigger><SelectContent><SelectItem value="all">Alle Kunden</SelectItem>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Typ" /></SelectTrigger><SelectContent><SelectItem value="all">Alle</SelectItem><SelectItem value="electrical_installation">Anlagen</SelectItem><SelectItem value="portable_device">Geraete</SelectItem><SelectItem value="machinery">Maschinen</SelectItem></SelectContent></Select>
      </div>

      {timeline.overdue.length > 0 && (
        <Card className="border-red-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Ueberfaellig ({timeline.overdue.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">{timeline.overdue.map(d => (
            <div key={d.id} onClick={() => onDeviceClick(d)} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100">
              <span className="font-medium text-sm">{d.name}</span>
              <Badge variant="destructive">{Math.abs(differenceInDays(new Date(d.next_inspection_date!), new Date()))}d</Badge>
            </div>
          ))}</CardContent></Card>
      )}

      {timeline.months.map(([month, devs]) => (
        <Card key={month}><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />{format(new Date(month + '-01'), 'MMMM yyyy', { locale: de })}<Badge variant="secondary">{devs.length}</Badge>
        </CardTitle></CardHeader>
          <CardContent className="space-y-2">{devs.sort((a, b) => a.next_inspection_date!.localeCompare(b.next_inspection_date!)).map(d => (
            <div key={d.id} onClick={() => onDeviceClick(d)} className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:shadow-sm ${cc(d.next_inspection_date)}`}>
              <div><span className="font-medium text-sm">{d.name}</span><span className="text-xs text-slate-500 ml-2">{d.location}</span></div>
              <span className="text-xs font-medium">{format(new Date(d.next_inspection_date!), 'dd.MM.yyyy')}</span>
            </div>
          ))}</CardContent></Card>
      ))}

      {filtered.length === 0 && <Card><CardContent className="py-12 text-center text-slate-400">Keine Geraete.</CardContent></Card>}
    </div>
  );
}
```

---

## Task 11: InspectionModule Container

**File:** `src/components/inspections/InspectionModule.tsx`

- [ ] Tab layout: Prufprotokolle | Geraete & Anlagen | DGUV V3 Fristen
- [ ] Wires InspectionForm, DeviceInventory, DGUVScheduleDashboard
- [ ] Protocol list table with PDF download

```tsx
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Zap, Calendar, Plus } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useInspectionProtocols, useInspectionProtocol } from '@/hooks/useInspections';
import InspectionForm from './InspectionForm';
import DeviceInventory from './DeviceInventory';
import DGUVScheduleDashboard from './DGUVScheduleDashboard';
import { InspectionPDFDownloadButton } from './InspectionProtocolPDF';
import type { InspectionDevice, ProtocolType } from '@/types/inspection';
import { format } from 'date-fns';

const PT_LABELS: Record<string, string> = { VDE_0100_600: '0100-600', VDE_0105_100: '0105-100', VDE_0701_0702: '0701/0702' };

function useCustomerList() {
  return useQuery({
    queryKey: ['customers-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, company_name').order('company_name');
      return (data ?? []).map(c => ({ id: c.id, name: c.company_name }));
    },
  });
}

export default function InspectionModule() {
  const { data: protocols = [] } = useInspectionProtocols();
  const { data: customers = [] } = useCustomerList();

  const [tab, setTab] = useState('protocols');
  const [formOpen, setFormOpen] = useState(false);
  const [selProtocolId, setSelProtocolId] = useState<string | undefined>();
  const [selDevice, setSelDevice] = useState<InspectionDevice | undefined>();
  const [defType, setDefType] = useState<ProtocolType | undefined>();

  const { data: selProtocol } = useInspectionProtocol(selProtocolId ?? '');

  const openNew = (dev?: InspectionDevice) => {
    setSelProtocolId(undefined); setSelDevice(dev);
    setDefType(dev?.device_type === 'portable_device' ? 'VDE_0701_0702' : 'VDE_0100_600');
    setFormOpen(true);
  };

  const ResultBadge = ({ r }: { r?: string | null }) => {
    if (r === 'pass') return <Badge className="bg-green-100 text-green-800">BESTANDEN</Badge>;
    if (r === 'fail') return <Badge variant="destructive">NICHT BEST.</Badge>;
    if (r === 'conditional') return <Badge className="bg-yellow-100 text-yellow-800">BEDINGT</Badge>;
    return <Badge variant="secondary">Entwurf</Badge>;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-800">Prufprotokolle</h1>
          <p className="text-sm text-slate-500">VDE-Prufungen, Geraete & DGUV V3</p></div>
        <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" />Neue Prufung</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="protocols" className="gap-1"><ClipboardList className="h-4 w-4" />Prufprotokolle<Badge variant="secondary" className="ml-1 text-xs">{protocols.length}</Badge></TabsTrigger>
          <TabsTrigger value="devices" className="gap-1"><Zap className="h-4 w-4" />Geraete & Anlagen</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1"><Calendar className="h-4 w-4" />DGUV V3 Fristen</TabsTrigger>
        </TabsList>

        <TabsContent value="protocols">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                <th className="p-3">Nr.</th><th className="p-3">Typ</th><th className="p-3">Datum</th><th className="p-3">Prufer</th><th className="p-3">Ergebnis</th><th className="p-3">Status</th><th className="p-3"></th>
              </tr></thead>
              <tbody>{protocols.map(p => (
                <tr key={p.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => { setSelProtocolId(p.id); setFormOpen(true); }}>
                  <td className="p-3 font-mono text-xs">{p.protocol_number ?? p.id.slice(0, 8)}</td>
                  <td className="p-3"><Badge variant="outline">{PT_LABELS[p.protocol_type]}</Badge></td>
                  <td className="p-3">{format(new Date(p.inspection_date), 'dd.MM.yyyy')}</td>
                  <td className="p-3">{p.inspector_name}</td>
                  <td className="p-3"><ResultBadge r={p.overall_result} /></td>
                  <td className="p-3"><Badge variant={p.is_finalized ? 'default' : 'secondary'}>{p.is_finalized ? 'Final' : 'Entwurf'}</Badge></td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    {p.is_finalized && <InspectionPDFDownloadButton protocol={p as any} companyName="Elektrobetrieb MG" />}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {protocols.length === 0 && <div className="py-12 text-center text-slate-400"><ClipboardList className="h-8 w-8 mx-auto mb-2 text-slate-300" /><p>Noch keine Protokolle.</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="devices"><DeviceInventory onStartInspection={openNew} /></TabsContent>
        <TabsContent value="schedule"><DGUVScheduleDashboard customers={customers} onDeviceClick={openNew} /></TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selProtocolId ? `Protokoll ${selProtocol?.protocol_number ?? ''}` : 'Neue Prufung'}</DialogTitle></DialogHeader>
          <InspectionForm protocol={selProtocol ?? undefined} deviceId={selDevice?.id} customerId={selDevice?.customer_id ?? undefined} defaultType={defType} onClose={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## Task 12: Integration & Testing

### 12a: Sidebar nav item

**File:** `src/components/AppSidebarV2.tsx`

- [ ] Add to `secondaryNavigation` array (after `delivery-notes` entry):

```ts
{ id: 'inspections', name: 'Prufprotokolle', icon: ClipboardList },
```

(`ClipboardList` is already imported.)

### 12b: Module switch

**File:** `src/pages/IndexV2.tsx`

- [ ] Add import:
```ts
import InspectionModule from "@/components/inspections/InspectionModule";
```

- [ ] Add case in `renderModule()`:
```ts
case 'inspections':
    return <InspectionModule />;
```

### 12c: Barrel export

**File:** `src/components/inspections/index.ts` (create)

```ts
export { default as InspectionModule } from './InspectionModule';
export { default as InspectionForm } from './InspectionForm';
export { default as DeviceInventory } from './DeviceInventory';
export { default as DGUVScheduleDashboard } from './DGUVScheduleDashboard';
export { generateInspectionPDF, InspectionPDFDownloadButton } from './InspectionProtocolPDF';
```

### 12d: ProjectDetailView link

**File:** `src/components/ProjectDetailView.tsx`

- [ ] Add button in overview tab:
```tsx
<Button variant="outline" size="sm"
  onClick={() => { onClose(); window.location.hash = 'inspections'; }}>
  <ClipboardList className="h-4 w-4 mr-1" /> Prufprotokolle
</Button>
```

### 12e: Manual E2E Test Checklist

```
[ ] Navigate to Prufprotokolle via sidebar
[ ] Create VDE 0100-600 inspection
    [ ] Fill header fields (type, date, inspector)
    [ ] Toggle Sichtpruefung checkboxes
    [ ] Add ISO measurement row -> auto pass/fail badge appears
    [ ] Add Schleife + RCD rows
    [ ] Save as draft
[ ] Create VDE 0701/0702 inspection
    [ ] Fill device data + Schutzklasse
    [ ] Enter PE, ISO, Ableitstrom values
    [ ] Verify badges auto-calculate
[ ] Finalize inspection -> confirm -> editing locked
[ ] Download PDF -> header, measurements, defects, result, footer OK
[ ] Geraete tab: add device, edit, filter by type, "Neue Prufung" action
[ ] DGUV tab: stats cards, color-coded timeline, customer filter
[ ] Upload photo in form
[ ] Responsive check (< 768px)
```

---

## Files Summary

| Task | File | Action |
|------|------|--------|
| 7 | `src/components/inspections/InspectionForm.tsx` | Create |
| 8 | `src/components/inspections/InspectionProtocolPDF.tsx` | Create |
| 9 | `src/components/inspections/DeviceInventory.tsx` | Create |
| 10 | `src/components/inspections/DGUVScheduleDashboard.tsx` | Create |
| 11 | `src/components/inspections/InspectionModule.tsx` | Create |
| 12a | `src/components/AppSidebarV2.tsx` | Modify |
| 12b | `src/pages/IndexV2.tsx` | Modify |
| 12c | `src/components/inspections/index.ts` | Create |
| 12d | `src/components/ProjectDetailView.tsx` | Modify |

**Deps:** `jspdf` (install if missing), `date-fns` (present)
