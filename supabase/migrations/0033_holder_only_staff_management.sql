-- Hiding the Add/Remove staff controls in the UI for non-holders isn't
-- enough on its own — the RLS policies underneath only checked that the
-- new/target row belonged to the caller's own account, not that the caller
-- was actually the holder. A staff member could still add or remove
-- teammates via a direct API call. This tightens both policies to require
-- the caller be the account's holder.

drop policy if exists "customers add staff to own account" on app_users;
create policy "holders add staff to own account" on app_users for insert
  with check (
    account_id = my_account_id()
    and role = 'staff'
    and exists (select 1 from app_users h where h.id = my_app_user_id() and h.role = 'holder')
  );

drop policy if exists "customers remove staff from own account" on app_users;
create policy "holders remove staff from own account" on app_users for delete
  using (
    account_id = my_account_id()
    and role = 'staff'
    and exists (select 1 from app_users h where h.id = my_app_user_id() and h.role = 'holder')
  );
