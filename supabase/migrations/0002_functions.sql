-- Helper functions used by RLS policies, plus the RPCs the frontend calls
-- directly for login resolution, sequence-locking, quiz grading, and
-- certificate issuance.

-- security definer so these can read admins/app_users regardless of the
-- caller's own row-level access (that's the whole point of a helper).
create or replace function my_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from app_users where auth_id = auth.uid()
$$;

create or replace function my_account_id() returns uuid
language sql stable security definer set search_path = public as $$
  select account_id from app_users where auth_id = auth.uid()
$$;

-- Returns the caller's approved_brand_ids as an actual array value, not a
-- one-row subquery — "x = any (select array_col from t)" fails in Postgres
-- because a bare subquery is treated as a set of scalar rows to compare
-- one-by-one, not "here's an array to search inside." Wrapping it in a
-- function call sidesteps that and gives a real array expression instead.
create or replace function my_approved_brand_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(approved_brand_ids, '{}') from accounts where id = my_account_id()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where auth_id = auth.uid())
$$;

grant execute on function my_app_user_id() to authenticated;
grant execute on function my_account_id() to authenticated;
grant execute on function my_approved_brand_ids() to authenticated;
grant execute on function is_admin() to authenticated;

-- True if p_step_id is the first step in its brand's sequence, or the step
-- immediately before it has been completed by p_user_id. This is the single
-- place that enforces "you can't skip ahead" — checked server-side, not
-- just hidden in the UI.
create or replace function step_unlocked_for(p_step_id uuid, p_user_id uuid) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_order int;
  v_prev_step_id uuid;
begin
  select brand_id, order_index into v_brand_id, v_order from brand_steps where id = p_step_id;
  if v_brand_id is null then
    return false;
  end if;
  select id into v_prev_step_id from brand_steps
    where brand_id = v_brand_id and order_index < v_order
    order by order_index desc limit 1;
  if v_prev_step_id is null then
    return true;
  end if;
  return exists (select 1 from step_progress where user_id = p_user_id and step_id = v_prev_step_id);
end;
$$;

grant execute on function step_unlocked_for(uuid, uuid) to authenticated;

-- Called right after sign-in. Links a freshly-authenticated user to their
-- pre-seeded admins/app_users row by email (first login only), then reports
-- back who they are so the frontend knows which screen to show.
create or replace function resolve_login()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_uid uuid := auth.uid();
  v_admin admins;
  v_user app_users;
  v_account accounts;
  found_admin boolean := false;
  found_user boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('kind', 'unauthenticated');
  end if;

  select * into v_admin from admins where auth_id = v_uid;
  found_admin := found;
  if not found_admin and v_email is not null then
    select * into v_admin from admins where email = v_email and auth_id is null;
    if found then
      update admins set auth_id = v_uid where id = v_admin.id;
      found_admin := true;
    end if;
  end if;
  if found_admin then
    return jsonb_build_object('kind', 'admin', 'admin', jsonb_build_object('id', v_admin.id, 'name', v_admin.name, 'email', v_admin.email));
  end if;

  select * into v_user from app_users where auth_id = v_uid;
  found_user := found;
  if not found_user and v_email is not null then
    select * into v_user from app_users where email = v_email and auth_id is null;
    if found then
      update app_users set auth_id = v_uid where id = v_user.id;
      found_user := true;
    end if;
  end if;
  if found_user then
    select * into v_account from accounts where id = v_user.account_id;
    return jsonb_build_object(
      'kind', case when v_account.status = 'approved' then 'customer' else 'pending' end,
      'user', jsonb_build_object('id', v_user.id, 'name', v_user.name, 'email', v_user.email, 'role', v_user.role, 'account_id', v_user.account_id),
      'account', jsonb_build_object(
        'id', v_account.id, 'company_name', v_account.company_name, 'customer_number', v_account.customer_number,
        'main_contact_name', v_account.main_contact_name, 'main_contact_email', v_account.main_contact_email,
        'status', v_account.status, 'approved_brand_ids', v_account.approved_brand_ids
      )
    );
  end if;

  return jsonb_build_object('kind', 'unrecognized');
end;
$$;

grant execute on function resolve_login() to authenticated;

-- Questions without their answer key — used by the quiz screen so the
-- correct option never reaches the browser.
create or replace function get_quiz_questions(p_step_id uuid)
returns table (id uuid, text text, options jsonb, order_index int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_type text;
begin
  select brand_id, type into v_brand_id, v_type from brand_steps where id = p_step_id;
  if v_brand_id is null then
    raise exception 'Step not found';
  end if;
  if v_type <> 'quiz' then
    raise exception 'Not a quiz step';
  end if;
  if not is_admin() and not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this step';
  end if;
  return query
    select q.id, q.text, q.options, q.order_index
    from quiz_questions q
    where q.step_id = p_step_id
    order by q.order_index;
end;
$$;

grant execute on function get_quiz_questions(uuid) to authenticated;

-- Grades a quiz attempt server-side and records progress. p_answers is a
-- JSON object of question id -> selected option index, e.g. {"<uuid>": 1}.
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

  v_passed := v_total > 0 and v_correct = v_total;
  if v_passed then
    insert into step_progress (user_id, step_id) values (v_uid, p_step_id)
      on conflict (user_id, step_id) do nothing;
  end if;

  return jsonb_build_object('passed', v_passed, 'correct', v_correct, 'total', v_total);
end;
$$;

grant execute on function submit_quiz_answers(uuid, jsonb) to authenticated;

-- Marks a video step watched. The client fires this on the video's "ended"
-- event and also offers a manual "mark as watched" button as a fallback.
create or replace function complete_video_step(p_step_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := my_app_user_id();
  v_brand_id uuid;
  v_type text;
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;

  select brand_id, type into v_brand_id, v_type from brand_steps where id = p_step_id;
  if v_brand_id is null then
    raise exception 'Step not found';
  end if;
  if v_type <> 'video' then
    raise exception 'Not a video step';
  end if;
  if not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this brand';
  end if;
  if not step_unlocked_for(p_step_id, v_uid) then
    raise exception 'Complete the previous step first';
  end if;

  insert into step_progress (user_id, step_id) values (v_uid, p_step_id)
    on conflict (user_id, step_id) do nothing;

  return jsonb_build_object('completed', true);
end;
$$;

grant execute on function complete_video_step(uuid) to authenticated;

-- Reached once every earlier step in the brand is complete. Marks the
-- certificate step itself complete and issues the certificates row.
create or replace function claim_certificate_step(p_step_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := my_app_user_id();
  v_brand_id uuid;
  v_type text;
  v_issued_at timestamptz;
begin
  if v_uid is null then
    raise exception 'No linked account for this login';
  end if;

  select brand_id, type into v_brand_id, v_type from brand_steps where id = p_step_id;
  if v_brand_id is null then
    raise exception 'Step not found';
  end if;
  if v_type <> 'certificate' then
    raise exception 'Not a certificate step';
  end if;
  if not (v_brand_id = any (my_approved_brand_ids())) then
    raise exception 'Not authorized for this brand';
  end if;
  if not step_unlocked_for(p_step_id, v_uid) then
    raise exception 'Complete every step before the certificate first';
  end if;

  insert into step_progress (user_id, step_id) values (v_uid, p_step_id)
    on conflict (user_id, step_id) do nothing;
  insert into certificates (user_id, brand_id) values (v_uid, v_brand_id)
    on conflict (user_id, brand_id) do nothing;

  select issued_at into v_issued_at from certificates where user_id = v_uid and brand_id = v_brand_id;

  return jsonb_build_object('claimed', true, 'issued_at', v_issued_at);
end;
$$;

grant execute on function claim_certificate_step(uuid) to authenticated;
