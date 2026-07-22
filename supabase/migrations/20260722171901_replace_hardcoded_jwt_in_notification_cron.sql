-- ====================================================================
-- Replace hardcoded JWT in notification-cron with Vault-based read
--
-- notification-cron was scheduled directly on the production database (no
-- repo migration ever existed for it) with an anon JWT hardcoded in the
-- Authorization header — the same pattern already fixed for gmail-sync-job
-- and process-ai-queue-job (20260722162523 / 20260722162550).
--
-- This migration re-creates the job so the Authorization header is built at
-- execution time from Supabase Vault. The migration itself contains no secret.
--
-- The Vault secret `supabase_anon_key` is shared with the other cron jobs and
-- is already provisioned; nothing more to set up.
--
-- Idempotent: safely re-runnable. Re-applying replaces the existing job.
-- ====================================================================

-- Fail fast if the secret has not been provisioned in this environment.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key'
  ) THEN
    RAISE EXCEPTION
      'Vault secret "supabase_anon_key" is missing. Create it via '
      'Project Settings → Vault → Secrets (or vault.create_secret) '
      'before applying this migration.';
  END IF;
END
$$;

-- Drop the existing job so we can re-create it with the Vault-based auth header.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-cron') THEN
    PERFORM cron.unschedule('notification-cron');
  END IF;
END
$$;

-- Reschedule with the auth header read per-invocation from Vault. Schedule and
-- body preserved verbatim from the previously installed job.
SELECT cron.schedule(
  'notification-cron',
  '0 0,6,12,18 * * *', -- 00:00, 06:00, 12:00, 18:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/notification-cron',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_anon_key'
        LIMIT 1
      )
    ),
    body := '{"automated": true}'::jsonb
  ) AS request_id;
  $$
);
