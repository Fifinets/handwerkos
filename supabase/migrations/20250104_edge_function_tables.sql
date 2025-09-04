-- Migration: Tabellen für Edge Functions (Logs, Reports)

-- ============================================================================
-- EMAIL LOGS - Tracking gesendeter E-Mails
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  cc TEXT[],
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  resend_id TEXT, -- ID von Resend API
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_email_logs_delivery_note ON email_logs(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- ============================================================================
-- CRON LOGS - Tracking von Cron-Job Ausführungen
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cron_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task TEXT NOT NULL, -- 'daily-check', 'weekly-report', etc.
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  details JSONB, -- Strukturierte Details der Ausführung
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN completed_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER
      ELSE NULL
    END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_cron_logs_task ON cron_logs(task);
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_logs(status);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started_at ON cron_logs(started_at DESC);

-- ============================================================================
-- WEEKLY REPORTS - Gespeicherte Wochenberichte
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  data JSONB NOT NULL, -- Strukturierte Berichtsdaten
  total_hours DECIMAL(10,2),
  employee_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Unique constraint pro Woche und Firma
  CONSTRAINT unique_weekly_report_per_company UNIQUE (company_id, week_start)
);

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_weekly_reports_company ON weekly_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_start DESC);

-- ============================================================================
-- REMINDER LOGS - Tracking von Erinnerungen
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'delivery_note_signature', 'time_tracking', etc.
  reference_id UUID, -- ID des referenzierten Objekts
  recipient TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_reminder_logs_type ON reminder_logs(type);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_reference ON reminder_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent_at ON reminder_logs(sent_at DESC);

-- ============================================================================
-- STORAGE BUCKETS für PDFs und Dokumente
-- ============================================================================

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies für documents bucket (nur erstellen falls nicht vorhanden)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Documents are publicly accessible'
  ) THEN
    CREATE POLICY "Documents are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'documents' AND 
      auth.role() = 'authenticated'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update their own documents'
  ) THEN
    CREATE POLICY "Users can update their own documents" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'documents' AND 
      auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES für Edge Function Tabellen
-- ============================================================================

-- ============================================================================
-- RLS POLICIES für Edge Function Tabellen (nur wenn nicht vorhanden)
-- ============================================================================

-- Email Logs - Nur eigene Company
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'email_logs' 
    AND policyname = 'email_logs_company_access'
  ) THEN
    CREATE POLICY email_logs_company_access ON email_logs
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM delivery_notes dn
        JOIN employees e ON e.company_id = dn.company_id
        WHERE dn.id = email_logs.delivery_note_id
        AND e.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Cron Logs - Nur Manager können sehen
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'cron_logs' 
    AND policyname = 'cron_logs_manager_only'
  ) THEN
    CREATE POLICY cron_logs_manager_only ON cron_logs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM employees
        WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
      )
    );
  END IF;
END $$;

-- Weekly Reports - Company-specific access
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'weekly_reports' 
    AND policyname = 'weekly_reports_company_access'
  ) THEN
    CREATE POLICY weekly_reports_company_access ON weekly_reports
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM employees
        WHERE employees.user_id = auth.uid()
        AND employees.company_id = weekly_reports.company_id
      )
    );
  END IF;
END $$;

-- Reminder Logs - Company-specific access
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'reminder_logs' 
    AND policyname = 'reminder_logs_company_access'
  ) THEN
    CREATE POLICY reminder_logs_company_access ON reminder_logs
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM employees
        WHERE employees.user_id = auth.uid()
        AND employees.role IN ('manager', 'admin')
      )
    );
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS für Edge Functions
-- ============================================================================

-- Function: Clean old logs (für Cron Jobs)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete email logs older than 6 months
  DELETE FROM email_logs 
  WHERE created_at < NOW() - INTERVAL '6 months';
  
  -- Delete cron logs older than 3 months
  DELETE FROM cron_logs 
  WHERE created_at < NOW() - INTERVAL '3 months';
  
  -- Delete reminder logs older than 1 year
  DELETE FROM reminder_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Keep weekly reports for 2 years
  DELETE FROM weekly_reports 
  WHERE created_at < NOW() - INTERVAL '2 years';
END;
$$;

-- Grant execution to service role
GRANT EXECUTE ON FUNCTION cleanup_old_logs TO service_role;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE email_logs IS 'Tracking aller versendeten E-Mails mit Status und Resend-Integration';
COMMENT ON TABLE cron_logs IS 'Protokoll aller Cron-Job Ausführungen mit Laufzeiten und Ergebnissen';
COMMENT ON TABLE weekly_reports IS 'Gespeicherte Wochenberichte für Zeitauswertungen';
COMMENT ON TABLE reminder_logs IS 'Tracking aller automatischen Erinnerungen';

COMMENT ON FUNCTION cleanup_old_logs IS 'Bereinigt alte Logs basierend auf Retention-Richtlinien';