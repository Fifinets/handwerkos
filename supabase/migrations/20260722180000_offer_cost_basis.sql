-- Soll-Kostenbasis: Spalte, autoritative Berechnungsfunktion, Freeze-Trigger.
-- Siehe docs/superpowers/specs/2026-07-22-soll-kostenbasis-design.md

-- 1. Reproduzierbarkeit des eingefrorenen Kostensatzes
ALTER TABLE public.offer_targets
  ADD COLUMN IF NOT EXISTS cost_rate_snapshot NUMERIC;
COMMENT ON COLUMN public.offer_targets.cost_rate_snapshot IS
  'Interner Vollkosten-Stundensatz (amge_calculations.lohn_mit_agk) zum Einfrierzeitpunkt.';

-- 1b. Ein Angebot hat genau eine Zielzeile. Bisher gab es nur den Primary Key
--     auf id — ohne UNIQUE(offer_id) scheitert das ON CONFLICT im Freeze-Trigger
--     unten zur Laufzeit. Tabelle ist leer, der Constraint greift ohne Backfill.
ALTER TABLE public.offer_targets
  DROP CONSTRAINT IF EXISTS offer_targets_offer_id_key;
ALTER TABLE public.offer_targets
  ADD CONSTRAINT offer_targets_offer_id_key UNIQUE (offer_id);

-- 2. Einzige autoritative Quelle der Soll-Zahlen eines Angebots.
CREATE OR REPLACE FUNCTION public.get_offer_cost_basis(p_offer_id UUID)
RETURNS TABLE (
  revenue      NUMERIC,
  cost         NUMERIC,
  margin_pct   NUMERIC,
  cost_rate    NUMERIC,
  is_complete  BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_rate       NUMERIC;
  v_revenue    NUMERIC;
  v_cost       NUMERIC;
  v_complete   BOOLEAN;
BEGIN
  SELECT company_id INTO v_company_id FROM public.offers WHERE id = p_offer_id;

  SELECT a.lohn_mit_agk INTO v_rate
  FROM public.amge_calculations a
  WHERE a.company_id = v_company_id AND a.is_active
    AND (a.valid_from IS NULL OR a.valid_from <= CURRENT_DATE)
    AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
  ORDER BY a.valid_from DESC NULLS LAST
  LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT default_hourly_rate INTO v_rate
    FROM public.company_ai_settings WHERE company_id = v_company_id LIMIT 1;
  END IF;

  SELECT
    COALESCE(SUM(oi.quantity * oi.unit_price_net), 0),
    SUM(COALESCE(oi.planned_hours_item, 0) * COALESCE(v_rate, 0)
        + COALESCE(oi.material_purchase_cost, 0)),
    bool_and(oi.planned_hours_item IS NOT NULL OR oi.material_purchase_cost IS NOT NULL)
  INTO v_revenue, v_cost, v_complete
  FROM public.offer_items oi
  WHERE oi.offer_id = p_offer_id;

  IF v_rate IS NULL THEN
    v_complete := false;
  END IF;

  v_complete := COALESCE(v_complete, false);

  revenue     := v_revenue;
  cost        := CASE WHEN v_complete THEN v_cost ELSE NULL END;
  margin_pct  := CASE WHEN v_complete AND v_revenue > 0
                      THEN round((v_revenue - v_cost) / v_revenue * 100, 2) ELSE NULL END;
  cost_rate   := CASE WHEN v_complete THEN v_rate ELSE NULL END;
  is_complete := v_complete;
  RETURN NEXT;
END;
$$;

-- 3. Freeze-Trigger: friert die Soll-Werte beim Übergang draft->sent/accepted
--    in offer_targets ein. Trifft beide Versandpfade. Ueberschreibt einen
--    bestehenden Snapshot NICHT.
CREATE OR REPLACE FUNCTION public.freeze_offer_target_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_basis RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft'
     AND NEW.status IN ('sent', 'accepted') THEN

    SELECT * INTO v_basis FROM public.get_offer_cost_basis(NEW.id);

    INSERT INTO public.offer_targets (offer_id)
    VALUES (NEW.id)
    ON CONFLICT (offer_id) DO NOTHING;

    UPDATE public.offer_targets ot
    SET snapshot_target_revenue = v_basis.revenue,
        snapshot_target_cost    = v_basis.cost,
        snapshot_target_margin  = v_basis.margin_pct,
        cost_rate_snapshot      = v_basis.cost_rate,
        snapshot_created_at     = NOW(),
        updated_at              = NOW()
    WHERE ot.offer_id = NEW.id
      AND ot.snapshot_created_at IS NULL;

    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_offer_target_snapshot_trigger ON public.offers;
CREATE TRIGGER freeze_offer_target_snapshot_trigger
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_offer_target_snapshot();
