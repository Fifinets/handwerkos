
-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Angebot' CHECK (status IN ('Angebot', 'Bestätigt', 'In Bearbeitung', 'Abgeschlossen', 'Storniert')),
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Niedrig', 'Normal', 'Hoch', 'Dringend')),
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies for order access
CREATE POLICY "Managers can manage all orders" 
  ON public.orders 
  FOR ALL 
  USING (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Employees can view orders" 
  ON public.orders 
  FOR SELECT 
  USING (has_role(auth.uid(), 'employee'::user_role));

-- Create indexes for faster searches
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);
CREATE INDEX idx_orders_order_date ON public.orders(order_date);

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON public.orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    year_suffix TEXT;
    counter INTEGER;
    new_number TEXT;
BEGIN
    year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
    INTO counter
    FROM public.orders
    WHERE order_number LIKE 'A' || year_suffix || '%';
    
    new_number := 'A' || year_suffix || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();
