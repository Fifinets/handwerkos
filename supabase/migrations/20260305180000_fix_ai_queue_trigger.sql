-- ====================================================================
-- FIX: Make queue_ai_indexing function SECURITY DEFINER
-- 
-- Problem: RLS policies on ai_processing_queue restrict direct INSERTs
-- for authenticated users. The trigger function queue_ai_indexing was
-- running as SECURITY INVOKER, causing INSERTS on projects/quotes/etc.
-- to fail with an RLS violation because the trigger couldn't insert
-- into the queue.
-- 
-- Solution: Add SECURITY DEFINER so the trigger runs with elevated
-- privileges and can write to the queue, while the table remains 
-- protected from direct client writes.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.queue_ai_indexing() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  content_text TEXT;
  operation_type TEXT := 'index_content';
BEGIN
  -- Skip if record is being deleted
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  -- Extract searchable text based on entity type
  IF TG_TABLE_NAME = 'projects' THEN
    content_text := COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, '');
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    content_text := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '');
  ELSIF TG_TABLE_NAME = 'customers' THEN
    content_text := COALESCE(NEW.company_name, '') || ' ' || COALESCE(NEW.contact_person, '');
  ELSIF TG_TABLE_NAME = 'materials' THEN
    content_text := COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, '');
  ELSE
    RETURN NEW; -- Skip indexing for other tables
  END IF;
  
  -- Only queue if there's meaningful content
  IF length(trim(content_text)) > 5 THEN
    INSERT INTO public.ai_processing_queue (
      operation_type, entity_type, entity_id, input_data, company_id
    ) VALUES (
      operation_type,
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('content', content_text),
      NEW.company_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;
