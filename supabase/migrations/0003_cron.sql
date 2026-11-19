-- Requires the pg_cron extension (Supabase: Database -> Extensions). Reminders are dispatched by the
-- web app's /api/cron/reminders route (needs SMS + secrets), triggered every 5 minutes via pg_net.
create extension if not exists pg_cron;
select cron.schedule('expire-stale-holds', '* * * * *', $$select public.expire_stale_holds()$$);
