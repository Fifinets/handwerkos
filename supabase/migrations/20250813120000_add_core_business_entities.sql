-- Add core business entities and workflow tables for AI-First HandwerkOS
-- Part 1: Business workflow tables (Quote -> Order -> Project -> Invoice)

-- Quotes table
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quote_number TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  body JSONB, -- Store structured quote items
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  total_net DECIMAL(12,2),
  total_gross DECIMAL(12,2),
  tax_rate DECIMAL(5,2) DEFAULT 19.00,
  valid_until DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  company_id UUID, -- For multi-tenant support
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders table (generated from accepted quotes)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  total_amount DECIMAL(12,2),
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Extend projects table to link to orders (if not already linked)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS company_id UUID;

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  tax_rate DECIMAL(5,2) DEFAULT 19.00,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void', 'cancelled')),
  due_date DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Materials master data table (enhanced from existing project_materials)
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  description TEXT,
  unit TEXT DEFAULT 'Stk',
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  stock INTEGER DEFAULT 0,
  reorder_min INTEGER DEFAULT 0,
  category TEXT,
  supplier TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Link project materials to master materials
ALTER TABLE public.project_materials ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL;

-- Stock movements for inventory tracking
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('issue', 'receive', 'adjust', 'return')),
  reference_number TEXT, -- Order number, delivery note, etc.
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Timesheets table (enhanced from existing time tracking)
CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0,
  hours DECIMAL(4,2) NOT NULL,
  description TEXT,
  task_category TEXT DEFAULT 'general',
  hourly_rate DECIMAL(10,2), -- Override rate for this entry
  is_billable BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES public.employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses table for project costs
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  is_billable BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add company_id to existing tables for proper multi-tenancy
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id UUID;

-- Create company_id update triggers (will be set by application logic or separate migration)
-- This ensures proper multi-tenant isolation for the AI features

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes(company_id);

CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON public.orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id);

CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);

CREATE INDEX IF NOT EXISTS idx_materials_sku ON public.materials(sku);
CREATE INDEX IF NOT EXISTS idx_materials_company_id ON public.materials(company_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_material_id ON public.stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_project_id ON public.stock_movements(project_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON public.stock_movements(company_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON public.timesheets(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_id ON public.timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON public.timesheets(date);
CREATE INDEX IF NOT EXISTS idx_timesheets_company_id ON public.timesheets(company_id);

CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON public.expenses(company_id);

-- Add updated_at triggers for new tables
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();