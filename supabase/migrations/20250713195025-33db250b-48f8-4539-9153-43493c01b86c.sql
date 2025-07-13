-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to profiles table
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to relevant tables
ALTER TABLE public.customers ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.orders ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.projects ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.employees ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.quotes ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.invoices ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.document_items ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.calendar_events ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.time_entries ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.time_entry_corrections ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.employee_absences ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.project_assignments ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.working_hours_config ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.company_settings ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create companies for existing users and migrate data
INSERT INTO public.companies (name)
SELECT DISTINCT COALESCE(company_name, email || ' Company') 
FROM public.profiles;

-- Update profiles with company_id
UPDATE public.profiles 
SET company_id = (
  SELECT c.id 
  FROM public.companies c 
  WHERE c.name = COALESCE(profiles.company_name, profiles.email || ' Company')
  LIMIT 1
);

-- Update company_settings with company_id
UPDATE public.company_settings 
SET company_id = (
  SELECT p.company_id 
  FROM public.profiles p 
  WHERE p.email = company_settings.company_email
  LIMIT 1
);

-- Make company_id NOT NULL after migration
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;

-- Update RLS policies for companies
CREATE POLICY "Users can view their own company" 
  ON public.companies 
  FOR SELECT 
  USING (id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Drop existing RLS policies that need updating
DROP POLICY IF EXISTS "Managers can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Employees can view customers" ON public.customers;
DROP POLICY IF EXISTS "Managers can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Employees can view orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Employees can view projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view other employees" ON public.employees;
DROP POLICY IF EXISTS "Managers can manage all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Employees can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Managers can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Employees can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Managers can manage company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Employees can view company settings" ON public.company_settings;

-- Create new company-aware RLS policies
CREATE POLICY "Managers can manage company customers" 
  ON public.customers 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company customers" 
  ON public.customers 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage company orders" 
  ON public.orders 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company orders" 
  ON public.orders 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage company projects" 
  ON public.projects 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company projects" 
  ON public.projects 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage company employees" 
  ON public.employees 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company employees" 
  ON public.employees 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage company quotes" 
  ON public.quotes 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company quotes" 
  ON public.quotes 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage company invoices" 
  ON public.invoices 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company invoices" 
  ON public.invoices 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can manage company settings" 
  ON public.company_settings 
  FOR ALL 
  USING (
    has_role(auth.uid(), 'manager'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Employees can view company settings" 
  ON public.company_settings 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'employee'::user_role) AND 
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Update the user registration trigger to create new companies
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Update trigger for updated_at on companies
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON public.companies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();