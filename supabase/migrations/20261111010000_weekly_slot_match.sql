-- 고침: "앞으로 매주" 가 고를 규칙을 회차의 rule_id 만으로 찾으면, 그 사이 일정 변경으로
-- 같은 요일·시각의 새 규칙이 생긴 경우(옛 규칙은 끝남) 새 규칙을 못 빼서
--   - 다른 아이로 옮기면 원래 아이에게도 남고(복사됨),
--   - 시간을 바꾸면 같은 요일·시각이 두 번 들어가 invalid_schedule 이 났다.
-- 이제 "이 수업" = 기준일에도 쓰이는 규칙 중 회차 규칙과 같은 요일·시작 시각인 것.
-- 그런 규칙이 없으면(이미 다른 시간으로 바뀜) slot_not_current 를 던진다.

create function private.rules_except_slot(p_enrollment_id uuid, p_from date, p_rule_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule public.class_rules;
begin
  select * into v_rule from public.class_rules r where r.id = p_rule_id;
  if not exists (
    select 1 from public.class_rules r
    where r.enrollment_id = p_enrollment_id
      and (r.effective_until is null or r.effective_until >= p_from)
      and r.weekday = v_rule.weekday
      and r.start_time = v_rule.start_time
  ) then
    raise exception 'slot_not_current';
  end if;

  return (
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
      and not (r.weekday = v_rule.weekday and r.start_time = v_rule.start_time)
  );
end;
$$;

revoke all on function private.rules_except_slot(uuid, date, uuid) from public;

create or replace function public.change_rule_from(
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
    private.rules_except_slot(v_session.enrollment_id, p_from, v_session.rule_id)
      || private.single_rule(p_weekday, p_start, p_end)
  );
end;
$$;

create or replace function public.move_rule_to_child(
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

  perform private.replace_rules_from(
    v_enrollment.id,
    p_from,
    private.rules_except_slot(v_enrollment.id, p_from, v_session.rule_id)
  );

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

create or replace function public.remove_rule_from(p_session_id uuid, p_version integer, p_from date)
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
    private.rules_except_slot(v_session.enrollment_id, p_from, v_session.rule_id)
  );
  update public.class_sessions s
  set status = 'cancelled'
  where s.id = v_session.id
    and s.session_date >= p_from
    and s.status = 'scheduled';
end;
$$;
