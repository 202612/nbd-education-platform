-- Lets admins customize the landing page hero (logo, background image,
-- heading text) from the admin panel, instead of it being hardcoded. Only
-- the hero banner is customizable — the sign-in/request-access form below
-- it is unaffected.
--
-- A single-row "settings" table: there's only ever one landing page, so
-- there's only ever one row, with a fixed id.

create table if not exists site_settings (
  id int primary key default 1,
  logo_url text,
  logo_position_x int not null default 50,
  logo_position_y int not null default 50,
  logo_zoom numeric not null default 1,
  background_url text,
  background_position_x int not null default 50,
  background_position_y int not null default 50,
  background_zoom numeric not null default 1,
  eyebrow text not null default 'National Beauty Distribution',
  headline text not null default 'Education Portal',
  subtitle text not null default 'Training, certification and brand education for our stockists',
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = 1)
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;

-- Shown on the landing page before anyone signs in, so it has to be
-- readable by signed-out visitors too.
create policy "public read site settings" on site_settings for select
  using (true);

create policy "admins update site settings" on site_settings for all
  using (is_admin()) with check (is_admin());

-- Logo/background image files — also needs to be public since the landing
-- page loads before authentication.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "public read site assets" on storage.objects for select
  using (bucket_id = 'site-assets');

create policy "admins upload site assets" on storage.objects for insert
  with check (bucket_id = 'site-assets' and public.is_admin());

create policy "admins update site assets" on storage.objects for update
  using (bucket_id = 'site-assets' and public.is_admin());

create policy "admins delete site assets" on storage.objects for delete
  using (bucket_id = 'site-assets' and public.is_admin());
