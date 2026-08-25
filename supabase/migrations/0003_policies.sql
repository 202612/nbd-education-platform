-- Row-level security: every table is locked down by default, then opened up
-- narrowly for admins (full access) and customers (only their own account's
-- data). Run 0001 and 0002 first — these policies call the helper functions
-- defined there.

alter table brands enable row level security;
alter table brand_steps enable row level security;
alter table quiz_questions enable row level security;
alter table accounts enable row level security;
alter table app_users enable row level security;
alter table admins enable row level security;
alter table step_progress enable row level security;
alter table certificates enable row level security;

-- brands
create policy "admins full access to brands" on brands for all
  using (is_admin()) with check (is_admin());
create policy "customers read approved brands" on brands for select
  using (id = any (select approved_brand_ids from accounts where id = my_account_id()));

-- brand_steps — video/quiz/certificate metadata is fine for customers to
-- read directly (no answer key lives here); it's just the ordered sequence.
create policy "admins full access to brand_steps" on brand_steps for all
  using (is_admin()) with check (is_admin());
create policy "customers read steps of approved brands" on brand_steps for select
  using (brand_id = any (select approved_brand_ids from accounts where id = my_account_id()));

-- quiz_questions — no direct customer policy. Customers only ever see
-- questions (without the answer key) via the get_quiz_questions RPC.
create policy "admins full access to quiz_questions" on quiz_questions for all
  using (is_admin()) with check (is_admin());

-- accounts
create policy "admins full access to accounts" on accounts for all
  using (is_admin()) with check (is_admin());
create policy "customers read own account" on accounts for select
  using (id = my_account_id());

-- app_users
create policy "admins full access to app_users" on app_users for all
  using (is_admin()) with check (is_admin());
create policy "customers read own account team" on app_users for select
  using (account_id = my_account_id());
create policy "customers add staff to own account" on app_users for insert
  with check (account_id = my_account_id() and role = 'staff');
create policy "customers remove staff from own account" on app_users for delete
  using (account_id = my_account_id() and role = 'staff');

-- admins — admins can see the admin roster; nobody else can see this table.
create policy "admins read admins" on admins for select
  using (is_admin());

-- step_progress
create policy "admins full access to step_progress" on step_progress for all
  using (is_admin()) with check (is_admin());
create policy "customers read own step_progress" on step_progress for select
  using (user_id = my_app_user_id());

-- certificates
create policy "admins full access to certificates" on certificates for all
  using (is_admin()) with check (is_admin());
create policy "customers read own certificates" on certificates for select
  using (user_id = my_app_user_id());
