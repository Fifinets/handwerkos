-- Validation Functions and Business Logic - Phase 2 (Final Version)
-- Creates essential functions for OCR import pipeline
-- This migration runs after all other 20250830120001_* migrations

-- Drop existing functions if they exist (to ensure clean state)
DROP FUNCTION IF EXISTS public.fn_find_supplier_matches(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_detect_invoice_duplicates(UUID, UUID, TEXT, DATE, DECIMAL, UUID);
DROP FUNCTION IF EXISTS public.fn_validate_invoice_data(JSONB, UUID);

-- 1. Supplier matching function
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
) AS $$
BEGIN
    -- Handle null or empty name
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        s.id,
        CASE
            WHEN p_vat_id IS NOT NULL AND s.vat_id = p_vat_id THEN 1.00::DECIMAL(3,2)
            WHEN p_iban IS NOT NULL AND s.iban = p_iban THEN 0.95::DECIMAL(3,2)
            WHEN lower(s.name) = lower(trim(p_name)) THEN 0.90::DECIMAL(3,2)
            WHEN lower(s.name) LIKE '%' || lower(trim(p_name)) || '%' OR 
                 lower(trim(p_name)) LIKE '%' || lower(s.name) || '%' THEN 0.60::DECIMAL(3,2)
            ELSE 0.00::DECIMAL(3,2)
        END as score,
        CASE
            WHEN p_vat_id IS NOT NULL AND s.vat_id = p_vat_id THEN 'Exact VAT ID match'
            WHEN p_iban IS NOT NULL AND s.iban = p_iban THEN 'Exact IBAN match'
            WHEN lower(s.name) = lower(trim(p_name)) THEN 'Exact name match'
            WHEN lower(s.name) LIKE '%' || lower(trim(p_name)) || '%' OR 
                 lower(trim(p_name)) LIKE '%' || lower(s.name) || '%' THEN 'Partial name match'
            ELSE 'No match'
        END as reason
    FROM public.suppliers s
    WHERE s.company_id = p_company_id 
        AND s.is_active = true
        AND (
            (p_vat_id IS NOT NULL AND s.vat_id = p_vat_id) OR
            (p_iban IS NOT NULL AND s.iban = p_iban) OR
            (lower(s.name) = lower(trim(p_name))) OR
            (lower(s.name) LIKE '%' || lower(trim(p_name)) || '%') OR
            (lower(trim(p_name)) LIKE '%' || lower(s.name) || '%')
        )
    ORDER BY score DESC, s.id
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Duplicate detection function
CREATE OR REPLACE FUNCTION public.fn_detect_invoice_duplicates(
    p_company_id UUID,
    p_supplier_id UUID,
    p_invoice_number TEXT,
    p_invoice_date DATE,
    p_gross_total DECIMAL(12,2),
    p_exclude_invoice_id UUID DEFAULT NULL
)
RETURNS TABLE(
    invoice_id UUID,
    duplicate_type TEXT,
    confidence DECIMAL(3,2),
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    -- Exact duplicates
    SELECT 
        si.id,
        'exact'::TEXT,
        1.00::DECIMAL(3,2),
        jsonb_build_object(
            'existing_invoice_number', si.invoice_number,
            'existing_date', si.invoice_date,
            'existing_amount', si.gross_total,
            'existing_supplier', COALESCE(s.name, 'Unknown Supplier'),
            'match_type', 'exact_match'
        )
    FROM public.supplier_invoices si
    LEFT JOIN public.suppliers s ON si.supplier_id = s.id
    WHERE si.company_id = p_company_id
        AND si.supplier_id = p_supplier_id
        AND si.invoice_number = p_invoice_number
        AND si.invoice_date = p_invoice_date
        AND (p_exclude_invoice_id IS NULL OR si.id != p_exclude_invoice_id)
        AND si.approval_status != 'rejected'
    
    UNION ALL
    
    -- Likely duplicates (same supplier, number, different date within 7 days)
    SELECT 
        si.id,
        'likely'::TEXT,
        0.85::DECIMAL(3,2),
        jsonb_build_object(
            'existing_invoice_number', si.invoice_number,
            'existing_date', si.invoice_date,
            'existing_amount', si.gross_total,
            'existing_supplier', COALESCE(s.name, 'Unknown Supplier'),
            'date_difference_days', ABS(EXTRACT(days FROM si.invoice_date - p_invoice_date)),
            'match_type', 'likely_duplicate'
        )
    FROM public.supplier_invoices si
    LEFT JOIN public.suppliers s ON si.supplier_id = s.id
    WHERE si.company_id = p_company_id
        AND si.supplier_id = p_supplier_id
        AND si.invoice_number = p_invoice_number
        AND ABS(EXTRACT(days FROM si.invoice_date - p_invoice_date)) <= 7
        AND si.invoice_date != p_invoice_date
        AND (p_exclude_invoice_id IS NULL OR si.id != p_exclude_invoice_id)
        AND si.approval_status != 'rejected'
    
    ORDER BY confidence DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Invoice data validation function
CREATE OR REPLACE FUNCTION public.fn_validate_invoice_data(
    p_structured_data JSONB,
    p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    errors TEXT[] := ARRAY[]::TEXT[];
    warnings TEXT[] := ARRAY[]::TEXT[];
    
    -- Extract key fields
    invoice_number TEXT;
    invoice_date TEXT;
    gross_total DECIMAL(12,2);
    net_total DECIMAL(12,2);
    supplier_name TEXT;
BEGIN
    -- Extract structured data
    invoice_number := p_structured_data->'invoice'->>'number';
    invoice_date := p_structured_data->'invoice'->>'date';
    gross_total := (p_structured_data->'totals'->>'gross')::DECIMAL(12,2);
    net_total := (p_structured_data->'totals'->>'net')::DECIMAL(12,2);
    supplier_name := p_structured_data->'supplier'->>'name';
    
    -- Validate required fields
    IF invoice_number IS NULL OR trim(invoice_number) = '' THEN
        errors := errors || 'Invoice number is required';
    END IF;
    
    IF invoice_date IS NULL THEN
        errors := errors || 'Invoice date is required';
    ELSE
        -- Validate date format
        BEGIN
            IF invoice_date::DATE > CURRENT_DATE + INTERVAL '7 days' THEN
                warnings := warnings || 'Invoice date is in the future';
            END IF;
            IF invoice_date::DATE < CURRENT_DATE - INTERVAL '2 years' THEN
                warnings := warnings || 'Invoice date is more than 2 years old';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            errors := errors || 'Invalid invoice date format';
        END;
    END IF;
    
    IF supplier_name IS NULL OR trim(supplier_name) = '' THEN
        errors := errors || 'Supplier name is required';
    END IF;
    
    IF gross_total IS NULL OR gross_total <= 0 THEN
        errors := errors || 'Gross total must be greater than 0';
    END IF;
    
    -- Validate totals consistency
    IF net_total IS NOT NULL AND gross_total IS NOT NULL THEN
        IF net_total > gross_total THEN
            errors := errors || 'Net total cannot be greater than gross total';
        END IF;
    END IF;
    
    -- Build final result
    RETURN jsonb_build_object(
        'valid', array_length(errors, 1) IS NULL,
        'errors', to_jsonb(errors),
        'warnings', to_jsonb(warnings)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify functions were created
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'fn_find_supplier_matches' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION 'fn_find_supplier_matches was not created successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'fn_detect_invoice_duplicates' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION 'fn_detect_invoice_duplicates was not created successfully';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'fn_validate_invoice_data' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION 'fn_validate_invoice_data was not created successfully';
    END IF;
    
    RAISE NOTICE 'All validation functions created successfully';
END $$;

-- Comments
COMMENT ON FUNCTION public.fn_find_supplier_matches(UUID, TEXT, TEXT, TEXT) IS 'Finds potential supplier matches for OCR data';
COMMENT ON FUNCTION public.fn_detect_invoice_duplicates(UUID, UUID, TEXT, DATE, DECIMAL, UUID) IS 'Detects potential duplicate invoices';
COMMENT ON FUNCTION public.fn_validate_invoice_data(JSONB, UUID) IS 'Validates structured OCR data before import';