-- Lets a customer (or an account holder, for any teammate) put a date on
-- finishing a brand's training. Status isn't stored — it's worked out from
-- step_progress the same way every other dashboard in this app already
-- does, so it can never drift out of sync with what's actually completed.
-- Email reminders are sent by a separate edge function + cron job (see
-- supabase/functions/send-training-reminders and the migration below it).

create table if not exists training_schedule (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  assigned_to uuid not null references app_users(id) on delete cascade,
  created_by uuid not null references app_users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  scheduled_date date not null,
  note text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists training_schedule_account_idx on training_schedule(account_id);
create index if not exists training_schedule_assigned_idx on training_schedule(assigned_to);
create index if not exists training_schedule_date_idx on training_schedule(scheduled_date);

alter table training_schedule enable row level security;

create policy "admins full access to training_schedule" on training_schedule for all
  using (is_admin()) with check (is_admin());

create policy "customers read own account schedule" on training_schedule for select
  using (account_id = my_account_id());

-- Staff can only schedule training for themselves; a holder can schedule it
-- for anyone on their own account's team.
create policy "customers create schedule entries" on training_schedule for insert
  with check (
    account_id = my_account_id()
    and assigned_to in (select id from app_users where account_id = my_account_id())
    and (
      assigned_to = my_app_user_id()
      or (select role from app_users where id = my_app_user_id()) = 'holder'
    )
  );

create policy "customers cancel schedule entries" on training_schedule for delete
  using (
    account_id = my_account_id()
    and (
      assigned_to = my_app_user_id()
      or created_by = my_app_user_id()
      or (select role from app_users where id = my_app_user_id()) = 'holder'
    )
  );
