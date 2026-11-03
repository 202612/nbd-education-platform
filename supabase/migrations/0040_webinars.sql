-- Live webinars: a YouTube video per brand that unlocks at a scheduled
-- date/time. Customers see it counting down, then can watch it once it's
-- live; once watched it drops off their list. Admin keeps every webinar
-- and every attendance record forever, regardless of whether a customer
-- has "finished" with it.

create table if not exists webinars (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  video_url text not null,
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists webinar_attendance (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  watched_at timestamptz not null default now(),
  unique (webinar_id, user_id)
);

create index if not exists webinars_brand_id_idx on webinars(brand_id);
create index if not exists webinar_attendance_webinar_id_idx on webinar_attendance(webinar_id);
create index if not exists webinar_attendance_user_id_idx on webinar_attendance(user_id);

alter table webinars enable row level security;
alter table webinar_attendance enable row level security;

-- No customer-facing select policy on either table on purpose — customers
-- only ever see webinar data shaped through get_my_webinars() below, which
-- withholds the video_url until the scheduled time has actually passed.
-- Reading the tables directly would let someone grab the YouTube link
-- early via the network tab.
create policy "admins full access to webinars" on webinars for all
  using (is_admin()) with check (is_admin());

create policy "admins full access to webinar attendance" on webinar_attendance for all
  using (is_admin()) with check (is_admin());

-- Shapes each approved brand's webinars for the caller: hides video_url
-- until scheduled_at has passed, and drops any webinar the caller has
-- already watched (per the "disappears once watched" requirement).
create function get_my_webinars()
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
    'video_url', case when w.scheduled_at <= now() then w.video_url else null end
  ) order by w.scheduled_at), '[]'::jsonb)
  from webinars w
  join brands b on b.id = w.brand_id
  where w.brand_id = any (my_approved_brand_ids())
    and not exists (
      select 1 from webinar_attendance a
      where a.webinar_id = w.id and a.user_id = my_app_user_id()
    );
$$;

grant execute on function get_my_webinars() to authenticated;

-- Records that this caller watched this webinar — only once it's actually
-- live, and only for a brand they're approved for. on conflict do nothing
-- means opening it twice doesn't error or create duplicate rows.
create function record_webinar_watched(p_webinar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_scheduled_at timestamptz;
  v_uid uuid := my_app_user_id();
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;

  select brand_id, scheduled_at into v_brand_id, v_scheduled_at from webinars where id = p_webinar_id;
  if v_brand_id is null then
    raise exception 'Webinar not found';
  end if;
  if not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this brand';
  end if;
  if v_scheduled_at > now() then
    raise exception 'This webinar is not live yet';
  end if;

  insert into webinar_attendance (webinar_id, user_id)
  values (p_webinar_id, v_uid)
  on conflict (webinar_id, user_id) do nothing;
end;
$$;

grant execute on function record_webinar_watched(uuid) to authenticated;
