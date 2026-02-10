-- Add new roles to enum if they don't exist
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'craftsman';

-- Update handle_new_user function to handle marketplace registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role user_role;
  new_company_id UUID;
  meta_role text;
BEGIN
  -- Extract role from metadata
  meta_role := new.raw_user_meta_data ->> 'role';
  
  -- Determine role, default to 'employee' if not set or invalid
  BEGIN
    IF meta_role IS NULL THEN
        new_role := 'employee';
    ELSE
        new_role := meta_role::user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    new_role := 'employee';
  END;

  -- 1. If role is 'craftsman', create a company
  IF new_role = 'craftsman' THEN
    INSERT INTO public.companies (name)
    VALUES (COALESCE(new.raw_user_meta_data ->> 'company_name', 'My Company'))
    RETURNING id INTO new_company_id;
  END IF;

  -- 2. If valid company_id is provided in metadata (e.g. employee invitation), use it
  IF new_company_id IS NULL AND (new.raw_user_meta_data ->> 'company_id') IS NOT NULL THEN
      BEGIN
        new_company_id := (new.raw_user_meta_data ->> 'company_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        new_company_id := NULL;
      END;
  END IF;

  -- 3. Insert profile
  -- Note: We assume company_id column exists in profiles.
  INSERT INTO public.profiles (id, email, first_name, last_name, company_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new_company_id
  );

  -- 4. Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, new_role);

  RETURN new;
END;
$$;
