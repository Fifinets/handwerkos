-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT 'Meine Firma',
  company_address text,
  company_city text,
  company_postal_code text,
  company_country text DEFAULT 'Deutschland',
  company_phone text,
  company_email text,
  company_website text,
  tax_number text,
  vat_number text,
  default_tax_rate numeric DEFAULT 19.00,
  default_currency text DEFAULT 'EUR',
  logo_url text,
  email_signature text,
  invoice_terms text DEFAULT '30 Tage netto',
  quote_validity_days integer DEFAULT 30,
  invoice_prefix text DEFAULT 'R',
  quote_prefix text DEFAULT 'Q',
  order_prefix text DEFAULT 'A',
  default_working_hours_start time DEFAULT '08:00:00',
  default_working_hours_end time DEFAULT '17:00:00',
  default_break_duration integer DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Managers can manage company settings" 
ON public.company_settings 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Employees can view company settings" 
ON public.company_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::user_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default company settings
INSERT INTO public.company_settings (company_name) VALUES ('Meine Firma');