-- Create cron job for automatic email synchronization
SELECT cron.schedule(
  'gmail-sync-job',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qgwhkjrhndeoskrxewpb.supabase.co/functions/v1/sync-gmail-emails',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd2hranJobmRlb3Nrcnhld3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NTExODAsImV4cCI6MjA2NzEyNzE4MH0.eSPBRJKIBd9oiXqfo8vrbmMCl6QByxnVgHqtgofDGtg"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);