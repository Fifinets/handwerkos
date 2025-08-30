-- Import Pipeline RPC Functions - Phase 3
-- Main business logic for importing OCR results into normalized invoice data

-- 1. Main import function - converts OCR result to supplier invoice
CREATE OR REPLACE FUNCTION public.rpc_import_supplier_invoice_from_ocr(
    p_ocr_result_id UUID,
    p_company_id UUID,
    p_auto_approve BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    ocr_rec RECORD;
    supplier_rec RECORD;
    invoice_id UUID;
    validation_result JSONB;
    duplicate_check JSONB;
    supplier_matches JSONB;
    
    -- Extracted data
    structured_data JSONB;
    invoice_number TEXT;
    invoice_date DATE;
    due_date DATE;
    gross_total DECIMAL(12,2);
    net_total DECIMAL(12,2);
    vat_total DECIMAL(12,2);
    supplier_name TEXT;
    supplier_vat_id TEXT;
    supplier_iban TEXT;
    currency TEXT;
    payment_terms TEXT;
    
    item JSONB;
    tax JSONB;
    result JSONB;
BEGIN
    -- Get OCR result
    SELECT * INTO ocr_rec
    FROM public.ocr_results
    WHERE id = p_ocr_result_id 
        AND company_id = p_company_id
        AND status = 'validated';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'OCR result not found or not validated',
            'code', 'OCR_NOT_FOUND'
        );
    END IF;
    
    structured_data := ocr_rec.structured_data;
    
    -- Extract invoice data
    invoice_number := structured_data->'invoice'->>'number';
    invoice_date := (structured_data->'invoice'->>'date')::DATE;
    due_date := (structured_data->'invoice'->>'due_date')::DATE;
    gross_total := (structured_data->'totals'->>'gross')::DECIMAL(12,2);
    net_total := (structured_data->'totals'->>'net')::DECIMAL(12,2);
    currency := COALESCE(structured_data->'invoice'->>'currency', 'EUR');
    payment_terms := structured_data->'invoice'->>'payment_terms';
    
    -- Extract supplier data
    supplier_name := structured_data->'supplier'->>'name';
    supplier_vat_id := structured_data->'supplier'->>'vat_id';
    supplier_iban := structured_data->'supplier'->>'iban';
    
    -- Calculate VAT total from taxes array
    vat_total := 0;
    IF structured_data->'totals'->'taxes' IS NOT NULL THEN
        FOR tax IN SELECT * FROM jsonb_array_elements(structured_data->'totals'->'taxes')
        LOOP
            vat_total := vat_total + COALESCE((tax->>'amount')::DECIMAL(12,2), 0);
        END LOOP;
    END IF;
    
    -- Validate data
    SELECT public.fn_validate_invoice_data(structured_data, p_company_id) INTO validation_result;
    
    IF NOT (validation_result->>'valid')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Validation failed',
            'code', 'VALIDATION_ERROR',
            'details', validation_result
        );
    END IF;
    
    -- Find or create supplier
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'supplier_id', supplier_id,
                'match_score', match_score,
                'match_reason', match_reason
            )
        ) INTO supplier_matches
    FROM public.fn_find_supplier_matches(p_company_id, supplier_name, supplier_vat_id, supplier_iban)
    WHERE match_score > 0.7;
    
    -- Use best match or create new supplier
    IF supplier_matches IS NOT NULL AND jsonb_array_length(supplier_matches) > 0 THEN
        -- Use the best match
        SELECT id INTO supplier_rec
        FROM public.suppliers
        WHERE id = (supplier_matches->0->>'supplier_id')::UUID;
    ELSE
        -- Create new supplier
        INSERT INTO public.suppliers (
            company_id, name, vat_id, iban, created_by
        ) VALUES (
            p_company_id, supplier_name, supplier_vat_id, supplier_iban, auth.uid()
        ) RETURNING * INTO supplier_rec;
    END IF;
    
    -- Check for duplicates
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'invoice_id', invoice_id,
                'duplicate_type', duplicate_type,
                'confidence', confidence,
                'details', details
            )
        ) INTO duplicate_check
    FROM public.fn_detect_invoice_duplicates(
        p_company_id, supplier_rec.id, invoice_number, invoice_date, gross_total
    )
    WHERE confidence > 0.7;
    
    -- Block exact duplicates
    IF duplicate_check IS NOT NULL AND jsonb_array_length(duplicate_check) > 0 THEN
        IF (duplicate_check->0->>'duplicate_type') = 'exact' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Exact duplicate invoice found',
                'code', 'DUPLICATE_INVOICE',
                'details', duplicate_check
            );
        END IF;
    END IF;
    
    -- Create supplier invoice
    INSERT INTO public.supplier_invoices (
        company_id,
        supplier_id,
        invoice_number,
        invoice_date,
        due_date,
        currency,
        net_total,
        vat_total,
        gross_total,
        payment_terms,
        payment_status,
        approval_status,
        ocr_result_id,
        immutable_file_id,
        created_by
    ) VALUES (
        p_company_id,
        supplier_rec.id,
        invoice_number,
        invoice_date,
        due_date,
        currency,
        net_total,
        vat_total,
        gross_total,
        payment_terms,
        'unpaid',
        CASE WHEN p_auto_approve THEN 'approved' ELSE 'pending' END,
        p_ocr_result_id,
        (SELECT immutable_file_id FROM public.ocr_results WHERE id = p_ocr_result_id),
        auth.uid()
    ) RETURNING id INTO invoice_id;
    
    -- Insert tax lines
    IF structured_data->'totals'->'taxes' IS NOT NULL THEN
        FOR tax IN SELECT * FROM jsonb_array_elements(structured_data->'totals'->'taxes')
        LOOP
            INSERT INTO public.supplier_invoice_taxes (
                invoice_id,
                tax_rate,
                base_amount,
                tax_amount,
                tax_type
            ) VALUES (
                invoice_id,
                (tax->>'rate')::DECIMAL(5,2),
                (tax->>'base')::DECIMAL(12,2),
                (tax->>'amount')::DECIMAL(12,2),
                CASE 
                    WHEN (tax->>'rate')::DECIMAL(5,2) = 0 THEN 'exempt'
                    WHEN (tax->>'rate')::DECIMAL(5,2) = 7 THEN 'reduced'
                    ELSE 'standard'
                END
            );
        END LOOP;
    END IF;
    
    -- Insert line items
    IF structured_data->'items' IS NOT NULL THEN
        FOR item IN SELECT * FROM jsonb_array_elements(structured_data->'items')
        LOOP
            INSERT INTO public.supplier_invoice_items (
                invoice_id,
                position_no,
                description,
                quantity,
                unit,
                unit_price,
                discount_percent,
                net_amount,
                tax_rate,
                tax_amount
            ) VALUES (
                invoice_id,
                (item->>'pos')::INT,
                item->>'description',
                COALESCE((item->>'qty')::DECIMAL(12,3), 1),
                COALESCE(item->>'unit', 'Stk'),
                (item->>'unit_price')::DECIMAL(12,4),
                COALESCE((item->>'discount_percent')::DECIMAL(5,2), 0),
                (item->>'net')::DECIMAL(12,2),
                (item->>'tax_rate')::DECIMAL(5,2),
                -- Calculate tax amount
                ROUND((item->>'net')::DECIMAL(12,2) * (item->>'tax_rate')::DECIMAL(5,2) / 100, 2)
            );
        END LOOP;
    END IF;
    
    -- Update OCR result status
    UPDATE public.ocr_results
    SET 
        status = 'imported',
        updated_at = now()
    WHERE id = p_ocr_result_id;
    
    -- Create audit log entry
    PERFORM public.create_audit_entry(
        'supplier_invoices',
        invoice_id,
        'INSERT',
        NULL,
        to_jsonb((SELECT * FROM public.supplier_invoices WHERE id = invoice_id)),
        NULL,
        'Invoice imported from OCR result ' || p_ocr_result_id::TEXT
    );
    
    -- Build success result
    result := jsonb_build_object(
        'success', true,
        'invoice_id', invoice_id,
        'supplier_id', supplier_rec.id,
        'supplier_was_created', supplier_matches IS NULL,
        'validation_result', validation_result
    );
    
    -- Add warnings for duplicates
    IF duplicate_check IS NOT NULL AND jsonb_array_length(duplicate_check) > 0 THEN
        result := result || jsonb_build_object('duplicate_warnings', duplicate_check);
    END IF;
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error and return failure
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE,
        'details', jsonb_build_object(
            'ocr_result_id', p_ocr_result_id,
            'company_id', p_company_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Revalidate existing invoice
CREATE OR REPLACE FUNCTION public.rpc_revalidate_invoice(
    p_invoice_id UUID,
    p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    invoice_rec RECORD;
    validation_errors TEXT[] := ARRAY[]::TEXT[];
    net_from_items DECIMAL(12,2);
    tax_from_items DECIMAL(12,2);
    tax_from_lines DECIMAL(12,2);
    tolerance DECIMAL(12,2) := 0.01;
BEGIN
    -- Get invoice
    SELECT * INTO invoice_rec
    FROM public.supplier_invoices
    WHERE id = p_invoice_id AND company_id = p_company_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice not found'
        );
    END IF;
    
    -- Validate totals
    IF invoice_rec.net_total IS NOT NULL AND invoice_rec.vat_total IS NOT NULL THEN
        IF ABS(invoice_rec.net_total + invoice_rec.vat_total - invoice_rec.gross_total) > tolerance THEN
            validation_errors := validation_errors || 'Net + VAT does not equal gross total';
        END IF;
    END IF;
    
    -- Check line items
    SELECT 
        COALESCE(SUM(net_amount), 0),
        COALESCE(SUM(tax_amount), 0)
    INTO net_from_items, tax_from_items
    FROM public.supplier_invoice_items
    WHERE invoice_id = p_invoice_id;
    
    IF net_from_items > 0 THEN
        IF invoice_rec.net_total IS NOT NULL AND ABS(net_from_items - invoice_rec.net_total) > tolerance THEN
            validation_errors := validation_errors || format('Line items net (%.2f) does not match invoice net (%.2f)', 
                net_from_items, invoice_rec.net_total);
        END IF;
    END IF;
    
    -- Check tax lines
    SELECT COALESCE(SUM(tax_amount), 0)
    INTO tax_from_lines
    FROM public.supplier_invoice_taxes
    WHERE invoice_id = p_invoice_id;
    
    IF tax_from_lines > 0 THEN
        IF invoice_rec.vat_total IS NOT NULL AND ABS(tax_from_lines - invoice_rec.vat_total) > tolerance THEN
            validation_errors := validation_errors || format('Tax lines (%.2f) do not match invoice VAT (%.2f)', 
                tax_from_lines, invoice_rec.vat_total);
        END IF;
    END IF;
    
    -- Update validation status
    UPDATE public.supplier_invoices
    SET 
        validation_errors = to_jsonb(validation_errors),
        updated_at = now()
    WHERE id = p_invoice_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'valid', array_length(validation_errors, 1) IS NULL,
        'errors', to_jsonb(validation_errors),
        'totals_check', jsonb_build_object(
            'net_from_items', net_from_items,
            'tax_from_items', tax_from_items,
            'tax_from_lines', tax_from_lines
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mark invoice as paid
CREATE OR REPLACE FUNCTION public.rpc_mark_invoice_paid(
    p_invoice_id UUID,
    p_amount DECIMAL(12,2),
    p_paid_at TIMESTAMPTZ,
    p_reference TEXT DEFAULT NULL,
    p_bank_tx_id TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    invoice_rec RECORD;
    payment_id UUID;
BEGIN
    -- Get invoice with company check
    SELECT * INTO invoice_rec
    FROM public.supplier_invoices
    WHERE id = p_invoice_id 
        AND (p_company_id IS NULL OR company_id = p_company_id);
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice not found'
        );
    END IF;
    
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Payment amount must be greater than 0'
        );
    END IF;
    
    -- Insert payment record
    INSERT INTO public.supplier_invoice_payments (
        invoice_id,
        amount,
        paid_at,
        payment_reference,
        bank_transaction_id,
        created_by
    ) VALUES (
        p_invoice_id,
        p_amount,
        p_paid_at,
        p_reference,
        p_bank_tx_id,
        auth.uid()
    ) RETURNING id INTO payment_id;
    
    -- Payment status will be updated automatically by trigger
    
    -- Create audit log
    PERFORM public.create_audit_entry(
        'supplier_invoice_payments',
        payment_id,
        'INSERT',
        NULL,
        to_jsonb((SELECT * FROM public.supplier_invoice_payments WHERE id = payment_id)),
        NULL,
        'Payment recorded for invoice ' || p_invoice_id::TEXT
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'payment_id', payment_id,
        'new_status', (
            SELECT payment_status 
            FROM public.supplier_invoices 
            WHERE id = p_invoice_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Approve/reject invoice
CREATE OR REPLACE FUNCTION public.rpc_set_invoice_approval(
    p_invoice_id UUID,
    p_approval_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    invoice_rec RECORD;
    old_status TEXT;
BEGIN
    -- Validate status
    IF p_approval_status NOT IN ('approved', 'rejected', 'pending') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid approval status'
        );
    END IF;
    
    -- Get current invoice
    SELECT * INTO invoice_rec
    FROM public.supplier_invoices
    WHERE id = p_invoice_id 
        AND (p_company_id IS NULL OR company_id = p_company_id);
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice not found'
        );
    END IF;
    
    old_status := invoice_rec.approval_status;
    
    -- Update approval status
    UPDATE public.supplier_invoices
    SET 
        approval_status = p_approval_status,
        updated_at = now()
    WHERE id = p_invoice_id;
    
    -- Create audit log
    PERFORM public.create_audit_entry(
        'supplier_invoices',
        p_invoice_id,
        'STATUS_CHANGE',
        jsonb_build_object('approval_status', old_status),
        jsonb_build_object('approval_status', p_approval_status),
        ARRAY['approval_status'],
        COALESCE(p_reason, 'Approval status changed to ' || p_approval_status)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'old_status', old_status,
        'new_status', p_approval_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Get invoice with full details
CREATE OR REPLACE FUNCTION public.rpc_get_invoice_details(
    p_invoice_id UUID,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'invoice', to_jsonb(si.*),
        'supplier', to_jsonb(s.*),
        'items', COALESCE(items.items_array, '[]'::jsonb),
        'taxes', COALESCE(taxes.taxes_array, '[]'::jsonb),
        'payments', COALESCE(payments.payments_array, '[]'::jsonb),
        'ocr_result', to_jsonb(ocr.*)
    ) INTO result
    FROM public.supplier_invoices si
    LEFT JOIN public.suppliers s ON si.supplier_id = s.id
    LEFT JOIN public.ocr_results ocr ON si.ocr_result_id = ocr.id
    LEFT JOIN (
        SELECT 
            invoice_id,
            jsonb_agg(to_jsonb(sii.*) ORDER BY position_no) as items_array
        FROM public.supplier_invoice_items sii
        GROUP BY invoice_id
    ) items ON si.id = items.invoice_id
    LEFT JOIN (
        SELECT 
            invoice_id,
            jsonb_agg(to_jsonb(sit.*) ORDER BY tax_rate) as taxes_array
        FROM public.supplier_invoice_taxes sit
        GROUP BY invoice_id
    ) taxes ON si.id = taxes.invoice_id
    LEFT JOIN (
        SELECT 
            invoice_id,
            jsonb_agg(to_jsonb(sip.*) ORDER BY paid_at) as payments_array
        FROM public.supplier_invoice_payments sip
        GROUP BY invoice_id
    ) payments ON si.id = payments.invoice_id
    WHERE si.id = p_invoice_id
        AND (p_company_id IS NULL OR si.company_id = p_company_id);
    
    IF result IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice not found'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'data', result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Bulk operations
CREATE OR REPLACE FUNCTION public.rpc_bulk_approve_invoices(
    p_invoice_ids UUID[],
    p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    updated_count INTEGER;
    invoice_id UUID;
BEGIN
    updated_count := 0;
    
    FOREACH invoice_id IN ARRAY p_invoice_ids
    LOOP
        UPDATE public.supplier_invoices
        SET 
            approval_status = 'approved',
            updated_at = now()
        WHERE id = invoice_id 
            AND company_id = p_company_id
            AND approval_status = 'pending';
        
        IF FOUND THEN
            updated_count := updated_count + 1;
            
            -- Log each approval
            PERFORM public.create_audit_entry(
                'supplier_invoices',
                invoice_id,
                'STATUS_CHANGE',
                jsonb_build_object('approval_status', 'pending'),
                jsonb_build_object('approval_status', 'approved'),
                ARRAY['approval_status'],
                'Bulk approval operation'
            );
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'updated_count', updated_count,
        'total_requested', array_length(p_invoice_ids, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION public.rpc_import_supplier_invoice_from_ocr IS 'Main import function: converts validated OCR result to supplier invoice with full validation';
COMMENT ON FUNCTION public.rpc_revalidate_invoice IS 'Revalidates invoice totals and line items after manual edits';
COMMENT ON FUNCTION public.rpc_mark_invoice_paid IS 'Records payment and updates payment status';
COMMENT ON FUNCTION public.rpc_set_invoice_approval IS 'Changes invoice approval status with audit trail';
COMMENT ON FUNCTION public.rpc_get_invoice_details IS 'Gets complete invoice with items, taxes, payments, and OCR data';
COMMENT ON FUNCTION public.rpc_bulk_approve_invoices IS 'Bulk approve multiple invoices with audit logging';