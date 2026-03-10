-- ============================================================
-- Phase 1.1: Create customer_contacts table
-- Multi-tenancy, primary contact logic, RLS and Backfill
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Multitenancy & RLS
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer_contacts for their company" ON public.customer_contacts
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage customer_contacts for their company" ON public.customer_contacts
  FOR ALL USING (public.user_has_company_access(company_id));

CREATE TRIGGER set_customer_contacts_company_id
  BEFORE INSERT ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

-- Ensure only one primary contact per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_primary 
ON public.customer_contacts(customer_id) 
WHERE is_primary = true;

-- ============================================================
-- Backfill existing contact data from customers
-- ============================================================
INSERT INTO public.customer_contacts (customer_id, company_id, first_name, last_name, email, phone, is_primary)
SELECT 
    id, 
    company_id, 
    -- Guess first name / last name from contact_person if first_name/last_name are empty
    COALESCE(NULLIF(TRIM(first_name), ''), split_part(contact_person, ' ', 1), 'Unbekannt'), 
    COALESCE(NULLIF(TRIM(last_name), ''), substring(contact_person from position(' ' in contact_person) + 1), 'Unbekannt'), 
    email, 
    COALESCE(NULLIF(TRIM(mobile), ''), NULLIF(TRIM(phone), '')), 
    true
FROM public.customers 
WHERE (contact_person IS NOT NULL AND contact_person != '')
  OR (first_name IS NOT NULL AND first_name != '')
  OR (last_name IS NOT NULL AND last_name != '')
ON CONFLICT (customer_id) WHERE is_primary = true DO NOTHING;
