-- ====================================================================
-- Replace hardcoded JWT in process-ai-queue-job cron with Vault-based read
--
-- The historical migration (20260511163000_*) hardcoded an anon JWT
-- directly in the Authorization header of the cron command. The key is
-- only an anon role token (public-by-design, also shipped in the frontend
-- bundle), but storing it in the repo causes:
--   - Gitleaks to flag the file on every CI run
--   - Manual edits to the migration on every key rotation
--   - A bad pattern that gets copied by future cron jobs
--
-- This migration unschedules the existing job and re-creates it so that
-- the Authorization header is built at execution time from a value
-- stored in Supabase Vault. The migration itself contains no secret.
--
-- ONE-TIME SETUP per environment (Prod/Staging/Local) — must run BEFORE
-- this migration is applied. The same Vault secret is shared with the
-- gmail-sync cron (see 20260531120000_replace_hardcoded_jwt_in_gmail_sync_cron),
-- so if that migration's setup has already been done, nothing more is
-- needed here.
--
--   Dashboard:  Project Settings → Vault → Secrets → New secret
--     Name:   supabase_anon_key
--     Secret: <anon/public JWT from Project Settings → API>
--
--   Or via SQL (e.g. supabase db remote --execute):
--     SELECT vault.create_secret(
--       '<anon JWT goes here>',
--       'supabase_anon_key',
--       'Anon key used by pg_cron jobs to call verify_jwt edge functions'
--     );
--
--   Verify:
--     SELECT name FROM vault.secrets WHERE name = 'supabase_anon_key';
--
-- Idempotent: safely re-runnable. Re-applying replaces the existing job.
-- ====================================================================

-- Fail fast if the secret has not been provisioned in this environment.
-- Better to abort the migration than to silently install a broken cron.
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

-- Drop the existing job (originally scheduled by 20260511163000_*) so we
-- can re-create it with the new Vault-based auth header.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-ai-queue-job') THEN
    PERFORM cron.unschedule('process-ai-queue-job');
  END IF;
END
$$;

-- Reschedule the job. The Authorization header is built per-invocation
-- from vault.decrypted_secrets, so key rotation only requires updating
-- the Vault entry — no code change, no new migration.
SELECT cron.schedule(
  'process-ai-queue-job',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/process-ai-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_anon_key'
        LIMIT 1
      )
    ),
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);
