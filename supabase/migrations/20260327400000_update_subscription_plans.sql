-- ============================================================================
-- Update subscription_plans with realistic Handwerker plans + Stripe IDs
-- ============================================================================

-- Clear old placeholder plans
DELETE FROM public.subscription_plans;

-- Starter: Fuer Einzelunternehmer
INSERT INTO public.subscription_plans (
  stripe_product_id, stripe_price_id, name, slug, description,
  price_cents, currency, interval, trial_days,
  features, max_employees, max_projects, is_active, sort_order
) VALUES (
  'prod_UE9GoeGePeLmoQ', 'price_1TFgy3FIMsd5kuQ90EF6FGdE',
  'Starter', 'basic',
  'Fuer Einzelunternehmer und kleine Betriebe',
  2900, 'eur', 'month', 14,
  '["offers","projects","customers","time_tracking","materials"]'::jsonb,
  3, 10, true, 1
);

-- Handwerker: Fuer wachsende Betriebe
INSERT INTO public.subscription_plans (
  stripe_product_id, stripe_price_id, name, slug, description,
  price_cents, currency, interval, trial_days,
  features, max_employees, max_projects, is_active, sort_order
) VALUES (
  'prod_UE9GWarH0x5ziM', 'price_1TFgy5FIMsd5kuQ9qYdpqoM0',
  'Handwerker', 'pro',
  'Fuer wachsende Handwerksbetriebe',
  5900, 'eur', 'month', 14,
  '["offers","projects","customers","time_tracking","materials","invoices","delivery_notes","ai_estimation","document_ocr","site_documentation","employee_management"]'::jsonb,
  10, NULL, true, 2
);

-- Meisterbetrieb: Fuer etablierte Betriebe
INSERT INTO public.subscription_plans (
  stripe_product_id, stripe_price_id, name, slug, description,
  price_cents, currency, interval, trial_days,
  features, max_employees, max_projects, is_active, sort_order
) VALUES (
  'prod_UE9GQPcXVSDTyA', 'price_1TFgyAFIMsd5kuQ9NjUfeWiK',
  'Meisterbetrieb', 'enterprise',
  'Fuer etablierte Betriebe mit Team',
  9900, 'eur', 'month', 14,
  '["offers","projects","customers","time_tracking","materials","invoices","delivery_notes","ai_estimation","document_ocr","site_documentation","employee_management","vde_protocols","datev_export","api_access","priority_support","custom_branding"]'::jsonb,
  NULL, NULL, true, 3
);
