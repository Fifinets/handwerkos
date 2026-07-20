-- P0.1: split projects.status into a canonical lifecycle status and a workflow stage.
--
-- Problem
-- -------
-- Four competing definitions of projects.status existed side by side:
--   * docs/ARCHITECTURE_RULES.md  : planned / active / completed / cancelled
--   * src/types/core.ts           : ten German values
--   * src/types/project.ts        : six German values (WORKFLOW_STAGES)
--   * src/types/legacy-migration.ts: a five-value mapping including 'blocked'
-- The database enforced none of them — there was no CHECK constraint at all —
-- and held German values ('anfrage', 'beauftragt', 'in_bearbeitung'). Service
-- code compensated by accepting both languages at every comparison, e.g.
-- projectService.ts: status !== 'planned' && status !== 'beauftragt'.
--
-- Why not simply collapse to four values
-- --------------------------------------
-- The German values carry more information than the canonical four. 'besichtigung'
-- is backed by real columns (besichtigung_date, besichtigung_employee_id,
-- besichtigung_calendar_event_id) and WORKFLOW_STAGES drives the progress bar in
-- ProjectDetailView. Folding ten values into four would silently delete that.
--
-- Solution
-- --------
-- Two orthogonal columns:
--   status         — lifecycle, canonical and constrained, used for filters,
--                    KPIs and automation
--   workflow_stage — the operational stage inside the lifecycle, English,
--                    constrained, used for the workflow board
-- German remains a pure UI concern (src/lib/projectStatus.ts).
--
-- Cancelled projects keep workflow_stage NULL: the stage they were in when they
-- were cancelled is not recorded anywhere, and inventing one would be wrong.

-- ---------------------------------------------------------------------------
-- 1. New column, unconstrained for now so the backfill can run.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT;

COMMENT ON COLUMN public.projects.workflow_stage IS
  'Operative Stufe innerhalb des Lebenszyklus. NULL bei stornierten Projekten.';

COMMENT ON COLUMN public.projects.status IS
  'Kanonischer Lebenszyklus: planned/active/completed/cancelled. Deutsche Bezeichnungen nur in der UI.';

-- ---------------------------------------------------------------------------
-- 2. Backfill: derive both columns from whatever the row currently holds.
--    Covers the German values, the partially migrated English ones, and the
--    stray 'blocked' from legacy-migration.ts.
-- ---------------------------------------------------------------------------
UPDATE public.projects
SET workflow_stage = CASE status
      WHEN 'anfrage'           THEN 'inquiry'
      WHEN 'besichtigung'      THEN 'site_visit'
      WHEN 'angebot'           THEN 'quoted'
      WHEN 'angebot_versendet' THEN 'quoted'
      WHEN 'beauftragt'        THEN 'ordered'
      WHEN 'in_planung'        THEN 'ordered'
      WHEN 'in_bearbeitung'    THEN 'in_progress'
      WHEN 'abnahme'           THEN 'acceptance'
      WHEN 'abgeschlossen'     THEN 'done'
      WHEN 'storniert'         THEN NULL
      -- already-canonical rows: pick the stage that matches the lifecycle
      WHEN 'planned'           THEN 'ordered'
      WHEN 'active'            THEN 'in_progress'
      WHEN 'blocked'           THEN 'in_progress'
      WHEN 'completed'         THEN 'done'
      WHEN 'cancelled'         THEN NULL
      ELSE 'inquiry'
    END
WHERE workflow_stage IS NULL;

UPDATE public.projects
SET status = CASE status
      WHEN 'anfrage'           THEN 'planned'
      WHEN 'besichtigung'      THEN 'planned'
      WHEN 'angebot'           THEN 'planned'
      WHEN 'angebot_versendet' THEN 'planned'
      WHEN 'beauftragt'        THEN 'planned'
      WHEN 'in_planung'        THEN 'planned'
      WHEN 'in_bearbeitung'    THEN 'active'
      WHEN 'abnahme'           THEN 'active'
      WHEN 'abgeschlossen'     THEN 'completed'
      WHEN 'storniert'         THEN 'cancelled'
      WHEN 'blocked'           THEN 'active'
      ELSE status
    END
WHERE status NOT IN ('planned', 'active', 'completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- 3. Enforce both sets in the database — this is what was missing entirely.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planned', 'active', 'completed', 'cancelled'));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_workflow_stage_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_workflow_stage_check
  CHECK (
    workflow_stage IS NULL
    OR workflow_stage IN (
      'inquiry', 'site_visit', 'quoted', 'ordered',
      'in_progress', 'acceptance', 'done'
    )
  );

-- A cancelled project has no stage; anything else must have one.
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_stage_requires_status;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_stage_requires_status
  CHECK (
    (status = 'cancelled' AND workflow_stage IS NULL)
    OR (status <> 'cancelled' AND workflow_stage IS NOT NULL)
  );

ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'planned';

-- ---------------------------------------------------------------------------
-- 4. The offer acceptance RPCs wrote the German 'beauftragt' and would now
--    violate the constraint. Both are recreated with the canonical pair.
--    Only the two status lines change; the rest matches the live definition
--    applied as 20260720204529.
-- ---------------------------------------------------------------------------
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
