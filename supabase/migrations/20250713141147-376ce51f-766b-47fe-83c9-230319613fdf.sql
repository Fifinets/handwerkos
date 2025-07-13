-- Vereinfachte Lösung: Aktualisiere direkt die bestehenden company_settings
UPDATE public.company_settings 
SET 
  company_address = (
    SELECT street_address 
    FROM public.profiles 
    WHERE email = company_settings.company_email 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  company_city = (
    SELECT city 
    FROM public.profiles 
    WHERE email = company_settings.company_email 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  company_postal_code = (
    SELECT postal_code 
    FROM public.profiles 
    WHERE email = company_settings.company_email 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  company_phone = (
    SELECT phone 
    FROM public.profiles 
    WHERE email = company_settings.company_email 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  vat_number = (
    SELECT vat_id 
    FROM public.profiles 
    WHERE email = company_settings.company_email 
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  company_name = COALESCE((
    SELECT company_name 
    FROM public.profiles 
    WHERE email = company_settings.company_email 
    ORDER BY created_at DESC 
    LIMIT 1
  ), company_settings.company_name),
  updated_at = now()
WHERE is_active = true;

-- Vereinfache den Trigger für neue Registrierungen
CREATE OR REPLACE FUNCTION public.create_company_settings_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Aktualisiere existierende company_settings mit neuen Profildaten wenn vorhanden
  UPDATE public.company_settings 
  SET 
    company_address = new.street_address,
    company_city = new.city,
    company_postal_code = new.postal_code,
    company_phone = new.phone,
    vat_number = new.vat_id,
    company_name = COALESCE(new.company_name, company_settings.company_name),
    company_country = COALESCE(new.country, company_settings.company_country),
    updated_at = now()
  WHERE company_email = new.email AND is_active = true;
  
  -- Falls keine company_settings existieren, erstelle neue
  IF NOT FOUND THEN
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
    );
  END IF;
  
  RETURN new;
END;
$function$;