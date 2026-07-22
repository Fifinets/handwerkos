-- Idempotenz: alte Versionen entfernen falls re-applied
SELECT cron.unschedule('agent-mahnungen-check')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-mahnungen-check');
SELECT cron.unschedule('agent-daily-briefing')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-daily-briefing');

-- Job 1: Mahnungen-Check Mo-Fr 08:00 UTC
SELECT cron.schedule(
  'agent-mahnungen-check',
  '0 8 * * 1-5',
  $cmd$
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
  $cmd$
);

-- Job 2: Daily Briefing Mo-Fr 06:00 UTC
SELECT cron.schedule(
  'agent-daily-briefing',
  '0 6 * * 1-5',
  $cmd$
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
  $cmd$
);
