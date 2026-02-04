-- Create Offer Module Tables and Functions

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  offer_number TEXT NOT NULL,
  offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  contact_person TEXT,
  customer_reference TEXT,
  project_name TEXT NOT NULL,
  project_location TEXT,
  execution_period_text TEXT,
  execution_notes TEXT,
  payment_terms TEXT DEFAULT '14 Tage netto',
  skonto_percent DECIMAL(5, 2),
  skonto_days INTEGER,
  terms_text TEXT,
  warranty_text TEXT,
  notes TEXT,
  
  -- Snapshot values (calculated)
  snapshot_subtotal_net DECIMAL(15, 2),
  snapshot_discount_percent DECIMAL(5, 2),
  snapshot_discount_amount DECIMAL(15, 2),
  snapshot_net_total DECIMAL(15, 2),
  snapshot_vat_rate DECIMAL(5, 2) DEFAULT 19.0,
  snapshot_vat_amount DECIMAL(15, 2),
  snapshot_gross_total DECIMAL(15, 2),
  snapshot_created_at TIMESTAMPTZ,
  
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')) DEFAULT 'draft',
  is_locked BOOLEAN DEFAULT false,
  
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT,
  acceptance_note TEXT,
  
  version INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  position_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(15, 3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Stk',
  unit_price_net DECIMAL(15, 2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 19.0,
  item_type TEXT NOT NULL CHECK (item_type IN ('labor', 'material', 'lump_sum', 'text', 'title', 'other', 'page_break')) DEFAULT 'labor',
  is_optional BOOLEAN DEFAULT false,
  
  planned_hours_item DECIMAL(10, 2),
  material_purchase_cost DECIMAL(15, 2),
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offer_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  
  planned_hours_total DECIMAL(10, 2),
  internal_hourly_rate DECIMAL(10, 2),
  billable_hourly_rate DECIMAL(10, 2),
  planned_material_cost_total DECIMAL(15, 2),
  planned_other_cost DECIMAL(15, 2) DEFAULT 0,
  
  target_start_date DATE,
  target_end_date DATE,
  project_manager_id UUID REFERENCES public.employees(id),
  complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')) DEFAULT 'medium',
  
  -- Snapshot target values
  snapshot_target_revenue DECIMAL(15, 2),
  snapshot_target_cost DECIMAL(15, 2),
  snapshot_target_margin DECIMAL(15, 2),
  snapshot_created_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_targets ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies (Permissive for authenticated users for now)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.offers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.offer_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.offer_targets;

CREATE POLICY "Enable all access for authenticated users" ON public.offers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.offer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.offer_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Create Triggers for Updated At
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_offer_targets_updated_at BEFORE UPDATE ON public.offer_targets FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 5. Create RPC Function: create_offer_with_targets
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
