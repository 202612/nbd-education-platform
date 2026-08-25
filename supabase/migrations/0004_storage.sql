-- Video storage for training modules, using Supabase Storage (already part
-- of this project — no separate Google Drive service account needed to get
-- real upload working today). MP4 plays natively via the browser's <video>
-- tag once it has a URL, whichever storage backend serves it.
--
-- Caveat worth knowing: Supabase's free tier caps individual file size
-- (~50MB by default) and total storage (~1GB). Fine for a handful of
-- short training clips; if videos are longer or the catalog grows, this is
-- exactly the point the build plan flags for moving to Cloudflare Stream,
-- Mux, or Google Drive — the database only ever stores a URL, so swapping
-- the backend later doesn't touch anything else.

insert into storage.buckets (id, name, public)
values ('training-videos', 'training-videos', true)
on conflict (id) do nothing;

create policy "public read training videos" on storage.objects for select
  using (bucket_id = 'training-videos');

create policy "admins upload training videos" on storage.objects for insert
  with check (bucket_id = 'training-videos' and public.is_admin());

create policy "admins update training videos" on storage.objects for update
  using (bucket_id = 'training-videos' and public.is_admin());

create policy "admins delete training videos" on storage.objects for delete
  using (bucket_id = 'training-videos' and public.is_admin());

-- Brand logos — one image per brand, uploaded from the admin panel. Used on
-- that brand's certificate, which is generated per learner in the browser
-- (name + date filled in automatically) rather than a pre-made file.
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', true)
on conflict (id) do nothing;

create policy "public read brand logos" on storage.objects for select
  using (bucket_id = 'brand-logos');

create policy "admins upload brand logos" on storage.objects for insert
  with check (bucket_id = 'brand-logos' and public.is_admin());

create policy "admins update brand logos" on storage.objects for update
  using (bucket_id = 'brand-logos' and public.is_admin());

create policy "admins delete brand logos" on storage.objects for delete
  using (bucket_id = 'brand-logos' and public.is_admin());
