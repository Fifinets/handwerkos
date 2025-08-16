-- Update existing projects with company_id from user profiles
-- This fixes the issue where old projects are not visible due to missing company_id

-- Update existing projects without company_id to use the first available company
-- (This assumes all current projects belong to the same company)

DO $$
DECLARE
    default_company_id uuid;
BEGIN
    -- Get the first company ID from the companies table
    SELECT id INTO default_company_id 
    FROM public.companies 
    LIMIT 1;
    
    -- If we have a company, update all projects without company_id
    IF default_company_id IS NOT NULL THEN
        UPDATE public.projects 
        SET company_id = default_company_id 
        WHERE company_id IS NULL;
        
        RAISE NOTICE 'Updated % projects with company_id %', 
            (SELECT COUNT(*) FROM public.projects WHERE company_id = default_company_id),
            default_company_id;
    ELSE
        RAISE NOTICE 'No company found, please create a company first';
    END IF;
END $$;