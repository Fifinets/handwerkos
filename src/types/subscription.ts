import { z } from 'zod';

// ============================================================================
// SUBSCRIPTION PLAN
// ============================================================================

export const SubscriptionPlanSchema = z.object({
  id: z.string().uuid(),
  stripe_product_id: z.string(),
  stripe_price_id: z.string(),
  name: z.string(),
  slug: z.enum(['basic', 'pro', 'enterprise']),
  description: z.string().nullable(),
  price_cents: z.number().int().min(0),
  currency: z.string().default('eur'),
  interval: z.enum(['month', 'year']).default('month'),
  trial_days: z.number().int().min(0).default(14),
  features: z.array(z.string()),
  max_employees: z.number().int().nullable(),
  max_projects: z.number().int().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type PlanSlug = SubscriptionPlan['slug'];

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

export const SubscriptionStatusEnum = z.enum([
  'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'none',
]);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>;

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  stripe_customer_id: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  status: SubscriptionStatusEnum,
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  trial_start: z.string().nullable(),
  trial_end: z.string().nullable(),
  cancel_at_period_end: z.boolean().default(false),
  canceled_at: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

// RPC response from get_company_subscription
export const CompanySubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  status: SubscriptionStatusEnum,
  plan_slug: z.string(),
  plan_name: z.string(),
  plan_id: z.string().uuid().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  current_period_start: z.string().nullable().optional(),
  current_period_end: z.string().nullable().optional(),
  trial_end: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  is_active: z.boolean(),
  is_trialing: z.boolean().optional(),
  features: z.array(z.string()),
  max_employees: z.number().int().nullable().optional(),
  max_projects: z.number().int().nullable().optional(),
});

export type CompanySubscription = z.infer<typeof CompanySubscriptionSchema>;

// ============================================================================
// OFFER PAYMENT
// ============================================================================

export const OfferPaymentStatusEnum = z.enum([
  'pending', 'paid', 'failed', 'refunded', 'expired', 'none',
]);

export type OfferPaymentStatus = z.infer<typeof OfferPaymentStatusEnum>;

export const OfferPaymentSchema = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  company_id: z.string().uuid(),
  stripe_payment_link_id: z.string().nullable(),
  stripe_payment_link_url: z.string().nullable(),
  stripe_payment_intent_id: z.string().nullable(),
  stripe_checkout_session_id: z.string().nullable(),
  amount_cents: z.number().int(),
  currency: z.string().default('eur'),
  status: OfferPaymentStatusEnum,
  paid_at: z.string().nullable(),
  payment_method_type: z.string().nullable(),
  customer_email: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OfferPayment = z.infer<typeof OfferPaymentSchema>;

export const OfferPaymentStatusResponseSchema = z.object({
  has_payment_link: z.boolean(),
  payment_link_url: z.string().nullable().optional(),
  status: OfferPaymentStatusEnum,
  paid_at: z.string().nullable().optional(),
  amount_cents: z.number().int().optional(),
  currency: z.string().optional(),
});

export type OfferPaymentStatusResponse = z.infer<typeof OfferPaymentStatusResponseSchema>;

// ============================================================================
// CHECKOUT/PORTAL RESPONSES
// ============================================================================

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface PaymentLinkResponse {
  url: string;
  payment_link_id: string;
  offer_payment_id: string;
}

// ============================================================================
// USAGE STATS
// ============================================================================

export interface UsageStats {
  offers_this_month: number;
  active_projects: number;
  active_employees: number;
  storage_used_gb: number;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export const PLAN_FEATURES: Record<string, string[]> = {
  free: [],
  basic: [
    'offers', 'projects', 'customers', 'time_tracking', 'materials',
  ],
  pro: [
    'offers', 'projects', 'customers', 'time_tracking', 'materials',
    'invoices', 'delivery_notes', 'ai_estimation', 'document_ocr',
    'site_documentation', 'employee_management',
  ],
  enterprise: [
    'offers', 'projects', 'customers', 'time_tracking', 'materials',
    'invoices', 'delivery_notes', 'ai_estimation', 'document_ocr',
    'site_documentation', 'employee_management',
    'vde_protocols', 'datev_export', 'api_access',
    'priority_support', 'custom_branding',
  ],
};

export const PLAN_LIMITS: Record<string, {
  max_offers_month: number | null;
  max_projects: number | null;
  max_employees: number | null;
  storage_gb: number;
}> = {
  free: { max_offers_month: 3, max_projects: 2, max_employees: 1, storage_gb: 0.5 },
  basic: { max_offers_month: 30, max_projects: 10, max_employees: 3, storage_gb: 5 },
  pro: { max_offers_month: null, max_projects: null, max_employees: 10, storage_gb: 15 },
  enterprise: { max_offers_month: null, max_projects: null, max_employees: null, storage_gb: 50 },
};

export const PLAN_DISPLAY: Record<string, {
  name: string;
  badge_color: string;
  description: string;
}> = {
  free: { name: 'Kostenlos', badge_color: 'gray', description: 'Zum Testen' },
  basic: { name: 'Starter', badge_color: 'blue', description: 'Fuer Einzelunternehmer' },
  pro: { name: 'Handwerker', badge_color: 'emerald', description: 'Fuer wachsende Betriebe' },
  enterprise: { name: 'Meisterbetrieb', badge_color: 'purple', description: 'Fuer etablierte Betriebe' },
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const PAYMENT_STATUS_LABELS: Record<OfferPaymentStatus, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  failed: 'Fehlgeschlagen',
  refunded: 'Erstattet',
  expired: 'Abgelaufen',
  none: 'Keine Zahlung',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Testphase',
  active: 'Aktiv',
  past_due: 'Ueberfaellig',
  canceled: 'Gekuendigt',
  unpaid: 'Unbezahlt',
  incomplete: 'Unvollstaendig',
  none: 'Kein Abo',
};
