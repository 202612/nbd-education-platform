-- A one-time "welcome" screen shown the first time a newly-approved
-- customer opens the app, then never again. Per-person (not per-account)
-- since each teammate logs in and sees it on their own first visit.

alter table app_users add column if not exists has_seen_welcome boolean not null default false;

create or replace function mark_welcome_seen() returns void
language sql security definer set search_path = public as $$
  update app_users set has_seen_welcome = true where id = my_app_user_id()
$$;

grant execute on function mark_welcome_seen() to authenticated;
