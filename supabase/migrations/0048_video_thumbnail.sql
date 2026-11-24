-- Lets an admin prep a video step (title + thumbnail image) before the
-- actual video file/link is ready. The thumbnail is just decorative, so it
-- gets its own small public bucket (unlike training-videos, which is
-- private) — same pattern as certificate-templates.

alter table brand_steps add column if not exists thumbnail_url text;

insert into storage.buckets (id, name, public)
values ('step-thumbnails', 'step-thumbnails', true)
on conflict (id) do nothing;

create policy "public read step thumbnails" on storage.objects for select
  using (bucket_id = 'step-thumbnails');

create policy "admins upload step thumbnails" on storage.objects for insert
  with check (bucket_id = 'step-thumbnails' and public.is_admin());

create policy "admins update step thumbnails" on storage.objects for update
  using (bucket_id = 'step-thumbnails' and public.is_admin());

create policy "admins delete step thumbnails" on storage.objects for delete
  using (bucket_id = 'step-thumbnails' and public.is_admin());
