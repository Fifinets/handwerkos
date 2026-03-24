-- Fix offers column names: rename snapshot_* back to original names
-- The columns were renamed in 20260307000005 but the RPC function
-- and all service/frontend code still reference the original names.

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='snapshot_customer_name') THEN
    EXECUTE 'ALTER TABLE public.offers RENAME COLUMN snapshot_customer_name TO customer_name';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='snapshot_customer_address') THEN
    EXECUTE 'ALTER TABLE public.offers RENAME COLUMN snapshot_customer_address TO customer_address';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offers' AND column_name='snapshot_contact_name') THEN
    EXECUTE 'ALTER TABLE public.offers RENAME COLUMN snapshot_contact_name TO contact_person';
  END IF;
END $$;
