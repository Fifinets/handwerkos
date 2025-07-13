-- Aktualisiere company_settings mit Daten der neuesten Registrierung
UPDATE public.company_settings 
SET 
  company_email = (SELECT email FROM public.profiles ORDER BY created_at DESC LIMIT 1),
  company_address = (SELECT street_address FROM public.profiles ORDER BY created_at DESC LIMIT 1),
  company_city = (SELECT city FROM public.profiles ORDER BY created_at DESC LIMIT 1),
  company_postal_code = (SELECT postal_code FROM public.profiles ORDER BY created_at DESC LIMIT 1),
  company_phone = (SELECT phone FROM public.profiles ORDER BY created_at DESC LIMIT 1),
  vat_number = (SELECT vat_id FROM public.profiles ORDER BY created_at DESC LIMIT 1),
  company_name = COALESCE((SELECT company_name FROM public.profiles ORDER BY created_at DESC LIMIT 1), company_settings.company_name),
  updated_at = now()
WHERE is_active = true;