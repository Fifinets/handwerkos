-- Gapless GoBD-compliant offer numbering
-- Reactivates the existing number_sequences infrastructure instead of adding a parallel system.
--
-- Context:
-- * 20250813120001 introduced number_sequences + get_next_number() (atomic via SELECT ... FOR UPDATE,
--   SECURITY DEFINER).
-- * 20260224194000 wired offers to it: assign_offer_number_trigger assigns a real sequential number
--   on the draft -> sent/accepted transition, but only when the offer still carries a draft marker
--   ('ENTWURF-%', NULL or '').
-- * 20260305172000 regressed create_offer_with_targets back to random numbers
--   ('ANG-' || YYYYMMDD || '-' || floor(random()*1000)), so the trigger condition never matched
--   and sent offers kept their random (collision-prone, non-gapless) numbers forever.
--
-- This migration:
-- 1. Makes number_sequences actually usable per company (multi-tenant): drops the leftover
--    single-column UNIQUE(sequence_name) constraint, which made every per-company INSERT in
--    get_next_number fail with a unique violation.
-- 2. Fixes get_next_number to inherit prefix/year_reset/format_pattern from the global template
--    row (company_id IS NULL) when creating a company-scoped sequence. Without this a fresh
--    per-company row would use the column defaults (prefix '') and produce numbers like '-2026-0001'.
-- 3. Extends assign_offer_document_number() to also renumber legacy agent drafts ('KI-%')
--    on their first send.
-- 4. Restores the draft marker ('ENTWURF-...') in create_offer_with_targets. Only that one line
--    changes; the rest of the function matches the live definition (verified against remote DB).
--
-- 5. Backfills never-sent drafts that still carry a legacy random number so they, too,
--    get a real number on their first send.
--
-- GoBD: numbers of already sent/finalized offers are NOT migrated or changed. Only the
-- draft -> sent/accepted transition assigns a number, exactly once.

-- ---------------------------------------------------------------------------
-- 1. Multi-tenant number sequences: drop leftover global unique on sequence_name.
--    Per-company rows are still guarded by UNIQUE (sequence_name, company_id).
-- ---------------------------------------------------------------------------
ALTER TABLE public.number_sequences
  DROP CONSTRAINT IF EXISTS number_sequences_sequence_name_key;

-- ---------------------------------------------------------------------------
-- 2. get_next_number: inherit template settings on first per-company use
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_number(
  seq_name TEXT,
  comp_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  seq_record RECORD;
  next_number INTEGER;
  formatted_number TEXT;
  v_prefix TEXT;
  v_year_reset BOOLEAN;
  v_format_pattern TEXT;
BEGIN
  -- Get or create sequence record
  SELECT * INTO seq_record
  FROM public.number_sequences
  WHERE sequence_name = seq_name
    AND (company_id = comp_id OR (company_id IS NULL AND comp_id IS NULL))
  FOR UPDATE;

  -- Create sequence if it doesn't exist, inheriting prefix/format from the
  -- global template row (company_id IS NULL) so per-company numbers keep the
  -- intended format (e.g. 'ANG-2026-0001' instead of '-2026-0001').
  IF NOT FOUND THEN
    SELECT prefix, year_reset, format_pattern
      INTO v_prefix, v_year_reset, v_format_pattern
    FROM public.number_sequences
    WHERE sequence_name = seq_name AND company_id IS NULL
    LIMIT 1;

    INSERT INTO public.number_sequences (
      sequence_name, current_value, company_id, last_reset_year,
      prefix, year_reset, format_pattern
    )
    VALUES (
      seq_name, 0, comp_id, current_year,
      COALESCE(v_prefix, ''),
      COALESCE(v_year_reset, true),
      COALESCE(v_format_pattern, '{prefix}-{year}-{number:04d}')
    )
    RETURNING * INTO seq_record;
  END IF;

  -- Reset counter if year changed and year_reset is enabled
  IF seq_record.year_reset AND (seq_record.last_reset_year IS NULL OR seq_record.last_reset_year < current_year) THEN
    next_number := 1;
    UPDATE public.number_sequences
    SET current_value = next_number, last_reset_year = current_year, updated_at = NOW()
    WHERE id = seq_record.id;
  ELSE
    next_number := seq_record.current_value + 1;
    UPDATE public.number_sequences
    SET current_value = next_number, updated_at = NOW()
    WHERE id = seq_record.id;
  END IF;

  -- Format the number according to pattern
  formatted_number := replace(seq_record.format_pattern, '{prefix}', seq_record.prefix);
  formatted_number := replace(formatted_number, '{year}', current_year::text);
  formatted_number := replace(formatted_number, '{number:04d}', lpad(next_number::text, 4, '0'));

  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Trigger function: also treat legacy agent drafts ('KI-%') as draft markers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_offer_document_number() RETURNS TRIGGER AS $$
DECLARE
  doc_number TEXT;
BEGIN
  -- Assign number when status changes to 'sent' or 'accepted' and no official number exists yet.
  -- 'KI-%' covers legacy agent-created drafts that still carry the old marker.
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status IN ('sent', 'accepted')
       AND (NEW.offer_number IS NULL
            OR NEW.offer_number = ''
            OR NEW.offer_number LIKE 'ENTWURF-%'
            OR NEW.offer_number LIKE 'KI-%') THEN

      doc_number := public.get_next_number('offers', NEW.company_id);
      NEW.offer_number := doc_number;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. create_offer_with_targets: draft marker instead of random pseudo number.
--    Full function body taken from the live definition; ONLY the offer number
--    line changed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_offer_with_targets(
  offer_data JSONB,
  items_data JSONB,
  targets_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer_id UUID;
  v_company_id UUID;
  v_user_id UUID;
  v_offer_number TEXT;
  v_item JSONB;
  v_target_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get company_id from params (supplied by robust frontend logic)
  v_company_id := (offer_data->>'company_id')::UUID;

  -- Fallback if not provided (should not happen with updated service, but safe)
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM public.employees
    WHERE user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a company';
  END IF;

  -- Draft marker only (GoBD): the real gapless number is assigned exactly once by
  -- assign_offer_number_trigger (via get_next_number) on the draft -> sent transition.
  v_offer_number := 'ENTWURF-' || to_char(NOW(), 'YYYYMMDD-HH24MISS');

  -- Insert Offer
  INSERT INTO public.offers (
    company_id,
    offer_number,
    customer_id,
    customer_name,
    customer_address,
    contact_person,
    project_name,
    project_location,
    valid_until,
    payment_terms,
    notes,
    intro_text,
    final_text,
    is_reverse_charge,
    show_labor_share,
    status,
    created_by
  ) VALUES (
    v_company_id,
    v_offer_number,
    (offer_data->>'customer_id')::UUID,
    offer_data->>'customer_name',
    offer_data->>'customer_address',
    offer_data->>'contact_person',
    offer_data->>'project_name',
    offer_data->>'project_location',
    (offer_data->>'valid_until')::DATE,
    offer_data->>'payment_terms',
    offer_data->>'notes',
    offer_data->>'intro_text',
    offer_data->>'final_text',
    COALESCE((offer_data->>'is_reverse_charge')::BOOLEAN, false),
    COALESCE((offer_data->>'show_labor_share')::BOOLEAN, true),
    'draft',
    v_user_id
  )
  RETURNING id INTO v_offer_id;

  -- Insert Items
  IF items_data IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
    LOOP
      INSERT INTO public.offer_items (
        offer_id,
        position_number,
        description,
        quantity,
        unit,
        unit_price_net,
        vat_rate,
        item_type,
        is_optional,
        planned_hours_item,
        material_purchase_cost,
        internal_notes
      ) VALUES (
        v_offer_id,
        (v_item->>'position_number')::INTEGER,
        v_item->>'description',
        COALESCE((v_item->>'quantity')::DECIMAL, 1),
        COALESCE(v_item->>'unit', 'Stk'),
        COALESCE((v_item->>'unit_price_net')::DECIMAL, 0),
        COALESCE((v_item->>'vat_rate')::DECIMAL, 19.0),
        COALESCE(v_item->>'item_type', 'labor'),
        COALESCE((v_item->>'is_optional')::BOOLEAN, false),
        (v_item->>'planned_hours_item')::DECIMAL,
        (v_item->>'material_purchase_cost')::DECIMAL,
        v_item->>'internal_notes'
      );
    END LOOP;
  END IF;

  -- Insert Targets
  IF targets_data IS NOT NULL THEN
    INSERT INTO public.offer_targets (
      offer_id,
      planned_hours_total,
      internal_hourly_rate,
      billable_hourly_rate,
      planned_material_cost_total,
      planned_other_cost,
      target_start_date,
      target_end_date,
      project_manager_id,
      complexity
    ) VALUES (
      v_offer_id,
      (targets_data->>'planned_hours_total')::DECIMAL,
      (targets_data->>'internal_hourly_rate')::DECIMAL,
      (targets_data->>'billable_hourly_rate')::DECIMAL,
      (targets_data->>'planned_material_cost_total')::DECIMAL,
      COALESCE((targets_data->>'planned_other_cost')::DECIMAL, 0),
      (targets_data->>'target_start_date')::DATE,
      (targets_data->>'target_end_date')::DATE,
      (targets_data->>'project_manager_id')::UUID,
      COALESCE(targets_data->>'complexity', 'medium')
    );
  END IF;

  RETURN jsonb_build_object('id', v_offer_id, 'offer_number', v_offer_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. One-time backfill: never-sent drafts carrying a legacy random number
--    ('ANG-YYYYMMDD-<random>') are not recognised as draft markers by the
--    trigger, so without this they would keep that number forever on their
--    first send. Rewriting them to the draft marker is GoBD-safe because these
--    rows were never issued as a document.
--
--    Deliberately narrow: only status 'draft', never sent, not locked, no
--    snapshot, still version 1, and NOT already a real gapless number
--    ('ANG-YYYY-NNNN'). Sent, accepted, rejected, cancelled and revised offers
--    are untouched.
-- ---------------------------------------------------------------------------
UPDATE public.offers
SET offer_number = 'ENTWURF-' || to_char(COALESCE(created_at, NOW()), 'YYYYMMDD-HH24MISS')
WHERE status = 'draft'
  AND sent_at IS NULL
  AND is_locked = false
  AND snapshot_created_at IS NULL
  AND COALESCE(version, 1) = 1
  AND offer_number IS NOT NULL
  AND offer_number <> ''
  AND offer_number NOT LIKE 'ENTWURF-%'
  AND offer_number NOT LIKE 'KI-%'
  AND offer_number !~ '^[A-Z]+-[0-9]{4}-[0-9]{4}$';

-- ---------------------------------------------------------------------------
-- 6. Enforce the invariant in the database, not just in application code:
--    a real document number must be unique per company. Nothing prevented a
--    duplicate before.
--
--    Partial index: draft markers are deliberately excluded, because several
--    drafts created within the same second legitimately share a marker
--    ('ENTWURF-YYYYMMDD-HHMMSS'). Verified against the live data: no duplicate
--    real numbers exist, so this index applies cleanly.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS offers_company_document_number_unique
  ON public.offers (company_id, offer_number)
  WHERE offer_number IS NOT NULL
    AND offer_number <> ''
    AND offer_number NOT LIKE 'ENTWURF-%'
    AND offer_number NOT LIKE 'KI-%';
