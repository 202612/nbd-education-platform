-- A fixed "Account holder view" / "Staff view" for admin testing, with every
-- brand unlocked — not tied to any real customer, and not affected by which
-- real accounts exist. is_demo marks it so the frontend can show ALL brands
-- for it regardless of approved_brand_ids (robust even as new brands get
-- added later, rather than needing this re-run every time).

alter table accounts add column if not exists is_demo boolean not null default false;

insert into accounts (customer_number, company_name, main_contact_name, main_contact_email, status, approved_brand_ids, is_demo)
select 'DEMO', 'Full Access Demo', 'Demo', 'demo@nationalbeauty.ie', 'approved', (select coalesce(array_agg(id), '{}') from brands), true
where not exists (select 1 from accounts where customer_number = 'DEMO');

insert into app_users (account_id, name, email, role, status)
select a.id, 'Account Holder View', 'demo-holder@nationalbeauty.ie', 'holder', 'active'
from accounts a
where a.customer_number = 'DEMO'
  and not exists (select 1 from app_users where email = 'demo-holder@nationalbeauty.ie');

insert into app_users (account_id, name, email, role, status)
select a.id, 'Staff Member View', 'demo-staff@nationalbeauty.ie', 'staff', 'active'
from accounts a
where a.customer_number = 'DEMO'
  and not exists (select 1 from app_users where email = 'demo-staff@nationalbeauty.ie');

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
          'status', v_account.status, 'approved_brand_ids', v_account.approved_brand_ids, 'is_demo', v_account.is_demo
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
        'status', v_account.status, 'approved_brand_ids', v_account.approved_brand_ids, 'is_demo', v_account.is_demo
      )
    );
  end if;

  return jsonb_build_object('kind', 'unrecognized');
end;
$$;

-- Keeps the demo account's *real* authorization in sync with "every brand,
-- forever" too (not just what the frontend displays) — so a brand added
-- after this migration runs still works in the demo view without needing
-- this re-run.
create or replace function my_approved_brand_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select case
    when (select is_demo from accounts where id = my_account_id()) then (select coalesce(array_agg(id), '{}') from brands)
    else coalesce((select approved_brand_ids from accounts where id = my_account_id()), '{}')
  end
$$;
