-- ============================================================
-- Phase 1.6: Update invoices backfill
-- Add project_id, offer_id, snapshot and gross amount fields
-- ============================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS snapshot_customer_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS snapshot_customer_address TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS snapshot_tax_number TEXT;

-- Use total_amount as gross_amount and rename it to match Soll-Datenmatrix
DO $$ 
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='total_amount') THEN
    EXECUTE 'ALTER TABLE public.invoices RENAME COLUMN total_amount TO gross_amount';
  END IF;
END $$;
