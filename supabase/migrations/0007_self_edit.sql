-- Lets a signed-in customer (holder or staff) update their own profile
-- name and their account's company details. Deliberately narrow — these
-- RPCs can never touch status or approved_brand_ids, so a customer editing
-- their own details can't grant themselves brand access or approve
-- themselves. That stays admin-only, same as before.

create or replace function update_my_profile(p_name text)
returns jsonb
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
  if p_name is null or trim(p_name) = '' then
    raise exception 'Name is required';
  end if;

  update app_users set name = trim(p_name) where id = v_uid;

  return jsonb_build_object('updated', true);
end;
$$;

grant execute on function update_my_profile(text) to authenticated;

create or replace function update_my_account(
  p_customer_number text,
  p_company_name text,
  p_main_contact_name text,
  p_main_contact_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := my_account_id();
begin
  if v_account_id is null then
    raise exception 'No linked account for this login';
  end if;
  if p_company_name is null or trim(p_company_name) = '' then
    raise exception 'Company name is required';
  end if;
  if exists (
    select 1 from accounts
    where customer_number = trim(p_customer_number) and id <> v_account_id
  ) then
    raise exception 'That customer number is already registered to another account';
  end if;

  update accounts set
    customer_number = nullif(trim(p_customer_number), ''),
    company_name = trim(p_company_name),
    main_contact_name = trim(p_main_contact_name),
    main_contact_email = trim(p_main_contact_email)
  where id = v_account_id;

  return jsonb_build_object('updated', true);
end;
$$;

grant execute on function update_my_account(text, text, text, text) to authenticated;
