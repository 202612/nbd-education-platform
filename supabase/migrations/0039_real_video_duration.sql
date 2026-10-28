-- Lets the player itself report a video's REAL length (YouTube's own
-- getDuration(), or the native <video> element's loadedmetadata event)
-- the first time anyone watches it, instead of relying only on the
-- free-text "duration" admins type in (e.g. "6 min") for reporting.
-- First-write-wins (only sets it if still null) so nothing can clobber an
-- already-known-good value, and it's capped to video steps only.

alter table brand_steps add column if not exists duration_seconds numeric;

create or replace function record_video_duration(p_step_id uuid, p_seconds numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_type text;
begin
  select brand_id, type into v_brand_id, v_type from brand_steps where id = p_step_id;
  if v_brand_id is null or v_type <> 'video' then
    return;
  end if;
  if not is_admin() and not (v_brand_id = any (my_approved_brand_ids())) then
    return;
  end if;
  if p_seconds is null or p_seconds <= 0 then
    return;
  end if;

  update brand_steps set duration_seconds = p_seconds where id = p_step_id and duration_seconds is null;
end;
$$;

grant execute on function record_video_duration(uuid, numeric) to authenticated;
