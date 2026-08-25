-- Self-service "request access" flow: a salon creates their own login and
-- submits an application, which lands in Admin → Approvals exactly like
-- the accounts you've been approving by hand so far.

-- What they said they stock, kept separate from approved_brand_ids (what
-- you actually granted) so you can see the difference at approval time.
alter table accounts add column if not exists requested_brand_ids uuid[] not null default '{}';

-- The brand catalog (name/tagline/logo — nothing sensitive) needs to be
-- visible to signed-out visitors so the application form can show checkboxes
-- for "which brands do you stock." Training content itself (brand_steps,
-- quiz_questions) stays restricted — this policy only opens up `brands`.
create policy "public read brand catalog" on brands for select
  using (true);

-- Called right after a new salon creates their login (email/password).
-- Creates their account (pending) and links them as its main holder in one
-- step — bypasses RLS deliberately, the same way every other write RPC
-- here does, so no blanket "any authenticated user can insert" policy is
-- needed on accounts/app_users.
create or replace function submit_account_application(
  p_customer_number text,
  p_company_name text,
  p_main_contact_name text,
  p_requested_brand_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_account_id uuid;
begin
  if v_uid is null or v_email is null then
    raise exception 'You need to be signed in to submit an application';
  end if;
  if exists (select 1 from app_users where auth_id = v_uid) then
    raise exception 'This login is already linked to an account';
  end if;
  if exists (select 1 from admins where auth_id = v_uid) then
    raise exception 'This login is already an admin account';
  end if;
  if p_company_name is null or trim(p_company_name) = '' then
    raise exception 'Company name is required';
  end if;
  if p_customer_number is null or trim(p_customer_number) = '' then
    raise exception 'Customer number is required';
  end if;
  if exists (select 1 from accounts where customer_number = trim(p_customer_number)) then
    raise exception 'That customer number is already registered — contact NBD if this is a mistake';
  end if;

  insert into accounts (customer_number, company_name, main_contact_name, main_contact_email, status, requested_brand_ids)
  values (trim(p_customer_number), trim(p_company_name), trim(p_main_contact_name), v_email, 'pending', p_requested_brand_ids)
  returning id into v_account_id;

  insert into app_users (account_id, name, email, role, auth_id)
  values (v_account_id, trim(p_main_contact_name), v_email, 'holder', v_uid);

  return jsonb_build_object('account_id', v_account_id);
end;
$$;

grant execute on function submit_account_application(text, text, text, uuid[]) to authenticated;
