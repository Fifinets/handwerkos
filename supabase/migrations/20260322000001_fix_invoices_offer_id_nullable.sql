-- Make offer_id nullable on invoices table
-- Invoices can be created without an offer (e.g. from time entries / delivery notes)
ALTER TABLE public.invoices ALTER COLUMN offer_id DROP NOT NULL;
