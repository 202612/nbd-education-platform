-- Keep a server-side copy of every certificate PDF, so a learner who never
-- clicks "Download" isn't the only place the document exists.
--
-- The PDF is still built in the learner's browser (html2canvas + jsPDF) the
-- same as before — on the certificate screen it now also uploads that file
-- to a private Storage bucket and records the path here. Admins download it
-- from the Certificates tab via a short-lived signed URL.

alter table certificates add column if not exists pdf_path text;

-- Private bucket — certificates carry a learner's name, so unlike logos and
-- videos this one is not world-readable. Access is via signed URLs only.
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- Path convention: '<app_user_id>/<brand_id>.pdf'. The first folder is the
-- owning learner, which is what the learner-scoped policies match on.
create policy "admins full access to certificate files" on storage.objects for all
  using (bucket_id = 'certificates' and public.is_admin())
  with check (bucket_id = 'certificates' and public.is_admin());

create policy "learners read own certificate files" on storage.objects for select
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.my_app_user_id()::text
  );

create policy "learners upload own certificate files" on storage.objects for insert
  with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.my_app_user_id()::text
  );

create policy "learners replace own certificate files" on storage.objects for update
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.my_app_user_id()::text
  );

-- Lets the learner's browser record the stored path on their own certificate
-- row without opening a general UPDATE policy on the table.
create or replace function record_certificate_pdf(p_brand_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := my_app_user_id();
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;
  update certificates set pdf_path = p_path
    where user_id = v_uid and brand_id = p_brand_id;
end;
$$;

grant execute on function record_certificate_pdf(uuid, text) to authenticated;

-- Re-issue claim_certificate_step so its response also carries the learner's
-- app_user id, the brand id, and whether a PDF copy is already stored — the
-- certificate screen needs all three to upload the backup copy to the right
-- Storage path without a second round-trip.
create or replace function claim_certificate_step(p_step_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := my_app_user_id();
  v_brand_id uuid;
  v_type text;
  v_issued_at timestamptz;
  v_pdf_path text;
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;

  select brand_id, type into v_brand_id, v_type from brand_steps where id = p_step_id;
  if v_brand_id is null then
    raise exception 'Step not found';
  end if;
  if v_type <> 'certificate' then
    raise exception 'Not a certificate step';
  end if;
  if not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this brand';
  end if;
  if not step_unlocked_for(p_step_id, v_uid) then
    raise exception 'Complete every step before the certificate first';
  end if;

  insert into step_progress (user_id, step_id) values (v_uid, p_step_id)
    on conflict (user_id, step_id) do nothing;
  insert into certificates (user_id, brand_id) values (v_uid, v_brand_id)
    on conflict (user_id, brand_id) do nothing;

  select issued_at, pdf_path into v_issued_at, v_pdf_path
    from certificates where user_id = v_uid and brand_id = v_brand_id;

  return jsonb_build_object(
    'claimed', true,
    'issued_at', v_issued_at,
    'user_id', v_uid,
    'brand_id', v_brand_id,
    'pdf_stored', v_pdf_path is not null
  );
end;
$$;

grant execute on function claim_certificate_step(uuid) to authenticated;
