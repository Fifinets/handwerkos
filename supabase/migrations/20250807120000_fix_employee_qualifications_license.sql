-- Fix missing qualifications and license columns in employees table
-- This ensures the columns exist even if previous migration wasn't applied

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS qualifications TEXT,
ADD COLUMN IF NOT EXISTS license TEXT;

-- Update any existing employee records that might have NULL values
UPDATE public.employees 
SET qualifications = '[]' 
WHERE qualifications IS NULL;

UPDATE public.employees 
SET license = '' 
WHERE license IS NULL;