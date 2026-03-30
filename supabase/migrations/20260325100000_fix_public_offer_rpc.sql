-- Fix get_public_offer RPC: use company_settings instead of companies
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

  -- Load company from company_settings (not companies)
  SELECT company_name, company_address, company_phone, company_email, tax_number, logo_url
  INTO v_company
  FROM public.company_settings
  WHERE company_id = v_offer.company_id;

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
      'address', v_company.company_address,
      'phone', v_company.company_phone,
      'email', v_company.company_email,
      'tax_number', v_company.tax_number,
      'logo_url', v_company.logo_url
    )
  );
END;
$$;
