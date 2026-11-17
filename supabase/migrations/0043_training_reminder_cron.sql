-- Schedules the daily call to the send-training-reminders edge function.
-- Before running this: deploy the function (see
-- supabase/functions/send-training-reminders/index.ts for the exact CLI
-- commands), then replace YOUR-PROJECT-REF below with your actual project
-- ref (visible in the Supabase dashboard URL, or via `supabase status`).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-training-reminders-daily',
  '0 8 * * *', -- 08:00 UTC every day
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-training-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
