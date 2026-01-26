// Delivery Note (Lieferschein) DTOs and Zod schemas for HandwerkOS
// Employee work documentation with approval workflow

import { z } from 'zod';

// ============================================================================
// STATUS ENUM
// ============================================================================

export const DeliveryNoteStatusEnum = z.enum([
  'draft',      // Mitarbeiter erstellt/bearbeitet
  'submitted',  // Eingereicht zur Prüfung
  'approved',   // Vom Projektleiter freigegeben
  'rejected',   // Zurückgewiesen (mit Grund)
  'invoiced'    // In Rechnung übernommen
]);

export type DeliveryNoteStatus = z.infer<typeof DeliveryNoteStatusEnum>;

export const DeliveryNoteItemTypeEnum = z.enum([
  'material',
  'photo'
]);

export type DeliveryNoteItemType = z.infer<typeof DeliveryNoteItemTypeEnum>;

// ============================================================================
// DELIVERY NOTE ITEM SCHEMAS
// ============================================================================

export const DeliveryNoteItemCreateSchema = z.object({
  item_type: DeliveryNoteItemTypeEnum,
  // Material fields
  material_name: z.string().min(1).optional(),
  material_quantity: z.number().min(0.01).optional(),
  material_unit: z.string().default('Stk'),
  material_id: z.string().uuid().optional(),
  // Photo fields
  photo_url: z.string().url().optional(),
  photo_caption: z.string().optional(),
  // Billing
  is_additional_work: z.boolean().default(false),
  unit_price: z.number().min(0).optional(),
}).refine(
  (data) => {
    if (data.item_type === 'material') {
      return data.material_name && data.material_name.length > 0 &&
             data.material_quantity && data.material_quantity > 0;
    }
    if (data.item_type === 'photo') {
      return data.photo_url && data.photo_url.length > 0;
    }
    return true;
  },
  { message: 'Material benötigt Name und Menge, Foto benötigt URL' }
);

export const DeliveryNoteItemSchema = z.object({
  id: z.string().uuid(),
  delivery_note_id: z.string().uuid(),
  item_type: DeliveryNoteItemTypeEnum,
  material_name: z.string().nullable(),
  material_quantity: z.number().nullable(),
  material_unit: z.string().nullable(),
  material_id: z.string().uuid().nullable(),
  photo_url: z.string().nullable(),
  photo_caption: z.string().nullable(),
  is_additional_work: z.boolean(),
  unit_price: z.number().nullable(),
  created_at: z.string().datetime(),
});

// ============================================================================
// DELIVERY NOTE SCHEMAS
// ============================================================================

export const DeliveryNoteCreateSchema = z.object({
  project_id: z.string().uuid('Projekt ist erforderlich'),
  work_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM').optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM').optional(),
  break_minutes: z.number().int().min(0).max(480).default(0),
  description: z.string().min(20, 'Beschreibung muss mindestens 20 Zeichen enthalten'),
  // Optional signature
  signature_data: z.string().optional(),
  signature_name: z.string().optional(),
});

export const DeliveryNoteUpdateSchema = DeliveryNoteCreateSchema.partial().extend({
  status: DeliveryNoteStatusEnum.optional(),
  rejection_reason: z.string().optional(),
});

export const DeliveryNoteSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  delivery_note_number: z.string(),
  project_id: z.string().uuid(),
  created_by_employee_id: z.string().uuid(),
  work_date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  break_minutes: z.number().nullable(),
  work_hours: z.number().nullable(), // Generated column
  description: z.string(),
  status: DeliveryNoteStatusEnum,
  submitted_at: z.string().datetime().nullable(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  rejection_reason: z.string().nullable(),
  signature_data: z.string().nullable(),
  signature_name: z.string().nullable(),
  signed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// EXTENDED TYPES
// ============================================================================

export const DeliveryNoteWithItemsSchema = DeliveryNoteSchema.extend({
  items: z.array(DeliveryNoteItemSchema),
});

export const DeliveryNoteWithRelationsSchema = DeliveryNoteSchema.extend({
  items: z.array(DeliveryNoteItemSchema).optional(),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    customer_id: z.string().uuid().nullable(),
  }).optional(),
  created_by_employee: z.object({
    id: z.string().uuid(),
    first_name: z.string(),
    last_name: z.string(),
  }).optional(),
  approved_by_employee: z.object({
    id: z.string().uuid(),
    first_name: z.string(),
    last_name: z.string(),
  }).optional().nullable(),
});

// ============================================================================
// APPROVAL SCHEMAS
// ============================================================================

export const DeliveryNoteSubmitSchema = z.object({
  id: z.string().uuid(),
});

export const DeliveryNoteApproveSchema = z.object({
  id: z.string().uuid(),
});

export const DeliveryNoteRejectSchema = z.object({
  id: z.string().uuid(),
  rejection_reason: z.string().min(10, 'Ablehnungsgrund muss mindestens 10 Zeichen enthalten'),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type DeliveryNote = z.infer<typeof DeliveryNoteSchema>;
export type DeliveryNoteCreate = z.infer<typeof DeliveryNoteCreateSchema>;
export type DeliveryNoteUpdate = z.infer<typeof DeliveryNoteUpdateSchema>;
export type DeliveryNoteWithItems = z.infer<typeof DeliveryNoteWithItemsSchema>;
export type DeliveryNoteWithRelations = z.infer<typeof DeliveryNoteWithRelationsSchema>;

export type DeliveryNoteItem = z.infer<typeof DeliveryNoteItemSchema>;
export type DeliveryNoteItemCreate = z.infer<typeof DeliveryNoteItemCreateSchema>;

export type DeliveryNoteFilter = {
  project_id?: string;
  status?: DeliveryNoteStatus | DeliveryNoteStatus[];
  created_by_employee_id?: string;
  work_date_from?: string;
  work_date_to?: string;
  search?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const DELIVERY_NOTE_STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
  draft: 'Entwurf',
  submitted: 'Eingereicht',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  invoiced: 'Abgerechnet',
};

export const DELIVERY_NOTE_STATUS_COLORS: Record<DeliveryNoteStatus, string> = {
  draft: 'gray',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
  invoiced: 'purple',
};

export const DELIVERY_NOTE_ITEM_TYPE_LABELS: Record<DeliveryNoteItemType, string> = {
  material: 'Material',
  photo: 'Foto',
};

// ============================================================================
// STATUS TRANSITIONS (for UI validation)
// ============================================================================

export const DELIVERY_NOTE_STATUS_TRANSITIONS: Record<DeliveryNoteStatus, DeliveryNoteStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['invoiced'],
  rejected: ['draft'],
  invoiced: [],
};

export function canTransitionDeliveryNoteStatus(
  currentStatus: DeliveryNoteStatus,
  newStatus: DeliveryNoteStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return DELIVERY_NOTE_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
