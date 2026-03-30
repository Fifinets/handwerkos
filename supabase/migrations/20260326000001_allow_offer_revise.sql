-- Allow offers to be revised (sent/rejected → draft)
-- Angebote sind keine GoBD-relevanten Dokumente (nur Rechnungen, Buchungsbelege, Gutschriften)

-- 1. Update the main offer immutability trigger to allow revise flow
CREATE OR REPLACE FUNCTION public.prevent_locked_offer_updates() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Allow revise: sent/rejected → draft (with is_locked being set to false)
    IF (OLD.status IN ('sent', 'rejected') AND NEW.status = 'draft' AND NEW.is_locked = false) THEN
      RETURN NEW;
    END IF;

    IF OLD.is_locked = true OR OLD.status IN ('sent', 'accepted', 'rejected') THEN
      -- Prevent downgrade to draft (except revise flow handled above)
      IF NEW.status NOT IN ('sent', 'accepted', 'rejected', 'cancelled') THEN
         RAISE EXCEPTION 'GoBD Compliance Violation: Cannot revert a finalized offer to draft.';
      END IF;

      -- Prevent core field modifications while allowing status updates
      IF NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
         NEW.project_name IS DISTINCT FROM OLD.project_name OR
         NEW.snapshot_net_total IS DISTINCT FROM OLD.snapshot_net_total OR
         NEW.snapshot_gross_total IS DISTINCT FROM OLD.snapshot_gross_total OR
         NEW.offer_date IS DISTINCT FROM OLD.offer_date OR
         NEW.payment_terms IS DISTINCT FROM OLD.payment_terms OR
         NEW.notes IS DISTINCT FROM OLD.notes
      THEN
         RAISE EXCEPTION 'GoBD Compliance Violation: Cannot modify core data of a finalized offer.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked = true OR OLD.status IN ('sent', 'accepted', 'rejected') THEN
       RAISE EXCEPTION 'GoBD Compliance Violation: Cannot delete a locked or finalized offer. Flag it as cancelled instead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update offer_items trigger: check is_locked first (draft offers with is_locked=false are editable)
CREATE OR REPLACE FUNCTION public.prevent_locked_offer_items_updates() RETURNS TRIGGER AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT is_locked, status INTO v_is_locked, v_status
    FROM public.offers
    WHERE id = OLD.offer_id;

    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Cannot modify items of a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT is_locked, status INTO v_is_locked, v_status
    FROM public.offers
    WHERE id = NEW.offer_id;

    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Cannot add items to a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update offer_targets trigger: same logic
CREATE OR REPLACE FUNCTION public.prevent_locked_offer_targets_updates() RETURNS TRIGGER AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT is_locked, status INTO v_is_locked, v_status
    FROM public.offers
    WHERE id = OLD.offer_id;

    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Cannot modify targets of a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT is_locked, status INTO v_is_locked, v_status
    FROM public.offers
    WHERE id = NEW.offer_id;

    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Cannot add targets to a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
