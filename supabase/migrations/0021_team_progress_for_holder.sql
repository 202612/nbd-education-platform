-- Lets the main account holder (the salon's "account manager") see their
-- whole team's real training progress on their own Team tab — previously
-- customers could only read their own step_progress rows (RLS scoped it to
-- user_id = caller), so this adds a security-definer RPC that checks the
-- caller is the holder on their own account before returning the team's
-- progress rows.

create or replace function get_team_progress()
returns table (user_id uuid, step_id uuid)
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
    select sp.user_id, sp.step_id
    from step_progress sp
    join app_users u on u.id = sp.user_id
    where u.account_id = v_account_id;
end;
$$;

grant execute on function get_team_progress() to authenticated;
