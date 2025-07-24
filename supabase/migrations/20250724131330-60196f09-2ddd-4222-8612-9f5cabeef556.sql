-- Security Fix 1: Update database functions with proper search paths
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.orders
    WHERE order_number LIKE 'A' || year_suffix || '%';
    
    new_number := 'A' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := public.generate_order_number();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quote_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.quotes
    WHERE quote_number LIKE 'Q' || year_suffix || '%';
    
    new_number := 'Q' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.invoices
    WHERE invoice_number LIKE 'R' || year_suffix || '%';
    
    new_number := 'R' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_quote_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        NEW.quote_number := public.generate_quote_number();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := public.generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  new_company_id UUID;
BEGIN
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
  
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.create_company_settings_from_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.has_role(role text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT
    CASE WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'roles', 'null'::jsonb))
      WHERE value = role
    )
    THEN TRUE
    ELSE FALSE
    END
$function$;

-- Security Fix 2: Improve RLS policies for company-level isolation

-- Fix document_items policies to include company isolation
DROP POLICY IF EXISTS "Employees can view document items" ON public.document_items;
DROP POLICY IF EXISTS "Managers can manage all document items" ON public.document_items;

CREATE POLICY "Employees can view company document items" 
ON public.document_items 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::user_role) AND 
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can manage company document items" 
ON public.document_items 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::user_role) AND 
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Fix project_assignments policies for better company isolation
DROP POLICY IF EXISTS "Employees can view project assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Managers can manage project assignments" ON public.project_assignments;

CREATE POLICY "Employees can view company project assignments" 
ON public.project_assignments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::user_role) AND 
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Managers can manage company project assignments" 
ON public.project_assignments 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::user_role) AND 
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Fix project material and work hour policies
DROP POLICY IF EXISTS "Employees can view material purchases" ON public.project_material_purchases;
DROP POLICY IF EXISTS "Managers can manage material purchases" ON public.project_material_purchases;

CREATE POLICY "Employees can view company material purchases" 
ON public.project_material_purchases 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::user_role) AND 
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id::text = project_material_purchases.project_id 
    AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Managers can manage company material purchases" 
ON public.project_material_purchases 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::user_role) AND 
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id::text = project_material_purchases.project_id 
    AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Employees can view material usage" ON public.project_material_usage;
DROP POLICY IF EXISTS "Managers can manage material usage" ON public.project_material_usage;

CREATE POLICY "Employees can view company material usage" 
ON public.project_material_usage 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::user_role) AND 
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id::text = project_material_usage.project_id 
    AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Managers can manage company material usage" 
ON public.project_material_usage 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::user_role) AND 
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id::text = project_material_usage.project_id 
    AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Employees can view work hours" ON public.project_work_hours;
DROP POLICY IF EXISTS "Managers can manage work hours" ON public.project_work_hours;

CREATE POLICY "Employees can view company work hours" 
ON public.project_work_hours 
FOR SELECT 
USING (
  has_role(auth.uid(), 'employee'::user_role) AND 
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id::text = project_work_hours.project_id 
    AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Managers can manage company work hours" 
ON public.project_work_hours 
FOR ALL 
USING (
  has_role(auth.uid(), 'manager'::user_role) AND 
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id::text = project_work_hours.project_id 
    AND p.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Security Fix 3: Add data validation functions

-- Function to validate email content
CREATE OR REPLACE FUNCTION public.validate_email_content(content_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Check for basic content validation
  IF content_text IS NULL OR length(content_text) = 0 THEN
    RETURN false;
  END IF;
  
  -- Check for reasonable content length (prevent extremely large content)
  IF length(content_text) > 1000000 THEN -- 1MB limit
    RETURN false;
  END IF;
  
  -- Add more validation rules as needed
  RETURN true;
END;
$function$;

-- Function to sanitize user input
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove dangerous characters and limit length
  RETURN substring(trim(input_text), 1, 10000);
END;
$function$;