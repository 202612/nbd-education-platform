-- Returns per-question right/wrong for the learner's own submitted answers,
-- so the quiz screen can tell them which ones they got wrong without ever
-- exposing the actual correct_index (still never sent to the browser).

create or replace function submit_quiz_answers(p_step_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := my_app_user_id();
  v_brand_id uuid;
  v_type text;
  v_total int;
  v_correct int;
  v_passed boolean;
  v_results jsonb;
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;

  select brand_id, type into v_brand_id, v_type from brand_steps where id = p_step_id;
  if v_brand_id is null then
    raise exception 'Step not found';
  end if;
  if v_type <> 'quiz' then
    raise exception 'Not a quiz step';
  end if;
  if not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this brand';
  end if;
  if not step_unlocked_for(p_step_id, v_uid) then
    raise exception 'Complete the previous step first';
  end if;

  select count(*) into v_total from quiz_questions where step_id = p_step_id;
  select count(*) into v_correct
    from quiz_questions q
    where q.step_id = p_step_id
      and (p_answers -> q.id::text) is not null
      and (p_answers ->> q.id::text)::int = q.correct_index;

  select jsonb_object_agg(q.id::text, coalesce((p_answers ->> q.id::text)::int = q.correct_index, false))
    into v_results
    from quiz_questions q
    where q.step_id = p_step_id;

  v_passed := v_total > 0 and v_correct = v_total;
  if v_passed then
    insert into step_progress (user_id, step_id) values (v_uid, p_step_id)
      on conflict (user_id, step_id) do nothing;
  end if;

  return jsonb_build_object('passed', v_passed, 'correct', v_correct, 'total', v_total, 'results', v_results);
end;
$$;
