-- Erweitere die profiles Tabelle um die fehlenden Registrierungsfelder
ALTER TABLE public.profiles 
ADD COLUMN vat_id text,
ADD COLUMN country text DEFAULT 'Deutschland',
ADD COLUMN voucher_code text,
ADD COLUMN referral_source text;

-- Update the handle_new_user function to include the new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    first_name, 
    last_name,
    company_name,
    phone,
    street_address,
    postal_code,
    city,
    vat_id,
    country,
    voucher_code,
    referral_source
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'street_address',
    new.raw_user_meta_data ->> 'postal_code',
    new.raw_user_meta_data ->> 'city',
    new.raw_user_meta_data ->> 'vat_id',
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'voucher_code',
    new.raw_user_meta_data ->> 'referral_source'
  );
  
  -- Neue Registrierungen bekommen immer Manager-Rolle
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'manager');
  
  RETURN new;
END;
$function$;

-- Erweitere den Trigger für company_settings um VAT ID und Land
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