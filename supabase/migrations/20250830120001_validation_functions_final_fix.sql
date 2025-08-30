-- Validation Functions and Business Logic - Phase 2 (Final Fix)
-- Implements comprehensive validation, duplicate detection, and business rules

-- 1. Sum validation trigger for supplier invoices
CREATE OR REPLACE FUNCTION public.fn_enforce_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    calculated_net DECIMAL(12,2);
    calculated_tax DECIMAL(12,2);
    tolerance DECIMAL(12,2) := 0.01; -- 1 cent tolerance
BEGIN
    -- Skip validation if totals are null (during partial updates)
    IF NEW.net_total IS NULL OR NEW.vat_total IS NULL OR NEW.gross_total IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Validate gross = net + vat
    IF ABS(ROUND(NEW.net_total + NEW.vat_total, 2) - ROUND(NEW.gross_total, 2)) > tolerance THEN
        RAISE EXCEPTION 'Invoice totals mismatch: net (%) + vat (%) != gross (%). Difference: %', 
            NEW.net_total, NEW.vat_total, NEW.gross_total,
            ABS(NEW.net_total + NEW.vat_total - NEW.gross_total);
    END IF;
    
    -- If invoice has items, validate against line item totals
    IF EXISTS (SELECT 1 FROM public.supplier_invoice_items WHERE invoice_id = NEW.id) THEN
        SELECT 
            COALESCE(SUM(net_amount), 0),
            COALESCE(SUM(tax_amount), 0)
        INTO calculated_net, calculated_tax
        FROM public.supplier_invoice_items 
        WHERE invoice_id = NEW.id;
        
        -- Check net total against line items
        IF ABS(calculated_net - NEW.net_total) > tolerance THEN
            RAISE EXCEPTION 'Net total (%) does not match sum of line items (%). Difference: %',
                NEW.net_total, calculated_net, ABS(calculated_net - NEW.net_total);
        END IF;
        
        -- Check tax total against line items
        IF ABS(calculated_tax - NEW.vat_total) > tolerance THEN
            RAISE EXCEPTION 'Tax total (%) does not match sum of line item taxes (%). Difference: %',
                NEW.vat_total, calculated_tax, ABS(calculated_tax - NEW.vat_total);
        END IF;
    END IF;
    
    -- If invoice has tax lines, validate against tax breakdown
    IF EXISTS (SELECT 1 FROM public.supplier_invoice_taxes WHERE invoice_id = NEW.id) THEN
        SELECT COALESCE(SUM(tax_amount), 0)
        INTO calculated_tax
        FROM public.supplier_invoice_taxes 
        WHERE invoice_id = NEW.id;
        
        IF ABS(calculated_tax - NEW.vat_total) > tolerance THEN
            RAISE EXCEPTION 'Tax total (%) does not match sum of tax lines (%). Difference: %',
                NEW.vat_total, calculated_tax, ABS(calculated_tax - NEW.vat_total);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trg_enforce_invoice_totals ON public.supplier_invoices;
CREATE TRIGGER trg_enforce_invoice_totals
    BEFORE INSERT OR UPDATE ON public.supplier_invoices
    FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_invoice_totals();

-- 2. Payment status update trigger
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
    SELECT id, gross_total, due_date 
    INTO invoice_rec
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

-- 3. Overdue status management function (called by scheduler)
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

-- 4. Supplier matching function
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
    name_normalized := lower(trim(p_name));
    
    RETURN QUERY
    WITH matches AS (
        SELECT 
            s.id,
            CASE
                -- Exact VAT ID match (highest confidence)
                WHEN p_vat_id IS NOT NULL AND s.vat_id = p_vat_id THEN 1.00
                -- Exact IBAN match
                WHEN p_iban IS NOT NULL AND s.iban = p_iban THEN 0.95
                -- Exact name match
                WHEN lower(s.name) = name_normalized THEN 0.90
                -- Partial name match
                WHEN lower(s.name) LIKE '%' || name_normalized || '%' OR 
                     name_normalized LIKE '%' || lower(s.name) || '%' THEN 0.60
                ELSE 0.00
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
    )
    SELECT m.id, m.score, m.reason
    FROM matches m
    WHERE m.score > 0
    ORDER BY m.score DESC, m.id
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Duplicate detection function
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
DECLARE
    amount_tolerance DECIMAL(12,2) := 1.00; -- 1 Euro tolerance
    date_tolerance INTEGER := 7; -- 7 days tolerance
BEGIN
    RETURN QUERY
    WITH existing_invoices AS (
        SELECT 
            si.id,
            si.invoice_number,
            si.invoice_date,
            si.gross_total,
            si.supplier_id,
            COALESCE(s.name, 'Unknown Supplier') as existing_supplier_name
        FROM public.supplier_invoices si
        LEFT JOIN public.suppliers s ON si.supplier_id = s.id
        WHERE si.company_id = p_company_id
            AND (p_exclude_invoice_id IS NULL OR si.id != p_exclude_invoice_id)
            AND si.approval_status != 'rejected'
    ),
    duplicates AS (
        SELECT 
            ei.id,
            CASE
                -- Exact duplicate (same supplier, number, date)
                WHEN ei.supplier_id = p_supplier_id 
                    AND ei.invoice_number = p_invoice_number 
                    AND ei.invoice_date = p_invoice_date THEN 'exact'
                -- Same supplier, number, different date
                WHEN ei.supplier_id = p_supplier_id 
                    AND ei.invoice_number = p_invoice_number 
                    AND ABS(ei.invoice_date - p_invoice_date) <= date_tolerance THEN 'likely'
                -- Same supplier, amount, similar date
                WHEN ei.supplier_id = p_supplier_id
                    AND ABS(ei.gross_total - p_gross_total) <= amount_tolerance
                    AND ABS(ei.invoice_date - p_invoice_date) <= date_tolerance THEN 'possible'
                -- Different supplier but same number and amount (rare but possible)
                WHEN ei.invoice_number = p_invoice_number
                    AND ABS(ei.gross_total - p_gross_total) <= amount_tolerance
                    AND ABS(ei.invoice_date - p_invoice_date) <= date_tolerance THEN 'cross_supplier'
                ELSE NULL
            END as dup_type,
            CASE
                WHEN ei.supplier_id = p_supplier_id 
                    AND ei.invoice_number = p_invoice_number 
                    AND ei.invoice_date = p_invoice_date THEN 1.00
                WHEN ei.supplier_id = p_supplier_id 
                    AND ei.invoice_number = p_invoice_number 
                    AND ABS(ei.invoice_date - p_invoice_date) <= date_tolerance THEN 0.85
                WHEN ei.supplier_id = p_supplier_id
                    AND ABS(ei.gross_total - p_gross_total) <= amount_tolerance
                    AND ABS(ei.invoice_date - p_invoice_date) <= date_tolerance THEN 0.70
                WHEN ei.invoice_number = p_invoice_number
                    AND ABS(ei.gross_total - p_gross_total) <= amount_tolerance
                    AND ABS(ei.invoice_date - p_invoice_date) <= date_tolerance THEN 0.60
                ELSE 0.00
            END as confidence,
            jsonb_build_object(
                'existing_invoice_number', ei.invoice_number,
                'existing_date', ei.invoice_date,
                'existing_amount', ei.gross_total,
                'existing_supplier', ei.existing_supplier_name,
                'date_difference_days', ABS(ei.invoice_date - p_invoice_date),
                'amount_difference', ABS(ei.gross_total - p_gross_total)
            ) as detail_info
        FROM existing_invoices ei
    )
    SELECT d.id, d.dup_type, d.confidence, d.detail_info
    FROM duplicates d
    WHERE d.dup_type IS NOT NULL
    ORDER BY d.confidence DESC, d.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Main import validation function
CREATE OR REPLACE FUNCTION public.fn_validate_invoice_data(
    p_structured_data JSONB,
    p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    validation_result JSONB := '{"valid": true, "errors": [], "warnings": []}';
    errors TEXT[] := ARRAY[]::TEXT[];
    warnings TEXT[] := ARRAY[]::TEXT[];
    
    -- Extract key fields
    invoice_number TEXT;
    invoice_date TEXT;
    gross_total DECIMAL(12,2);
    net_total DECIMAL(12,2);
    supplier_name TEXT;
    items JSONB;
    taxes JSONB;
    
    item JSONB;
    tax JSONB;
    calculated_net DECIMAL(12,2) := 0;
    calculated_tax DECIMAL(12,2) := 0;
BEGIN
    -- Extract structured data
    invoice_number := p_structured_data->'invoice'->>'number';
    invoice_date := p_structured_data->'invoice'->>'date';
    gross_total := (p_structured_data->'totals'->>'gross')::DECIMAL(12,2);
    net_total := (p_structured_data->'totals'->>'net')::DECIMAL(12,2);
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
        -- Validate date format and range
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
    
    -- Validate items if present
    IF items IS NOT NULL AND jsonb_array_length(items) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(items)
        LOOP
            IF item->>'description' IS NULL OR trim(item->>'description') = '' THEN
                errors := errors || 'Item description is required';
            END IF;
            
            IF (item->>'net')::DECIMAL(12,2) <= 0 THEN
                errors := errors || 'Item net amount must be greater than 0';
            END IF;
            
            calculated_net := calculated_net + COALESCE((item->>'net')::DECIMAL(12,2), 0);
        END LOOP;
        
        -- Check if calculated net matches declared net
        IF net_total IS NOT NULL AND ABS(calculated_net - net_total) > 0.01 THEN
            warnings := warnings || format('Item totals (%.2f) do not match declared net total (%.2f)', 
                calculated_net, net_total);
        END IF;
    END IF;
    
    -- Validate taxes if present
    IF taxes IS NOT NULL AND jsonb_array_length(taxes) > 0 THEN
        FOR tax IN SELECT * FROM jsonb_array_elements(taxes)
        LOOP
            IF (tax->>'rate')::DECIMAL(5,2) < 0 OR (tax->>'rate')::DECIMAL(5,2) > 100 THEN
                errors := errors || 'Invalid tax rate: ' || (tax->>'rate');
            END IF;
            
            calculated_tax := calculated_tax + COALESCE((tax->>'amount')::DECIMAL(12,2), 0);
        END LOOP;
    END IF;
    
    -- Build final result
    validation_result := jsonb_build_object(
        'valid', array_length(errors, 1) IS NULL,
        'errors', to_jsonb(errors),
        'warnings', to_jsonb(warnings),
        'calculated_totals', jsonb_build_object(
            'net_from_items', calculated_net,
            'tax_from_breakdown', calculated_tax
        )
    );
    
    RETURN validation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. View for overdue invoices (FIXED - no duplicate column names)
CREATE OR REPLACE VIEW public.v_overdue_invoices AS
SELECT 
    i.id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.gross_total,
    i.payment_status,
    i.approval_status,
    i.company_id,
    i.supplier_id,
    i.created_at,
    i.updated_at,
    COALESCE(s.name, 'Unknown Supplier') as supplier_name,
    GREATEST(0, (CURRENT_DATE - i.due_date)) AS days_overdue,
    COALESCE(paid.total_paid, 0) as total_paid,
    (i.gross_total - COALESCE(paid.total_paid, 0)) as outstanding_amount
FROM public.supplier_invoices i
LEFT JOIN public.suppliers s ON i.supplier_id = s.id
LEFT JOIN (
    SELECT 
        invoice_id,
        SUM(amount) as total_paid
    FROM public.supplier_invoice_payments
    GROUP BY invoice_id
) paid ON i.id = paid.invoice_id
WHERE i.payment_status IN ('unpaid', 'partly_paid')
    AND i.due_date IS NOT NULL
    AND i.due_date < CURRENT_DATE
    AND i.approval_status = 'approved';

-- 8. Function to get invoice summary stats
CREATE OR REPLACE FUNCTION public.fn_get_invoice_stats(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH stats AS (
        SELECT 
            COUNT(*) as total_invoices,
            COUNT(*) FILTER (WHERE payment_status = 'unpaid') as unpaid_count,
            COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count,
            COUNT(*) FILTER (WHERE payment_status = 'overdue') as overdue_count,
            COUNT(*) FILTER (WHERE approval_status = 'pending') as pending_approval,
            COALESCE(SUM(gross_total), 0) as total_amount,
            COALESCE(SUM(gross_total) FILTER (WHERE payment_status = 'unpaid'), 0) as unpaid_amount,
            COALESCE(SUM(gross_total) FILTER (WHERE payment_status = 'overdue'), 0) as overdue_amount
        FROM public.supplier_invoices
        WHERE company_id = p_company_id
    )
    SELECT jsonb_build_object(
        'total_invoices', total_invoices,
        'unpaid_count', unpaid_count,
        'paid_count', paid_count,
        'overdue_count', overdue_count,
        'pending_approval', pending_approval,
        'total_amount', total_amount,
        'unpaid_amount', unpaid_amount,
        'overdue_amount', overdue_amount
    ) INTO result
    FROM stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION public.fn_enforce_invoice_totals() IS 'Validates invoice totals consistency before insert/update';
COMMENT ON FUNCTION public.fn_update_payment_status() IS 'Automatically updates payment status based on recorded payments';
COMMENT ON FUNCTION public.fn_mark_overdue_invoices() IS 'Marks invoices as overdue when due date passes';
COMMENT ON FUNCTION public.fn_find_supplier_matches() IS 'Finds potential supplier matches for OCR data';
COMMENT ON FUNCTION public.fn_detect_invoice_duplicates() IS 'Detects potential duplicate invoices';
COMMENT ON FUNCTION public.fn_validate_invoice_data() IS 'Validates structured OCR data before import';