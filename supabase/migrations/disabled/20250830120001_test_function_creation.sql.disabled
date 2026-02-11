-- Test Function Creation - Diagnostic Version
-- This will help identify why function creation is failing

-- First, let's test if we can create a simple function
CREATE OR REPLACE FUNCTION public.test_function()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Function creation works';
END;
$$ LANGUAGE plpgsql;

-- Test if the function was created
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'test_function' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION 'Test function was not created successfully';
    ELSE
        RAISE NOTICE 'Test function created successfully';
    END IF;
END $$;

-- Now try to create the supplier matching function with error handling
DO $$ 
BEGIN
    BEGIN
        EXECUTE '
        CREATE OR REPLACE FUNCTION public.fn_find_supplier_matches(
            p_company_id UUID,
            p_name TEXT,
            p_vat_id TEXT DEFAULT NULL,
            p_iban TEXT DEFAULT NULL
        )
        RETURNS TABLE(
            supplier_id UUID,
            match_score DECIMAL(3,2),
            match_reason TEXT
        ) AS $func$
        BEGIN
            RETURN QUERY
            SELECT 
                s.id,
                0.90::DECIMAL(3,2),
                ''Exact name match''
            FROM public.suppliers s
            WHERE s.company_id = p_company_id 
                AND s.is_active = true
                AND lower(s.name) = lower(trim(p_name))
            LIMIT 10;
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ';
        
        RAISE NOTICE 'fn_find_supplier_matches created successfully';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating fn_find_supplier_matches: % %', SQLSTATE, SQLERRM;
        RAISE;
    END;
END $$;

-- Test if the function exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'fn_find_supplier_matches' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE 'fn_find_supplier_matches exists and is callable';
    ELSE
        RAISE EXCEPTION 'fn_find_supplier_matches was not created';
    END IF;
END $$;

-- Clean up test function
DROP FUNCTION IF EXISTS public.test_function();