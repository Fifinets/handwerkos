
-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Deutschland',
  tax_number TEXT,
  customer_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'Aktiv' CHECK (status IN ('Aktiv', 'Premium', 'Inaktiv')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policies for customer access
CREATE POLICY "Managers can manage all customers" 
  ON public.customers 
  FOR ALL 
  USING (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Employees can view customers" 
  ON public.customers 
  FOR SELECT 
  USING (has_role(auth.uid(), 'employee'::user_role));

-- Create index for faster searches
CREATE INDEX idx_customers_company_name ON public.customers(company_name);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_customer_number ON public.customers(customer_number);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON public.customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
