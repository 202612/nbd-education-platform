-- Makes uploaded training videos actually private: only a signed-in
-- customer whose account is approved for that brand (or an admin) can ever
-- fetch the file — not just "anyone who has the link," which is all the
-- public bucket from 0004 gave us. Free — this is a Supabase Storage
-- feature, not a paid add-on.
--
-- Pasted external video URLs (YouTube etc.) are unaffected — those were
-- never files in this bucket to begin with.

-- Uploaded files now store their storage path here; video_url stays for
-- pasted external links. A step has one or the other, not both.
alter table brand_steps add column if not exists video_storage_path text;

update storage.buckets set public = false where id = 'training-videos';

drop policy if exists "public read training videos" on storage.objects;

create policy "approved customers and admins read training videos" on storage.objects for select
  using (
    bucket_id = 'training-videos'
    and (
      public.is_admin()
      or ((storage.foldername(name))[1])::uuid = any (public.my_approved_brand_ids())
    )
  );
