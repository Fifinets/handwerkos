-- Secure customers table by removing overly broad policies and preserving company-scoped access

-- 1) Ensure RLS is enabled
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 2) Remove broad policies that allow any authenticated user unrestricted access
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

-- (Company-scoped policies for managers/employees already exist and are kept)
--   - Employees can view company customers
--   - Managers can manage company customers

-- 3) Add a safe BEFORE INSERT trigger to auto-assign company_id from the current user's profile
--    This preserves existing app behavior (which doesn't pass company_id) while keeping strict RLS
CREATE OR REPLACE FUNCTION public.set_customer_company()
RETURNS trigger AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT p.company_id INTO v_company_id
    FROM public.profiles p
    WHERE p.id = auth.uid();

    NEW.company_id := v_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_customer_company ON public.customers;
CREATE TRIGGER trg_set_customer_company
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_company();