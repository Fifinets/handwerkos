-- Ensure qualifications and license columns exist in employees table
-- This migration should be run manually in Supabase dashboard if auto-migration doesn't work

-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Add qualifications column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'qualifications' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.employees ADD COLUMN qualifications TEXT DEFAULT '[]';
    END IF;

    -- Add license column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'license' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.employees ADD COLUMN license TEXT DEFAULT '';
    END IF;
END $$;

-- Update existing employees to have empty qualifications array if NULL
UPDATE public.employees 
SET qualifications = '[]' 
WHERE qualifications IS NULL;

-- Update existing employees to have empty license if NULL  
UPDATE public.employees 
SET license = '' 
WHERE license IS NULL;

-- For existing invited employees, try to populate qualifications/license from employee_invitations
UPDATE public.employees e
SET 
  qualifications = COALESCE((
    SELECT (ei.employee_data->>'qualifications')::text 
    FROM public.employee_invitations ei 
    WHERE ei.email = e.email 
    AND ei.employee_data IS NOT NULL
    LIMIT 1
  ), '[]'),
  license = COALESCE((
    SELECT (ei.employee_data->>'license')::text 
    FROM public.employee_invitations ei 
    WHERE ei.email = e.email 
    AND ei.employee_data IS NOT NULL  
    LIMIT 1
  ), '')
WHERE e.qualifications = '[]' OR e.license = '';

-- Commit message for reference:
-- This migration adds qualifications and license columns to employees table
-- and populates them with data from employee_invitations where available