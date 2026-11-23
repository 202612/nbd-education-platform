-- A real, unique, verifiable certificate ID per issued certificate — not a
-- separate counter to keep in sync, just a short readable code derived from
-- the certificate row's own id (already guaranteed unique by being a
-- primary key). Mirrors the cert_date_* columns: null by default, only
-- shown once an admin turns it on and places it for a brand.

alter table brand_steps add column if not exists cert_id_x numeric;
alter table brand_steps add column if not exists cert_id_y numeric;
alter table brand_steps add column if not exists cert_id_font_size numeric;
alter table brand_steps add column if not exists cert_id_color text;

-- claim_certificate_step previously returned everything the certificate
-- screen needs EXCEPT the certificate row's own id — add it so the
-- frontend can derive a short code (e.g. NBD-A1B2C3D4) from something
-- that's already guaranteed unique, instead of maintaining a separate
-- sequence.
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
  v_cert_id uuid;
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

  select id, issued_at, pdf_path into v_cert_id, v_issued_at, v_pdf_path
    from certificates where user_id = v_uid and brand_id = v_brand_id;

  return jsonb_build_object(
    'claimed', true,
    'id', v_cert_id,
    'issued_at', v_issued_at,
    'user_id', v_uid,
    'brand_id', v_brand_id,
    'pdf_stored', v_pdf_path is not null
  );
end;
$$;

grant execute on function claim_certificate_step(uuid) to authenticated;
