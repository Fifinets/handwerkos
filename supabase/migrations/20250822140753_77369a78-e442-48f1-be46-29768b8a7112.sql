-- Final Function Security Fix
-- Address the remaining function search_path issue

-- The remaining function that likely needs search_path fix
ALTER FUNCTION public.has_role(text) SET search_path = '';

-- Also ensure the user-specific has_role function is secure
ALTER FUNCTION public.has_role(uuid, user_role) SET search_path = '';

-- Ensure create_company_settings_from_profile function is secure
ALTER FUNCTION public.create_company_settings_from_profile() SET search_path = '';

-- Check for any other functions that might need this
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT proname, prosrc 
        FROM pg_proc 
        WHERE pronamespace = 'public'::regnamespace 
        AND prosecdef = false  -- Not already SECURITY DEFINER
    LOOP
        -- This will help identify any remaining functions
        RAISE NOTICE 'Function: %', func_record.proname;
    END LOOP;
END $$;