-- Enable realtime for emails table
ALTER TABLE public.emails REPLICA IDENTITY FULL;

-- Add emails table to realtime publication 
ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;