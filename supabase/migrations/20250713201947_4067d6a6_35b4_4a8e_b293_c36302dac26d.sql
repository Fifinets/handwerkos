-- Create email categories table
CREATE TABLE public.email_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create emails table
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  subject TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_email TEXT NOT NULL,
  content TEXT,
  html_content TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal',
  
  -- AI Classification
  ai_category_id UUID REFERENCES public.email_categories(id),
  ai_confidence NUMERIC(3,2), -- 0.00 to 1.00
  ai_extracted_data JSONB,
  ai_sentiment TEXT, -- positive, neutral, negative
  ai_summary TEXT,
  
  -- Customer linking
  customer_id UUID REFERENCES public.customers(id),
  project_id UUID REFERENCES public.projects(id),
  
  -- Email threading
  thread_id TEXT,
  in_reply_to TEXT,
  message_id TEXT UNIQUE,
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email attachments table
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default email categories
INSERT INTO public.email_categories (name, description, color, icon) VALUES
('Auftrag', 'E-Mails mit neuen Aufträgen oder Bestellungen', '#10B981', 'ShoppingCart'),
('Anfrage', 'Kundenanfragen und Interesse', '#3B82F6', 'MessageSquare'),
('Rechnung', 'Eingehende Rechnungen und Zahlungen', '#F59E0B', 'Receipt'),
('Support', 'Support-Anfragen und Probleme', '#EF4444', 'HelpCircle'),
('Neuigkeiten', 'Newsletter und Informationen', '#8B5CF6', 'Newspaper'),
('Spam', 'Unerwünschte E-Mails', '#6B7280', 'Trash2'),
('Sonstiges', 'Andere E-Mails', '#64748B', 'Mail');

-- Enable RLS
ALTER TABLE public.email_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_categories
CREATE POLICY "Everyone can view email categories" 
ON public.email_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Managers can manage email categories" 
ON public.email_categories 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role));

-- RLS Policies for emails
CREATE POLICY "Employees can view company emails" 
ON public.emails 
FOR SELECT 
USING (has_role(auth.uid(), 'employee'::user_role) AND company_id = (
  SELECT company_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Managers can manage company emails" 
ON public.emails 
FOR ALL 
USING (has_role(auth.uid(), 'manager'::user_role) AND company_id = (
  SELECT company_id FROM profiles WHERE id = auth.uid()
));

-- RLS Policies for email_attachments
CREATE POLICY "Employees can view attachments" 
ON public.email_attachments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM emails 
  WHERE emails.id = email_attachments.email_id 
  AND has_role(auth.uid(), 'employee'::user_role)
  AND emails.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
));

CREATE POLICY "Managers can manage attachments" 
ON public.email_attachments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM emails 
  WHERE emails.id = email_attachments.email_id 
  AND has_role(auth.uid(), 'manager'::user_role)
  AND emails.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
));

-- Triggers for updated_at
CREATE TRIGGER update_emails_updated_at
BEFORE UPDATE ON public.emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_emails_company_id ON public.emails(company_id);
CREATE INDEX idx_emails_received_at ON public.emails(received_at DESC);
CREATE INDEX idx_emails_sender_email ON public.emails(sender_email);
CREATE INDEX idx_emails_category ON public.emails(ai_category_id);
CREATE INDEX idx_emails_customer ON public.emails(customer_id);
CREATE INDEX idx_emails_thread ON public.emails(thread_id);