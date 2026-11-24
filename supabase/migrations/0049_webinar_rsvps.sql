-- Lets a customer RSVP to an upcoming webinar ("I'm attending"). Separate
-- from webinar_attendance (which only records that it was actually
-- watched) — an RSVP is a statement of intent before it goes live, and is
-- how the webinar shows up on the customer's own Calendar. Admin can see
-- who's RSVPed per webinar, same pattern as the existing attendance list.

create table if not exists webinar_rsvps (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (webinar_id, user_id)
);

create index if not exists webinar_rsvps_webinar_id_idx on webinar_rsvps(webinar_id);
create index if not exists webinar_rsvps_user_id_idx on webinar_rsvps(user_id);

alter table webinar_rsvps enable row level security;

-- No direct customer select policy, same reasoning as webinar_attendance —
-- customers only ever see RSVP state shaped through get_my_webinars().
create policy "admins full access to webinar rsvps" on webinar_rsvps for all
  using (is_admin()) with check (is_admin());

-- Adds has_rsvped to what the customer-facing list already returns, so the
-- UI can show "You're going" vs an "I'm attending" button, and the
-- Calendar can filter down to just the ones they've RSVPed to.
create or replace function get_my_webinars()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id,
    'brand_id', w.brand_id,
    'brand_name', b.name,
    'brand_logo_url', b.logo_url,
    'title', w.title,
    'scheduled_at', w.scheduled_at,
    'is_live', w.scheduled_at <= now(),
    'video_url', case when w.scheduled_at <= now() then w.video_url else null end,
    'has_rsvped', exists (
      select 1 from webinar_rsvps r where r.webinar_id = w.id and r.user_id = my_app_user_id()
    )
  ) order by w.scheduled_at), '[]'::jsonb)
  from webinars w
  join brands b on b.id = w.brand_id
  where w.brand_id = any (my_approved_brand_ids())
    and not exists (
      select 1 from webinar_attendance a
      where a.webinar_id = w.id and a.user_id = my_app_user_id()
    );
$$;

create function rsvp_webinar(p_webinar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_uid uuid := my_app_user_id();
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;

  select brand_id into v_brand_id from webinars where id = p_webinar_id;
  if v_brand_id is null then
    raise exception 'Webinar not found';
  end if;
  if not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this brand';
  end if;

  insert into webinar_rsvps (webinar_id, user_id)
  values (p_webinar_id, v_uid)
  on conflict (webinar_id, user_id) do nothing;
end;
$$;

grant execute on function rsvp_webinar(uuid) to authenticated;

create function cancel_webinar_rsvp(p_webinar_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from webinar_rsvps
  where webinar_id = p_webinar_id and user_id = my_app_user_id();
$$;

grant execute on function cancel_webinar_rsvp(uuid) to authenticated;
