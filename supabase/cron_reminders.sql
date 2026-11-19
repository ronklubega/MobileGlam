-- Triggers the web app's reminder + payment-reconciliation job every 5 minutes, on any hosting plan
-- (Vercel Hobby only allows daily crons). Run in the Supabase SQL editor AFTER deploying the web app.
-- Replace the two placeholders. The secret must equal CRON_SECRET in the web app's environment.

create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-APP-DOMAIN/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);

-- Inspect:  select * from cron.job;   select * from net._http_response order by created desc limit 5;
-- Remove:   select cron.unschedule('send-reminders');
