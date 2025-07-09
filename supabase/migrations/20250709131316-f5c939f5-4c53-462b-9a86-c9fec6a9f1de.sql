
-- Update der handle_new_user Funktion um immer Manager-Rolle zu vergeben
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  
  -- Neue Registrierungen bekommen immer Manager-Rolle
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'manager');
  
  RETURN new;
END;
$$;
