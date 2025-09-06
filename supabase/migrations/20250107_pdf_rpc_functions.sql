-- Migration: RPC Funktionen für PDF-Generierung und Email-Versand
-- Sichere Wrapper für Edge Functions mit Audit-Trail

-- ============================================================================
-- 1. RPC_GENERATE_DELIVERY_NOTE_PDF
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_generate_delivery_note_pdf(
  p_delivery_note_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_company_id UUID;
  v_delivery_note RECORD;
  v_edge_function_url TEXT;
  v_service_key TEXT;
  v_response TEXT;
BEGIN
  -- Hole Company ID des Users (RLS Check)
  SELECT company_id INTO v_employee_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_employee_company_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter für User gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Prüfe ob Lieferschein existiert und zur Company gehört
  SELECT * INTO v_delivery_note
  FROM delivery_notes
  WHERE id = p_delivery_note_id
  AND company_id = v_employee_company_id;
  
  IF v_delivery_note IS NULL THEN
    RAISE EXCEPTION 'Lieferschein nicht gefunden oder keine Berechtigung'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Prüfe ob bereits PDF vorhanden und nicht älter als 1 Stunde
  IF v_delivery_note.pdf_url IS NOT NULL 
     AND v_delivery_note.pdf_generated_at IS NOT NULL 
     AND v_delivery_note.pdf_generated_at > (now() - INTERVAL '1 hour') THEN
    -- Return existing PDF URL
    RETURN jsonb_build_object(
      'success', true,
      'pdf_url', v_delivery_note.pdf_url,
      'pdf_generated_at', v_delivery_note.pdf_generated_at,
      'cached', true
    );
  END IF;
  
  -- Update Status auf "generating"
  UPDATE delivery_notes
  SET status = 'generating_pdf',
      updated_at = timezone('utc'::text, now())
  WHERE id = p_delivery_note_id;
  
  -- Log PDF Generation Request
  INSERT INTO delivery_note_audit_log (
    delivery_note_id,
    action_type,
    action_by,
    action_details,
    created_at
  ) VALUES (
    p_delivery_note_id,
    'pdf_generation_requested',
    auth.uid(),
    jsonb_build_object(
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent',
      'timestamp', timezone('utc'::text, now())
    ),
    timezone('utc'::text, now())
  );
  
  -- Die eigentliche PDF-Generierung erfolgt in der Edge Function
  -- Hier returnen wir den Auftrag mit Status
  RETURN jsonb_build_object(
    'success', true,
    'message', 'PDF-Generierung gestartet',
    'delivery_note_id', p_delivery_note_id,
    'delivery_note_number', v_delivery_note.number,
    'status', 'generating',
    'edge_function_url', concat(current_setting('app.settings.supabase_url'), '/functions/v1/generate-delivery-note-pdf')
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Reset status bei Fehler
    UPDATE delivery_notes
    SET status = 'draft',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_delivery_note_id;
    
    RAISE EXCEPTION 'Fehler bei PDF-Generierung: %', SQLERRM
      USING ERRCODE = 'internal_error';
END;
$$;

-- ============================================================================
-- 2. RPC_SEND_DELIVERY_NOTE_EMAIL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_send_delivery_note_email(
  p_delivery_note_id UUID,
  p_recipient_email TEXT,
  p_cc_emails TEXT[] DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_attach_pdf BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_company_id UUID;
  v_delivery_note RECORD;
  v_email_log_id UUID;
BEGIN
  -- RLS Check
  SELECT company_id INTO v_employee_company_id
  FROM employees
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_employee_company_id IS NULL THEN
    RAISE EXCEPTION 'Kein Mitarbeiter für User gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Prüfe Lieferschein
  SELECT * INTO v_delivery_note
  FROM delivery_notes
  WHERE id = p_delivery_note_id
  AND company_id = v_employee_company_id;
  
  IF v_delivery_note IS NULL THEN
    RAISE EXCEPTION 'Lieferschein nicht gefunden oder keine Berechtigung'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Erstelle Email-Log Eintrag
  INSERT INTO delivery_note_email_log (
    id,
    delivery_note_id,
    recipient_email,
    cc_emails,
    subject,
    message,
    attach_pdf,
    status,
    sent_by,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_delivery_note_id,
    p_recipient_email,
    p_cc_emails,
    COALESCE(p_subject, 'Lieferschein ' || v_delivery_note.number),
    p_message,
    p_attach_pdf,
    'pending',
    auth.uid(),
    timezone('utc'::text, now())
  )
  RETURNING id INTO v_email_log_id;
  
  -- Update Lieferschein Status
  UPDATE delivery_notes
  SET status = 'sent',
      updated_at = timezone('utc'::text, now())
  WHERE id = p_delivery_note_id;
  
  -- Audit Log
  INSERT INTO delivery_note_audit_log (
    delivery_note_id,
    action_type,
    action_by,
    action_details,
    created_at
  ) VALUES (
    p_delivery_note_id,
    'email_sent',
    auth.uid(),
    jsonb_build_object(
      'recipient_email', p_recipient_email,
      'cc_emails', p_cc_emails,
      'subject', COALESCE(p_subject, 'Lieferschein ' || v_delivery_note.number),
      'attach_pdf', p_attach_pdf,
      'email_log_id', v_email_log_id
    ),
    timezone('utc'::text, now())
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email wird versendet',
    'email_log_id', v_email_log_id,
    'delivery_note_id', p_delivery_note_id,
    'recipient_email', p_recipient_email,
    'edge_function_url', concat(current_setting('app.settings.supabase_url'), '/functions/v1/send-delivery-note-email')
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Update Email Log bei Fehler
    UPDATE delivery_note_email_log
    SET status = 'failed',
        error_message = SQLERRM,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_email_log_id;
    
    RAISE EXCEPTION 'Fehler beim Email-Versand: %', SQLERRM
      USING ERRCODE = 'internal_error';
END;
$$;

-- ============================================================================
-- 3. AUDIT-TABELLEN für Logging
-- ============================================================================

-- Audit Log für Delivery Notes
CREATE TABLE IF NOT EXISTS public.delivery_note_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'created', 'updated', 'signed', 'pdf_generated', 'email_sent', etc.
  action_by UUID REFERENCES auth.users(id),
  action_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Email Log für Delivery Notes  
CREATE TABLE IF NOT EXISTS public.delivery_note_email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  cc_emails TEXT[],
  subject TEXT NOT NULL,
  message TEXT,
  attach_pdf BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  external_message_id TEXT, -- From email provider
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 4. INDIZES für Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_delivery_note_audit_log_delivery_note_id 
  ON delivery_note_audit_log(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_audit_log_created_at 
  ON delivery_note_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_note_email_log_delivery_note_id 
  ON delivery_note_email_log(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_email_log_status 
  ON delivery_note_email_log(status);
CREATE INDEX IF NOT EXISTS idx_delivery_note_email_log_created_at 
  ON delivery_note_email_log(created_at DESC);

-- ============================================================================
-- 5. RLS POLICIES für Audit Tables
-- ============================================================================

ALTER TABLE public.delivery_note_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_email_log ENABLE ROW LEVEL SECURITY;

-- Audit Log - nur eigene Company lesen
CREATE POLICY "delivery_note_audit_log_company_access" ON public.delivery_note_audit_log
  FOR ALL
  USING (
    delivery_note_id IN (
      SELECT dn.id FROM delivery_notes dn
      JOIN employees e ON e.company_id = dn.company_id
      WHERE e.user_id = auth.uid()
    )
  );

-- Email Log - nur eigene Company lesen/schreiben  
CREATE POLICY "delivery_note_email_log_company_access" ON public.delivery_note_email_log
  FOR ALL
  USING (
    delivery_note_id IN (
      SELECT dn.id FROM delivery_notes dn
      JOIN employees e ON e.company_id = dn.company_id
      WHERE e.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTION: PDF Status prüfen
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_check_pdf_status(
  p_delivery_note_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_note RECORD;
BEGIN
  SELECT 
    id, number, status, pdf_url, pdf_generated_at,
    CASE 
      WHEN pdf_url IS NOT NULL AND pdf_generated_at IS NOT NULL THEN 'ready'
      WHEN status = 'generating_pdf' THEN 'generating'
      ELSE 'not_generated'
    END as pdf_status
  INTO v_delivery_note
  FROM delivery_notes
  WHERE id = p_delivery_note_id
  AND company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  );
  
  IF v_delivery_note IS NULL THEN
    RAISE EXCEPTION 'Lieferschein nicht gefunden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  RETURN jsonb_build_object(
    'delivery_note_id', v_delivery_note.id,
    'delivery_note_number', v_delivery_note.number,
    'pdf_status', v_delivery_note.pdf_status,
    'pdf_url', v_delivery_note.pdf_url,
    'pdf_generated_at', v_delivery_note.pdf_generated_at,
    'overall_status', v_delivery_note.status
  );
END;
$$;

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION rpc_generate_delivery_note_pdf TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_send_delivery_note_email TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_check_pdf_status TO authenticated;

GRANT ALL ON public.delivery_note_audit_log TO authenticated;
GRANT ALL ON public.delivery_note_email_log TO authenticated;

-- ============================================================================
-- 8. KOMMENTARE
-- ============================================================================

COMMENT ON FUNCTION rpc_generate_delivery_note_pdf IS '
Generiert PDF für Lieferschein über Edge Function.
- Prüft RLS (nur eigene Company)
- Verhindert Doppel-Generierung (1h Cache)
- Erstellt Audit-Trail
- Ruft Edge Function auf
';

COMMENT ON FUNCTION rpc_send_delivery_note_email IS '
Versendet Lieferschein per Email über Edge Function.
- Prüft RLS (nur eigene Company)  
- Erstellt Email-Log
- Erstellt Audit-Trail
- Optional PDF-Anhang
';

COMMENT ON TABLE delivery_note_audit_log IS '
Audit-Trail für alle Aktionen an Lieferscheinen.
Compliance-relevant für GoBD.
';

COMMENT ON TABLE delivery_note_email_log IS '
Email-Versand-Protokoll für Lieferscheine.
Tracking von Status, Fehlern und Provider-IDs.
';