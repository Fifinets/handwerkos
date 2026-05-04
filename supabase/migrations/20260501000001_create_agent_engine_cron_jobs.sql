-- ============================================================
-- Phase 3.2: pg_cron Heartbeats für die Agent-Engine
--
-- Zwei wiederkehrende Jobs:
--   1. agent-mahnungen-check (Mo–Fr 08:00) — agent-invoices scannt
--      überfällige Rechnungen je Company, bereitet Mahnungen vor.
--   2. agent-daily-briefing (Mo–Fr 06:00) — agent-planning erstellt
--      Tagesbriefing pro Company.
--
-- Authentifizierung: service_role Key liegt in Supabase Vault
-- (siehe SETUP unten — User muss EINMAL ausgeführen). Cron-Commands
-- lesen den Key zur Laufzeit aus vault.decrypted_secrets.
--
-- pg_cron + pg_net + supabase_vault sind bereits installiert.
-- ============================================================

-- ============================================================
-- SETUP (User muss EINMAL ausführen, BEVOR die Cron-Jobs feuern):
--
--   SELECT vault.create_secret(
--     '<service_role_key_hier>',
--     'agent_engine_service_role_key',
--     'Service role JWT — used by agent-engine cron jobs to invoke agent-router heartbeat path'
--   );
--
-- Kontrolle:
--
--   SELECT name, description, created_at FROM vault.secrets
--   WHERE name = 'agent_engine_service_role_key';
-- ============================================================

-- Idempotenz: alte Versionen entfernen falls re-applied
SELECT cron.unschedule('agent-mahnungen-check')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-mahnungen-check');
SELECT cron.unschedule('agent-daily-briefing')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-daily-briefing');

-- ============================================================
-- Job 1: Mahnungen-Check
-- Mo–Fr 08:00 UTC — agent-invoices fan-out für jede Company
-- ============================================================
SELECT cron.schedule(
  'agent-mahnungen-check',
  '0 8 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/agent-router',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'agent_engine_service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'trigger', 'heartbeat',
      'agent', 'invoices',
      'action', 'check_overdue',
      'companyId', c.id::text,
      'payload', jsonb_build_object('reason', 'cron-mahnungen-check')
    )
  ) AS request_id
  FROM public.companies c;
  $$
);

-- ============================================================
-- Job 2: Daily Briefing
-- Mo–Fr 06:00 UTC — agent-planning fan-out für jede Company
-- ============================================================
SELECT cron.schedule(
  'agent-daily-briefing',
  '0 6 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/agent-router',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'agent_engine_service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'trigger', 'heartbeat',
      'agent', 'planning',
      'action', 'daily_briefing',
      'companyId', c.id::text,
      'payload', jsonb_build_object('reason', 'cron-daily-briefing', 'when', 'today')
    )
  ) AS request_id
  FROM public.companies c;
  $$
);

-- ============================================================
-- Verifikation:
--   SELECT jobid, jobname, schedule, active
--   FROM cron.job
--   WHERE jobname IN ('agent-mahnungen-check', 'agent-daily-briefing');
-- ============================================================
