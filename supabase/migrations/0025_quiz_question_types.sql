-- Lets each quiz question have its own interactive format, not just multiple
-- choice. `type` picks the format; `config` holds whatever that format needs
-- (correct answers included) — it's only ever read server-side, the same
-- way correct_index already worked for plain multiple choice.
--
-- Formats: multiple_choice, true_false, sequence, match_pairs, categorize, numeric.
-- Existing rows default to multiple_choice and keep working off the
-- original options/correct_index columns unchanged.

alter table quiz_questions add column if not exists type text not null default 'multiple_choice'
  check (type in ('multiple_choice', 'true_false', 'sequence', 'match_pairs', 'categorize', 'numeric'));
alter table quiz_questions add column if not exists config jsonb not null default '{}'::jsonb;
alter table quiz_questions alter column options drop not null;
alter table quiz_questions alter column correct_index drop not null;

-- Returns each question shaped for its own format, with every answer key
-- stripped out (sequence/match/categorize correct answers never leave the
-- server; multiple choice/true false/numeric never send correct_index or
-- correct_value/tolerance). Items needing a shuffle (sequence order, match
-- pairs' right-hand side) are shuffled here so display order never leaks
-- the answer.
-- get_quiz_questions used to return table(...); changing it to return a
-- single jsonb value means the old signature has to be dropped first —
-- Postgres won't let CREATE OR REPLACE change a function's return type.
drop function if exists get_quiz_questions(uuid);

create function get_quiz_questions(p_step_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_type text;
  v_result jsonb;
begin
  select brand_steps.brand_id, brand_steps.type into v_brand_id, v_type from brand_steps where brand_steps.id = p_step_id;
  if v_brand_id is null then
    raise exception 'Step not found';
  end if;
  if v_type <> 'quiz' then
    raise exception 'Not a quiz step';
  end if;
  if not is_admin() and not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this step';
  end if;

  select coalesce(jsonb_agg(q.shaped order by q.order_index), '[]'::jsonb)
  into v_result
  from (
    select
      qq.order_index,
      case qq.type
        when 'numeric' then jsonb_build_object(
          'id', qq.id, 'type', qq.type, 'text', qq.text, 'order_index', qq.order_index,
          'unit', qq.config->>'unit'
        )
        when 'sequence' then jsonb_build_object(
          'id', qq.id, 'type', qq.type, 'text', qq.text, 'order_index', qq.order_index,
          'items', (select coalesce(jsonb_agg(elem order by random()), '[]'::jsonb) from jsonb_array_elements(qq.config->'items') elem)
        )
        when 'match_pairs' then jsonb_build_object(
          'id', qq.id, 'type', qq.type, 'text', qq.text, 'order_index', qq.order_index,
          'left', coalesce(qq.config->'left', '[]'::jsonb),
          'right', (select coalesce(jsonb_agg(elem order by random()), '[]'::jsonb) from jsonb_array_elements(qq.config->'right') elem)
        )
        when 'categorize' then jsonb_build_object(
          'id', qq.id, 'type', qq.type, 'text', qq.text, 'order_index', qq.order_index,
          'buckets', coalesce(qq.config->'buckets', '[]'::jsonb),
          'items', (select coalesce(jsonb_agg(elem order by random()), '[]'::jsonb) from jsonb_array_elements(qq.config->'items') elem)
        )
        else jsonb_build_object(
          'id', qq.id, 'type', qq.type, 'text', qq.text, 'order_index', qq.order_index,
          'options', qq.options
        )
      end as shaped
    from quiz_questions qq
    where qq.step_id = p_step_id
  ) q;

  return v_result;
end;
$$;

grant execute on function get_quiz_questions(uuid) to authenticated;

-- Grades every format. For sequence/match/categorize, the submitted answer
-- is compared structurally (jsonb equality) against the stored correct
-- shape — object-key equality is order-independent, array equality is
-- order-sensitive, which is exactly what each format needs.
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

  select
    count(*) filter (where graded.is_correct),
    jsonb_object_agg(graded.id::text, graded.is_correct)
  into v_correct, v_results
  from (
    select
      qq.id,
      case qq.type
        when 'numeric' then
          (p_answers -> qq.id::text) is not null
          and abs((p_answers ->> qq.id::text)::numeric - (qq.config ->> 'correct_value')::numeric)
              <= coalesce((qq.config ->> 'tolerance')::numeric, 0)
        when 'sequence' then
          (p_answers -> qq.id::text) = (
            select coalesce(jsonb_agg(elem -> 'id'), '[]'::jsonb) from jsonb_array_elements(qq.config -> 'items') elem
          )
        when 'match_pairs' then
          (p_answers -> qq.id::text) = coalesce(qq.config -> 'correct_pairs', '{}'::jsonb)
        when 'categorize' then
          (p_answers -> qq.id::text) = coalesce(qq.config -> 'correct_buckets', '{}'::jsonb)
        else
          (p_answers -> qq.id::text) is not null
          and (p_answers ->> qq.id::text)::int = qq.correct_index
      end as is_correct
    from quiz_questions qq
    where qq.step_id = p_step_id
  ) graded;

  v_passed := v_total > 0 and v_correct = v_total;
  if v_passed then
    insert into step_progress (user_id, step_id) values (v_uid, p_step_id)
      on conflict (user_id, step_id) do nothing;
  end if;

  return jsonb_build_object('passed', v_passed, 'correct', v_correct, 'total', v_total, 'results', v_results);
end;
$$;
