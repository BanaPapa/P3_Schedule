-- "앞으로 전체 변경" 을 이번 주 월요일부터 할 수 있게 한다.
-- 오늘부터만 바꾸면 이번 주 지난 요일(월·화 …)은 그대로라, 시간표를 고쳐도 지금 보는 주가 안 바뀌어
-- 바뀌지 않은 것처럼 보였다. 이번 주 안에서는 기록이 없는(손대지 않은: 정규·예정·version 1) 회차만
-- 지우고 새 규칙으로 다시 만든다. 완료·결석·메모·이번만 변경한 회차는 기존대로 남는다(M3 규칙 유지).
-- 지난주 이전은 여전히 바꿀 수 없다.

create function private.week_start(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_date - (extract(isodow from p_date)::integer - 1);
$$;

revoke all on function private.week_start(date) from public;

create or replace function public.change_schedule_from(p_enrollment_id uuid, p_from date, p_rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
begin
  select * into v_enrollment
  from public.enrollments e
  where e.id = p_enrollment_id
    and e.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  if p_from is null
    or p_from < private.week_start(private.family_today())
    or p_from > private.family_today() + 400
    or p_from < v_enrollment.start_date
    or (v_enrollment.end_date is not null and p_from > v_enrollment.end_date) then
    raise exception 'invalid_period';
  end if;

  -- 아무도 손대지 않은(version 1) 정규 예정 회차만 지운다. 손댄 회차는 남고, 새 규칙은 그날을 건너뛴다.
  delete from public.class_sessions s
  where s.enrollment_id = p_enrollment_id
    and s.session_date >= p_from
    and s.kind = 'regular'
    and s.status = 'scheduled'
    and s.version = 1;
  delete from public.class_rules r
  where r.enrollment_id = p_enrollment_id
    and r.effective_from >= p_from;
  update public.class_rules r
  set effective_until = p_from - 1
  where r.enrollment_id = p_enrollment_id
    and (r.effective_until is null or r.effective_until >= p_from);

  perform private.insert_class_rules(
    p_enrollment_id, v_enrollment.family_id, p_rules, p_from, v_enrollment.end_date
  );
  perform private.generate_sessions_between(p_enrollment_id, p_from, private.session_horizon());
end;
$$;

-- 수업 시간이 하나도 안 남으면 수강을 끝낸다. end_enrollment 는 오늘 이후 회차만 정리하므로
-- 이번 주 지난 요일의 손대지 않은 회차는 여기서 먼저 지운다(다른 아이로 옮겼을 때 두 번 보이지 않게).
create or replace function private.replace_rules_from(p_enrollment_id uuid, p_from date, p_rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
begin
  if jsonb_array_length(p_rules) > 0 then
    perform public.change_schedule_from(p_enrollment_id, p_from, p_rules);
    return;
  end if;

  if p_from < private.week_start(private.family_today()) then
    raise exception 'invalid_period';
  end if;
  delete from public.class_sessions s
  where s.enrollment_id = p_enrollment_id
    and s.session_date >= p_from
    and s.kind = 'regular'
    and s.status = 'scheduled'
    and s.version = 1;
  select e.start_date into v_start from public.enrollments e where e.id = p_enrollment_id;
  perform public.end_enrollment(p_enrollment_id, greatest(p_from - 1, v_start));
end;
$$;
