-- Lets an admin genuinely become a specific customer for testing: real video
-- completion, real quiz grading, real step unlocking, real certificate
-- issuance — not the read-only content preview that already existed
-- (PreviewAsCustomer, which deliberately never writes to the database).
--
-- Mechanism: admins gets a nullable view_as_app_user_id. While it's set,
-- my_app_user_id()/my_account_id() resolve to that app_user instead of the
-- admin's own (admins have no app_user row), so every RPC that reads "who
-- is calling" — complete_video_step, submit_quiz_answers,
-- claim_certificate_step — behaves exactly as it would for that real
-- customer. resolve_login() reports this back to the frontend so it can
-- render the real CustomerApp with a "you're testing as X" banner instead
-- of the admin screen.

alter table admins add column if not exists view_as_app_user_id uuid references app_users(id) on delete set null;

create or replace function my_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select view_as_app_user_id from admins where auth_id = auth.uid() and view_as_app_user_id is not null),
    (select id from app_users where auth_id = auth.uid())
  )
$$;

create or replace function my_account_id() returns uuid
language sql stable security definer set search_path = public as $$
  select account_id from app_users where id = my_app_user_id()
$$;

create or replace function admin_set_view_as(p_app_user_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admins only';
  end if;
  if p_app_user_id is not null and not exists (select 1 from app_users where id = p_app_user_id) then
    raise exception 'That customer login does not exist';
  end if;
  update admins set view_as_app_user_id = p_app_user_id where auth_id = auth.uid();
end;
$$;

grant execute on function admin_set_view_as(uuid) to authenticated;

create or replace function resolve_login()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_uid uuid := auth.uid();
  v_admin admins;
  v_user app_users;
  v_account accounts;
  found_admin boolean := false;
  found_user boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('kind', 'unauthenticated');
  end if;

  select * into v_admin from admins where auth_id = v_uid;
  found_admin := found;
  if not found_admin and v_email is not null then
    select * into v_admin from admins where email = v_email and auth_id is null;
    if found then
      update admins set auth_id = v_uid where id = v_admin.id;
      found_admin := true;
    end if;
  end if;

  if found_admin and v_admin.view_as_app_user_id is not null then
    select * into v_user from app_users where id = v_admin.view_as_app_user_id;
    if found then
      select * into v_account from accounts where id = v_user.account_id;
      return jsonb_build_object(
        'kind', 'customer',
        'admin_testing', true,
        'admin_name', v_admin.name,
        'user', jsonb_build_object('id', v_user.id, 'name', v_user.name, 'email', v_user.email, 'role', v_user.role, 'account_id', v_user.account_id),
        'account', jsonb_build_object(
          'id', v_account.id, 'company_name', v_account.company_name, 'customer_number', v_account.customer_number,
          'main_contact_name', v_account.main_contact_name, 'main_contact_email', v_account.main_contact_email,
          'status', v_account.status, 'approved_brand_ids', v_account.approved_brand_ids
        )
      );
    end if;
    -- the test target was deleted since it was picked; clear it and fall through to the normal admin screen
    update admins set view_as_app_user_id = null where id = v_admin.id;
  end if;

  if found_admin then
    return jsonb_build_object('kind', 'admin', 'admin', jsonb_build_object('id', v_admin.id, 'name', v_admin.name, 'email', v_admin.email));
  end if;

  select * into v_user from app_users where auth_id = v_uid;
  found_user := found;
  if not found_user and v_email is not null then
    select * into v_user from app_users where email = v_email and auth_id is null;
    if found then
      update app_users set auth_id = v_uid where id = v_user.id;
      found_user := true;
    end if;
  end if;
  if found_user then
    select * into v_account from accounts where id = v_user.account_id;
    return jsonb_build_object(
      'kind', case when v_account.status = 'approved' then 'customer' else 'pending' end,
      'user', jsonb_build_object('id', v_user.id, 'name', v_user.name, 'email', v_user.email, 'role', v_user.role, 'account_id', v_user.account_id),
      'account', jsonb_build_object(
        'id', v_account.id, 'company_name', v_account.company_name, 'customer_number', v_account.customer_number,
        'main_contact_name', v_account.main_contact_name, 'main_contact_email', v_account.main_contact_email,
        'status', v_account.status, 'approved_brand_ids', v_account.approved_brand_ids
      )
    );
  end if;

  return jsonb_build_object('kind', 'unrecognized');
end;
$$;
