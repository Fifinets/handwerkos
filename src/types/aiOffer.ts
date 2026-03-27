// AI Offer Assistant (KI-Angebotsassistent) types and Zod schemas
// Provides type-safe validation for AI-generated offer positions and templates

import { z } from 'zod';

// ============================================================================
// REQUEST
// ============================================================================

export const AIOfferRequestSchema = z.object({
  prompt: z.string().min(3, 'Beschreibung zu kurz').max(2000),
  project_name: z.string().optional(),
  customer_name: z.string().optional(),
  hourly_rate: z.number().min(1).max(500).default(75),
  vat_rate: z.number().min(0).max(100).default(19),
  templates: z.array(z.object({
    name: z.string(),
    description: z.string(),
    item_type: z.string(),
    unit: z.string(),
    planned_hours: z.number().nullable(),
    material_cost_estimate: z.number().nullable(),
  })).max(15).default([]),
  custom_instructions: z.string().optional(),
});
export type AIOfferRequest = z.infer<typeof AIOfferRequestSchema>;

// ============================================================================
// RESPONSE POSITION
// ============================================================================

export const AIGeneratedPositionSchema = z.object({
  position_number: z.number().int().min(1),
  description: z.string().min(1),
  quantity: z.number().min(0.001),
  unit: z.string(),
  unit_price_net: z.number().min(0),
  vat_rate: z.number().min(0).max(100),
  item_type: z.enum([
    'labor', 'material', 'material_lump_sum', 'lump_sum',
    'travel', 'small_material', 'other'
  ]),
  planned_hours_item: z.number().min(0).optional(),
  material_purchase_cost: z.number().min(0).optional(),
  internal_notes: z.string().optional(),
  is_optional: z.boolean().default(false),
});
export type AIGeneratedPosition = z.infer<typeof AIGeneratedPositionSchema>;

// ============================================================================
// FULL RESPONSE
// ============================================================================

export const AIOfferResponseSchema = z.object({
  positions: z.array(AIGeneratedPositionSchema),
  summary: z.string().optional(),
  reasoning: z.string().optional(),
  total_estimated_hours: z.number().optional(),
  total_estimated_material_cost: z.number().optional(),
});
export type AIOfferResponse = z.infer<typeof AIOfferResponseSchema>;

// ============================================================================
// CHAT UI STATE
// ============================================================================

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  positions?: AIGeneratedPosition[];
  timestamp: Date;
  isStreaming?: boolean;
}

// ============================================================================
// TEMPLATE (from DB)
// ============================================================================

export const OfferPositionTemplateSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid().nullable(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  item_type: z.string(),
  unit: z.string(),
  default_quantity: z.number(),
  default_unit_price_net: z.number().nullable(),
  default_vat_rate: z.number(),
  planned_hours: z.number().nullable(),
  material_cost_estimate: z.number().nullable(),
  tags: z.array(z.string()),
  sort_order: z.number(),
  is_active: z.boolean(),
});
export type OfferPositionTemplate = z.infer<typeof OfferPositionTemplateSchema>;
