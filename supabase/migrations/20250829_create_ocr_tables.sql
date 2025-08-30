-- Create OCR results table for invoice processing
CREATE TABLE IF NOT EXISTS ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_file_path TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    structured_data JSONB NOT NULL,
    confidence_scores JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'validated', 'rejected')) DEFAULT 'pending',
    validation_notes TEXT,
    validated_at TIMESTAMPTZ,
    validated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create supplier_invoices table for validated OCR results
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    total_amount DECIMAL(10,2) NOT NULL,
    vat_amount DECIMAL(10,2),
    description TEXT,
    iban TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')) DEFAULT 'pending',
    ocr_result_id UUID REFERENCES ocr_results(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ocr_results_status ON ocr_results(status);
CREATE INDEX IF NOT EXISTS idx_ocr_results_created_by ON ocr_results(created_by);
CREATE INDEX IF NOT EXISTS idx_ocr_results_created_at ON ocr_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_created_by ON supplier_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_invoice_date ON supplier_invoices(invoice_date DESC);

-- Row Level Security (RLS) policies
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

-- OCR results policies
CREATE POLICY "Users can view their own OCR results" ON ocr_results
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own OCR results" ON ocr_results
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own OCR results" ON ocr_results
    FOR UPDATE USING (auth.uid() = created_by);

-- Supplier invoices policies
CREATE POLICY "Users can view their own supplier invoices" ON supplier_invoices
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own supplier invoices" ON supplier_invoices
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own supplier invoices" ON supplier_invoices
    FOR UPDATE USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_ocr_results_updated_at 
    BEFORE UPDATE ON ocr_results 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_supplier_invoices_updated_at 
    BEFORE UPDATE ON supplier_invoices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE ocr_results IS 'Stores OCR processing results for invoice images';
COMMENT ON TABLE supplier_invoices IS 'Stores validated supplier invoices created from OCR results';
COMMENT ON COLUMN ocr_results.structured_data IS 'JSON containing extracted invoice data (invoiceNumber, supplierName, etc.)';
COMMENT ON COLUMN ocr_results.confidence_scores IS 'JSON containing confidence scores for each extracted field';
COMMENT ON COLUMN supplier_invoices.ocr_result_id IS 'References the OCR result this invoice was created from';

-- Storage bucket for invoice documents (this would be done via Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);