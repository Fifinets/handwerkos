-- Erstelle einen verbesserten Trigger der immer ausgeführt wird
CREATE OR REPLACE FUNCTION public.create_company_settings_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Aktualisiere oder erstelle company_settings für den angemeldeten Benutzer
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
  ON CONFLICT DO NOTHING;  -- Verhindere Duplikate, aber erstelle wenn nicht vorhanden
  
  RETURN new;
END;
$function$;

-- Für bestehende Nutzer: Aktualisiere company_settings mit den neuesten Profildaten
DO $$
DECLARE
    profile_rec RECORD;
BEGIN
    FOR profile_rec IN 
        SELECT DISTINCT ON (email) *
        FROM public.profiles 
        ORDER BY email, created_at DESC
    LOOP
        -- Aktualisiere oder erstelle company_settings für jeden Nutzer
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
            COALESCE(profile_rec.company_name, 'Meine Firma'),
            profile_rec.street_address,
            profile_rec.city,
            profile_rec.postal_code,
            profile_rec.phone,
            profile_rec.email,
            COALESCE(profile_rec.country, 'Deutschland'),
            profile_rec.vat_id,
            true
        )
        ON CONFLICT (company_email) DO UPDATE SET
            company_name = COALESCE(EXCLUDED.company_name, company_settings.company_name),
            company_address = COALESCE(EXCLUDED.company_address, company_settings.company_address),
            company_city = COALESCE(EXCLUDED.company_city, company_settings.company_city),
            company_postal_code = COALESCE(EXCLUDED.company_postal_code, company_settings.company_postal_code),
            company_phone = COALESCE(EXCLUDED.company_phone, company_settings.company_phone),
            company_country = COALESCE(EXCLUDED.company_country, company_settings.company_country),
            vat_number = COALESCE(EXCLUDED.vat_number, company_settings.vat_number),
            updated_at = now()
        WHERE company_settings.company_email = EXCLUDED.company_email;
    END LOOP;
END $$;