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
  measurements: z.array(InspectionMeasurementSchema).optional(),
  defects: z.array(InspectionDefectSchema).optional(),
  photos: z.array(InspectionPhotoSchema).optional(),
  device: InspectionDeviceSchema.optional(),
});

// TS TYPES
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

export type InspectionFilter = {
  protocol_type?: ProtocolType;
  overall_result?: OverallResult;
  customer_id?: string;
  device_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
};

// CONSTANTS (German labels for UI)
export const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  vde_0100_600: 'VDE 0100-600 (Erstpruefung)',
  vde_0105_100: 'VDE 0105-100 (Wiederk. Pruefung)',
  vde_0701_0702: 'VDE 0701/0702 (Geraete)',
};
export const RESULT_LABELS: Record<OverallResult, string> = {
  pass: 'Bestanden',
  fail: 'Nicht bestanden',
  conditional: 'Bedingt bestanden',
};
export const RESULT_COLORS: Record<OverallResult, string> = {
  pass: 'green',
  fail: 'red',
  conditional: 'orange',
};
export const SEVERITY_LABELS: Record<DefectSeverity, string> = {
  minor: 'Gering',
  major: 'Erheblich',
  critical: 'Kritisch / Gefahr',
};
export const MEASUREMENT_TYPE_LABELS: Record<MeasurementType, string> = {
  insulation_resistance: 'Isolationswiderstand',
  loop_impedance: 'Schleifenimpedanz',
  rcd_trip_time: 'RCD Ausloeszeit',
  rcd_trip_current: 'RCD Ausloesstrom',
  protective_conductor: 'Schutzleiterwiderstand',
  earth_resistance: 'Erdungswiderstand',
  voltage_drop: 'Spannungsfall',
  leakage_current: 'Ableitstrom',
  touch_current: 'Beruehrungsstrom',
};
