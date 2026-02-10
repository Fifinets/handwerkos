-- Create email_signatures table
CREATE TABLE public.email_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own signatures" 
ON public.email_signatures 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for timestamps
CREATE TRIGGER update_email_signatures_updated_at
BEFORE UPDATE ON public.email_signatures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for email_templates
CREATE POLICY "Users can manage their own templates" 
ON public.email_templates 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for email_templates timestamps
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();