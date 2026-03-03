-- Migrate Offers to be GoBD Compliant

-- 1. Insert Number Sequence for Offers
INSERT INTO public.number_sequences (sequence_name, prefix, format_pattern) 
VALUES ('offers', 'ANG', '{prefix}-{year}-{number:04d}')
ON CONFLICT (sequence_name, company_id) DO NOTHING;

-- 2. Audit Logging Setup
-- Attach the existing general audit trigger to the new offer tables
DROP TRIGGER IF EXISTS audit_offers_trigger ON public.offers;
CREATE TRIGGER audit_offers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

DROP TRIGGER IF EXISTS audit_offer_items_trigger ON public.offer_items;
CREATE TRIGGER audit_offer_items_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.offer_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

DROP TRIGGER IF EXISTS audit_offer_targets_trigger ON public.offer_targets;
CREATE TRIGGER audit_offer_targets_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.offer_targets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 3. Document Numbering Automation
-- When an offer moves to 'sent' or 'accepted', assign a deterministic number
CREATE OR REPLACE FUNCTION public.assign_offer_document_number() RETURNS TRIGGER AS $$
DECLARE
  doc_number TEXT;
BEGIN
  -- Assign number when status changes to 'sent' or 'accepted' and no official number exists yet
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status IN ('sent', 'accepted') AND (NEW.offer_number IS NULL OR NEW.offer_number LIKE 'ENTWURF-%' OR NEW.offer_number = '') THEN
      
      doc_number := public.get_next_number('offers', NEW.company_id);
      NEW.offer_number := doc_number;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_offer_number_trigger ON public.offers;
CREATE TRIGGER assign_offer_number_trigger
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.assign_offer_document_number();

-- 4. Immutability Enforcement (GoBD)
-- Prevent changes to locked or finalized offers
CREATE OR REPLACE FUNCTION public.prevent_locked_offer_updates() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_locked = true OR OLD.status IN ('sent', 'accepted', 'rejected') THEN
      -- Prevent downgrade to draft
      IF NEW.status NOT IN ('sent', 'accepted', 'rejected', 'cancelled') THEN
         RAISE EXCEPTION 'GoBD Compliance Violation: Cannot revert a finalized offer to draft.';
      END IF;
      
      -- Prevent core field modifications while allowing status updates (like sent -> accepted)
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

DROP TRIGGER IF EXISTS enforce_offer_immutability ON public.offers;
CREATE TRIGGER enforce_offer_immutability
  BEFORE UPDATE OR DELETE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_offer_updates();

-- Helper function to lock offer_items implicitly if parent offer is locked
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
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot modify items of a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT is_locked, status INTO v_is_locked, v_status 
    FROM public.offers 
    WHERE id = NEW.offer_id;
    
    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot add items to a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_offer_items_immutability ON public.offer_items;
CREATE TRIGGER enforce_offer_items_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.offer_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_offer_items_updates();

-- Helper function to lock offer_targets implicitly if parent offer is locked
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
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot modify targets of a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT is_locked, status INTO v_is_locked, v_status 
    FROM public.offers 
    WHERE id = NEW.offer_id;
    
    IF v_is_locked = true OR v_status IN ('sent', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'GoBD Compliance Violation: Cannot add targets to a locked or finalized offer.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_offer_targets_immutability ON public.offer_targets;
CREATE TRIGGER enforce_offer_targets_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.offer_targets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_offer_targets_updates();

-- 5. Fix `create_offer_with_targets` to NOT use random number initially, 
-- but a draft identifier instead.
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
  
  -- Get company_id from employee/user
  SELECT company_id INTO v_company_id
  FROM public.employees
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a company';
  END IF;

  -- Generate DRAFT indicator. Will be overwritten by DB trigger once sent.
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
