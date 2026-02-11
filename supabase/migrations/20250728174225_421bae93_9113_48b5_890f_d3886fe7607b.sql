-- Create storage bucket for document signatures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('document-signatures', 'document-signatures', true)
ON CONFLICT DO NOTHING;