-- ============================================================
-- Phase 1.2: Create project_sites table
-- Multi-tenancy, RLS and specific Backfill from location/description
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_sites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT,
    country TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Multitenancy & RLS
ALTER TABLE public.project_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project_sites for their company" ON public.project_sites
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage project_sites for their company" ON public.project_sites
  FOR ALL USING (public.user_has_company_access(company_id));

CREATE TRIGGER set_project_sites_company_id
  BEFORE INSERT ON public.project_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

-- ============================================================
-- Backfill existing project sites from projects (location + description marker)
-- ============================================================
WITH extracted_sites AS (
  SELECT 
    customer_id,
    company_id,
    COALESCE(
      NULLIF(TRIM(location), ''), 
      NULLIF(TRIM(substring(description from '(?i)Standort:\s*([^\n\r]+)')), ''),
      'Unbekannt'
    ) as site_address
  FROM public.projects
  WHERE customer_id IS NOT NULL 
    AND (
      NULLIF(TRIM(location), '') IS NOT NULL 
      OR NULLIF(TRIM(substring(description from '(?i)Standort:\s*([^\n\r]+)')), '') IS NOT NULL
    )
),
distinct_sites AS (
  SELECT DISTINCT customer_id, company_id, site_address
  FROM extracted_sites
)
INSERT INTO public.project_sites (id, company_id, customer_id, address, city, notes)
SELECT 
  gen_random_uuid(), 
  company_id, 
  customer_id, 
  site_address, 
  'Unbekannt', -- City is required but we only have a raw address string, will need manual cleanup if needed
  'Automatischer Backfill aus projects'
FROM distinct_sites
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_sites ps 
  WHERE ps.customer_id = distinct_sites.customer_id AND ps.address = distinct_sites.site_address
);
