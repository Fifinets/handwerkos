-- Row Level Security (RLS) Policies for new tables
-- Ensures proper multi-tenant access control and security

-- Enable RLS on all new tables
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immutable_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_processing_queue ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user belongs to company
CREATE OR REPLACE FUNCTION public.user_has_company_access(company_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.company_id = company_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quotes policies
CREATE POLICY "Users can view quotes for their company" ON public.quotes
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage quotes for their company" ON public.quotes
  FOR ALL USING (public.user_has_company_access(company_id));

-- Orders policies  
CREATE POLICY "Users can view orders for their company" ON public.orders
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage orders for their company" ON public.orders
  FOR ALL USING (public.user_has_company_access(company_id));

-- Invoices policies
CREATE POLICY "Users can view invoices for their company" ON public.invoices
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage invoices for their company" ON public.invoices
  FOR ALL USING (public.user_has_company_access(company_id));

-- Materials policies
CREATE POLICY "Users can view materials for their company" ON public.materials
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage materials for their company" ON public.materials
  FOR ALL USING (public.user_has_company_access(company_id));

-- Stock movements policies
CREATE POLICY "Users can view stock movements for their company" ON public.stock_movements
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage stock movements for their company" ON public.stock_movements
  FOR ALL USING (public.user_has_company_access(company_id));

-- Timesheets policies
CREATE POLICY "Users can view timesheets for their company" ON public.timesheets
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage timesheets for their company" ON public.timesheets
  FOR ALL USING (public.user_has_company_access(company_id));

-- Expenses policies
CREATE POLICY "Users can view expenses for their company" ON public.expenses
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage expenses for their company" ON public.expenses
  FOR ALL USING (public.user_has_company_access(company_id));

-- Audit log policies (read-only for security)
CREATE POLICY "Users can view audit log for their company" ON public.audit_log
  FOR SELECT USING (public.user_has_company_access(company_id));

-- Number sequences policies
CREATE POLICY "Users can view number sequences for their company" ON public.number_sequences
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "System can manage number sequences" ON public.number_sequences
  FOR ALL USING (true); -- Managed by system functions

-- Immutable files policies
CREATE POLICY "Users can view immutable files for their company" ON public.immutable_files
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can create immutable files for their company" ON public.immutable_files
  FOR INSERT WITH CHECK (public.user_has_company_access(company_id));

-- AI Index policies
CREATE POLICY "Users can view AI index for their company" ON public.ai_index
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "System can manage AI index" ON public.ai_index
  FOR ALL USING (true); -- Managed by AI processing system

-- AI Suggestions policies
CREATE POLICY "Users can view AI suggestions for their company" ON public.ai_suggestions
  FOR SELECT USING (public.user_has_company_access(company_id));

CREATE POLICY "Users can manage AI suggestions for their company" ON public.ai_suggestions
  FOR ALL USING (public.user_has_company_access(company_id));

-- AI Training data policies (system only)
CREATE POLICY "System can manage AI training data" ON public.ai_training_data
  FOR ALL USING (true); -- Only system should access this

-- AI Processing queue policies (system only)  
CREATE POLICY "System can manage AI processing queue" ON public.ai_processing_queue
  FOR ALL USING (true); -- Only AI workers should access this

-- Update existing tables with company_id triggers
CREATE OR REPLACE FUNCTION public.set_company_id_from_profile()
RETURNS TRIGGER AS $$
DECLARE
  user_company_id UUID;
BEGIN
  -- Get company_id from user's profile
  SELECT company_id INTO user_company_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Set company_id if not already set
  IF NEW.company_id IS NULL THEN
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add company_id auto-assignment triggers
CREATE TRIGGER set_quotes_company_id
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_orders_company_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_invoices_company_id
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_materials_company_id
  BEFORE INSERT ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_stock_movements_company_id
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_timesheets_company_id
  BEFORE INSERT ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_expenses_company_id
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_ai_suggestions_company_id
  BEFORE INSERT ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

-- Update existing customers/employees company_id assignment
CREATE TRIGGER set_customers_company_id_new
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();

CREATE TRIGGER set_employees_company_id
  BEFORE INSERT ON public.employees  
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_profile();