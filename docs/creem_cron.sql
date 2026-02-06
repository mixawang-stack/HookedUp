-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists http;

-- Function to invoke Creem processor endpoint
create or replace function public.invoke_process_creem_events()
returns void
language plpgsql
as $$
declare
  resp json;
begin
  select content::json
  into resp
  from http(
    (
      'POST',
      'https://hookedup.me/api/cron/process-creem-events',
      ARRAY[
        http_header('x-cron-secret', 'hookedupdada6578san2nd')
      ],
      'application/json',
      '{}'::text
    )::http_request
  );
end;
$$;

-- Schedule every minute
select cron.schedule(
  'process_creem_events_every_minute',
  '* * * * *',
  $$select public.invoke_process_creem_events();$$
);

-- Verify jobs
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 20;
