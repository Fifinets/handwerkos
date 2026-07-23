-- accept_offer_and_create_project ohne Freitext-Marker in project.description.
-- Siehe docs/superpowers/specs/2026-07-22-soll-kostenbasis-design.md, Abschnitt 5.
-- Basis ist die Live-Definition (kanonisches Statusmodell, planned/ordered);
-- geaendert wurde ausschliesslich die Belegung von v_description.
-- Geprueft: kein Code liest diese Marker (die anderen description-Marker
-- [PRECALC:] und [BUDGET:] stammen aus anderem Code und bleiben unberuehrt).

CREATE OR REPLACE FUNCTION public.accept_offer_and_create_project(p_offer_id uuid, p_accepted_by text DEFAULT NULL::text, p_acceptance_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Nur eine menschenlesbare Herkunftszeile. Die Planwerte standen hier
  -- frueher als Freitext-Marker ('planned_hours: 12' usw.) — als Soll-Basis
  -- unbrauchbar und laut ARCHITECTURE_RULES unzulaessig (Magic-Strings in
  -- Freitextfeldern). Massgeblich ist jetzt der eingefrorene
  -- offer_targets-Snapshot, erreichbar ueber offers.project_id.
  v_description := 'Erstellt aus Angebot ' || v_offer.offer_number;

  INSERT INTO public.projects (
    id, company_id, customer_id, name, status, workflow_stage, description,
    budget, location, start_date, end_date, work_start_date, work_end_date,
    workflow_origin_type, workflow_origin_id
  )
  VALUES (
    v_project_id,
    v_offer.company_id,
    v_offer.customer_id,
    v_offer.project_name,
    'planned',
    'ordered',
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
$function$;
