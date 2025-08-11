-- Add missing fields to customers table that are used in the AddCustomerDialog
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS anrede TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fax TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS zahlungsziel TEXT DEFAULT '30';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS skonto_prozent TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS skonto_tage TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS waehrung TEXT DEFAULT 'EUR';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS preisgruppe TEXT DEFAULT 'Standard';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bic TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS kontoinhaber TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS zugprd_status TEXT DEFAULT 'Inaktiv';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS benutzer_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passwort TEXT;

-- Add CHECK constraint for zugprd_status
ALTER TABLE public.customers ADD CONSTRAINT check_zugprd_status CHECK (zugprd_status IN ('Aktiv', 'Inaktiv'));

-- Add CHECK constraint for waehrung
ALTER TABLE public.customers ADD CONSTRAINT check_waehrung CHECK (waehrung IN ('EUR', 'USD', 'GBP'));

-- Add CHECK constraint for preisgruppe
ALTER TABLE public.customers ADD CONSTRAINT check_preisgruppe CHECK (preisgruppe IN ('Standard', 'Premium', 'VIP'));

-- Add CHECK constraint for anrede
ALTER TABLE public.customers ADD CONSTRAINT check_anrede CHECK (anrede IN ('Herr', 'Frau', 'Divers', ''));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_first_name ON public.customers(first_name);
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON public.customers(last_name);
CREATE INDEX IF NOT EXISTS idx_customers_website ON public.customers(website);