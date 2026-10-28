-- The holder's team-progress view only knew WHICH steps each teammate had
-- completed, not WHEN — needed to show a "last activity" date per person
-- per course on the new staff training dashboard.

-- Adding a column to a RETURNS TABLE(...) signature counts as changing the
-- function's return type, which CREATE OR REPLACE won't allow — drop first.
drop function if exists get_team_progress();

create function get_team_progress()
returns table (user_id uuid, step_id uuid, completed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid := my_account_id();
  v_role text;
begin
  select role into v_role from app_users where id = my_app_user_id();
  if v_role is distinct from 'holder' then
    raise exception 'Only the main account holder can view team progress';
  end if;

  return query
    select sp.user_id, sp.step_id, sp.completed_at
    from step_progress sp
    join app_users u on u.id = sp.user_id
    where u.account_id = v_account_id;
end;
$$;

grant execute on function get_team_progress() to authenticated;
