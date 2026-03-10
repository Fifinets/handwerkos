-- ============================================================
-- Phase 1.5: Update offers backfill
-- Add project_id, rename snapshots, create dummy projects
-- ============================================================

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Idempotent rename of snapshot fields
DO $$ 
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='customer_name') THEN
    EXECUTE 'ALTER TABLE public.offers RENAME COLUMN customer_name TO snapshot_customer_name';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='customer_address') THEN
    EXECUTE 'ALTER TABLE public.offers RENAME COLUMN customer_address TO snapshot_customer_address';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='contact_person') THEN
    EXECUTE 'ALTER TABLE public.offers RENAME COLUMN contact_person TO snapshot_contact_name';
  END IF;
END $$;

-- Try to associate offers with existing project or create one
DO $$
DECLARE
  v_offer RECORD;
  v_project_id UUID;
BEGIN
  FOR v_offer IN SELECT id, customer_id, company_id, offer_number FROM public.offers WHERE project_id IS NULL LOOP
    -- Try to find an existing project for this customer
    SELECT id INTO v_project_id FROM public.projects WHERE customer_id = v_offer.customer_id ORDER BY created_at DESC LIMIT 1;
    
    -- If no project exists, create a dummy one safely
    IF v_project_id IS NULL THEN
      v_project_id := gen_random_uuid();
      INSERT INTO public.projects (id, company_id, customer_id, name, status)
      VALUES (v_project_id, v_offer.company_id, v_offer.customer_id, COALESCE(v_offer.offer_number, 'Legacy Projekt'), 'planned');
    END IF;
    
    UPDATE public.offers SET project_id = v_project_id WHERE id = v_offer.id;
  END LOOP;
END $$;
