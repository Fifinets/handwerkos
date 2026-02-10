-- Create Marketplace Module Tables
-- 2026-02-08

-- 1. Create marketplace_jobs table
CREATE TABLE IF NOT EXISTS public.marketplace_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Link to user profile (can be null for guests initially?) -> No, enforce auth for posting? user said "erstmal kunden bekommen eine eigene rolle"
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g. 'sanitary', 'electrical', 'carpentry'
  location TEXT NOT NULL, -- postal code or city
  budget_range TEXT,      -- e.g. '1000-2000'
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create marketplace_bids table (Handwerker applies to Job)
CREATE TABLE IF NOT EXISTS public.marketplace_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.marketplace_jobs(id) ON DELETE CASCADE,
  craftsman_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- The craftsman user
  company_id UUID REFERENCES public.companies(id), -- Optional link to company
  
  message TEXT NOT NULL,
  price_estimate DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.marketplace_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_bids ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- JOBS:
-- Anyone can read open jobs (Public / Craftsmen)
CREATE POLICY "Public read access for open jobs" ON public.marketplace_jobs
  FOR SELECT USING (status = 'open' OR auth.uid() = customer_id);

-- Customers can insert their own jobs
CREATE POLICY "Customers can create jobs" ON public.marketplace_jobs
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own jobs
CREATE POLICY "Customers can update own jobs" ON public.marketplace_jobs
  FOR UPDATE USING (auth.uid() = customer_id);

-- BIDS:
-- Craftsmen can see bids they created
CREATE POLICY "Craftsmen see own bids" ON public.marketplace_bids
  FOR SELECT USING (auth.uid() = craftsman_id);

-- Customers can see bids on their jobs
CREATE POLICY "Customers see bids on their jobs" ON public.marketplace_bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_jobs
      WHERE id = marketplace_bids.job_id
      AND customer_id = auth.uid()
    )
  );

-- Craftsmen can insert bids
CREATE POLICY "Craftsmen can place bids" ON public.marketplace_bids
  FOR INSERT WITH CHECK (auth.uid() = craftsman_id);

-- 5. Updated_at Triggers (assuming function exists from previous migrations)
CREATE TRIGGER update_marketplace_jobs_timestamp
  BEFORE UPDATE ON public.marketplace_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_bids_timestamp
  BEFORE UPDATE ON public.marketplace_bids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
