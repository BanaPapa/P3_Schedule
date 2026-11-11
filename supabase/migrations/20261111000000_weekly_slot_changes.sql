-- 캘린더에서 바로 고치기(끌어 옮기기·더블클릭 편집·우클릭 삭제)의 "앞으로 매주" 동작.
-- 회차 하나를 기준으로 그 회차를 만든 규칙(요일·시간) 한 줄만 바꾼다. 모두 한 트랜잭션.
--   change_rule_from    : 이 요일·시간 수업을 기준일부터 다른 요일·시간으로
--   move_rule_to_child  : 이 요일·시간 수업을 기준일부터 다른 자녀의 (같은 학원) 수업으로
--   remove_rule_from    : 이 요일·시간 수업을 기준일부터 없앤다
-- 기준일 검사(오늘 ~ +400일, 수강 기간 안)는 change_schedule_from 이 한다.
-- 손댄 회차(메모·시간·상태를 바꾼 회차)는 기존 규칙대로 남는다(M3 규칙).

-- 수강 과목의 기준일 이후에도 쓰이는 규칙들(제외할 규칙 하나 빼고)을 change_schedule_from 형식으로
create function private.rules_from(p_enrollment_id uuid, p_from date, p_exclude_rule_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(distinct jsonb_build_object(
      'weekday', r.weekday,
      'start_time', to_char(r.start_time, 'HH24:MI'),
      'end_time', to_char(r.end_time, 'HH24:MI')
    )),
    '[]'::jsonb
  )
  from public.class_rules r
  where r.enrollment_id = p_enrollment_id
    and (r.effective_until is null or r.effective_until >= p_from)
    and (p_exclude_rule_id is null or r.id <> p_exclude_rule_id);
$$;

revoke all on function private.rules_from(uuid, date, uuid) from public;

-- 회차를 잠그고 확인한다: 우리 가족, 화면이 읽은 version, 규칙에서 만든 정규 회차
create function private.lock_regular_session(p_session_id uuid, p_version integer)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
begin
  select * into v_session
  from public.class_sessions s
  where s.id = p_session_id
    and s.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if v_session.version <> p_version then
    raise exception 'session_conflict';
  end if;
  if v_session.kind <> 'regular' or v_session.rule_id is null then
    raise exception 'only_regular_session';
  end if;
  return v_session;
end;
$$;

revoke all on function private.lock_regular_session(uuid, integer) from public;

-- 규칙 한 줄로 된 change_schedule_from 형식
create function private.single_rule(p_weekday smallint, p_start time, p_end time)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(jsonb_build_object(
    'weekday', p_weekday,
    'start_time', to_char(p_start, 'HH24:MI'),
    'end_time', to_char(p_end, 'HH24:MI')
  ));
$$;

revoke all on function private.single_rule(smallint, time, time) from public;

-- 남은 규칙이 없으면 수강을 기준일 전날로 끝내고, 있으면 그 규칙들로 이어 간다
create function private.replace_rules_from(p_enrollment_id uuid, p_from date, p_rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_array_length(p_rules) = 0 then
    perform public.end_enrollment(p_enrollment_id, p_from - 1);
  else
    perform public.change_schedule_from(p_enrollment_id, p_from, p_rules);
  end if;
end;
$$;

revoke all on function private.replace_rules_from(uuid, date, jsonb) from public;

create function public.change_rule_from(
  p_session_id uuid,
  p_version integer,
  p_from date,
  p_weekday smallint,
  p_start time,
  p_end time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
begin
  v_session := private.lock_regular_session(p_session_id, p_version);
  perform private.replace_rules_from(
    v_session.enrollment_id,
    p_from,
    private.rules_from(v_session.enrollment_id, p_from, v_session.rule_id)
      || private.single_rule(p_weekday, p_start, p_end)
  );
end;
$$;

create function public.move_rule_to_child(
  p_session_id uuid,
  p_version integer,
  p_child_id uuid,
  p_from date,
  p_weekday smallint,
  p_start time,
  p_end time
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_enrollment public.enrollments;
  v_target uuid;
  v_new jsonb := private.single_rule(p_weekday, p_start, p_end);
begin
  v_session := private.lock_regular_session(p_session_id, p_version);
  select * into v_enrollment from public.enrollments e where e.id = v_session.enrollment_id;

  if not exists (
    select 1 from public.children c
    where c.id = p_child_id and c.family_id = v_enrollment.family_id
  ) then
    raise exception 'child_not_found';
  end if;
  if p_child_id = v_enrollment.child_id then
    raise exception 'same_child';
  end if;

  -- 원래 자녀 수업에서 이 요일·시간을 뺀다
  perform private.replace_rules_from(
    v_enrollment.id,
    p_from,
    private.rules_from(v_enrollment.id, p_from, v_session.rule_id)
  );

  -- 옮겨 갈 자녀가 그 학원을 이미 다니면 그 수강 과목에 더하고, 아니면 새로 만든다
  select e.id into v_target
  from public.enrollments e
  where e.family_id = v_enrollment.family_id
    and e.child_id = p_child_id
    and e.academy_id = v_enrollment.academy_id
    and e.start_date <= p_from
    and (e.end_date is null or e.end_date >= p_from)
  order by e.start_date desc
  limit 1
  for update;

  if v_target is null then
    v_target := public.create_enrollment(
      p_child_id, v_enrollment.academy_id, null, p_from, null, v_new, v_enrollment.memo
    );
  else
    perform public.change_schedule_from(
      v_target, p_from, private.rules_from(v_target, p_from, null) || v_new
    );
  end if;
  return v_target;
end;
$$;

create function public.remove_rule_from(p_session_id uuid, p_version integer, p_from date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
begin
  v_session := private.lock_regular_session(p_session_id, p_version);
  perform private.replace_rules_from(
    v_session.enrollment_id,
    p_from,
    private.rules_from(v_session.enrollment_id, p_from, v_session.rule_id)
  );
  -- 고른 회차가 손댄 회차라 남았다면(예정 상태) 사용자가 지우려던 것이므로 취소한다
  update public.class_sessions s
  set status = 'cancelled'
  where s.id = v_session.id
    and s.session_date >= p_from
    and s.status = 'scheduled';
end;
$$;

revoke all on function public.change_rule_from(uuid, integer, date, smallint, time, time) from public, anon;
revoke all on function public.move_rule_to_child(uuid, integer, uuid, date, smallint, time, time) from public, anon;
revoke all on function public.remove_rule_from(uuid, integer, date) from public, anon;
grant execute on function public.change_rule_from(uuid, integer, date, smallint, time, time) to authenticated;
grant execute on function public.move_rule_to_child(uuid, integer, uuid, date, smallint, time, time) to authenticated;
grant execute on function public.remove_rule_from(uuid, integer, date) to authenticated;
