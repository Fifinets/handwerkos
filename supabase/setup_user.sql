DO $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  -- Get the user ID (assuming only one user exists or picking the latest)
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found in auth.users';
    RETURN;
  END IF;

  -- 1. Create Company (Minimal columns)
  INSERT INTO public.companies (name)
  VALUES ('Handwerk Demo GmbH')
  RETURNING id INTO v_company_id;

  -- 2. Create Profile
  INSERT INTO public.profiles (id, first_name, last_name, company_id)
  VALUES (v_user_id, 'Max', 'Mustermann', v_company_id)
  ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

  -- 3. Create User Role (Manager)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'manager')
  ON CONFLICT (user_id) DO UPDATE SET role = 'manager';

  -- 4. Create Employee Record (Correct columns)
  INSERT INTO public.employees (user_id, company_id, first_name, last_name, email, position, status)
  VALUES (v_user_id, v_company_id, 'Max', 'Mustermann', (SELECT email FROM auth.users WHERE id = v_user_id), 'Manager', 'active')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'User % setup complete with Company %', v_user_id, v_company_id;
END $$;
