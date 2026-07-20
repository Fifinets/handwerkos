-- ====================================================================
-- Schedule process-ai-queue Edge Function via pg_cron
--
-- Triggers the worker every 5 minutes. The worker drains up to 20 pending
-- items per run (see supabase/functions/process-ai-queue/index.ts),
-- creates OpenAI embeddings, and upserts them into ai_index.
--
-- The Authorization header uses the project's anon key. The key is
-- public-by-design (it's in the frontend bundle anyway), so storing it in
-- the migration is acceptable. verify_jwt=true on the edge function means
-- anonymous calls without this key are rejected.
--
-- Idempotent: safely re-runnable. Re-applying replaces the existing job.
-- ====================================================================

-- Remove any previous schedule with the same name so re-running this
-- migration doesn't fail with a unique constraint error.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-ai-queue-job') THEN
    PERFORM cron.unschedule('process-ai-queue-job');
  END IF;
END
$$;

SELECT cron.schedule(
  'process-ai-queue-job',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/process-ai-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd2hranJobmRlb3Nrcnhld3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTExODAsImV4cCI6MjA2NzEyNzE4MH0.eSPBRJKIBd9oiXqfo8vrbmMCl6QByxnVgHqtgofDGtg"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);
