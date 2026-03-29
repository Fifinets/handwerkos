-- ============================================================
-- Site Documentation Tables for Voice-First Baustellendoku
-- ============================================================

-- 1. Main entries table
CREATE TABLE IF NOT EXISTS public.site_documentation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Audio
  audio_storage_path TEXT,
  audio_duration_seconds NUMERIC,

  -- Transcription
  transcript TEXT,
  transcript_language TEXT DEFAULT 'de',

  -- Structured extraction (from GPT-4o-mini)
  extracted_data JSONB DEFAULT '{}'::jsonb,

  -- Manual text entry (alternative to voice)
  manual_text TEXT,

  -- Entry type
  entry_type TEXT NOT NULL DEFAULT 'voice'
    CHECK (entry_type IN ('voice', 'text', 'photo_only')),

  -- Processing status
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'transcribing', 'extracting', 'completed', 'failed')),
  processing_error TEXT,

  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  weather_info TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Photos table
CREATE TABLE IF NOT EXISTS public.site_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.site_documentation_entries(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Storage
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',

  -- Metadata
  caption TEXT,
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Category
  photo_type TEXT NOT NULL DEFAULT 'documentation'
    CHECK (photo_type IN ('documentation', 'mangel', 'fortschritt', 'material', 'abnahme')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_site_docs_project
  ON public.site_documentation_entries(project_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_docs_company
  ON public.site_documentation_entries(company_id);

CREATE INDEX IF NOT EXISTS idx_site_docs_status
  ON public.site_documentation_entries(processing_status)
  WHERE processing_status != 'completed';

CREATE INDEX IF NOT EXISTS idx_site_photos_project
  ON public.site_photos(project_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_photos_entry
  ON public.site_photos(entry_id)
  WHERE entry_id IS NOT NULL;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_site_doc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_site_doc_updated_at
  BEFORE UPDATE ON public.site_documentation_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_doc_updated_at();

-- 5. RLS Policies
ALTER TABLE public.site_documentation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_docs_select_company"
  ON public.site_documentation_entries FOR SELECT
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "site_docs_insert_company"
  ON public.site_documentation_entries FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "site_docs_update_own"
  ON public.site_documentation_entries FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "site_docs_delete_own"
  ON public.site_documentation_entries FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "site_photos_select_company"
  ON public.site_photos FOR SELECT
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "site_photos_insert_company"
  ON public.site_photos FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "site_photos_delete_own"
  ON public.site_photos FOR DELETE
  USING (created_by = auth.uid());

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-documentation',
  'site-documentation',
  false,
  52428800, -- 50MB
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg',
        'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "site_docs_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'site-documentation'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "site_docs_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'site-documentation'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "site_docs_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'site-documentation'
    AND auth.role() = 'authenticated'
  );
