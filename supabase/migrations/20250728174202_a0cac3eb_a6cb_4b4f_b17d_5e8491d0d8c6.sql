-- Add signature_url column to quotes and invoices tables
ALTER TABLE public.quotes 
ADD COLUMN signature_url TEXT;

ALTER TABLE public.invoices 
ADD COLUMN signature_url TEXT;