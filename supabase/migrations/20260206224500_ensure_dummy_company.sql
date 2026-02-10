-- Ensure companies table exists (minimal definition if missing)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- optional fields that might exist in other versions
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  vat_id TEXT
);

-- Ensure dummy company exists for users without a proper company assignment
-- This prevents FK violations in offers table
INSERT INTO public.companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Demo Company')
ON CONFLICT (id) DO NOTHING;
