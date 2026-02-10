-- Add unique constraint for user_email_connections
ALTER TABLE public.user_email_connections 
ADD CONSTRAINT unique_user_provider_email 
UNIQUE (user_id, provider, email_address);