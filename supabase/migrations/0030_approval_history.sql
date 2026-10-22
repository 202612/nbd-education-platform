-- Declined staff were being hard-deleted, which threw away any record of
-- the decision. Adds a 'declined' status so they're kept (just excluded
-- from the team's own view) instead of vanishing, enabling a real history
-- view in Admin -> Approvals.

alter table app_users drop constraint if exists app_users_status_check;
alter table app_users add constraint app_users_status_check check (status in ('active', 'pending', 'declined'));
