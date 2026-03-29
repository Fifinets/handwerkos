# Stripe Payment Integration — SaaS Subscriptions + Offer Payment Links

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monetize HandwerkOS with Stripe subscriptions (Basic/Pro/Enterprise) and allow Handwerker customers to pay accepted offers directly via Stripe Payment Links embedded in the public offer page.

**Architecture:** Supabase Edge Functions handle all Stripe API calls server-side (secret key never in browser). Webhooks keep DB in sync. Feature gating uses existing `feature_flags` + new `subscriptions` table. Payment Links for offers are generated on-demand and embedded in the existing `PublicOfferView.tsx`.

**Tech Stack:** Stripe API (stripe npm for Edge Functions), Supabase Edge Functions (Deno), existing React 18 + TanStack Query + Shadcn/ui patterns, Zod validation

---

## Architektur-Uebersicht

```
=== Phase 1: SaaS Subscriptions ===

Handwerker klickt "Upgrade" / "Plan waehlen"
  -> Frontend ruft Edge Function `create-checkout` auf
  -> Edge Function erstellt Stripe Checkout Session
  -> Handwerker wird zu Stripe Checkout weitergeleitet
  -> Nach Zahlung: Stripe sendet Webhook -> `stripe-webhook` Edge Function
  -> DB: subscriptions-Tabelle wird aktualisiert
  -> Frontend prueft subscription_status fuer Feature-Gating

Handwerker klickt "Abo verwalten"
  -> Edge Function `create-portal-session` erstellt Stripe Customer Portal URL
  -> Handwerker wird zu Stripe Portal weitergeleitet (Plan aendern, kuendigen)
  -> Aenderungen kommen via Webhook zurueck

=== Phase 2: Offer Payment Links ===

Angebot wird angenommen (status: accepted)
  -> Handwerker klickt "Zahlungslink erstellen" im Angebot
  -> Edge Function `create-payment-link` erstellt Stripe Payment Link
  -> Link wird in offer_payments gespeichert
  -> "Jetzt bezahlen" Button erscheint auf PublicOfferView
  -> Kunde zahlt via Stripe (Karte, SEPA, etc.)
  -> Webhook: offer_payments + invoices Status wird aktualisiert
```

---

## Datei-Struktur

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `supabase/migrations/20260326100000_subscriptions.sql` | NEU | DB: subscription_plans, subscriptions, payment_events, offer_payments |
| `supabase/functions/stripe-webhook/index.ts` | NEU | Webhook-Handler fuer alle Stripe Events |
| `supabase/functions/create-checkout/index.ts` | NEU | Stripe Checkout Session fuer SaaS Subscriptions |
| `supabase/functions/create-portal-session/index.ts` | NEU | Stripe Customer Portal Session |
| `supabase/functions/create-payment-link/index.ts` | NEU | Stripe Payment Link fuer Angebotszahlung |
| `src/types/subscription.ts` | NEU | TypeScript Typen + Zod Schemas |
| `src/services/subscriptionService.ts` | NEU | Subscription CRUD + Edge Function Aufrufe |
| `src/hooks/useSubscription.ts` | NEU | React Hook fuer Subscription-Status + Feature-Gating |
| `src/components/billing/PricingTable.tsx` | NEU | Plan-Auswahl (Basic/Pro/Enterprise) |
| `src/components/billing/SubscriptionManager.tsx` | NEU | Aktueller Plan + Abo verwalten |
| `src/components/billing/PaymentButton.tsx` | NEU | "Jetzt bezahlen" Button fuer Angebote |
| `src/pages/public/PublicOfferView.tsx` | AENDERN | PaymentButton einbetten |
| `src/components/OfferModuleV2.tsx` | AENDERN | "Zahlungslink erstellen" Button |
| `src/App.tsx` | AENDERN | Billing-Route hinzufuegen |
| `.env` | AENDERN | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET hinzufuegen |
| `supabase/functions/.env.example` | AENDERN | Stripe Env Vars dokumentieren |

---

## Voraussetzungen

Vor Beginn der Implementierung:

1. Stripe Account erstellen unter https://dashboard.stripe.com
2. Im Stripe Dashboard erstellen:
   - 3 Products mit Monthly Prices (Basic 29EUR, Pro 79EUR, Enterprise 199EUR)
   - Webhook Endpoint auf `https://<supabase-project>.supabase.co/functions/v1/stripe-webhook`
   - Webhook Events aktivieren: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `payment_intent.succeeded`
3. API Keys notieren: `STRIPE_SECRET_KEY` (sk_live_... oder sk_test_...), `STRIPE_WEBHOOK_SECRET` (whsec_...)
4. Supabase Edge Function Secrets setzen:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

---

## Task 1: Datenbank — Subscription + Payment Tabellen

**Files:**
- Create: `supabase/migrations/20260326100000_subscriptions.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- ============================================================================
-- Stripe Payment Integration: Subscription + Payment Tables
-- ============================================================================

-- 1. Subscription Plans (Produkt-Katalog)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,                          -- 'Basic', 'Pro', 'Enterprise'
  slug TEXT NOT NULL UNIQUE,                   -- 'basic', 'pro', 'enterprise'
  description TEXT,
  price_cents INTEGER NOT NULL,                -- 2900 = 29.00 EUR
  currency TEXT NOT NULL DEFAULT 'eur',
  interval TEXT NOT NULL DEFAULT 'month',      -- 'month' | 'year'
  trial_days INTEGER NOT NULL DEFAULT 14,
  features JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["feature_a", "feature_b"]
  max_employees INTEGER,                       -- NULL = unlimited
  max_projects INTEGER,                        -- NULL = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Subscriptions (pro Company)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  stripe_customer_id TEXT,                          -- cus_xxx
  stripe_subscription_id TEXT UNIQUE,               -- sub_xxx
  status TEXT NOT NULL DEFAULT 'trialing',          -- trialing, active, past_due, canceled, unpaid, incomplete
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)                                -- 1 subscription per company
);

-- 3. Payment Events (Webhook-Log, idempotency)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,             -- evt_xxx (idempotency key)
  event_type TEXT NOT NULL,                         -- checkout.session.completed, etc.
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Offer Payments (Angebotszahlungen)
CREATE TABLE IF NOT EXISTS public.offer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_payment_link_id TEXT,                      -- plink_xxx
  stripe_payment_link_url TEXT,                     -- https://buy.stripe.com/xxx
  stripe_payment_intent_id TEXT,                    -- pi_xxx
  stripe_checkout_session_id TEXT,                  -- cs_xxx
  amount_cents INTEGER NOT NULL,                    -- Betrag in Cent
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending',           -- pending, paid, failed, refunded, expired
  paid_at TIMESTAMPTZ,
  payment_method_type TEXT,                         -- card, sepa_debit, etc.
  customer_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_payment_events_type ON public.payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_id ON public.payment_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_offer_payments_offer ON public.offer_payments(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_payments_company ON public.offer_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_offer_payments_status ON public.offer_payments(status);
CREATE INDEX IF NOT EXISTS idx_offer_payments_stripe_pi ON public.offer_payments(stripe_payment_intent_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_payments ENABLE ROW LEVEL SECURITY;

-- subscription_plans: Jeder kann Plans lesen (oeffentlich)
CREATE POLICY "plans_select_all" ON public.subscription_plans
  FOR SELECT USING (true);

-- subscriptions: Nur eigene Company
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- payment_events: Nur Service-Role (kein Frontend-Zugriff)
-- Kein SELECT-Policy = kein Zugriff fuer anon/authenticated

-- offer_payments: Nur eigene Company
CREATE POLICY "offer_payments_select_own" ON public.offer_payments
  FOR SELECT USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Subscription-Status fuer aktuelle Company abrufen
CREATE OR REPLACE FUNCTION public.get_company_subscription(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
BEGIN
  SELECT s.* INTO v_sub
  FROM public.subscriptions s
  WHERE s.company_id = p_company_id;

  IF NOT FOUND THEN
    -- Kein Abo = Free Tier
    RETURN jsonb_build_object(
      'status', 'none',
      'plan_slug', 'free',
      'plan_name', 'Kostenlos',
      'is_active', true,
      'features', '[]'::jsonb
    );
  END IF;

  -- Plan laden
  SELECT sp.* INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_sub.plan_id;

  RETURN jsonb_build_object(
    'id', v_sub.id,
    'status', v_sub.status,
    'plan_slug', COALESCE(v_plan.slug, 'free'),
    'plan_name', COALESCE(v_plan.name, 'Kostenlos'),
    'plan_id', v_sub.plan_id,
    'stripe_subscription_id', v_sub.stripe_subscription_id,
    'current_period_start', v_sub.current_period_start,
    'current_period_end', v_sub.current_period_end,
    'trial_end', v_sub.trial_end,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'is_active', v_sub.status IN ('trialing', 'active'),
    'is_trialing', v_sub.status = 'trialing',
    'features', COALESCE(v_plan.features, '[]'::jsonb),
    'max_employees', v_plan.max_employees,
    'max_projects', v_plan.max_projects
  );
END;
$$;

-- Offer Payment Status abrufen (fuer PublicOfferView, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_offer_payment_status(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT op.* INTO v_payment
  FROM public.offer_payments op
  WHERE op.offer_id = p_offer_id
  ORDER BY op.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_payment_link', false,
      'status', 'none'
    );
  END IF;

  RETURN jsonb_build_object(
    'has_payment_link', v_payment.stripe_payment_link_url IS NOT NULL,
    'payment_link_url', v_payment.stripe_payment_link_url,
    'status', v_payment.status,
    'paid_at', v_payment.paid_at,
    'amount_cents', v_payment.amount_cents,
    'currency', v_payment.currency
  );
END;
$$;

-- ============================================================================
-- Seed: Default Plans
-- ============================================================================

INSERT INTO public.subscription_plans (stripe_product_id, stripe_price_id, name, slug, description, price_cents, trial_days, features, max_employees, max_projects, sort_order)
VALUES
  ('prod_basic_PLACEHOLDER', 'price_basic_PLACEHOLDER', 'Basic', 'basic',
   'Fuer Einzelunternehmer und kleine Betriebe',
   2900, 14,
   '["offers", "invoices", "projects", "customers", "time_tracking"]'::jsonb,
   3, 20, 1),
  ('prod_pro_PLACEHOLDER', 'price_pro_PLACEHOLDER', 'Pro', 'pro',
   'Fuer wachsende Handwerksbetriebe',
   7900, 14,
   '["offers", "invoices", "projects", "customers", "time_tracking", "materials", "ai_estimation", "document_ocr", "delivery_notes", "employee_management"]'::jsonb,
   15, NULL, 2),
  ('prod_enterprise_PLACEHOLDER', 'price_enterprise_PLACEHOLDER', 'Enterprise', 'enterprise',
   'Fuer grosse Betriebe mit mehreren Teams',
   19900, 14,
   '["offers", "invoices", "projects", "customers", "time_tracking", "materials", "ai_estimation", "document_ocr", "delivery_notes", "employee_management", "datev_export", "api_access", "priority_support", "custom_branding"]'::jsonb,
   NULL, NULL, 3)
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 2: Migration anwenden**

```bash
supabase db push
# Oder via MCP: apply_migration
```

- [ ] **Step 3: Verifizieren**

```sql
-- Pruefen ob Tabellen existieren
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('subscription_plans', 'subscriptions', 'payment_events', 'offer_payments');

-- Plans pruefen
SELECT slug, name, price_cents, features FROM public.subscription_plans ORDER BY sort_order;
```

**Test-Kriterium:** Alle 4 Tabellen existieren, 3 Plans sind geseedet, RLS ist aktiv, RPC-Funktionen sind aufrufbar.

---

## Task 2: TypeScript Typen + Zod Schemas

**Files:**
- Create: `src/types/subscription.ts`

- [ ] **Step 1: Typen definieren**

```typescript
// Stripe Payment Integration types for HandwerkOS
// Subscription plans, billing status, and offer payments

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
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type PlanSlug = SubscriptionPlan['slug'];

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

export const SubscriptionStatusEnum = z.enum([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'none',      // No subscription exists
]);

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>;

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  stripe_customer_id: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  status: SubscriptionStatusEnum,
  current_period_start: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
  trial_start: z.string().datetime().nullable(),
  trial_end: z.string().datetime().nullable(),
  cancel_at_period_end: z.boolean().default(false),
  canceled_at: z.string().datetime().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
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
  'pending',
  'paid',
  'failed',
  'refunded',
  'expired',
  'none',
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
  paid_at: z.string().datetime().nullable(),
  payment_method_type: z.string().nullable(),
  customer_email: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type OfferPayment = z.infer<typeof OfferPaymentSchema>;

// RPC response from get_offer_payment_status
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
// CHECKOUT SESSION RESPONSE
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
// FEATURE GATING
// ============================================================================

// Maps plan slug to feature availability
export const PLAN_FEATURES: Record<string, string[]> = {
  free: [],
  basic: ['offers', 'invoices', 'projects', 'customers', 'time_tracking'],
  pro: [
    'offers', 'invoices', 'projects', 'customers', 'time_tracking',
    'materials', 'ai_estimation', 'document_ocr', 'delivery_notes',
    'employee_management',
  ],
  enterprise: [
    'offers', 'invoices', 'projects', 'customers', 'time_tracking',
    'materials', 'ai_estimation', 'document_ocr', 'delivery_notes',
    'employee_management', 'datev_export', 'api_access',
    'priority_support', 'custom_branding',
  ],
};

export const PLAN_DISPLAY: Record<string, {
  name: string;
  badge_color: string;
  description: string;
}> = {
  free: { name: 'Kostenlos', badge_color: 'gray', description: 'Eingeschraenkte Funktionen' },
  basic: { name: 'Basic', badge_color: 'blue', description: 'Fuer Einzelunternehmer' },
  pro: { name: 'Pro', badge_color: 'emerald', description: 'Fuer wachsende Betriebe' },
  enterprise: { name: 'Enterprise', badge_color: 'purple', description: 'Fuer grosse Betriebe' },
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
```

- [ ] **Step 2: Typen in src/types/index.ts exportieren**

Oeffne `src/types/index.ts` und fuege hinzu:

```typescript
export * from './subscription';
```

**Test-Kriterium:** `npm run typecheck` laeuft ohne Fehler. Alle Typen sind importierbar.

---

## Task 3: Supabase Edge Function — Stripe Webhook Handler

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Webhook Handler implementieren**

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // Stripe sends POST, no CORS needed for webhooks
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Idempotency: Check if already processed
  const { data: existing } = await supabase
    .from("payment_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Log event
  await supabase.from("payment_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
  });

  try {
    switch (event.type) {
      // === SaaS Subscriptions ===
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // === Offer Payments ===
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "checkout.session.completed":
        // Also handle offer payment checkout sessions
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.offer_id) {
          await handleOfferPaymentCompleted(session);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await supabase
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

  } catch (err) {
    console.error(`Error processing event ${event.id}:`, err);
    await supabase
      .from("payment_events")
      .update({ error: err.message })
      .eq("stripe_event_id", event.id);
    // Still return 200 to prevent Stripe retries for processing errors
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// === HANDLER FUNCTIONS ===

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const companyId = session.metadata?.company_id;
  if (!companyId) {
    console.error("checkout.session.completed: missing company_id in metadata");
    return;
  }

  // If this is a subscription checkout
  if (session.mode === "subscription" && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await upsertSubscription(companyId, session.customer as string, subscription);
  }

  // If this is an offer payment checkout
  if (session.metadata?.offer_id) {
    await handleOfferPaymentCompleted(session);
  }
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  // Find company by stripe_customer_id
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("company_id")
    .eq("stripe_customer_id", subscription.customer as string)
    .single();

  if (!sub) {
    console.error("No company found for stripe customer:", subscription.customer);
    return;
  }

  await upsertSubscription(
    sub.company_id,
    subscription.customer as string,
    subscription
  );
}

async function upsertSubscription(
  companyId: string,
  stripeCustomerId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id;

  // Find plan by stripe_price_id
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .single();

  const { error } = await supabase.from("subscriptions").upsert(
    {
      company_id: companyId,
      plan_id: plan?.id || null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(
        subscription.current_period_start * 1000
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );

  if (error) {
    console.error("Error upserting subscription:", error);
    throw error;
  }

  console.log(
    `Subscription upserted: company=${companyId}, status=${subscription.status}`
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Error canceling subscription:", error);
    throw error;
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", invoice.customer as string);

  if (error) {
    console.error("Error marking subscription past_due:", error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const offerId = paymentIntent.metadata?.offer_id;
  if (!offerId) return; // Not an offer payment

  await supabase
    .from("offer_payments")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntent.id,
      paid_at: new Date().toISOString(),
      payment_method_type:
        paymentIntent.payment_method_types?.[0] || "unknown",
      updated_at: new Date().toISOString(),
    })
    .eq("offer_id", offerId)
    .eq("status", "pending");

  console.log(`Offer payment completed: offer=${offerId}`);
}

async function handleOfferPaymentCompleted(session: Stripe.Checkout.Session) {
  const offerId = session.metadata?.offer_id;
  if (!offerId) return;

  // Update offer_payments
  await supabase
    .from("offer_payments")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString(),
      customer_email: session.customer_details?.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("offer_id", offerId)
    .eq("status", "pending");

  // Optional: Update related invoice status to 'paid'
  const { data: offer } = await supabase
    .from("offers")
    .select("id, project_id")
    .eq("id", offerId)
    .single();

  if (offer?.project_id) {
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("offer_id", offerId)
      .eq("status", "sent");
  }

  console.log(`Offer payment checkout completed: offer=${offerId}`);
}
```

- [ ] **Step 2: Edge Function deployen**

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

WICHTIG: `--no-verify-jwt` weil Stripe keinen Supabase JWT sendet. Authentifizierung erfolgt ueber Stripe Signature.

**Test-Kriterium:** Function deployed. Stripe Test-Webhook sendet `checkout.session.completed` und Event wird in `payment_events` geloggt.

---

## Task 4: Supabase Edge Function — Create Checkout Session

**Files:**
- Create: `supabase/functions/create-checkout/index.ts`

- [ ] **Step 1: Checkout Edge Function implementieren**

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const jwt = authHeader.substring(7);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) throw new Error("Invalid token");

    // Get company_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) throw new Error("No company found");

    const { price_id, success_url, cancel_url } = await req.json();

    if (!price_id) throw new Error("price_id is required");

    // Check if company already has a Stripe customer
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", profile.company_id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          company_id: profile.company_id,
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Upsert subscription row with customer ID
      await supabase.from("subscriptions").upsert(
        {
          company_id: profile.company_id,
          stripe_customer_id: customerId,
          status: "incomplete",
        },
        { onConflict: "company_id" }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      line_items: [{ price: price_id, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          company_id: profile.company_id,
        },
      },
      metadata: {
        company_id: profile.company_id,
      },
      success_url:
        success_url || `${req.headers.get("origin")}/manager2?subscription=success`,
      cancel_url:
        cancel_url || `${req.headers.get("origin")}/manager2?subscription=cancelled`,
      locale: "de",
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deployen**

```bash
supabase functions deploy create-checkout
```

**Test-Kriterium:** Authenticated request mit `price_id` gibt `{ url, session_id }` zurueck. URL fuehrt zu Stripe Checkout.

---

## Task 5: Supabase Edge Function — Customer Portal Session

**Files:**
- Create: `supabase/functions/create-portal-session/index.ts`

- [ ] **Step 1: Portal Session Edge Function implementieren**

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const jwt = authHeader.substring(7);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) throw new Error("Invalid token");

    // Get company_id + stripe_customer_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) throw new Error("No company found");

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", profile.company_id)
      .single();

    if (!sub?.stripe_customer_id) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }

    const { return_url } = await req.json();

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url:
        return_url || `${req.headers.get("origin")}/manager2?tab=billing`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deployen**

```bash
supabase functions deploy create-portal-session
```

**Test-Kriterium:** Authenticated request gibt `{ url }` zurueck. URL fuehrt zu Stripe Customer Portal.

---

## Task 6: Supabase Edge Function — Create Payment Link (fuer Angebote)

**Files:**
- Create: `supabase/functions/create-payment-link/index.ts`

- [ ] **Step 1: Payment Link Edge Function implementieren**

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const jwt = authHeader.substring(7);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) throw new Error("Invalid token");

    // Get company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) throw new Error("No company found");

    const { offer_id } = await req.json();
    if (!offer_id) throw new Error("offer_id is required");

    // Get offer details
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .select("id, offer_number, project_name, customer_name, customer_id, snapshot_gross_total, status, company_id")
      .eq("id", offer_id)
      .eq("company_id", profile.company_id)
      .single();

    if (offerError || !offer) throw new Error("Offer not found");
    if (offer.status !== "accepted") {
      throw new Error("Only accepted offers can have payment links");
    }

    const amountCents = Math.round((offer.snapshot_gross_total || 0) * 100);
    if (amountCents <= 0) throw new Error("Offer amount must be > 0");

    // Get customer email
    const { data: customer } = await supabase
      .from("customers")
      .select("email")
      .eq("id", offer.customer_id)
      .single();

    // Get company name for product description
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name")
      .eq("company_id", profile.company_id)
      .single();

    const companyName = companySettings?.company_name || "HandwerkOS";

    // Check for existing pending payment link
    const { data: existingPayment } = await supabase
      .from("offer_payments")
      .select("id, stripe_payment_link_url, status")
      .eq("offer_id", offer_id)
      .eq("status", "pending")
      .single();

    if (existingPayment?.stripe_payment_link_url) {
      return new Response(
        JSON.stringify({
          url: existingPayment.stripe_payment_link_url,
          payment_link_id: null,
          offer_payment_id: existingPayment.id,
          existing: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a one-time Stripe product + price for this offer
    const product = await stripe.products.create({
      name: `${offer.offer_number} — ${offer.project_name}`,
      description: `Angebot fuer ${offer.customer_name} von ${companyName}`,
      metadata: {
        offer_id: offer.id,
        company_id: profile.company_id,
        offer_number: offer.offer_number,
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency: "eur",
    });

    // Create Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_types: ["card", "sepa_debit"],
      metadata: {
        offer_id: offer.id,
        company_id: profile.company_id,
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${req.headers.get("origin")}/public/offer/${offer_id}?payment=success`,
        },
      },
      custom_text: {
        submit: {
          message: `Zahlung fuer Angebot ${offer.offer_number} an ${companyName}`,
        },
      },
    });

    // Save to DB
    const { data: offerPayment, error: insertError } = await supabase
      .from("offer_payments")
      .insert({
        offer_id: offer.id,
        company_id: profile.company_id,
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
        amount_cents: amountCents,
        currency: "eur",
        status: "pending",
        customer_email: customer?.email || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        url: paymentLink.url,
        payment_link_id: paymentLink.id,
        offer_payment_id: offerPayment.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating payment link:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deployen**

```bash
supabase functions deploy create-payment-link
```

**Test-Kriterium:** Authenticated request mit `offer_id` (accepted offer) gibt `{ url, payment_link_id, offer_payment_id }` zurueck. URL fuehrt zu Stripe Payment Page.

---

## Task 7: Frontend Service — subscriptionService.ts

**Files:**
- Create: `src/services/subscriptionService.ts`

- [ ] **Step 1: Service implementieren**

```typescript
// Subscription service for HandwerkOS
// Handles SaaS billing, plan management, and offer payments via Stripe

import { supabase } from '@/integrations/supabase/client';
import { apiCall, ApiError, API_ERROR_CODES } from '@/utils/api';
import type {
  SubscriptionPlan,
  CompanySubscription,
  OfferPaymentStatusResponse,
  CheckoutSessionResponse,
  PortalSessionResponse,
  PaymentLinkResponse,
} from '@/types/subscription';

export class SubscriptionService {

  // ============================================================================
  // PLANS
  // ============================================================================

  /** Get all active subscription plans */
  static async getPlans(): Promise<SubscriptionPlan[]> {
    return apiCall(async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Get subscription plans');
  }

  // ============================================================================
  // SUBSCRIPTION STATUS
  // ============================================================================

  /** Get current company's subscription status via RPC */
  static async getSubscription(): Promise<CompanySubscription> {
    return apiCall(async () => {
      const companyId = await this.getCompanyId();

      // @ts-ignore
      const { data, error } = await supabase.rpc('get_company_subscription', {
        p_company_id: companyId,
      });

      if (error) throw error;
      return data as CompanySubscription;
    }, 'Get company subscription');
  }

  /** Check if current company has access to a specific feature */
  static async hasFeature(feature: string): Promise<boolean> {
    try {
      const sub = await this.getSubscription();
      return sub.features.includes(feature);
    } catch {
      return false;
    }
  }

  /** Check if subscription is active (trialing or active) */
  static async isActive(): Promise<boolean> {
    try {
      const sub = await this.getSubscription();
      return sub.is_active;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // CHECKOUT & PORTAL
  // ============================================================================

  /** Create a Stripe Checkout session for subscription */
  static async createCheckout(priceId: string): Promise<CheckoutSessionResponse> {
    return apiCall(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');
      }

      const response = await supabase.functions.invoke('create-checkout', {
        body: {
          price_id: priceId,
          success_url: `${window.location.origin}/manager2?subscription=success`,
          cancel_url: `${window.location.origin}/manager2?subscription=cancelled`,
        },
      });

      if (response.error) throw response.error;
      return response.data as CheckoutSessionResponse;
    }, 'Create checkout session');
  }

  /** Open Stripe Customer Portal for plan management */
  static async createPortalSession(): Promise<PortalSessionResponse> {
    return apiCall(async () => {
      const response = await supabase.functions.invoke('create-portal-session', {
        body: {
          return_url: `${window.location.origin}/manager2?tab=billing`,
        },
      });

      if (response.error) throw response.error;
      return response.data as PortalSessionResponse;
    }, 'Create portal session');
  }

  // ============================================================================
  // OFFER PAYMENTS
  // ============================================================================

  /** Create a payment link for an accepted offer */
  static async createPaymentLink(offerId: string): Promise<PaymentLinkResponse> {
    return apiCall(async () => {
      const response = await supabase.functions.invoke('create-payment-link', {
        body: { offer_id: offerId },
      });

      if (response.error) throw response.error;
      return response.data as PaymentLinkResponse;
    }, 'Create payment link');
  }

  /** Get payment status for an offer (public, no auth needed) */
  static async getOfferPaymentStatus(offerId: string): Promise<OfferPaymentStatusResponse> {
    return apiCall(async () => {
      // @ts-ignore
      const { data, error } = await supabase.rpc('get_offer_payment_status', {
        p_offer_id: offerId,
      });

      if (error) throw error;
      return data as OfferPaymentStatusResponse;
    }, 'Get offer payment status');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private static async getCompanyId(): Promise<string> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new ApiError(API_ERROR_CODES.UNAUTHORIZED, 'Nicht angemeldet');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.user.id)
      .single();

    if (profile?.company_id) return profile.company_id;

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.user.id)
      .single();

    if (employee?.company_id) return employee.company_id;

    return '00000000-0000-0000-0000-000000000000';
  }
}
```

**Test-Kriterium:** `SubscriptionService.getPlans()` returns 3 plans. `getSubscription()` returns `{ status: 'none', plan_slug: 'free' }` for company without subscription.

---

## Task 8: React Hook — useSubscription

**Files:**
- Create: `src/hooks/useSubscription.ts`

- [ ] **Step 1: Hook implementieren**

```typescript
// React hook for subscription status + feature gating
// Uses TanStack Query for caching and automatic refetching

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubscriptionService } from '@/services/subscriptionService';
import type {
  SubscriptionPlan,
  CompanySubscription,
  PlanSlug,
} from '@/types/subscription';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const subscriptionKeys = {
  all: ['subscription'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  status: () => [...subscriptionKeys.all, 'status'] as const,
  offerPayment: (offerId: string) =>
    [...subscriptionKeys.all, 'offer-payment', offerId] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/** Fetch all available subscription plans */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: subscriptionKeys.plans(),
    queryFn: () => SubscriptionService.getPlans(),
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
}

/** Fetch current company's subscription status */
export function useSubscription() {
  return useQuery<CompanySubscription>({
    queryKey: subscriptionKeys.status(),
    queryFn: () => SubscriptionService.getSubscription(),
    staleTime: 2 * 60 * 1000, // 2 min cache
    retry: 1,
  });
}

/** Check if company has access to a specific feature */
export function useFeatureAccess(feature: string): {
  hasAccess: boolean;
  isLoading: boolean;
  planSlug: string;
  requiredPlan: PlanSlug | null;
} {
  const { data: subscription, isLoading } = useSubscription();

  const hasAccess = subscription?.features?.includes(feature) ?? false;

  // Determine minimum plan needed for this feature
  let requiredPlan: PlanSlug | null = null;
  if (!hasAccess) {
    const { PLAN_FEATURES } = require('@/types/subscription');
    for (const slug of ['basic', 'pro', 'enterprise'] as PlanSlug[]) {
      if (PLAN_FEATURES[slug]?.includes(feature)) {
        requiredPlan = slug;
        break;
      }
    }
  }

  return {
    hasAccess,
    isLoading,
    planSlug: subscription?.plan_slug || 'free',
    requiredPlan,
  };
}

/** Check if subscription is active (trialing or active) */
export function useIsSubscribed(): {
  isSubscribed: boolean;
  isTrialing: boolean;
  isLoading: boolean;
  daysRemaining: number | null;
} {
  const { data: subscription, isLoading } = useSubscription();

  const isSubscribed = subscription?.is_active ?? false;
  const isTrialing = subscription?.is_trialing ?? false;

  let daysRemaining: number | null = null;
  if (isTrialing && subscription?.trial_end) {
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    daysRemaining = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  return { isSubscribed, isTrialing, isLoading, daysRemaining };
}

// ============================================================================
// MUTATIONS
// ============================================================================

/** Start checkout for a subscription plan */
export function useCheckout() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (priceId: string) => {
      const result = await SubscriptionService.createCheckout(priceId);
      // Redirect to Stripe Checkout
      window.location.href = result.url;
      return result;
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Checkout konnte nicht gestartet werden.',
        variant: 'destructive',
      });
    },
  });
}

/** Open Stripe Customer Portal */
export function usePortalSession() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const result = await SubscriptionService.createPortalSession();
      window.location.href = result.url;
      return result;
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Portal konnte nicht geoeffnet werden.',
        variant: 'destructive',
      });
    },
  });
}

/** Create payment link for an offer */
export function useCreatePaymentLink() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (offerId: string) =>
      SubscriptionService.createPaymentLink(offerId),
    onSuccess: (data, offerId) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.offerPayment(offerId),
      });
      toast({
        title: 'Zahlungslink erstellt',
        description: 'Der Kunde kann jetzt ueber den Link bezahlen.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message || 'Zahlungslink konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    },
  });
}

/** Fetch payment status for an offer */
export function useOfferPaymentStatus(offerId: string | undefined) {
  return useQuery({
    queryKey: subscriptionKeys.offerPayment(offerId || ''),
    queryFn: () => SubscriptionService.getOfferPaymentStatus(offerId!),
    enabled: !!offerId,
    staleTime: 30 * 1000, // 30 sec cache
    refetchInterval: 60 * 1000, // Poll every 60s for payment updates
  });
}
```

**Test-Kriterium:** `useSubscription()` returns data. `useCheckout` redirects to Stripe. `useOfferPaymentStatus('some-id')` returns status.

---

## Task 9: PricingTable Component

**Files:**
- Create: `src/components/billing/PricingTable.tsx`

- [ ] **Step 1: PricingTable implementieren**

```tsx
import React from 'react';
import { Check, Loader2, Zap, Crown, Building } from 'lucide-react';
import { useSubscriptionPlans, useCheckout, useSubscription } from '@/hooks/useSubscription';
import { PLAN_DISPLAY } from '@/types/subscription';
import { Button } from '@/components/ui/button';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  basic: <Zap className="h-6 w-6" />,
  pro: <Crown className="h-6 w-6" />,
  enterprise: <Building className="h-6 w-6" />,
};

const FEATURE_LABELS: Record<string, string> = {
  offers: 'Angebote erstellen',
  invoices: 'Rechnungen & Mahnungen',
  projects: 'Projektverwaltung',
  customers: 'Kundenverwaltung',
  time_tracking: 'Zeiterfassung',
  materials: 'Materialverwaltung',
  ai_estimation: 'KI-Schaetzungen',
  document_ocr: 'Dokumenten-OCR',
  delivery_notes: 'Lieferscheine',
  employee_management: 'Mitarbeiterverwaltung',
  datev_export: 'DATEV-Export',
  api_access: 'API-Zugang',
  priority_support: 'Prioritaets-Support',
  custom_branding: 'Eigenes Branding',
};

export function PricingTable() {
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: subscription } = useSubscription();
  const checkout = useCheckout();

  if (plansLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentSlug = subscription?.plan_slug || 'free';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {plans?.map((plan) => {
        const display = PLAN_DISPLAY[plan.slug] || PLAN_DISPLAY.basic;
        const isCurrent = currentSlug === plan.slug;
        const isPopular = plan.slug === 'pro';

        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-xl border-2 p-6 flex flex-col ${
              isPopular
                ? 'border-emerald-400 shadow-lg shadow-emerald-100'
                : 'border-slate-200'
            }`}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Beliebt
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${
                plan.slug === 'basic' ? 'bg-blue-100 text-blue-600' :
                plan.slug === 'pro' ? 'bg-emerald-100 text-emerald-600' :
                'bg-purple-100 text-purple-600'
              }`}>
                {PLAN_ICONS[plan.slug]}
              </div>
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
            </div>

            {/* Price */}
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-slate-900">
                {(plan.price_cents / 100).toFixed(0)}
              </span>
              <span className="text-slate-500 ml-1">EUR/Monat</span>
              {plan.trial_days > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  {plan.trial_days} Tage kostenlos testen
                </p>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1">
              {(plan.features as string[]).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    {FEATURE_LABELS[feature] || feature}
                  </span>
                </li>
              ))}
              {plan.max_employees && (
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">
                    Bis zu {plan.max_employees} Mitarbeiter
                  </span>
                </li>
              )}
              {!plan.max_employees && (
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">Unbegrenzte Mitarbeiter</span>
                </li>
              )}
            </ul>

            {/* CTA */}
            <Button
              onClick={() => checkout.mutate(plan.stripe_price_id)}
              disabled={isCurrent || checkout.isPending}
              variant={isPopular ? 'default' : 'outline'}
              className={`w-full ${isPopular ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            >
              {checkout.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isCurrent
                ? 'Aktueller Plan'
                : subscription?.is_active
                  ? 'Plan wechseln'
                  : 'Jetzt starten'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
```

**Test-Kriterium:** Component rendert 3 Pricing Cards mit korrekten Preisen, Features, und funktionierenden Checkout-Buttons.

---

## Task 10: SubscriptionManager Component

**Files:**
- Create: `src/components/billing/SubscriptionManager.tsx`

- [ ] **Step 1: SubscriptionManager implementieren**

```tsx
import React from 'react';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  useSubscription,
  usePortalSession,
  useIsSubscribed,
} from '@/hooks/useSubscription';
import { SUBSCRIPTION_STATUS_LABELS, PLAN_DISPLAY } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { PricingTable } from './PricingTable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function SubscriptionManager() {
  const { data: subscription, isLoading } = useSubscription();
  const { isSubscribed, isTrialing, daysRemaining } = useIsSubscribed();
  const portalSession = usePortalSession();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const planSlug = subscription?.plan_slug || 'free';
  const display = PLAN_DISPLAY[planSlug] || PLAN_DISPLAY.free;

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-500" />
              Aktuelles Abonnement
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                display.badge_color === 'blue' ? 'bg-blue-100 text-blue-700' :
                display.badge_color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                display.badge_color === 'purple' ? 'bg-purple-100 text-purple-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {display.name}
              </span>
              <span className="text-sm text-slate-500">
                {SUBSCRIPTION_STATUS_LABELS[subscription?.status || 'none']}
              </span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : subscription?.status === 'past_due' ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Clock className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Trial Banner */}
        {isTrialing && daysRemaining !== null && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <Clock className="h-4 w-4 inline mr-1" />
              Testphase: Noch <strong>{daysRemaining} Tage</strong> kostenlos.
              {daysRemaining <= 3 && ' Jetzt upgraden, um den Zugang zu behalten!'}
            </p>
          </div>
        )}

        {/* Past Due Banner */}
        {subscription?.status === 'past_due' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Zahlung fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode.
            </p>
          </div>
        )}

        {/* Period Info */}
        {subscription?.current_period_end && (
          <p className="mt-3 text-sm text-slate-500">
            Naechste Abrechnung: {format(new Date(subscription.current_period_end), 'dd. MMMM yyyy', { locale: de })}
            {subscription.cancel_at_period_end && (
              <span className="text-red-500 ml-2">(wird zum Ende des Zeitraums gekuendigt)</span>
            )}
          </p>
        )}

        {/* Manage Button */}
        {isSubscribed && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => portalSession.mutate()}
            disabled={portalSession.isPending}
          >
            {portalSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Abo verwalten
          </Button>
        )}
      </div>

      {/* Pricing Table */}
      {!isSubscribed && (
        <>
          <h2 className="text-xl font-bold text-slate-900 text-center">Plan waehlen</h2>
          <PricingTable />
        </>
      )}
    </div>
  );
}
```

**Test-Kriterium:** Shows current plan status, trial banner with countdown, and pricing table for non-subscribers.

---

## Task 11: PaymentButton Component fuer Angebote

**Files:**
- Create: `src/components/billing/PaymentButton.tsx`

- [ ] **Step 1: PaymentButton implementieren**

```tsx
import React from 'react';
import { CreditCard, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useOfferPaymentStatus } from '@/hooks/useSubscription';
import { PAYMENT_STATUS_LABELS } from '@/types/subscription';

interface PaymentButtonProps {
  offerId: string;
  offerStatus: string;
  grossTotal: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Payment button for the public offer view.
 * Shows "Jetzt bezahlen" if a payment link exists, or payment status.
 */
export function PaymentButton({ offerId, offerStatus, grossTotal }: PaymentButtonProps) {
  const { data: payment, isLoading } = useOfferPaymentStatus(offerId);

  // Only show for accepted offers
  if (offerStatus !== 'accepted') return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // Already paid
  if (payment?.status === 'paid') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-emerald-800">Zahlung eingegangen</h3>
        <p className="text-emerald-600 mt-1">
          {formatCurrency(grossTotal)} wurden erfolgreich bezahlt.
        </p>
      </div>
    );
  }

  // Payment link available
  if (payment?.has_payment_link && payment.payment_link_url) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 text-center">
          Angebot bezahlen
        </h3>
        <p className="text-sm text-slate-500 text-center mb-4">
          Betrag: <strong>{formatCurrency(grossTotal)}</strong>
        </p>
        <div className="flex justify-center">
          <a
            href={payment.payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-lg"
          >
            <CreditCard className="h-5 w-5" />
            Jetzt bezahlen
            <ExternalLink className="h-4 w-4 ml-1" />
          </a>
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">
          Sichere Zahlung ueber Stripe. Karte &amp; SEPA-Lastschrift moeglich.
        </p>
      </div>
    );
  }

  // No payment link yet - nothing to show on public view
  return null;
}
```

**Test-Kriterium:** Shows "Jetzt bezahlen" link wenn Payment Link existiert. Shows "Zahlung eingegangen" nach erfolgreicher Zahlung. Zeigt nichts fuer Angebote ohne Payment Link.

---

## Task 12: PublicOfferView erweitern — PaymentButton einbetten

**Files:**
- Modify: `src/pages/public/PublicOfferView.tsx`

- [ ] **Step 1: PaymentButton importieren und einbetten**

Fuege nach den bestehenden Action Buttons (Zeile ~342) den PaymentButton ein:

```tsx
// Am Anfang der Datei importieren:
import { PaymentButton } from '@/components/billing/PaymentButton';

// Nach dem Action-Buttons Block (nach Zeile ~342), VOR dem Footer:
{/* Payment Button - for accepted offers with payment links */}
{offer.status === 'accepted' && (
  <div className="mt-8">
    <PaymentButton
      offerId={offer.id}
      offerStatus={offer.status}
      grossTotal={offer.snapshot_gross_total || 0}
    />
  </div>
)}
```

HINWEIS: Die `get_public_offer` RPC Funktion muss `offer.id` zurueckgeben. Pruefe ob das bereits der Fall ist, sonst die RPC erweitern:

```sql
-- Falls id nicht im RPC-Ergebnis:
-- In get_public_offer, im RETURN jsonb_build_object(...) hinzufuegen:
-- 'id', v_offer.id,
```

- [ ] **Step 2: URL-Parameter fuer Zahlungserfolg**

```tsx
// Im PublicOfferView, nach useParams:
import { useParams, useSearchParams } from 'react-router-dom';

// In der Component:
const [searchParams] = useSearchParams();
const paymentSuccess = searchParams.get('payment') === 'success';

// Im JSX, vor den Action Buttons:
{paymentSuccess && (
  <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
    <h2 className="text-xl font-semibold text-emerald-800">Zahlung erfolgreich!</h2>
    <p className="text-emerald-600 mt-1">Vielen Dank fuer Ihre Zahlung. Sie erhalten in Kuerze eine Bestaetigung.</p>
  </div>
)}
```

**Test-Kriterium:** PublicOfferView zeigt "Jetzt bezahlen" Button fuer accepted Offers mit Payment Link. Nach Zahlung Erfolgs-Banner.

---

## Task 13: OfferModuleV2 erweitern — Zahlungslink erstellen

**Files:**
- Modify: `src/components/OfferModuleV2.tsx`

- [ ] **Step 1: Zahlungslink-Button fuer accepted Offers**

Im OfferModuleV2, in der Offer-Detail-Ansicht (wo Status angezeigt wird), fuege einen neuen Button hinzu fuer accepted Offers:

```tsx
// Import hinzufuegen:
import { useCreatePaymentLink, useOfferPaymentStatus } from '@/hooks/useSubscription';
import { CreditCard, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';

// Im Component, neben anderen Mutations:
const createPaymentLink = useCreatePaymentLink();

// Fuer das ausgewaehlte Offer:
const { data: paymentStatus } = useOfferPaymentStatus(
  selectedOffer?.status === 'accepted' ? selectedOffer?.id : undefined
);

// Im JSX, bei den Offer-Actions (neben Stornieren, PDF, etc.):
{selectedOffer?.status === 'accepted' && (
  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
      <CreditCard className="h-4 w-4" />
      Online-Zahlung
    </h4>

    {paymentStatus?.status === 'paid' ? (
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm font-medium">Bezahlt</span>
      </div>
    ) : paymentStatus?.has_payment_link ? (
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={paymentStatus.payment_link_url || ''}
          className="flex-1 text-xs bg-white border rounded px-2 py-1.5"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(paymentStatus.payment_link_url || '');
            toast({ title: 'Link kopiert!' });
          }}
          className="p-1.5 hover:bg-blue-100 rounded"
        >
          <Copy className="h-4 w-4 text-blue-600" />
        </button>
        <a
          href={paymentStatus.payment_link_url || ''}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-blue-100 rounded"
        >
          <ExternalLink className="h-4 w-4 text-blue-600" />
        </a>
      </div>
    ) : (
      <Button
        size="sm"
        variant="outline"
        onClick={() => createPaymentLink.mutate(selectedOffer.id)}
        disabled={createPaymentLink.isPending}
        className="text-blue-700 border-blue-300 hover:bg-blue-100"
      >
        {createPaymentLink.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CreditCard className="h-4 w-4 mr-2" />
        )}
        Zahlungslink erstellen
      </Button>
    )}
  </div>
)}
```

**Test-Kriterium:** Accepted Offers zeigen "Zahlungslink erstellen" Button. Nach Klick wird Link angezeigt + kopierbar. "Bezahlt"-Status nach erfolgreicher Zahlung.

---

## Task 14: App.tsx — Billing Route hinzufuegen

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Billing-Seite als Tab im Manager**

Da HandwerkOS den Manager unter `/manager2` als Haupt-Dashboard nutzt, soll Billing als Tab integriert werden. Falls ein eigener Route gewuenscht wird:

```tsx
// In App.tsx, bei den Route-Definitionen:
import { SubscriptionManager } from '@/components/billing/SubscriptionManager';

// Neue Route (optional, falls separate Seite gewuenscht):
<Route path="/billing" element={<SubscriptionManager />} />
```

Alternativ (empfohlen): In der IndexV2 Component einen neuen Tab "Abonnement" hinzufuegen, der `<SubscriptionManager />` rendert. Dies haengt von der Tab-Struktur in IndexV2 ab.

**Test-Kriterium:** Billing-Seite ist unter /billing erreichbar oder als Tab im Manager.

---

## Task 15: Env-Variablen + Secrets konfigurieren

**Files:**
- Modify: `supabase/functions/.env.example`
- Modify: `.env` (nicht committen!)

- [ ] **Step 1: .env.example aktualisieren**

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-signing-secret
```

- [ ] **Step 2: Supabase Secrets setzen**

```bash
# Fuer Production/Staging (Supabase Cloud):
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# Fuer lokale Entwicklung:
# In supabase/functions/.env:
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

- [ ] **Step 3: Stripe Plan IDs in DB aktualisieren**

Nachdem die Stripe Products/Prices erstellt wurden, die Placeholder-IDs in der DB aktualisieren:

```sql
UPDATE public.subscription_plans
SET stripe_product_id = 'prod_ACTUAL_ID', stripe_price_id = 'price_ACTUAL_ID'
WHERE slug = 'basic';

UPDATE public.subscription_plans
SET stripe_product_id = 'prod_ACTUAL_ID', stripe_price_id = 'price_ACTUAL_ID'
WHERE slug = 'pro';

UPDATE public.subscription_plans
SET stripe_product_id = 'prod_ACTUAL_ID', stripe_price_id = 'price_ACTUAL_ID'
WHERE slug = 'enterprise';
```

**Test-Kriterium:** Edge Functions koennen Stripe API aufrufen. Secrets sind nicht in Git.

---

## Task 16: End-to-End Testing

- [ ] **Step 1: Subscription Flow testen**

1. Stripe Test-Mode sicherstellen (sk_test_...)
2. PricingTable oeffnen
3. "Pro" Plan klicken -> Stripe Checkout oeffnet sich
4. Test-Karte verwenden: `4242 4242 4242 4242`, beliebiges Datum, CVC
5. Nach Checkout: Redirect zurueck zu HandwerkOS
6. Subscription-Status pruefen: `subscriptions`-Tabelle hat Eintrag mit `status: 'active'` oder `'trialing'`
7. SubscriptionManager zeigt korrekten Plan

- [ ] **Step 2: Offer Payment Flow testen**

1. Angebot erstellen und annehmen (status: accepted)
2. Im OfferModuleV2: "Zahlungslink erstellen" klicken
3. Link wird angezeigt und kopierbar
4. PublicOfferView oeffnen: "Jetzt bezahlen" Button sichtbar
5. Stripe Payment Link oeffnen, Test-Zahlung durchfuehren
6. Webhook verarbeitet: `offer_payments.status` = 'paid'
7. PublicOfferView zeigt "Zahlung eingegangen"

- [ ] **Step 3: Webhook testen mit Stripe CLI**

```bash
# Stripe CLI installieren: https://stripe.com/docs/stripe-cli
stripe listen --forward-to https://<project>.supabase.co/functions/v1/stripe-webhook

# In neuem Terminal: Test-Event senden
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger payment_intent.succeeded
```

- [ ] **Step 4: Edge Cases testen**

- Doppelter Webhook (Idempotency): Gleichen Event zweimal senden -> nur einmal verarbeitet
- Fehlgeschlagene Zahlung: `4000 0000 0000 0002` Test-Karte verwenden -> `past_due` Status
- Abo kuendigen via Portal -> `canceled` Status
- Offer Payment fuer nicht-accepted Offer -> Fehler 400

---

## Phase 3 Vorbereitung (P2 — Interfaces)

Die folgenden Interfaces bereiten Stripe Connect fuer Multi-Tenant vor. Noch nicht implementieren, aber die Datenstruktur beruecksichtigen:

```typescript
// Fuer spaeter in src/types/subscription.ts:
export interface StripeConnectAccount {
  company_id: string;
  stripe_account_id: string;         // acct_xxx
  onboarding_completed: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

// Spalte in subscriptions Tabelle (spaeter):
// stripe_connect_account_id TEXT  -- acct_xxx fuer Connect
```

Die Edge Functions sind bereits so strukturiert, dass sie spaeter um `Stripe-Account` Header und `transfer_data` erweitert werden koennen.

---

## Zusammenfassung der Reihenfolge

| # | Task | Abhaengigkeit | Geschaetzte Zeit |
|---|------|---------------|-----------------|
| 1 | DB Migration | - | 15 min |
| 2 | TypeScript Typen | - | 10 min |
| 3 | stripe-webhook Edge Function | Task 1 | 30 min |
| 4 | create-checkout Edge Function | Task 1 | 20 min |
| 5 | create-portal-session Edge Function | Task 1 | 15 min |
| 6 | create-payment-link Edge Function | Task 1 | 25 min |
| 7 | subscriptionService.ts | Task 2, 3-6 | 15 min |
| 8 | useSubscription Hook | Task 7 | 15 min |
| 9 | PricingTable Component | Task 8 | 20 min |
| 10 | SubscriptionManager Component | Task 8, 9 | 15 min |
| 11 | PaymentButton Component | Task 8 | 10 min |
| 12 | PublicOfferView erweitern | Task 11 | 10 min |
| 13 | OfferModuleV2 erweitern | Task 8 | 15 min |
| 14 | App.tsx Route | Task 10 | 5 min |
| 15 | Env-Variablen konfigurieren | Stripe Account | 10 min |
| 16 | E2E Testing | Alles | 30 min |

**Gesamtzeit:** ~4-5 Stunden

**Kritischer Pfad:** Task 1 (DB) -> Task 3 (Webhook) -> Task 4 (Checkout) -> Task 7 (Service) -> Task 8 (Hook) -> Task 9-13 (Components) -> Task 16 (E2E)

Tasks 1+2, Tasks 3+4+5+6, und Tasks 9+10+11 koennen jeweils parallel bearbeitet werden.

---

## Phase 2: Feature-Gating & Limit-Enforcement (TODO)

> **Status:** Noch nicht implementiert. Das Abo-System ist aktuell rein kosmetisch — Plaene werden angezeigt und Stripe-Zahlungen verarbeitet, aber keine Limits werden tatsaechlich durchgesetzt.

### Was fehlt

#### 1. Backend: RPC-Funktionen fuer Quota-Checks

Bevor ein Nutzer eine begrenzte Aktion ausfuehrt (Angebot erstellen, Projekt anlegen, Mitarbeiter einladen), muss eine Supabase RPC-Funktion pruefen, ob das Kontingent noch frei ist.

```sql
-- Beispiel: check_quota('offers_month') → boolean
CREATE OR REPLACE FUNCTION public.check_quota(quota_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_slug TEXT;
  v_company_id UUID;
  v_limit INT;
  v_used INT;
BEGIN
  -- Aktuellen Plan ermitteln
  SELECT s.plan_slug, s.company_id INTO v_plan_slug, v_company_id
  FROM subscriptions s WHERE s.company_id = auth.company_id() AND s.is_active = true;

  -- Limit aus subscription_plans holen
  -- Usage zaehlen (z.B. offers diesen Monat)
  -- RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Benoetigte Checks:
- `max_offers_month` — Angebote im aktuellen Monat zaehlen
- `max_projects` — Aktive Projekte zaehlen
- `max_employees` — Mitarbeiter der Firma zaehlen
- `storage_gb` — Genutzten Speicher in Supabase Storage berechnen

#### 2. Frontend: useFeatureAccess Hook in Module einbauen

Der Hook `useFeatureAccess(feature)` existiert bereits in `src/hooks/useSubscription.ts`, ist aber in keinem Modul verdrahtet.

Einzubauen in:
- **OfferModuleV2** — `useFeatureAccess('offers')` vor "Neues Angebot"
- **ProjectDetailView** — `useFeatureAccess('projects')` vor Projekt-Erstellung
- **Mitarbeiterverwaltung** — `useFeatureAccess('employee_management')` vor Einladung
- **KI-Angebotsassistent** — `useFeatureAccess('ai_estimation')`
- **Baustellendoku** — `useFeatureAccess('site_documentation')`
- **VDE-Pruefprotokolle** — `useFeatureAccess('vde_protocols')`
- **DATEV-Export** — `useFeatureAccess('datev_export')`

Pattern fuer Feature-Gate:
```tsx
const { hasAccess, isLoading } = useFeatureAccess('vde_protocols');

if (!hasAccess) {
  return <UpgradePrompt feature="VDE-Pruefprotokolle" requiredPlan="Meisterbetrieb" />;
}
```

#### 3. Echte Usage-Zahlen im SubscriptionManager

Die `UsageBar`-Komponente in `SubscriptionManager.tsx` zeigt aktuell `used={0}` fuer alle Werte. Muss durch echte Abfragen ersetzt werden:

```tsx
// Statt:
<UsageBar icon={FileText} label="Monatliche Angebote" used={0} max={limits.max_offers_month} />

// Real:
const { data: usage } = useUsageStats(); // Neuer Hook
<UsageBar icon={FileText} label="Monatliche Angebote" used={usage.offers_this_month} max={limits.max_offers_month} />
```

Neuer Hook `useUsageStats()` braucht eine RPC-Funktion die zaehlt:
- Angebote diesen Monat (`offers` WHERE `created_at` im aktuellen Monat)
- Aktive Projekte (`projects` WHERE `status != 'completed'`)
- Mitarbeiter (`employees` WHERE `company_id` = aktuelle Firma)
- Speicher (Supabase Storage API)

#### 4. UpgradePrompt Komponente

Einheitliche Komponente die angezeigt wird wenn ein Feature nicht im Plan enthalten ist:
- Zeigt welcher Plan benoetigt wird
- Direkter Link zum Upgrade (Checkout)
- Konsistentes Design ueber alle Module

#### 5. Speicher-Quota Tracking

Supabase Storage hat keine eingebaute Quota-Funktion. Optionen:
- **Storage-Trigger**: Bei jedem Upload die Groesse in einer `storage_usage` Tabelle tracken
- **Periodischer Cron**: Speicherverbrauch regelmaessig berechnen und cachen
- **Upload-Middleware**: In der Edge Function vor dem Upload pruefen

### Reihenfolge

| # | Task | Aufwand |
|---|------|---------|
| 1 | `check_quota()` RPC-Funktion + Tests | 2h |
| 2 | `useUsageStats()` Hook | 1h |
| 3 | UsageBar mit echten Zahlen | 30min |
| 4 | `UpgradePrompt` Komponente | 1h |
| 5 | Feature-Gates in alle Module einbauen | 2h |
| 6 | Storage-Quota Tracking | 2h |
| 7 | E2E Tests fuer Limit-Enforcement | 1.5h |

**Gesamtzeit:** ~10 Stunden
