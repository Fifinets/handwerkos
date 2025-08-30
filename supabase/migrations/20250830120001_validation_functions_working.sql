-- Validation Functions and Business Logic - Phase 2 (Working Version)
-- All essential functions for the OCR import pipeline

-- 1. Enhanced supplier matching function
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
    
    UNION ALL
    
    -- Possible duplicates (same supplier, similar amount, similar date)
    SELECT 
        si.id,
        'possible'::TEXT,
        0.70::DECIMAL(3,2),
        jsonb_build_object(
            'existing_invoice_number', si.invoice_number,
            'existing_date', si.invoice_date,
            'existing_amount', si.gross_total,
            'existing_supplier', COALESCE(s.name, 'Unknown Supplier'),
            'amount_difference', ABS(si.gross_total - p_gross_total),
            'date_difference_days', ABS(EXTRACT(days FROM si.invoice_date - p_invoice_date)),
            'match_type', 'possible_duplicate'
        )
    FROM public.supplier_invoices si
    LEFT JOIN public.suppliers s ON si.supplier_id = s.id
    WHERE si.company_id = p_company_id
        AND si.supplier_id = p_supplier_id
        AND ABS(si.gross_total - p_gross_total) <= 1.00
        AND ABS(EXTRACT(days FROM si.invoice_date - p_invoice_date)) <= 7
        AND NOT (si.invoice_number = p_invoice_number AND si.invoice_date = p_invoice_date)
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
    vat_total DECIMAL(12,2);
    supplier_name TEXT;
    items JSONB;
    taxes JSONB;
    
    item JSONB;
    calculated_net DECIMAL(12,2) := 0;
BEGIN
    -- Extract structured data
    invoice_number := p_structured_data->'invoice'->>'number';
    invoice_date := p_structured_data->'invoice'->>'date';
    gross_total := (p_structured_data->'totals'->>'gross')::DECIMAL(12,2);
    net_total := (p_structured_data->'totals'->>'net')::DECIMAL(12,2);
    vat_total := (p_structured_data->'totals'->>'vat')::DECIMAL(12,2);
    supplier_name := p_structured_data->'supplier'->>'name';
    items := p_structured_data->'items';
    taxes := p_structured_data->'totals'->'taxes';
    
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
    IF net_total IS NOT NULL AND vat_total IS NOT NULL AND gross_total IS NOT NULL THEN
        IF ABS((net_total + vat_total) - gross_total) > 0.01 THEN
            warnings := warnings || format('Total amounts may not add up correctly: %.2f + %.2f != %.2f', 
                net_total, vat_total, gross_total);
        END IF;
    END IF;
    
    IF net_total IS NOT NULL AND gross_total IS NOT NULL THEN
        IF net_total > gross_total THEN
            errors := errors || 'Net total cannot be greater than gross total';
        END IF;
    END IF;
    
    -- Validate items if present
    IF items IS NOT NULL AND jsonb_array_length(items) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(items)
        LOOP
            IF item->>'description' IS NULL OR trim(item->>'description') = '' THEN
                warnings := warnings || 'Item description is missing';
            END IF;
            
            IF COALESCE((item->>'net')::DECIMAL(12,2), 0) <= 0 THEN
                warnings := warnings || 'Item with zero or negative amount found';
            END IF;
            
            calculated_net := calculated_net + COALESCE((item->>'net')::DECIMAL(12,2), 0);
        END LOOP;
        
        -- Check if calculated net matches declared net
        IF net_total IS NOT NULL AND ABS(calculated_net - net_total) > 0.01 THEN
            warnings := warnings || format('Item totals (%.2f) do not match declared net total (%.2f)', 
                calculated_net, net_total);
        END IF;
    END IF;
    
    -- Build final result
    RETURN jsonb_build_object(
        'valid', array_length(errors, 1) IS NULL,
        'errors', to_jsonb(errors),
        'warnings', to_jsonb(warnings),
        'calculated_totals', jsonb_build_object(
            'net_from_items', calculated_net
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Sum validation trigger for supplier invoices
CREATE OR REPLACE FUNCTION public.fn_enforce_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    tolerance DECIMAL(12,2) := 0.01; -- 1 cent tolerance
BEGIN
    -- Skip validation if totals are null
    IF NEW.net_total IS NULL OR NEW.vat_total IS NULL OR NEW.gross_total IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Validate gross = net + vat (with tolerance)
    IF ABS(ROUND(NEW.net_total + NEW.vat_total, 2) - ROUND(NEW.gross_total, 2)) > tolerance THEN
        RAISE EXCEPTION 'Invoice totals mismatch: net (%) + vat (%) != gross (%). Difference: %', 
            NEW.net_total, NEW.vat_total, NEW.gross_total,
            ABS(NEW.net_total + NEW.vat_total - NEW.gross_total);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trg_enforce_invoice_totals ON public.supplier_invoices;
CREATE TRIGGER trg_enforce_invoice_totals
    BEFORE INSERT OR UPDATE ON public.supplier_invoices
    FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_invoice_totals();

-- 5. Payment status update trigger
CREATE OR REPLACE FUNCTION public.fn_update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    invoice_rec RECORD;
    paid_sum DECIMAL(12,2);
    target_invoice_id UUID;
BEGIN
    -- Determine which invoice to update
    IF TG_OP = 'DELETE' THEN
        target_invoice_id := OLD.invoice_id;
    ELSE
        target_invoice_id := NEW.invoice_id;
    END IF;
    
    -- Get invoice details
    SELECT id, gross_total INTO invoice_rec
    FROM public.supplier_invoices 
    WHERE id = target_invoice_id;
    
    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate total payments
    SELECT COALESCE(SUM(amount), 0) 
    INTO paid_sum
    FROM public.supplier_invoice_payments
    WHERE invoice_id = target_invoice_id;
    
    -- Update payment status
    UPDATE public.supplier_invoices
    SET 
        payment_status = CASE
            WHEN paid_sum <= 0 THEN 'unpaid'
            WHEN paid_sum >= invoice_rec.gross_total THEN 'paid'
            ELSE 'partly_paid'
        END,
        updated_at = now()
    WHERE id = target_invoice_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply payment status trigger
DROP TRIGGER IF EXISTS trg_update_payment_status ON public.supplier_invoice_payments;
CREATE TRIGGER trg_update_payment_status
    AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_payment_status();

-- 6. Function to mark overdue invoices
CREATE OR REPLACE FUNCTION public.fn_mark_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.supplier_invoices
    SET 
        payment_status = 'overdue',
        updated_at = now()
    WHERE payment_status IN ('unpaid', 'partly_paid')
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION public.fn_find_supplier_matches() IS 'Finds potential supplier matches for OCR data';
COMMENT ON FUNCTION public.fn_detect_invoice_duplicates() IS 'Detects potential duplicate invoices';
COMMENT ON FUNCTION public.fn_validate_invoice_data() IS 'Validates structured OCR data before import';
COMMENT ON FUNCTION public.fn_enforce_invoice_totals() IS 'Validates invoice totals consistency';
COMMENT ON FUNCTION public.fn_update_payment_status() IS 'Updates payment status based on payments';
COMMENT ON FUNCTION public.fn_mark_overdue_invoices() IS 'Marks overdue invoices (for scheduler)';