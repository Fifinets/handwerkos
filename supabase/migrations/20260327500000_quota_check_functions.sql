-- ============================================================================
-- Phase 2: Feature-Gating — Quota Check + Usage Stats RPC Functions
-- ============================================================================

-- 1. Fehlende Spalten in subscription_plans hinzufuegen
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_offers_month INTEGER,
  ADD COLUMN IF NOT EXISTS storage_gb NUMERIC(5,1);

-- 2. Bestehende Plaene aktualisieren
UPDATE public.subscription_plans SET max_offers_month = 30,  storage_gb = 5    WHERE slug = 'basic';
UPDATE public.subscription_plans SET max_offers_month = NULL, storage_gb = 15   WHERE slug = 'pro';
UPDATE public.subscription_plans SET max_offers_month = NULL, storage_gb = 50   WHERE slug = 'enterprise';

-- ============================================================================
-- 3. get_usage_stats() — Liefert aktuelle Nutzungszahlen fuer eine Company
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_usage_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offers_month INT;
  v_projects INT;
  v_employees INT;
BEGIN
  -- Angebote im aktuellen Monat (nicht-Draft)
  SELECT COUNT(*)::INT INTO v_offers_month
  FROM public.offers
  WHERE company_id = p_company_id
    AND created_at >= DATE_TRUNC('month', NOW())
    AND status != 'draft';

  -- Aktive Projekte (nicht completed/cancelled)
  SELECT COUNT(*)::INT INTO v_projects
  FROM public.projects
  WHERE company_id = p_company_id
    AND status NOT IN ('completed', 'cancelled');

  -- Aktive Mitarbeiter
  SELECT COUNT(*)::INT INTO v_employees
  FROM public.employees
  WHERE company_id = p_company_id
    AND status = 'aktiv';

  RETURN jsonb_build_object(
    'offers_this_month', v_offers_month,
    'active_projects',   v_projects,
    'active_employees',  v_employees,
    'storage_used_gb',   0  -- Placeholder, Supabase Storage hat keine native Quota-API
  );
END;
$$;

-- ============================================================================
-- 4. check_quota() — Prueft ob eine Company ein bestimmtes Kontingent noch frei hat
--    Gibt TRUE zurueck wenn Aktion erlaubt, FALSE wenn Limit erreicht
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_quota(p_company_id UUID, p_quota_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_sub  subscriptions%ROWTYPE;
  v_used INT;
  v_limit INT;
BEGIN
  -- Aktives Abo laden
  SELECT s.* INTO v_sub
  FROM public.subscriptions s
  WHERE s.company_id = p_company_id
    AND s.status IN ('trialing', 'active');

  -- Kein aktives Abo = Free-Tier Limits
  IF NOT FOUND OR v_sub.plan_id IS NULL THEN
    -- Free-Tier: 3 Angebote/Monat, 2 Projekte, 1 Mitarbeiter
    CASE p_quota_key
      WHEN 'offers_month' THEN
        SELECT COUNT(*)::INT INTO v_used FROM public.offers
        WHERE company_id = p_company_id AND created_at >= DATE_TRUNC('month', NOW()) AND status != 'draft';
        RETURN v_used < 3;
      WHEN 'projects' THEN
        SELECT COUNT(*)::INT INTO v_used FROM public.projects
        WHERE company_id = p_company_id AND status NOT IN ('completed', 'cancelled');
        RETURN v_used < 2;
      WHEN 'employees' THEN
        SELECT COUNT(*)::INT INTO v_used FROM public.employees
        WHERE company_id = p_company_id AND status = 'aktiv';
        RETURN v_used < 1;
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  -- Plan laden
  SELECT sp.* INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_sub.plan_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Quota pruefen je nach Key
  CASE p_quota_key
    WHEN 'offers_month' THEN
      -- NULL = unbegrenzt
      IF v_plan.max_offers_month IS NULL THEN RETURN TRUE; END IF;
      SELECT COUNT(*)::INT INTO v_used FROM public.offers
      WHERE company_id = p_company_id AND created_at >= DATE_TRUNC('month', NOW()) AND status != 'draft';
      RETURN v_used < v_plan.max_offers_month;

    WHEN 'projects' THEN
      IF v_plan.max_projects IS NULL THEN RETURN TRUE; END IF;
      SELECT COUNT(*)::INT INTO v_used FROM public.projects
      WHERE company_id = p_company_id AND status NOT IN ('completed', 'cancelled');
      RETURN v_used < v_plan.max_projects;

    WHEN 'employees' THEN
      IF v_plan.max_employees IS NULL THEN RETURN TRUE; END IF;
      SELECT COUNT(*)::INT INTO v_used FROM public.employees
      WHERE company_id = p_company_id AND status = 'aktiv';
      RETURN v_used < v_plan.max_employees;

    WHEN 'storage' THEN
      -- Storage-Check ist Placeholder — Supabase Storage hat keine native Size-API
      IF v_plan.storage_gb IS NULL THEN RETURN TRUE; END IF;
      RETURN TRUE; -- TODO: Implementierung mit storage_usage Tabelle

    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- ============================================================================
-- 5. get_company_subscription() aktualisieren — max_offers_month + storage_gb einschliessen
-- ============================================================================

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
      'features', '[]'::jsonb,
      'max_employees', 1,
      'max_projects', 2,
      'max_offers_month', 3,
      'storage_gb', 0.5
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
    'max_projects', v_plan.max_projects,
    'max_offers_month', v_plan.max_offers_month,
    'storage_gb', v_plan.storage_gb
  );
END;
$$;
