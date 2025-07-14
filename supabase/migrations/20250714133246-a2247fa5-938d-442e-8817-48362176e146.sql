-- Create table to store user email connections and tokens
CREATE TABLE IF NOT EXISTS public.user_email_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  email_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, email_address)
);

-- Enable RLS
ALTER TABLE public.user_email_connections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own email connections" 
ON public.user_email_connections 
FOR ALL 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_user_email_connections_updated_at
BEFORE UPDATE ON public.user_email_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for email sync settings
CREATE TABLE IF NOT EXISTS public.email_sync_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.email_sync_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own sync settings" 
ON public.email_sync_settings 
FOR ALL 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_email_sync_settings_updated_at
BEFORE UPDATE ON public.email_sync_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron extension for automated sync
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;