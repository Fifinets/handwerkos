-- 1. Share token column
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMPTZ;

-- Index for fast token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_share_token ON public.offers(share_token) WHERE share_token IS NOT NULL;

-- 2. RPC: Load offer via token (public, no auth needed)
CREATE OR REPLACE FUNCTION public.get_public_offer(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
  v_items JSONB;
  v_company RECORD;
BEGIN
  SELECT o.*, c.company_name as customer_company, c.address as customer_full_address
  INTO v_offer
  FROM public.offers o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.share_token = p_token
    AND o.status IN ('sent', 'accepted', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder nicht freigegeben';
  END IF;

  -- Load items
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'position_number', oi.position_number,
    'description', oi.description,
    'quantity', oi.quantity,
    'unit', oi.unit,
    'unit_price_net', oi.unit_price_net,
    'vat_rate', oi.vat_rate,
    'item_type', oi.item_type,
    'is_optional', oi.is_optional
  ) ORDER BY oi.position_number), '[]'::jsonb)
  INTO v_items
  FROM public.offer_items oi
  WHERE oi.offer_id = v_offer.id;

  -- Load company
  SELECT company_name, address, phone, email, tax_number, logo_url
  INTO v_company
  FROM public.companies
  WHERE id = v_offer.company_id;

  RETURN jsonb_build_object(
    'id', v_offer.id,
    'offer_number', v_offer.offer_number,
    'offer_date', v_offer.offer_date,
    'valid_until', v_offer.valid_until,
    'status', v_offer.status,
    'customer_name', v_offer.customer_name,
    'customer_address', v_offer.customer_address,
    'contact_person', v_offer.contact_person,
    'project_name', v_offer.project_name,
    'intro_text', v_offer.intro_text,
    'final_text', v_offer.final_text,
    'payment_terms', v_offer.payment_terms,
    'execution_period_text', v_offer.execution_period_text,
    'warranty_text', v_offer.warranty_text,
    'is_reverse_charge', v_offer.is_reverse_charge,
    'snapshot_subtotal_net', v_offer.snapshot_subtotal_net,
    'snapshot_discount_percent', v_offer.snapshot_discount_percent,
    'snapshot_discount_amount', v_offer.snapshot_discount_amount,
    'snapshot_net_total', v_offer.snapshot_net_total,
    'snapshot_vat_rate', v_offer.snapshot_vat_rate,
    'snapshot_vat_amount', v_offer.snapshot_vat_amount,
    'snapshot_gross_total', v_offer.snapshot_gross_total,
    'items', v_items,
    'company', jsonb_build_object(
      'name', v_company.company_name,
      'address', v_company.address,
      'phone', v_company.phone,
      'email', v_company.email,
      'tax_number', v_company.tax_number,
      'logo_url', v_company.logo_url
    )
  );
END;
$$;

-- 3. RPC: Accept offer (public)
CREATE OR REPLACE FUNCTION public.accept_public_offer(p_token UUID, p_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
  v_project_id UUID;
BEGIN
  SELECT * INTO v_offer
  FROM public.offers
  WHERE share_token = p_token AND status = 'sent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder bereits bearbeitet';
  END IF;

  IF v_offer.valid_until IS NOT NULL AND v_offer.valid_until::date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Angebot ist abgelaufen';
  END IF;

  -- Create project
  v_project_id := gen_random_uuid();
  INSERT INTO public.projects (id, company_id, customer_id, name, status, description)
  VALUES (
    v_project_id,
    v_offer.company_id,
    v_offer.customer_id,
    v_offer.project_name,
    'beauftragt',
    'Erstellt aus Angebot ' || v_offer.offer_number
  );

  -- Update offer
  UPDATE public.offers
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = COALESCE(p_name, v_offer.customer_name),
      is_locked = true,
      project_id = v_project_id
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Angebot angenommen',
    'project_id', v_project_id
  );
END;
$$;

-- 4. RPC: Reject offer (public)
CREATE OR REPLACE FUNCTION public.reject_public_offer(p_token UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
BEGIN
  SELECT * INTO v_offer
  FROM public.offers
  WHERE share_token = p_token AND status = 'sent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angebot nicht gefunden oder bereits bearbeitet';
  END IF;

  UPDATE public.offers
  SET status = 'rejected',
      acceptance_note = p_reason
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Angebot abgelehnt'
  );
END;
$$;

-- 5. Grant public access to RPCs
GRANT EXECUTE ON FUNCTION public.get_public_offer(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_public_offer(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reject_public_offer(UUID, TEXT) TO anon;
