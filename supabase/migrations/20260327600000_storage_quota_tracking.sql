-- ============================================================================
-- Phase 2, Task 6: Storage-Quota Tracking
-- Berechnet genutzten Speicher pro Company aus storage.objects
-- ============================================================================

-- Helper: Berechnet Speicherverbrauch in GB fuer eine Company
-- Supabase Storage legt Dateien in Buckets mit Pfad-Prefix ab
-- Konvention: bucket_id/company_id/... ODER owner in metadata
CREATE OR REPLACE FUNCTION public.get_storage_used_gb(p_company_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bytes BIGINT := 0;
  v_bucket_bytes BIGINT;
BEGIN
  -- Site-docs bucket: Pfad beginnt mit company_id
  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0) INTO v_bucket_bytes
  FROM storage.objects
  WHERE bucket_id = 'site-docs'
    AND name LIKE p_company_id::TEXT || '/%';
  v_bytes := v_bytes + v_bucket_bytes;

  -- Offer-attachments: Pfad beginnt mit company_id
  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0) INTO v_bucket_bytes
  FROM storage.objects
  WHERE bucket_id = 'offer-attachments'
    AND name LIKE p_company_id::TEXT || '/%';
  v_bytes := v_bytes + v_bucket_bytes;

  -- Project-files: Pfad beginnt mit company_id
  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0) INTO v_bucket_bytes
  FROM storage.objects
  WHERE bucket_id = 'project-files'
    AND name LIKE p_company_id::TEXT || '/%';
  v_bytes := v_bytes + v_bucket_bytes;

  -- Bytes -> GB (gerundet auf 2 Nachkommastellen)
  RETURN ROUND(v_bytes::NUMERIC / (1024 * 1024 * 1024), 2);
END;
$$;

-- get_usage_stats() aktualisieren mit echtem Storage-Wert
CREATE OR REPLACE FUNCTION public.get_usage_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offers_month INT;
  v_projects INT;
  v_employees INT;
  v_storage_gb NUMERIC;
BEGIN
  SELECT COUNT(*)::INT INTO v_offers_month
  FROM public.offers
  WHERE company_id = p_company_id
    AND created_at >= DATE_TRUNC('month', NOW())
    AND status != 'draft';

  SELECT COUNT(*)::INT INTO v_projects
  FROM public.projects
  WHERE company_id = p_company_id
    AND status NOT IN ('completed', 'cancelled');

  SELECT COUNT(*)::INT INTO v_employees
  FROM public.employees
  WHERE company_id = p_company_id
    AND status = 'aktiv';

  -- Echten Storage berechnen
  v_storage_gb := public.get_storage_used_gb(p_company_id);

  RETURN jsonb_build_object(
    'offers_this_month', v_offers_month,
    'active_projects',   v_projects,
    'active_employees',  v_employees,
    'storage_used_gb',   v_storage_gb
  );
END;
$$;

-- check_quota() Storage-Check aktualisieren
CREATE OR REPLACE FUNCTION public.check_quota(p_company_id UUID, p_quota_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_sub  subscriptions%ROWTYPE;
  v_used INT;
  v_storage_used NUMERIC;
BEGIN
  SELECT s.* INTO v_sub
  FROM public.subscriptions s
  WHERE s.company_id = p_company_id
    AND s.status IN ('trialing', 'active');

  IF NOT FOUND OR v_sub.plan_id IS NULL THEN
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
      WHEN 'storage' THEN
        v_storage_used := public.get_storage_used_gb(p_company_id);
        RETURN v_storage_used < 0.5; -- Free-Tier: 0.5 GB
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  SELECT sp.* INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_sub.plan_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  CASE p_quota_key
    WHEN 'offers_month' THEN
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
      IF v_plan.storage_gb IS NULL THEN RETURN TRUE; END IF;
      v_storage_used := public.get_storage_used_gb(p_company_id);
      RETURN v_storage_used < v_plan.storage_gb;

    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;
