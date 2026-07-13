-- Carry accepted offer targets into the created project baseline.
-- This keeps the current projects schema and stores detailed target markers in description.

CREATE OR REPLACE FUNCTION public.accept_offer_and_create_project(
  p_offer_id UUID,
  p_accepted_by TEXT DEFAULT NULL,
  p_acceptance_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_targets public.offer_targets%ROWTYPE;
  v_project_id UUID;
  v_budget NUMERIC;
  v_description TEXT;
BEGIN
  SELECT * INTO v_offer
  FROM public.offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden';
  END IF;

  IF v_offer.status = 'accepted' AND v_offer.project_id IS NOT NULL THEN
    RETURN v_offer.project_id;
  END IF;

  IF v_offer.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Nur Entwürfe oder versendete Angebote können angenommen werden';
  END IF;

  IF v_offer.valid_until IS NOT NULL AND v_offer.valid_until::date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Angebot ist abgelaufen';
  END IF;

  SELECT * INTO v_targets
  FROM public.offer_targets
  WHERE offer_id = p_offer_id
  LIMIT 1;

  v_project_id := gen_random_uuid();
  v_budget := COALESCE(v_offer.snapshot_net_total, v_targets.snapshot_target_revenue);
  v_description := CONCAT_WS(
    E'\n',
    'Erstellt aus Angebot ' || v_offer.offer_number,
    'accepted_offer_id: ' || v_offer.id::TEXT,
    CASE WHEN v_targets.planned_hours_total IS NOT NULL
      THEN 'planned_hours: ' || v_targets.planned_hours_total::TEXT
    END,
    CASE WHEN v_targets.planned_material_cost_total IS NOT NULL
      THEN 'planned_material_cost: ' || v_targets.planned_material_cost_total::TEXT
    END,
    CASE WHEN v_targets.planned_other_cost IS NOT NULL
      THEN 'planned_other_cost: ' || v_targets.planned_other_cost::TEXT
    END,
    CASE WHEN v_targets.snapshot_target_margin IS NOT NULL
      THEN 'target_margin: ' || v_targets.snapshot_target_margin::TEXT
    END,
    CASE WHEN v_targets.snapshot_target_cost IS NOT NULL
      THEN 'target_cost: ' || v_targets.snapshot_target_cost::TEXT
    END,
    CASE WHEN v_budget IS NOT NULL
      THEN 'target_revenue: ' || v_budget::TEXT
    END
  );

  INSERT INTO public.projects (
    id,
    company_id,
    customer_id,
    name,
    status,
    description,
    budget,
    location,
    start_date,
    end_date,
    work_start_date,
    work_end_date,
    workflow_origin_type,
    workflow_origin_id
  )
  VALUES (
    v_project_id,
    v_offer.company_id,
    v_offer.customer_id,
    v_offer.project_name,
    'beauftragt',
    v_description,
    v_budget,
    v_offer.project_location,
    v_targets.target_start_date,
    v_targets.target_end_date,
    v_targets.target_start_date,
    v_targets.target_end_date,
    'offer',
    v_offer.id
  );

  UPDATE public.offers
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = p_accepted_by,
      acceptance_note = p_acceptance_note,
      is_locked = true,
      project_id = v_project_id,
      updated_at = NOW()
  WHERE id = v_offer.id;

  RETURN v_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_offer_and_create_project(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_public_offer(p_token UUID, p_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_targets public.offer_targets%ROWTYPE;
  v_project_id UUID;
  v_budget NUMERIC;
  v_description TEXT;
BEGIN
  SELECT * INTO v_offer
  FROM public.offers
  WHERE share_token = p_token AND status = 'sent'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder bereits bearbeitet';
  END IF;

  IF v_offer.valid_until IS NOT NULL AND v_offer.valid_until::date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Angebot ist abgelaufen';
  END IF;

  SELECT * INTO v_targets
  FROM public.offer_targets
  WHERE offer_id = v_offer.id
  LIMIT 1;

  v_project_id := gen_random_uuid();
  v_budget := COALESCE(v_offer.snapshot_net_total, v_targets.snapshot_target_revenue);
  v_description := CONCAT_WS(
    E'\n',
    'Erstellt aus Angebot ' || v_offer.offer_number,
    'accepted_offer_id: ' || v_offer.id::TEXT,
    CASE WHEN v_targets.planned_hours_total IS NOT NULL
      THEN 'planned_hours: ' || v_targets.planned_hours_total::TEXT
    END,
    CASE WHEN v_targets.planned_material_cost_total IS NOT NULL
      THEN 'planned_material_cost: ' || v_targets.planned_material_cost_total::TEXT
    END,
    CASE WHEN v_targets.planned_other_cost IS NOT NULL
      THEN 'planned_other_cost: ' || v_targets.planned_other_cost::TEXT
    END,
    CASE WHEN v_targets.snapshot_target_margin IS NOT NULL
      THEN 'target_margin: ' || v_targets.snapshot_target_margin::TEXT
    END,
    CASE WHEN v_targets.snapshot_target_cost IS NOT NULL
      THEN 'target_cost: ' || v_targets.snapshot_target_cost::TEXT
    END,
    CASE WHEN v_budget IS NOT NULL
      THEN 'target_revenue: ' || v_budget::TEXT
    END
  );

  INSERT INTO public.projects (
    id,
    company_id,
    customer_id,
    name,
    status,
    description,
    budget,
    location,
    start_date,
    end_date,
    work_start_date,
    work_end_date,
    workflow_origin_type,
    workflow_origin_id
  )
  VALUES (
    v_project_id,
    v_offer.company_id,
    v_offer.customer_id,
    v_offer.project_name,
    'beauftragt',
    v_description,
    v_budget,
    v_offer.project_location,
    v_targets.target_start_date,
    v_targets.target_end_date,
    v_targets.target_start_date,
    v_targets.target_end_date,
    'offer',
    v_offer.id
  );

  UPDATE public.offers
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = COALESCE(p_name, v_offer.customer_name),
      is_locked = true,
      project_id = v_project_id,
      updated_at = NOW()
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Angebot angenommen',
    'project_id', v_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_public_offer(UUID, TEXT) TO anon;
