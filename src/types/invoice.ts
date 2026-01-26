// Invoice (Rechnung) DTOs and Zod schemas for HandwerkOS
// Extended types with invoice items and source tracking

import { z } from 'zod';

// ============================================================================
// STATUS ENUMS
// ============================================================================

export const InvoiceStatusEnum = z.enum([
  'draft',      // In Erstellung
  'sent',       // Versendet
  'paid',       // Bezahlt
  'overdue',    // Überfällig
  'void',       // Storniert (Stornorechnung)
  'cancelled'   // Abgebrochen (nie versendet)
]);

export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;

export const InvoiceTypeEnum = z.enum([
  'final',    // Schlussrechnung
  'partial',  // Teilrechnung
  'advance',  // Abschlagsrechnung
  'credit'    // Gutschrift/Stornorechnung
]);

export type InvoiceType = z.infer<typeof InvoiceTypeEnum>;

export const InvoiceItemSourceTypeEnum = z.enum([
  'offer_item',        // Aus Angebot übernommen
  'delivery_note',     // Aus Lieferschein (Zusatzarbeit)
  'manual',            // Manuell hinzugefügt (Nachtrag)
  'advance_deduction'  // Abzug bereits gezahlter Abschlag
]);

export type InvoiceItemSourceType = z.infer<typeof InvoiceItemSourceTypeEnum>;

// ============================================================================
// INVOICE ITEM SCHEMAS
// ============================================================================

export const InvoiceItemCreateSchema = z.object({
  position_number: z.number().int().min(1).optional(), // Auto-assigned if not provided
  source_type: InvoiceItemSourceTypeEnum,
  source_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  quantity: z.number().refine(val => val !== 0, 'Menge darf nicht 0 sein').default(1),
  unit: z.string().default('Stk'),
  unit_price: z.number(),
  vat_rate: z.number().min(0).max(100).default(19),
});

export const InvoiceItemUpdateSchema = InvoiceItemCreateSchema.partial();

export const InvoiceItemSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  position_number: z.number().int(),
  source_type: InvoiceItemSourceTypeEnum,
  source_id: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  vat_rate: z.number(),
  // Generated columns
  total_net: z.number(),
  total_vat: z.number(),
  total_gross: z.number(),
  created_at: z.string().datetime(),
});

// ============================================================================
// INVOICE SCHEMAS (Extended)
// ============================================================================

export const InvoiceCreateSchema = z.object({
  project_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  customer_id: z.string().uuid('Kunde ist erforderlich'),
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  invoice_type: InvoiceTypeEnum.default('final'),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  payment_terms: z.string().default('14 Tage netto'),
  due_date: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(19),
});

export const InvoiceUpdateSchema = InvoiceCreateSchema.partial().extend({
  status: InvoiceStatusEnum.optional(),
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  customer_id: z.string().uuid(),
  invoice_number: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  invoice_type: InvoiceTypeEnum.nullable(),
  status: InvoiceStatusEnum,
  // Amounts
  amount: z.number().nullable(),      // Brutto
  net_amount: z.number().nullable(),  // Netto
  tax_amount: z.number().nullable(),  // MwSt
  tax_rate: z.number().nullable(),
  // Dates
  service_period_start: z.string().nullable(),
  service_period_end: z.string().nullable(),
  payment_terms: z.string().nullable(),
  due_date: z.string().nullable(),
  sent_at: z.string().datetime().nullable(),
  paid_at: z.string().datetime().nullable(),
  // Lock
  is_locked: z.boolean().nullable(),
  // Audit
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// EXTENDED TYPES
// ============================================================================

export const InvoiceWithItemsSchema = InvoiceSchema.extend({
  items: z.array(InvoiceItemSchema),
});

export const InvoiceWithRelationsSchema = InvoiceSchema.extend({
  items: z.array(InvoiceItemSchema).optional(),
  customer: z.object({
    id: z.string().uuid(),
    company_name: z.string(),
    contact_person: z.string().nullable(),
    address: z.string().nullable(),
    postal_code: z.string().nullable(),
    city: z.string().nullable(),
  }).optional(),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).optional().nullable(),
});

// ============================================================================
// RPC SCHEMAS
// ============================================================================

export const BuildInvoiceFromProjectSchema = z.object({
  project_id: z.string().uuid('Projekt ist erforderlich'),
  invoice_type: InvoiceTypeEnum.default('final'),
  include_offer_items: z.boolean().default(true),
  include_delivery_note_extras: z.boolean().default(true),
  deduct_advance_invoices: z.boolean().default(true),
});

export const AddInvoiceManualItemSchema = z.object({
  invoice_id: z.string().uuid('Rechnung ist erforderlich'),
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  quantity: z.number().default(1),
  unit: z.string().default('Stk'),
  unit_price: z.number().default(0),
  vat_rate: z.number().min(0).max(100).default(19),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;
export type InvoiceWithItems = z.infer<typeof InvoiceWithItemsSchema>;
export type InvoiceWithRelations = z.infer<typeof InvoiceWithRelationsSchema>;

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type InvoiceItemCreate = z.infer<typeof InvoiceItemCreateSchema>;
export type InvoiceItemUpdate = z.infer<typeof InvoiceItemUpdateSchema>;

export type BuildInvoiceFromProject = z.infer<typeof BuildInvoiceFromProjectSchema>;
export type AddInvoiceManualItem = z.infer<typeof AddInvoiceManualItemSchema>;

export type InvoiceFilter = {
  status?: InvoiceStatus | InvoiceStatus[];
  invoice_type?: InvoiceType;
  customer_id?: string;
  project_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  overdue_only?: boolean;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Entwurf',
  sent: 'Versendet',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
  void: 'Storniert',
  cancelled: 'Abgebrochen',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'gray',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  void: 'orange',
  cancelled: 'slate',
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  final: 'Schlussrechnung',
  partial: 'Teilrechnung',
  advance: 'Abschlagsrechnung',
  credit: 'Gutschrift',
};

export const INVOICE_ITEM_SOURCE_LABELS: Record<InvoiceItemSourceType, string> = {
  offer_item: 'Aus Angebot',
  delivery_note: 'Zusatzarbeit',
  manual: 'Nachtrag',
  advance_deduction: 'Abschlag',
};

// ============================================================================
// STATUS TRANSITIONS (for UI validation)
// ============================================================================

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'void'],
  overdue: ['paid', 'void'],
  paid: [],
  void: [],
  cancelled: [],
};

export function canTransitionInvoiceStatus(
  currentStatus: InvoiceStatus,
  newStatus: InvoiceStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return INVOICE_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatInvoiceAmount(amount: number | null | undefined): string {
  if (amount == null) return '0,00 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function calculateInvoiceDueStatus(
  status: InvoiceStatus,
  dueDate: string | null,
  paidAt: string | null
): 'ok' | 'warning' | 'overdue' {
  if (status === 'paid' || paidAt) return 'ok';
  if (status === 'overdue') return 'overdue';
  if (!dueDate) return 'ok';

  const due = new Date(dueDate);
  const today = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'warning';
  return 'ok';
}
