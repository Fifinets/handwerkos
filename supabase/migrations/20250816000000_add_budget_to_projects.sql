-- Add budget column to projects table
ALTER TABLE public.projects 
ADD COLUMN budget NUMERIC(12,2);

-- Add location column if not exists (for address from customer)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Update projects table to match the expected schema
COMMENT ON COLUMN public.projects.budget IS 'Project budget in euros';
COMMENT ON COLUMN public.projects.location IS 'Project location/address';