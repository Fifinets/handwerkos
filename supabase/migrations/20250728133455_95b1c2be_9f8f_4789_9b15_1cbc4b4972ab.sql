-- Fix employee role assignment when inviting new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  new_company_id UUID;
  provided_company_id UUID;
BEGIN
  provided_company_id := NULLIF(new.raw_user_meta_data ->> 'company_id', '')::uuid;

  IF provided_company_id IS NOT NULL THEN
    new_company_id := provided_company_id;
  ELSE
    -- Create a new company for this user
    INSERT INTO public.companies (name)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'company_name', new.email || ' Company'))
    RETURNING id INTO new_company_id;

    -- Create company settings for the new company
    INSERT INTO public.company_settings (
      company_name,
      company_address,
      company_city,
      company_postal_code,
      company_phone,
      company_email,
      company_country,
      vat_number,
      is_active,
      company_id
    )
    VALUES (
      COALESCE(new.raw_user_meta_data ->> 'company_name', 'Meine Firma'),
      new.raw_user_meta_data ->> 'street_address',
      new.raw_user_meta_data ->> 'city',
      new.raw_user_meta_data ->> 'postal_code',
      new.raw_user_meta_data ->> 'phone',
      new.email,
      COALESCE(new.raw_user_meta_data ->> 'country', 'Deutschland'),
      new.raw_user_meta_data ->> 'vat_id',
      true,
      new_company_id
    );
  END IF;

  -- Insert profile with company_id
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
    referral_source,
    company_id
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
    new.raw_user_meta_data ->> 'referral_source',
    new_company_id
  );

  IF provided_company_id IS NOT NULL THEN
    -- Invited user joins existing company as employee
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'employee');
  ELSE
    -- New signups become managers of their new company
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'manager');
  END IF;

  RETURN new;
END;
$function$;
