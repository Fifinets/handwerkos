-- Validation Functions and Business Logic - Phase 2 (Simple Version)
-- Just the essential functions first

-- 1. Check if supplier table exists (prerequisite)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suppliers') THEN
        RAISE EXCEPTION 'suppliers table must exist before running this migration. Please run the first migration first.';
    END IF;
END $$;

-- 2. Supplier matching function (needed by import pipeline)
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
DECLARE
    name_normalized TEXT;
BEGIN
    -- Handle null or empty name
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN;
    END IF;
    
    name_normalized := lower(trim(p_name));
    
    RETURN QUERY
    SELECT 
        s.id,
        CASE
            -- Exact VAT ID match (highest confidence)
            WHEN p_vat_id IS NOT NULL AND s.vat_id = p_vat_id THEN 1.00::DECIMAL(3,2)
            -- Exact IBAN match
            WHEN p_iban IS NOT NULL AND s.iban = p_iban THEN 0.95::DECIMAL(3,2)
            -- Exact name match
            WHEN lower(s.name) = name_normalized THEN 0.90::DECIMAL(3,2)
            -- Partial name match
            WHEN lower(s.name) LIKE '%' || name_normalized || '%' OR 
                 name_normalized LIKE '%' || lower(s.name) || '%' THEN 0.60::DECIMAL(3,2)
            ELSE 0.00::DECIMAL(3,2)
        END as score,
        CASE
            WHEN p_vat_id IS NOT NULL AND s.vat_id = p_vat_id THEN 'Exact VAT ID match'
            WHEN p_iban IS NOT NULL AND s.iban = p_iban THEN 'Exact IBAN match'
            WHEN lower(s.name) = name_normalized THEN 'Exact name match'
            WHEN lower(s.name) LIKE '%' || name_normalized || '%' OR 
                 name_normalized LIKE '%' || lower(s.name) || '%' THEN 'Partial name match'
            ELSE 'No match'
        END as reason
    FROM public.suppliers s
    WHERE s.company_id = p_company_id 
        AND s.is_active = true
        AND (
            (p_vat_id IS NOT NULL AND s.vat_id = p_vat_id) OR
            (p_iban IS NOT NULL AND s.iban = p_iban) OR
            (lower(s.name) = name_normalized) OR
            (lower(s.name) LIKE '%' || name_normalized || '%') OR
            (name_normalized LIKE '%' || lower(s.name) || '%')
        )
    ORDER BY score DESC, s.id
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Duplicate detection function (needed by import pipeline)
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
    SELECT 
        si.id,
        'exact'::TEXT,
        1.00::DECIMAL(3,2),
        jsonb_build_object(
            'existing_invoice_number', si.invoice_number,
            'existing_date', si.invoice_date,
            'existing_amount', si.gross_total,
            'existing_supplier', COALESCE(s.name, 'Unknown Supplier')
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
    
    SELECT 
        si.id,
        'likely'::TEXT,
        0.85::DECIMAL(3,2),
        jsonb_build_object(
            'existing_invoice_number', si.invoice_number,
            'existing_date', si.invoice_date,
            'existing_amount', si.gross_total,
            'existing_supplier', COALESCE(s.name, 'Unknown Supplier'),
            'date_difference_days', ABS(si.invoice_date - p_invoice_date)
        )
    FROM public.supplier_invoices si
    LEFT JOIN public.suppliers s ON si.supplier_id = s.id
    WHERE si.company_id = p_company_id
        AND si.supplier_id = p_supplier_id
        AND si.invoice_number = p_invoice_number
        AND ABS(si.invoice_date - p_invoice_date) <= 7
        AND NOT (si.supplier_id = p_supplier_id AND si.invoice_number = p_invoice_number AND si.invoice_date = p_invoice_date)
        AND (p_exclude_invoice_id IS NULL OR si.id != p_exclude_invoice_id)
        AND si.approval_status != 'rejected'
    
    ORDER BY confidence DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Basic validation function (needed by import pipeline)
CREATE OR REPLACE FUNCTION public.fn_validate_invoice_data(
    p_structured_data JSONB,
    p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    errors TEXT[] := ARRAY[]::TEXT[];
    warnings TEXT[] := ARRAY[]::TEXT[];
    invoice_number TEXT;
    supplier_name TEXT;
    gross_total DECIMAL(12,2);
BEGIN
    -- Extract basic required fields
    invoice_number := p_structured_data->'invoice'->>'number';
    supplier_name := p_structured_data->'supplier'->>'name';
    gross_total := (p_structured_data->'totals'->>'gross')::DECIMAL(12,2);
    
    -- Basic validation
    IF invoice_number IS NULL OR trim(invoice_number) = '' THEN
        errors := errors || 'Invoice number is required';
    END IF;
    
    IF supplier_name IS NULL OR trim(supplier_name) = '' THEN
        errors := errors || 'Supplier name is required';
    END IF;
    
    IF gross_total IS NULL OR gross_total <= 0 THEN
        errors := errors || 'Gross total must be greater than 0';
    END IF;
    
    RETURN jsonb_build_object(
        'valid', array_length(errors, 1) IS NULL,
        'errors', to_jsonb(errors),
        'warnings', to_jsonb(warnings)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION public.fn_find_supplier_matches() IS 'Finds potential supplier matches for OCR data';
COMMENT ON FUNCTION public.fn_detect_invoice_duplicates() IS 'Detects potential duplicate invoices';
COMMENT ON FUNCTION public.fn_validate_invoice_data() IS 'Validates structured OCR data before import';