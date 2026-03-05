-- Add content and compliance fields to offers table
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS intro_text TEXT,
ADD COLUMN IF NOT EXISTS final_text TEXT,
ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_labor_share BOOLEAN DEFAULT true;

-- Update create_offer_with_targets function to handle new fields
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

  -- Generate offer number (simple version for now, ideally call a function)
  v_offer_number := 'ANG-' || to_char(NOW(), 'YYYYMMDD') || '-' || floor(random() * 1000)::text;

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
