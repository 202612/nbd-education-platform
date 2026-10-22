-- Previously, a taken customer number was only discovered *after* the login
-- was already created (auth.signUp succeeds, then submit_account_application
-- fails on the duplicate check) — leaving a real login with no account
-- behind it, and Supabase's auth system permanently refusing to let that
-- email sign up again ("User already registered"), even though nothing
-- ever actually got into `accounts`. This lets the frontend check first,
-- before ever creating a login, so a duplicate number just shows an inline
-- error instead of silently orphaning the signup.

create or replace function check_customer_number_available(p_customer_number text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from accounts where customer_number = trim(p_customer_number));
$$;

grant execute on function check_customer_number_available(text) to anon, authenticated;
