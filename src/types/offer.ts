// Offer (Angebot) DTOs and Zod schemas for HandwerkOS
// Provides type-safe validation for offer-related API requests and responses

import { z } from 'zod';

// ============================================================================
// STATUS ENUM
// ============================================================================

export const OfferStatusEnum = z.enum([
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'cancelled'
]);

export type OfferStatus = z.infer<typeof OfferStatusEnum>;

export const OfferItemTypeEnum = z.enum([
  'labor',
  'material',
  'lump_sum',
  'text',
  'title',
  'other',
  'page_break'
]);

export type OfferItemType = z.infer<typeof OfferItemTypeEnum>;

export const OfferComplexityEnum = z.enum([
  'simple',
  'medium',
  'complex'
]);

export type OfferComplexity = z.infer<typeof OfferComplexityEnum>;

// ============================================================================
// OFFER ITEM SCHEMAS
// ============================================================================

export const OfferItemCreateSchema = z.object({
  position_number: z.number().int().min(1, 'Positionsnummer muss mindestens 1 sein'),
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  quantity: z.number().min(0.001, 'Menge muss größer als 0 sein').default(1),
  unit: z.string().default('Stk'),
  unit_price_net: z.number().min(0, 'Preis muss positiv sein').default(0),
  vat_rate: z.number().min(0).max(100).default(19),
  item_type: OfferItemTypeEnum.default('labor'),
  is_optional: z.boolean().default(false),
  planned_hours_item: z.number().min(0).optional(),
  material_purchase_cost: z.number().min(0).optional(),
  internal_notes: z.string().optional(),
});

export const OfferItemUpdateSchema = OfferItemCreateSchema.partial();

export const OfferItemSchema = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  position_number: z.number().int(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price_net: z.number(),
  vat_rate: z.number(),
  item_type: OfferItemTypeEnum,
  is_optional: z.boolean(),
  planned_hours_item: z.number().nullable(),
  material_purchase_cost: z.number().nullable(),
  internal_notes: z.string().nullable(),
  created_at: z.string().datetime(),
  total_net: z.number().optional(),
});

// ============================================================================
// OFFER TARGET SCHEMAS
// ============================================================================

export const OfferTargetCreateSchema = z.object({
  planned_hours_total: z.number().min(0.5, 'Mindestens 0,5 geplante Stunden erforderlich').optional(),
  internal_hourly_rate: z.number().min(0, 'Stundensatz muss positiv sein').optional(),
  billable_hourly_rate: z.number().min(0).optional(),
  planned_material_cost_total: z.number().min(0).optional(),
  planned_other_cost: z.number().min(0).default(0),
  target_start_date: z.string().optional(),
  target_end_date: z.string().optional(),
  project_manager_id: z.string().uuid().optional(),
  complexity: OfferComplexityEnum.default('medium'),
});

export const OfferTargetUpdateSchema = OfferTargetCreateSchema.partial();

export const OfferTargetSchema = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  planned_hours_total: z.number().nullable(),
  internal_hourly_rate: z.number().nullable(),
  billable_hourly_rate: z.number().nullable(),
  planned_material_cost_total: z.number().nullable(),
  planned_other_cost: z.number().nullable(),
  target_start_date: z.string().nullable(),
  target_end_date: z.string().nullable(),
  project_manager_id: z.string().uuid().nullable(),
  complexity: OfferComplexityEnum,
  snapshot_target_revenue: z.number().nullable(),
  snapshot_target_cost: z.number().nullable(),
  snapshot_target_margin: z.number().nullable(),
  snapshot_created_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// OFFER SCHEMAS
// ============================================================================

export const OfferCreateSchema = z.object({
  customer_id: z.string().uuid('Kunde ist erforderlich'),
  customer_name: z.string().min(1, 'Kundenname ist erforderlich'),
  customer_address: z.string().optional(),
  contact_person: z.string().optional(),
  customer_reference: z.string().optional(),
  project_name: z.string().min(1, 'Projektname ist erforderlich'),
  project_location: z.string().optional(),
  valid_until: z.string().optional(),
  execution_period_text: z.string().optional(),
  execution_notes: z.string().optional(),
  payment_terms: z.string().default('14 Tage netto'),
  skonto_percent: z.number().min(0).max(100).optional(),
  skonto_days: z.number().int().min(0).optional(),
  terms_text: z.string().optional(),
  warranty_text: z.string().optional(),
  notes: z.string().optional(),
  created_by: z.string().uuid().optional(),
});

export const OfferUpdateSchema = OfferCreateSchema.partial();

export const OfferSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  offer_number: z.string(),
  offer_date: z.string(),
  valid_until: z.string().nullable(),
  customer_id: z.string().uuid(),
  customer_name: z.string(),
  customer_address: z.string().nullable(),
  contact_person: z.string().nullable(),
  customer_reference: z.string().nullable(),
  project_name: z.string(),
  project_location: z.string().nullable(),
  execution_period_text: z.string().nullable(),
  execution_notes: z.string().nullable(),
  payment_terms: z.string().nullable(),
  skonto_percent: z.number().nullable(),
  skonto_days: z.number().nullable(),
  terms_text: z.string().nullable(),
  warranty_text: z.string().nullable(),
  notes: z.string().nullable(),
  snapshot_subtotal_net: z.number().nullable(),
  snapshot_discount_percent: z.number().nullable(),
  snapshot_discount_amount: z.number().nullable(),
  snapshot_net_total: z.number().nullable(),
  snapshot_vat_rate: z.number().nullable(),
  snapshot_vat_amount: z.number().nullable(),
  snapshot_gross_total: z.number().nullable(),
  snapshot_created_at: z.string().datetime().nullable(),
  status: OfferStatusEnum,
  is_locked: z.boolean(),
  accepted_at: z.string().datetime().nullable(),
  accepted_by: z.string().nullable(),
  acceptance_note: z.string().nullable(),
  version: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().uuid().nullable(),
});

// ============================================================================
// EXTENDED TYPES
// ============================================================================

export const OfferWithTotalsSchema = OfferSchema.extend({
  subtotal_net: z.number(),
  discount_percent: z.number(),
  discount_amount: z.number(),
  net_total: z.number(),
  vat_rate: z.number(),
  vat_amount: z.number(),
  gross_total: z.number(),
});

export const OfferWithRelationsSchema = OfferSchema.extend({
  targets: OfferTargetSchema.optional(),
  items: z.array(OfferItemSchema).optional(),
  customer: z.object({
    id: z.string().uuid(),
    company_name: z.string(),
    contact_person: z.string().nullable(),
    email: z.string().nullable(),
  }).optional(),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type Offer = z.infer<typeof OfferSchema>;
export type OfferCreate = z.infer<typeof OfferCreateSchema>;
export type OfferUpdate = z.infer<typeof OfferUpdateSchema>;
export type OfferWithTotals = z.infer<typeof OfferWithTotalsSchema>;
export type OfferWithRelations = z.infer<typeof OfferWithRelationsSchema>;

export type OfferItem = z.infer<typeof OfferItemSchema>;
export type OfferItemCreate = z.infer<typeof OfferItemCreateSchema>;
export type OfferItemUpdate = z.infer<typeof OfferItemUpdateSchema>;

export type OfferTarget = z.infer<typeof OfferTargetSchema>;
export type OfferTargetCreate = z.infer<typeof OfferTargetCreateSchema>;
export type OfferTargetUpdate = z.infer<typeof OfferTargetUpdateSchema>;

export type OfferFilter = {
  status?: OfferStatus;
  customer_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Entwurf',
  sent: 'Versendet',
  accepted: 'Angenommen',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
  cancelled: 'Storniert',
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  expired: 'orange',
  cancelled: 'slate',
};

export const OFFER_ITEM_TYPE_LABELS: Record<OfferItemType, string> = {
  labor: 'Arbeitsleistung',
  material: 'Material',
  lump_sum: 'Pauschale',
  text: 'Text',
  title: 'Titel',
  other: 'Sonstiges',
  page_break: 'Seitenumbruch',
};

export const OFFER_ITEM_UNITS = [
  { value: 'Stk', label: 'Stück' },
  { value: 'Std', label: 'Stunde' },
  { value: 'm', label: 'Meter' },
  { value: 'm²', label: 'Quadratmeter' },
  { value: 'm³', label: 'Kubikmeter' },
  { value: 'kg', label: 'Kilogramm' },
  { value: 'l', label: 'Liter' },
  { value: 'psch', label: 'Pauschal' },
] as const;
