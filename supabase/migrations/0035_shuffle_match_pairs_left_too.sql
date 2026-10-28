-- The right-hand column of a match_pairs question was already shuffled on
-- every load, but the left-hand column stayed in whatever order it was
-- typed in admin — meaning the quiz could end up with no real pattern to
-- break, or worse, an exploitable one if it's always entered the same way.
-- Shuffling both sides independently removes any positional pattern.

create or replace function get_quiz_questions(p_step_id uuid)
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
          'left', (select coalesce(jsonb_agg(elem order by random()), '[]'::jsonb) from jsonb_array_elements(qq.config->'left') elem),
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
