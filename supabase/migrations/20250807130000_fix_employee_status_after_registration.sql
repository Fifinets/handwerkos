-- Fix employee status after registration
-- Update the handle_new_user function to set employee status to 'aktiv' after registration

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
  employee_record RECORD;
BEGIN
  -- Check if this user was invited as an employee (has employee record with this email)
  SELECT * INTO employee_record
  FROM public.employees 
  WHERE email = new.email AND user_id IS NULL;
  
  IF employee_record.id IS NOT NULL THEN
    -- This is an invited employee - update the employee record and assign employee role
    UPDATE public.employees 
    SET user_id = new.id,
        status = 'aktiv'
    WHERE id = employee_record.id;
    
    -- Insert profile using employee's company
    INSERT INTO public.profiles (
      id, 
      email, 
      first_name, 
      last_name,
      company_id
    )
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data ->> 'first_name', employee_record.first_name),
      COALESCE(new.raw_user_meta_data ->> 'last_name', employee_record.last_name),
      employee_record.company_id
    );
    
    -- Assign employee role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'employee');
    
  ELSE
    -- This is a new manager registration
    -- Create a new company for this user
    INSERT INTO public.companies (name)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'company_name', new.email || ' Company'))
    RETURNING id INTO new_company_id;

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
    
    -- Assign manager role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'manager');
  END IF;
  
  RETURN new;
END;
$function$;

-- Also manually update any existing employees who are registered but still have 'eingeladen' status
UPDATE public.employees 
SET status = 'aktiv' 
WHERE user_id IS NOT NULL AND status = 'eingeladen';