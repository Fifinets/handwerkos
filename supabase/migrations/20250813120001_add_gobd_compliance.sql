-- GoBD Compliance Tables for HandwerkOS
-- Implements German tax compliance requirements for audit trails, immutable records, and numbered documents

-- Audit Log table for GoBD compliance - tracks all changes to critical business data
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- table name (quotes, invoices, projects, etc.)
  entity_id UUID NOT NULL,   -- ID of the affected record
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE')),
  old_values JSONB,          -- Previous values (for UPDATE/DELETE)
  new_values JSONB,          -- New values (for INSERT/UPDATE)
  changed_fields TEXT[],     -- Array of field names that changed
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,           -- Backup in case user is deleted
  ip_address INET,
  user_agent TEXT,
  reason TEXT,               -- Optional reason for change
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Number sequences for GoBD-compliant document numbering
CREATE TABLE IF NOT EXISTS public.number_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_name TEXT NOT NULL UNIQUE, -- 'quotes', 'invoices', 'orders', etc.
  current_value INTEGER NOT NULL DEFAULT 0,
  prefix TEXT DEFAULT '', -- e.g., 'RE' for 'RE-2025-0001'
  year_reset BOOLEAN DEFAULT true, -- Reset counter each year
  format_pattern TEXT DEFAULT '{prefix}-{year}-{number:04d}', -- Formatting template
  last_reset_year INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(sequence_name, company_id)
);

-- Immutable files for GoBD compliance - PDFs, contracts, etc. that must not be changed
CREATE TABLE IF NOT EXISTS public.immutable_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to generate next number in sequence
CREATE OR REPLACE FUNCTION public.get_next_number(
  seq_name TEXT,
  comp_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  seq_record RECORD;
  next_number INTEGER;
  formatted_number TEXT;
BEGIN
  -- Get or create sequence record
  SELECT * INTO seq_record 
  FROM public.number_sequences 
  WHERE sequence_name = seq_name 
    AND (company_id = comp_id OR (company_id IS NULL AND comp_id IS NULL))
  FOR UPDATE;
  
  -- Create sequence if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO public.number_sequences (sequence_name, current_value, company_id, last_reset_year)
    VALUES (seq_name, 0, comp_id, current_year)
    RETURNING * INTO seq_record;
  END IF;
  
  -- Reset counter if year changed and year_reset is enabled
  IF seq_record.year_reset AND (seq_record.last_reset_year IS NULL OR seq_record.last_reset_year < current_year) THEN
    next_number := 1;
    UPDATE public.number_sequences 
    SET current_value = next_number, last_reset_year = current_year, updated_at = NOW()
    WHERE id = seq_record.id;
  ELSE
    next_number := seq_record.current_value + 1;
    UPDATE public.number_sequences 
    SET current_value = next_number, updated_at = NOW()
    WHERE id = seq_record.id;
  END IF;
  
  -- Format the number according to pattern
  formatted_number := replace(seq_record.format_pattern, '{prefix}', seq_record.prefix);
  formatted_number := replace(formatted_number, '{year}', current_year::text);
  formatted_number := replace(formatted_number, '{number:04d}', lpad(next_number::text, 4, '0'));
  
  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION public.create_audit_entry(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_changed_fields TEXT[] DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  current_user_email TEXT;
BEGIN
  -- Get current user email
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  
  INSERT INTO public.audit_log (
    entity_type, entity_id, action, old_values, new_values, 
    changed_fields, user_id, user_email, reason
  ) VALUES (
    p_entity_type, p_entity_id, p_action, p_old_values, p_new_values,
    p_changed_fields, auth.uid(), current_user_email, p_reason
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for automatic audit logging
CREATE OR REPLACE FUNCTION public.audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  changed_fields TEXT[] := ARRAY[]::TEXT[];
  field_name TEXT;
BEGIN
  -- Skip audit for audit_log table itself
  IF TG_TABLE_NAME = 'audit_log' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Convert records to JSON
  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    PERFORM public.create_audit_entry(
      TG_TABLE_NAME::TEXT,
      OLD.id,
      'DELETE',
      old_json,
      NULL,
      NULL,
      'Record deleted'
    );
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    PERFORM public.create_audit_entry(
      TG_TABLE_NAME::TEXT,
      NEW.id,
      'INSERT',
      NULL,
      new_json,
      NULL,
      'Record created'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    -- Find changed fields
    FOR field_name IN SELECT jsonb_object_keys(new_json) LOOP
      IF old_json->field_name IS DISTINCT FROM new_json->field_name THEN
        changed_fields := changed_fields || field_name;
      END IF;
    END LOOP;
    
    -- Only log if there are actual changes
    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM public.create_audit_entry(
        TG_TABLE_NAME::TEXT,
        NEW.id,
        'UPDATE',
        old_json,
        new_json,
        changed_fields,
        'Record updated'
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to critical business tables
CREATE TRIGGER audit_quotes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_orders_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_invoices_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_projects_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_timesheets_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_expenses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Function to automatically assign document numbers on status change
CREATE OR REPLACE FUNCTION public.assign_document_number() RETURNS TRIGGER AS $$
DECLARE
  doc_number TEXT;
  seq_name TEXT;
BEGIN
  -- Determine sequence name based on table
  IF TG_TABLE_NAME = 'quotes' THEN
    seq_name := 'quotes';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    seq_name := 'orders';  
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    seq_name := 'invoices';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Assign number when status changes to 'sent' (for quotes/invoices) or 'confirmed' (for orders)
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF (TG_TABLE_NAME = 'quotes' AND NEW.status = 'sent' AND (NEW.quote_number IS NULL OR NEW.quote_number = '')) OR
       (TG_TABLE_NAME = 'orders' AND NEW.status IN ('confirmed', 'in_progress') AND (NEW.order_number IS NULL OR NEW.order_number = '')) OR
       (TG_TABLE_NAME = 'invoices' AND NEW.status = 'sent' AND (NEW.invoice_number IS NULL OR NEW.invoice_number = '')) THEN
      
      doc_number := public.get_next_number(seq_name, NEW.company_id);
      
      IF TG_TABLE_NAME = 'quotes' THEN
        NEW.quote_number := doc_number;
      ELSIF TG_TABLE_NAME = 'orders' THEN
        NEW.order_number := doc_number;
      ELSIF TG_TABLE_NAME = 'invoices' THEN
        NEW.invoice_number := doc_number;
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add document numbering triggers
CREATE TRIGGER assign_quote_number_trigger
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number();

CREATE TRIGGER assign_order_number_trigger
  BEFORE UPDATE ON public.orders  
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number();

CREATE TRIGGER assign_invoice_number_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number();

-- Create indexes for audit log performance
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.audit_log(company_id);

CREATE INDEX IF NOT EXISTS idx_number_sequences_name ON public.number_sequences(sequence_name);
CREATE INDEX IF NOT EXISTS idx_number_sequences_company ON public.number_sequences(company_id);

CREATE INDEX IF NOT EXISTS idx_immutable_files_entity ON public.immutable_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_immutable_files_hash ON public.immutable_files(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_immutable_files_company_id ON public.immutable_files(company_id);

-- Insert default number sequences
INSERT INTO public.number_sequences (sequence_name, prefix, format_pattern) VALUES
('quotes', 'AG', '{prefix}-{year}-{number:04d}'),
('orders', 'AU', '{prefix}-{year}-{number:04d}'),
('invoices', 'RE', '{prefix}-{year}-{number:04d}')
ON CONFLICT (sequence_name, company_id) DO NOTHING;