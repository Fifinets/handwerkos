-- ============================================================
-- KRITISCHER SICHERHEITSFIX: RLS-Policies für öffentlich 
-- zugängliche Tabellen sichern
-- 
-- Problem: Mehrere Tabellen hatten USING (true) Policies, die
-- unauthentifizierten Nutzern vollständigen Lesezugriff 
-- (und in manchen Fällen auch Schreibzugriff) erlaubten.
--
-- Datum: 2026-03-05
-- ============================================================


-- ============================================================
-- 1. EMPLOYEE_INVITATIONS
-- ============================================================
-- Die Policy "Anyone can view invitation by token" erlaubte
-- allen (anon + authenticated) den vollen SELECT-Zugriff auf
-- ALLE Einladungen inkl. Tokens. Ersetzt durch eine sichere
-- SECURITY DEFINER Funktion, die nur per Token filtert.

DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.employee_invitations;

-- Sichere Funktion: Liest genau eine Einladung anhand des Tokens.
-- SECURITY DEFINER bedeutet: die Funktion läuft mit den Rechten
-- des Owners (postgres), nicht des aufrufenden Users. Damit
-- braucht die anon-Rolle keine direkte Tabellenberechtigung mehr.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id uuid,
  email text,
  invited_by uuid,
  company_id uuid,
  invite_token text,
  expires_at timestamptz,
  employee_data jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, email, invited_by, company_id, invite_token,
    expires_at, employee_data, status, created_at, updated_at
  FROM public.employee_invitations
  WHERE invite_token = p_token
    AND status = 'pending'
    AND expires_at > now();
$$;

-- Berechtigungen explizit setzen
REVOKE ALL ON FUNCTION public.get_invitation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;

-- Sichere Funktion: Markiert eine Einladung als angenommen.
-- Wird nach der Registrierung aufgerufen.
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(p_token TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.employee_invitations
  SET status = 'accepted', updated_at = now()
  WHERE invite_token = p_token
    AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(TEXT) TO anon, authenticated;


-- ============================================================
-- 2. TELEGRAM_USERS + TELEGRAM_AUTH_CODES
-- ============================================================
-- Beide Tabellen hatten "Service role full access" mit 
-- USING (true) - also voller Zugriff für ALLE nicht nur den
-- Service Role Key. Service Role umgeht RLS sowieso immer.

DROP POLICY IF EXISTS "Service role full access on telegram_users" ON public.telegram_users;
DROP POLICY IF EXISTS "Service role full access on telegram_auth_codes" ON public.telegram_auth_codes;

-- Nutzer sehen und verwalten nur ihre eigene Telegram-Verbindung
CREATE POLICY "Users can manage own telegram connection"
  ON public.telegram_users
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auth-Codes: Nutzer sehen und verwalten nur ihre eigenen
CREATE POLICY "Users can manage own telegram auth codes"
  ON public.telegram_auth_codes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- 3. NUMBER_SEQUENCES
-- ============================================================
-- Die Policy "System can manage number sequences" hatte 
-- USING (true) - also voller Schreibzugriff für alle.
-- Schreibzugriff erfolgt ausschließlich über SECURITY DEFINER
-- Funktionen (z.B. generate_document_number). Direkte 
-- Schreibzugriffe werden gesperrt.

DROP POLICY IF EXISTS "System can manage number sequences" ON public.number_sequences;

-- Hinweis: Die bestehende SELECT-Policy "Users can view number 
-- sequences for their company" bleibt erhalten. 
-- INSERT/UPDATE/DELETE nur noch via SECURITY DEFINER Funktionen.


-- ============================================================
-- 4. AI_PROCESSING_QUEUE
-- ============================================================
-- Die Policy "System can manage AI processing queue" hatte 
-- USING (true) - also for alle lesbar.
-- AI-Worker nutzen den service_role Key (umgeht RLS), also
-- brauchen wir keine offene Policy.

DROP POLICY IF EXISTS "System can manage AI processing queue" ON public.ai_processing_queue;

-- Authentifizierte Nutzer der gleichen Firma können ihre Queue sehen
CREATE POLICY "Company users can view own AI queue"
  ON public.ai_processing_queue
  FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

-- Schreiben nur via service_role (Edge Functions / Triggers),
-- keine direkte INSERT/UPDATE/DELETE Berechtigung für Users.


-- ============================================================
-- 5. EMAIL_CATEGORIES
-- ============================================================
-- Die Policy "Everyone can view email categories" erlaubte
-- anonymen Nutzern den Lesezugriff. Da es sich um globale
-- System-Kategorien handelt, reicht "authenticated" aus.

DROP POLICY IF EXISTS "Everyone can view email categories" ON public.email_categories;

CREATE POLICY "Authenticated users can view email categories"
  ON public.email_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Die Policy "Managers can manage email categories" bleibt erhalten.


-- ============================================================
-- 6. AI_INDEX + AI_TRAINING_DATA  
-- ============================================================
-- Diese Tabellen hatten ebenfalls USING (true) für "System".
-- AI-Worker nutzen service_role, keine offene Policy nötig.

DROP POLICY IF EXISTS "System can manage AI index" ON public.ai_index;
DROP POLICY IF EXISTS "System can manage AI training data" ON public.ai_training_data;

-- Users der eigenen Company können AI-Index lesen (bereits durch
-- SELECT-Policy abgedeckt). Schreiben nur via service_role.
-- Keine neue Policy nötig, bestehende SELECT-Policy reicht.


-- ============================================================
-- VERIFICATION
-- ============================================================
-- Nach dem Deployen im Supabase SQL Editor ausführen:
--
-- SELECT tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'employee_invitations', 'telegram_users', 'telegram_auth_codes',
--   'number_sequences', 'ai_processing_queue', 'email_categories'
-- )
-- ORDER BY tablename, policyname;
