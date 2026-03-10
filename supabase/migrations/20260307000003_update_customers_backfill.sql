-- ============================================================
-- Phase 1.3: Update customers backfill
-- Add display_name and customer_type
-- ============================================================

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_type TEXT;

UPDATE public.customers
SET 
  customer_type = 'business',
  display_name = COALESCE(
    NULLIF(TRIM(company_name), ''), 
    NULLIF(TRIM(first_name || ' ' || last_name), ''), 
    'Kunde ' || SUBSTRING(id::text, 1, 8)
  )
WHERE display_name IS NULL OR customer_type IS NULL;
