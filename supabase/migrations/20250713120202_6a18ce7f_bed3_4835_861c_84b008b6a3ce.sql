-- Erweitere die profiles Tabelle um zusätzliche Registrierungsfelder
ALTER TABLE public.profiles 
ADD COLUMN company_name text,
ADD COLUMN street_address text,
ADD COLUMN postal_code text,
ADD COLUMN city text;

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
    city
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
    new.raw_user_meta_data ->> 'city'
  );
  
  -- Neue Registrierungen bekommen immer Manager-Rolle
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'manager');
  
  RETURN new;
END;
$function$;