-- AI Features and Index Tables for HandwerkOS
-- Supports AI-powered intent parsing, cost estimation, and scheduling

-- AI Index table for storing embeddings and searchable content
-- This enables RAG (Retrieval Augmented Generation) for context-aware AI responses
CREATE TABLE IF NOT EXISTS public.ai_index (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_type TEXT NOT NULL, -- 'quote', 'project', 'customer', 'material', etc.
  ref_id UUID NOT NULL,   -- ID of the referenced entity
  content_text TEXT NOT NULL, -- The actual text content for searching
  embedding VECTOR(1536), -- OpenAI embedding vector (1536 dimensions)
  metadata JSONB, -- Additional structured data
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AI Suggestions table for storing AI-generated recommendations and estimates
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('parse_intent', 'estimate', 'schedule', 'material_list', 'cost_breakdown', 'timeline')),
  input_data JSONB NOT NULL, -- The input that generated this suggestion
  output_data JSONB NOT NULL, -- The AI-generated suggestion/result
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  model_version TEXT, -- AI model version used
  trace_id UUID, -- For tracking related AI operations
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'applied', 'rejected', 'superseded')),
  applied_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMP WITH TIME ZONE,
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5), -- User feedback
  feedback_notes TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AI Training Data table for improving model accuracy over time
CREATE TABLE IF NOT EXISTS public.ai_training_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_type TEXT NOT NULL CHECK (data_type IN ('estimate_correction', 'schedule_feedback', 'material_suggestion', 'cost_actual_vs_predicted')),
  input_features JSONB NOT NULL, -- Features used for prediction
  expected_output JSONB NOT NULL, -- Actual outcome/correct answer
  predicted_output JSONB, -- What the AI predicted
  prediction_error DECIMAL(10,4), -- Difference between predicted and actual
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  suggestion_id UUID REFERENCES public.ai_suggestions(id) ON DELETE SET NULL,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AI Processing Queue for async AI operations
CREATE TABLE IF NOT EXISTS public.ai_processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('index_content', 'generate_estimate', 'create_schedule', 'extract_intent')),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  input_data JSONB NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=highest, 10=lowest
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  result_data JSONB,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to automatically index content when business records change
CREATE OR REPLACE FUNCTION public.queue_ai_indexing() RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Function to create AI suggestions
CREATE OR REPLACE FUNCTION public.create_ai_suggestion(
  p_project_id UUID,
  p_suggestion_type TEXT,
  p_input_data JSONB,
  p_output_data JSONB,
  p_confidence_score DECIMAL DEFAULT NULL,
  p_model_version TEXT DEFAULT NULL,
  p_trace_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  suggestion_id UUID;
BEGIN
  INSERT INTO public.ai_suggestions (
    project_id, suggestion_type, input_data, output_data,
    confidence_score, model_version, trace_id
  ) VALUES (
    p_project_id, p_suggestion_type, p_input_data, p_output_data,
    p_confidence_score, p_model_version, p_trace_id
  ) RETURNING id INTO suggestion_id;
  
  RETURN suggestion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search AI index (for RAG queries)
CREATE OR REPLACE FUNCTION public.search_ai_index(
  query_embedding VECTOR(1536),
  ref_types TEXT[] DEFAULT NULL,
  company_id_filter UUID DEFAULT NULL,
  limit_results INTEGER DEFAULT 5
) RETURNS TABLE (
  id UUID,
  ref_type TEXT,
  ref_id UUID,
  content_text TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id,
    ai.ref_type,
    ai.ref_id,
    ai.content_text,
    1 - (ai.embedding <-> query_embedding) as similarity,
    ai.metadata
  FROM public.ai_index ai
  WHERE (ref_types IS NULL OR ai.ref_type = ANY(ref_types))
    AND (company_id_filter IS NULL OR ai.company_id = company_id_filter)
    AND ai.embedding IS NOT NULL
  ORDER BY ai.embedding <-> query_embedding
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add AI indexing triggers to relevant tables
CREATE TRIGGER ai_index_projects_trigger
  AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.queue_ai_indexing();

CREATE TRIGGER ai_index_quotes_trigger
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.queue_ai_indexing();

CREATE TRIGGER ai_index_customers_trigger
  AFTER INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.queue_ai_indexing();

CREATE TRIGGER ai_index_materials_trigger
  AFTER INSERT OR UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.queue_ai_indexing();

-- Create indexes for AI tables
CREATE INDEX IF NOT EXISTS idx_ai_index_ref ON public.ai_index(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_ai_index_company_id ON public.ai_index(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_index_embedding ON public.ai_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_project_id ON public.ai_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON public.ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON public.ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_trace_id ON public.ai_suggestions(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_company_id ON public.ai_suggestions(company_id);

CREATE INDEX IF NOT EXISTS idx_ai_training_data_type ON public.ai_training_data(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_project_id ON public.ai_training_data(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_company_id ON public.ai_training_data(company_id);

CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_status ON public.ai_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_scheduled ON public.ai_processing_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_priority ON public.ai_processing_queue(priority, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ai_processing_queue_company_id ON public.ai_processing_queue(company_id);

-- Add updated_at triggers
CREATE TRIGGER update_ai_index_updated_at BEFORE UPDATE ON public.ai_index FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_suggestions_updated_at BEFORE UPDATE ON public.ai_suggestions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable vector extension for embeddings (if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Note: The vector extension and VECTOR data type require the pgvector extension
-- This should be enabled in Supabase dashboard or via separate migration