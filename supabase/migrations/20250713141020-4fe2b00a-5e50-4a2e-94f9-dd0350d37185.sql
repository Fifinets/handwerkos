-- Korrigiere den Trigger für company_settings um pro User zu funktionieren
CREATE OR REPLACE FUNCTION public.create_company_settings_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prüfe ob für diesen spezifischen Benutzer bereits company_settings existieren
  -- Neue Logik: Erstelle immer company_settings aus Registrierungsdaten, überschreibe existing wenn leer
  IF NOT EXISTS (SELECT 1 FROM public.company_settings WHERE is_active = true AND company_email = new.email) THEN
    -- Erstelle oder aktualisiere company_settings aus den Registrierungsdaten
    INSERT INTO public.company_settings (
      company_name,
      company_address,
      company_city,
      company_postal_code,
      company_phone,
      company_email,
      company_country,
      vat_number,
      is_active
    )
    VALUES (
      COALESCE(new.company_name, 'Meine Firma'),
      new.street_address,
      new.city,
      new.postal_code,
      new.phone,
      new.email,
      COALESCE(new.country, 'Deutschland'),
      new.vat_id,
      true
    )
    ON CONFLICT (id) 
    DO UPDATE SET
      company_name = COALESCE(EXCLUDED.company_name, company_settings.company_name),
      company_address = COALESCE(EXCLUDED.company_address, company_settings.company_address),
      company_city = COALESCE(EXCLUDED.company_city, company_settings.company_city),
      company_postal_code = COALESCE(EXCLUDED.company_postal_code, company_settings.company_postal_code),
      company_phone = COALESCE(EXCLUDED.company_phone, company_settings.company_phone),
      company_country = COALESCE(EXCLUDED.company_country, company_settings.company_country),
      vat_number = COALESCE(EXCLUDED.vat_number, company_settings.vat_number),
      updated_at = now()
    WHERE company_settings.is_active = true;
  END IF;
  
  RETURN new;
END;
$function$;

-- Aktualisiere die bestehenden company_settings mit Daten aus der neuesten Registrierung
UPDATE public.company_settings 
SET 
  company_address = p.street_address,
  company_city = p.city,
  company_postal_code = p.postal_code,
  company_phone = p.phone,
  vat_number = p.vat_id,
  company_name = COALESCE(p.company_name, company_settings.company_name),
  updated_at = now()
FROM public.profiles p
WHERE company_settings.is_active = true 
  AND p.email = company_settings.company_email
  AND p.created_at = (SELECT MAX(created_at) FROM public.profiles WHERE email = company_settings.company_email);