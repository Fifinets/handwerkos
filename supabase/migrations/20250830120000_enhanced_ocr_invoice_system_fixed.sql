-- Enhanced OCR Invoice System Migration - Phase 1 (Fixed)
-- Implements the comprehensive plan for OCR invoice processing
-- Based on existing ocr_results and supplier_invoices tables

-- First create immutable_files if it doesn't exist (from GoBD compliance)
CREATE TABLE IF NOT EXISTS public.immutable_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'invoice', 'contract', 'quote', etc.
    entity_id UUID NOT NULL,   -- ID of the related business record
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,   -- Storage path/URL
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    sha256_hash TEXT NOT NULL, -- File integrity hash
    created_by UUID REFERENCES auth.users(id),
    is_original BOOLEAN DEFAULT true, -- Original vs. copy
    legal_category TEXT CHECK (legal_category IN ('invoice', 'contract', 'receipt', 'tax_document', 'correspondence')),
    retention_until DATE, -- Legal retention period end
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for immutable_files if they don't exist
CREATE INDEX IF NOT EXISTS idx_immutable_files_entity ON public.immutable_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_immutable_files_hash ON public.immutable_files(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_immutable_files_company_id ON public.immutable_files(company_id);

-- Enable RLS for immutable_files if not already enabled
ALTER TABLE public.immutable_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for immutable_files if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'immutable_files' 
        AND policyname = 'Company members can manage immutable files'
    ) THEN
        CREATE POLICY "Company members can manage immutable files" ON public.immutable_files
            FOR ALL USING (
                company_id IN (
                    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 1.1 Extend ocr_results table with additional metadata
ALTER TABLE public.ocr_results 
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS filesize BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS page_count INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS ocr_engine TEXT DEFAULT 'tesseract',
ADD COLUMN IF NOT EXISTS ocr_engine_version TEXT,
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS duplicates_of UUID REFERENCES public.ocr_results(id),
ADD COLUMN IF NOT EXISTS company_id UUID,
ADD COLUMN IF NOT EXISTS processing_errors TEXT[],
ADD COLUMN IF NOT EXISTS immutable_file_id UUID REFERENCES public.immutable_files(id);

-- Add unique constraint for file hashes to prevent duplicate uploads
CREATE UNIQUE INDEX IF NOT EXISTS ocr_results_file_hash_unique 
    ON public.ocr_results(file_hash) 
    WHERE file_hash IS NOT NULL;

-- 1.2 Create suppliers table for normalized supplier management
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    name TEXT NOT NULL,
    vat_id TEXT,                    -- USt-IdNr (e.g., DE123456789)
    tax_number TEXT,                -- Steuernummer
    iban TEXT,
    bic TEXT,
    address JSONB,                  -- Structured address data
    payment_terms TEXT,             -- Default payment terms
    contact_info JSONB,             -- Email, phone, etc.
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes for supplier search and matching
CREATE INDEX IF NOT EXISTS suppliers_company_name_idx 
    ON public.suppliers(company_id, lower(name));
CREATE INDEX IF NOT EXISTS suppliers_vat_id_idx 
    ON public.suppliers(company_id, vat_id) WHERE vat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_iban_idx 
    ON public.suppliers(company_id, iban) WHERE iban IS NOT NULL;

-- 1.3 Enhance supplier_invoices table
ALTER TABLE public.supplier_invoices 
ADD COLUMN IF NOT EXISTS company_id UUID,
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS net_total DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS vat_total DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS gross_total DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partly_paid','paid','overdue')),
ADD COLUMN IF NOT EXISTS reference TEXT,
ADD COLUMN IF NOT EXISTS project_id UUID,
ADD COLUMN IF NOT EXISTS order_id UUID,
ADD COLUMN IF NOT EXISTS immutable_file_id UUID REFERENCES public.immutable_files(id),
ADD COLUMN IF NOT EXISTS validation_errors JSONB,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Handle existing total_amount column
DO $$ 
DECLARE
    has_total_amount BOOLEAN := false;
    has_gross_total BOOLEAN := false;
BEGIN
    -- Check if total_amount column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_invoices' 
        AND column_name = 'total_amount'
        AND table_schema = 'public'
    ) INTO has_total_amount;
    
    -- Check if gross_total column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_invoices' 
        AND column_name = 'gross_total'
        AND table_schema = 'public'
    ) INTO has_gross_total;
    
    -- If total_amount exists but gross_total doesn't, add gross_total and migrate data
    IF has_total_amount AND NOT has_gross_total THEN
        ALTER TABLE public.supplier_invoices ADD COLUMN gross_total DECIMAL(12,2);
        UPDATE public.supplier_invoices 
        SET gross_total = total_amount 
        WHERE gross_total IS NULL AND total_amount IS NOT NULL;
    -- If both exist, migrate data from total_amount to gross_total where gross_total is null
    ELSIF has_total_amount AND has_gross_total THEN
        UPDATE public.supplier_invoices 
        SET gross_total = total_amount 
        WHERE gross_total IS NULL AND total_amount IS NOT NULL;
    END IF;
END $$;

-- Add unique constraint for invoice duplicates
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_duplicate_check 
    ON public.supplier_invoices(company_id, supplier_id, invoice_number, invoice_date)
    WHERE supplier_id IS NOT NULL;

-- 1.4 Tax lines table for detailed tax breakdown
CREATE TABLE IF NOT EXISTS public.supplier_invoice_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    tax_rate DECIMAL(5,2) NOT NULL,      -- e.g., 19.00, 7.00, 0.00
    base_amount DECIMAL(12,2) NOT NULL,  -- Net basis for this tax rate
    tax_amount DECIMAL(12,2) NOT NULL,   -- Calculated tax amount
    tax_type TEXT DEFAULT 'standard'     -- 'standard', 'reduced', 'reverse_charge', 'exempt'
        CHECK (tax_type IN ('standard', 'reduced', 'reverse_charge', 'exempt'))
);

CREATE INDEX IF NOT EXISTS supplier_invoice_taxes_invoice_idx 
    ON public.supplier_invoice_taxes(invoice_id);

-- 1.5 Invoice line items table
CREATE TABLE IF NOT EXISTS public.supplier_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    position_no INT,
    description TEXT NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'Stk',
    unit_price DECIMAL(12,4) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL,
    project_id UUID,
    cost_center_id UUID,
    material_id UUID,
    account_code TEXT                     -- For accounting integration
);

CREATE INDEX IF NOT EXISTS supplier_invoice_items_invoice_idx 
    ON public.supplier_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS supplier_invoice_items_project_idx 
    ON public.supplier_invoice_items(project_id) WHERE project_id IS NOT NULL;

-- 1.6 Payment tracking table
CREATE TABLE IF NOT EXISTS public.supplier_invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    payment_method TEXT DEFAULT 'bank_transfer'
        CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'credit_card', 'other')),
    payment_reference TEXT,              -- Reference from bank statement
    bank_transaction_id TEXT,            -- For automatic reconciliation
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS supplier_invoice_payments_invoice_idx 
    ON public.supplier_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS supplier_invoice_payments_bank_tx_idx 
    ON public.supplier_invoice_payments(bank_transaction_id) 
    WHERE bank_transaction_id IS NOT NULL;

-- 1.7 Add company_id to existing tables where missing
UPDATE public.ocr_results 
SET company_id = (
    SELECT companies.id 
    FROM public.employees 
    JOIN public.companies ON employees.company_id = companies.id
    JOIN auth.users ON employees.user_id = users.id
    WHERE users.id = ocr_results.created_by
    LIMIT 1
)
WHERE company_id IS NULL AND created_by IS NOT NULL;

UPDATE public.supplier_invoices 
SET company_id = (
    SELECT companies.id 
    FROM public.employees 
    JOIN public.companies ON employees.company_id = companies.id
    JOIN auth.users ON employees.user_id = users.id
    WHERE users.id = supplier_invoices.created_by
    LIMIT 1
)
WHERE company_id IS NULL AND created_by IS NOT NULL;

-- 2. Enhanced RLS Policies
-- Drop existing policies to recreate with company_id support
DROP POLICY IF EXISTS "Users can view their own OCR results" ON public.ocr_results;
DROP POLICY IF EXISTS "Users can insert their own OCR results" ON public.ocr_results;
DROP POLICY IF EXISTS "Users can update their own OCR results" ON public.ocr_results;

DROP POLICY IF EXISTS "Users can view their own supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Users can insert their own supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Users can update their own supplier invoices" ON public.supplier_invoices;

-- New RLS policies with company_id support
CREATE POLICY "Company members can view OCR results" ON public.ocr_results
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can insert OCR results" ON public.ocr_results
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

CREATE POLICY "Company members can update OCR results" ON public.ocr_results
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can view supplier invoices" ON public.supplier_invoices
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can insert supplier invoices" ON public.supplier_invoices
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

CREATE POLICY "Company members can update supplier invoices" ON public.supplier_invoices
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
    );

-- RLS for new tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage suppliers" ON public.suppliers
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM public.employees WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage invoice taxes" ON public.supplier_invoice_taxes
    FOR ALL USING (
        invoice_id IN (
            SELECT id FROM public.supplier_invoices 
            WHERE company_id IN (
                SELECT company_id FROM public.employees WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Company members can manage invoice items" ON public.supplier_invoice_items
    FOR ALL USING (
        invoice_id IN (
            SELECT id FROM public.supplier_invoices 
            WHERE company_id IN (
                SELECT company_id FROM public.employees WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Company members can manage invoice payments" ON public.supplier_invoice_payments
    FOR ALL USING (
        invoice_id IN (
            SELECT id FROM public.supplier_invoices 
            WHERE company_id IN (
                SELECT company_id FROM public.employees WHERE user_id = auth.uid()
            )
        )
    );

-- 3. Updated triggers (need to check if function exists first)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE TRIGGER update_suppliers_updated_at 
            BEFORE UPDATE ON public.suppliers 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    ELSE
        -- Create the function if it doesn't exist
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ language 'plpgsql';
        
        CREATE OR REPLACE TRIGGER update_suppliers_updated_at 
            BEFORE UPDATE ON public.suppliers 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS supplier_invoices_company_date_idx 
    ON public.supplier_invoices(company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS supplier_invoices_payment_status_idx 
    ON public.supplier_invoices(company_id, payment_status);
CREATE INDEX IF NOT EXISTS supplier_invoices_approval_status_idx 
    ON public.supplier_invoices(company_id, approval_status);

-- 5. Comments for documentation
COMMENT ON TABLE public.suppliers IS 'Normalized supplier/vendor master data';
COMMENT ON TABLE public.supplier_invoice_taxes IS 'Tax breakdown lines for each invoice';
COMMENT ON TABLE public.supplier_invoice_items IS 'Individual line items/positions on invoices';
COMMENT ON TABLE public.supplier_invoice_payments IS 'Payment tracking and bank reconciliation';
COMMENT ON TABLE public.immutable_files IS 'Immutable file storage for GoBD compliance';

COMMENT ON COLUMN public.ocr_results.file_hash IS 'SHA-256 hash for duplicate detection';
COMMENT ON COLUMN public.ocr_results.duplicates_of IS 'Reference to original OCR result if this is a duplicate';
COMMENT ON COLUMN public.supplier_invoices.validation_errors IS 'JSON array of validation errors during import';
COMMENT ON COLUMN public.supplier_invoices.payment_status IS 'Current payment status: unpaid, partly_paid, paid, overdue';
COMMENT ON COLUMN public.supplier_invoices.approval_status IS 'Approval workflow status';