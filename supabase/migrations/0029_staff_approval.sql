-- Staff a holder adds now need admin approval before they can actually get
-- in, not instant access. New staff rows land as status='pending'; they can
-- still create their password any time (same flow as before), but
-- resolve_login reports them back as pending until an admin approves them
-- from a new queue in Admin -> Approvals.

alter table app_users add column if not exists status text not null default 'active'
  check (status in ('active', 'pending'));

-- Existing rows (everyone already using the platform) stay active;
-- app_users.insert() for new staff will now explicitly pass status='pending'
-- from the frontend.

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
      'kind',
      case
        when v_user.status = 'pending' then 'staff_pending'
        when v_account.status = 'approved' then 'customer'
        else 'pending'
      end,
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
