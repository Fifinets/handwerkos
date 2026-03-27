-- ============================================================================
-- Stripe Payment Integration: Subscription + Payment Tables
-- ============================================================================

-- 1. Subscription Plans (Produkt-Katalog)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  interval TEXT NOT NULL DEFAULT 'month',
  trial_days INTEGER NOT NULL DEFAULT 14,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_employees INTEGER,
  max_projects INTEGER,
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
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- 3. Payment Events (Webhook-Log, idempotency)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
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
  stripe_payment_link_id TEXT,
  stripe_payment_link_url TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payment_method_type TEXT,
  customer_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_payment_events_type ON public.payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_id ON public.payment_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_offer_payments_offer ON public.offer_payments(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_payments_company ON public.offer_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_offer_payments_status ON public.offer_payments(status);

-- RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_all" ON public.subscription_plans
  FOR SELECT USING (true);

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "offer_payments_select_own" ON public.offer_payments
  FOR SELECT USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Helper: Get company subscription
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
    RETURN jsonb_build_object(
      'status', 'none',
      'plan_slug', 'free',
      'plan_name', 'Kostenlos',
      'is_active', true,
      'features', '[]'::jsonb
    );
  END IF;

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

-- Helper: Get offer payment status
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

-- Seed: Default Plans (PLACEHOLDERs — update with real Stripe IDs later)
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
