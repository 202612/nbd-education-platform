-- Lets admins upload their own certificate artwork per brand (instead of the
-- one built-in design) and mark exactly where the learner's name should be
-- printed on it. Position is stored as a percentage of the image so it
-- lines up the same way at any render size; font size/colour are plain
-- CSS values, same convention the built-in certificate already uses.

alter table brand_steps add column if not exists cert_template_url text;
alter table brand_steps add column if not exists cert_name_x numeric not null default 50;
alter table brand_steps add column if not exists cert_name_y numeric not null default 55;
alter table brand_steps add column if not exists cert_name_font_size int not null default 34;
alter table brand_steps add column if not exists cert_name_color text not null default '#1a2b3d';

-- Public bucket — template artwork is blank (no learner names), same as
-- brand logos, and needs to be readable by signed-out visitors previewing
-- nothing in particular, but consistent with how brand-logos already works.
insert into storage.buckets (id, name, public)
values ('certificate-templates', 'certificate-templates', true)
on conflict (id) do nothing;

create policy "public read certificate templates" on storage.objects for select
  using (bucket_id = 'certificate-templates');

create policy "admins upload certificate templates" on storage.objects for insert
  with check (bucket_id = 'certificate-templates' and public.is_admin());

create policy "admins update certificate templates" on storage.objects for update
  using (bucket_id = 'certificate-templates' and public.is_admin());

create policy "admins delete certificate templates" on storage.objects for delete
  using (bucket_id = 'certificate-templates' and public.is_admin());
