-- Erstelle company_settings automatisch aus Registrierungsdaten wenn keine existieren
CREATE OR REPLACE FUNCTION public.create_company_settings_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prüfe ob bereits company_settings existieren
  IF NOT EXISTS (SELECT 1 FROM public.company_settings WHERE is_active = true) THEN
    -- Erstelle company_settings aus den Registrierungsdaten
    INSERT INTO public.company_settings (
      company_name,
      company_address,
      company_city,
      company_postal_code,
      company_phone,
      company_email,
      is_active
    )
    VALUES (
      COALESCE(new.company_name, 'Meine Firma'),
      new.street_address,
      new.city,
      new.postal_code,
      new.phone,
      new.email,
      true
    );
  END IF;
  
  RETURN new;
END;
$function$;

-- Trigger für automatische Erstellung der company_settings nach Profilerstellung
CREATE TRIGGER create_company_settings_after_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_company_settings_from_profile();