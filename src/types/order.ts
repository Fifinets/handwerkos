// Order (Auftrag) DTOs and Zod schemas for HandwerkOS
// Extended types for offer-based workflow

import { z } from 'zod';

// ============================================================================
// STATUS ENUM
// ============================================================================

export const OrderStatusEnum = z.enum([
  'created',      // Auftrag angelegt (aus Angebot)
  'confirmed',    // Auftragsbestätigung versendet
  'in_progress',  // Projekt läuft
  'completed',    // Arbeit abgeschlossen
  'invoiced',     // Rechnung erstellt
  'cancelled',    // Storniert
  'open'          // Legacy (= created)
]);

export type OrderStatus = z.infer<typeof OrderStatusEnum>;

// ============================================================================
// ORDER SCHEMAS (Extended for offer-based workflow)
// ============================================================================

export const OrderCreateFromOfferSchema = z.object({
  offer_id: z.string().uuid('Angebot ist erforderlich'),
  accepted_by: z.string().optional(),
  create_project: z.boolean().default(false),
});

export const OrderCreateSchema = z.object({
  customer_id: z.string().uuid('Kunde ist erforderlich'),
  offer_id: z.string().uuid().optional(),
  quote_id: z.string().uuid().optional(), // Legacy
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  total_amount: z.number().min(0, 'Betrag muss positiv sein').optional(),
});

export const OrderUpdateSchema = OrderCreateSchema.partial().extend({
  status: OrderStatusEnum.optional(),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid().nullable(),
  order_number: z.string().nullable(),
  customer_id: z.string().uuid(),
  offer_id: z.string().uuid().nullable(),
  quote_id: z.string().uuid().nullable(), // Legacy
  title: z.string(),
  description: z.string().nullable(),
  status: OrderStatusEnum,
  total_amount: z.number().nullable(),
  confirmed_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// EXTENDED TYPES
// ============================================================================

export const OrderWithRelationsSchema = OrderSchema.extend({
  customer: z.object({
    id: z.string().uuid(),
    company_name: z.string(),
    contact_person: z.string().nullable(),
  }).optional(),
  offer: z.object({
    id: z.string().uuid(),
    offer_number: z.string(),
    project_name: z.string(),
    snapshot_net_total: z.number().nullable(),
  }).optional().nullable(),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.string(),
  }).optional().nullable(),
});

// ============================================================================
// RPC RESPONSE SCHEMAS
// ============================================================================

export const AcceptOfferResponseSchema = z.object({
  offer_id: z.string().uuid(),
  order_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  order_number: z.string(),
});

export const CreateProjectFromOrderResponseSchema = z.object({
  project_id: z.string().uuid(),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type Order = z.infer<typeof OrderSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderCreateFromOffer = z.infer<typeof OrderCreateFromOfferSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;
export type OrderWithRelations = z.infer<typeof OrderWithRelationsSchema>;

export type AcceptOfferResponse = z.infer<typeof AcceptOfferResponseSchema>;
export type CreateProjectFromOrderResponse = z.infer<typeof CreateProjectFromOrderResponseSchema>;

export type OrderFilter = {
  status?: OrderStatus | OrderStatus[];
  customer_id?: string;
  offer_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: 'Angelegt',
  confirmed: 'Bestätigt',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  invoiced: 'Abgerechnet',
  cancelled: 'Storniert',
  open: 'Offen', // Legacy
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  created: 'gray',
  confirmed: 'blue',
  in_progress: 'yellow',
  completed: 'green',
  invoiced: 'purple',
  cancelled: 'red',
  open: 'gray', // Legacy
};

// ============================================================================
// STATUS TRANSITIONS (for UI validation)
// ============================================================================

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['invoiced'],
  invoiced: [],
  cancelled: [],
  open: ['created', 'confirmed', 'cancelled'], // Legacy can transition to new states
};

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  if (currentStatus === newStatus) return true;
  return ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
