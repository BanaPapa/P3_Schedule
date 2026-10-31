-- M3: 결석·휴강·취소, 이번 수업만 변경, 앞으로 전체 변경, 보강 연결
--
-- 원칙
-- * 회차 종류(kind): regular(규칙에서 생성) / makeup(보강) / rescheduled(이번만 다른 날로 옮김).
--   makeup·rescheduled 는 원 회차(origin_session_id)와 연결한다.
-- * 원 회차 하나에 살아 있는(취소되지 않은) 보강·변경 회차는 하나뿐이다. 누락·중복 계산을 막는다.
-- * 정규 회차의 날짜는 바꾸지 않는다. 다른 날로 옮기면 원 회차는 cancelled 로 남기고 rescheduled 회차를 만든다.
-- * 상태 변경은 RPC 로만 한다. 회차 종류별로 허용되는 상태를 검사하고 version 으로 동시 수정을 감지한다.
-- * 이미 지난 일정과 사람이 바꾼 회차는 이력이므로 일정 변경으로 지우지 않는다.

create type public.class_session_kind as enum ('regular', 'makeup', 'rescheduled');

alter table public.class_sessions
  add column kind public.class_session_kind not null default 'regular',
  add column origin_session_id uuid,
  -- 결석·휴강했지만 보강을 하지 않기로 함 (보강 대기 목록에서 뺀다)
  add column makeup_waived boolean not null default false,
  add constraint class_sessions_id_family_id_key unique (id, family_id),
  -- 원 회차가 지워져도 보강·변경 이력이 함께 사라지지 않도록 cascade 하지 않는다.
  -- (no action 은 문장 끝에 검사하므로 수강 과목·가족 전체 삭제에서는 함께 지워진다)
  add constraint class_sessions_origin_fkey foreign key (origin_session_id, family_id)
    references public.class_sessions (id, family_id),
  add constraint class_sessions_origin_matches_kind check ((kind = 'regular') = (origin_session_id is null)),
  add constraint class_sessions_rule_only_for_regular check (kind = 'regular' or rule_id is null),
  add constraint class_sessions_status_matches_kind check (
    case kind
      when 'makeup' then status in ('makeup_scheduled', 'makeup_completed', 'cancelled')
      else status not in ('makeup_scheduled', 'makeup_completed')
    end
  );

create unique index class_sessions_one_live_replacement_idx
  on public.class_sessions (origin_session_id)
  where origin_session_id is not null and status <> 'cancelled';

-- 사람이 만든 보강·변경 회차는 생성도 이력에 남긴다 (자동 생성 정규 회차는 남기지 않는다)
create trigger class_sessions_audit_manual_insert after insert on public.class_sessions
  for each row when (new.kind <> 'regular') execute function private.write_audit_log();

-- 메모는 직접 고칠 수 있다. 상태·날짜·시각은 RPC 로만 바꾼다.
grant update (note) on public.class_sessions to authenticated;
create policy "members update class sessions" on public.class_sessions
  for update to authenticated
  using (private.is_family_member(family_id)) with check (private.is_family_member(family_id));

-- 결석·휴강했고, 보강이 없고, 보강 안 함으로 표시하지 않은 회차
create view public.makeup_waitlist with (security_invoker = true) as
select s.*
from public.class_sessions s
where s.status in ('absent', 'academy_cancelled')
  and s.kind <> 'makeup'
  and not s.makeup_waived
  and not exists (
    select 1 from public.class_sessions m
    where m.origin_session_id = s.id and m.status <> 'cancelled'
  );

revoke all on public.makeup_waitlist from anon, authenticated;
grant select on public.makeup_waitlist to authenticated;

-- ---------------------------------------------------------------------------
-- 내부 함수
-- ---------------------------------------------------------------------------

-- 내 가족 회차를 잠그고 돌려준다. 화면이 읽은 version 과 다르면 다른 사람이 먼저 바꾼 것이다.
create function private.lock_session(p_session_id uuid, p_version integer)
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
  if v_session.version is distinct from p_version then
    raise exception 'session_conflict';
  end if;
  return v_session;
end;
$$;

create function private.validate_session_slot(p_date date, p_start time, p_end time)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_date is null
    or p_date < private.family_today() - 366
    or p_date > private.family_today() + 400 then
    raise exception 'invalid_period';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'invalid_schedule';
  end if;
end;
$$;

-- 정규 회차 생성(M2)에 한 가지 조건을 더한다: 그날 이미 "지금은 끝난(또는 지워진) 규칙"의 정규 회차가
-- 있으면 만들지 않는다. 앞으로 전체 변경 뒤에도 결석·이동·메모 등으로 남겨 둔 회차와 겹치지 않게 한다.
-- 같은 날 다른 시각의 현재 규칙 회차는 막지 않는다.
create or replace function private.generate_sessions_between(p_enrollment_id uuid, p_from date, p_until date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- end_enrollment 이 같은 수강 과목을 바꾸는 동안 회차를 만들지 않도록 기다린다
  perform 1 from public.enrollments e where e.id = p_enrollment_id for share;

  insert into public.class_sessions (family_id, enrollment_id, rule_id, session_date, start_time, end_time)
  select r.family_id, r.enrollment_id, r.id, d::date, r.start_time, r.end_time
  from public.class_rules r
  join public.enrollments e on e.id = r.enrollment_id
  cross join lateral generate_series(
    greatest(p_from, r.effective_from, e.start_date)::timestamp,
    least(p_until, coalesce(r.effective_until, p_until), coalesce(e.end_date, p_until))::timestamp,
    interval '1 day'
  ) as d
  where r.enrollment_id = p_enrollment_id
    and extract(isodow from d) = r.weekday
    and not exists (
      select 1 from public.class_sessions x
      where x.enrollment_id = r.enrollment_id
        and x.kind = 'regular'
        and x.session_date = d::date
        and (
          x.rule_id is null
          or not exists (
            select 1 from public.class_rules cr
            where cr.id = x.rule_id
              and d::date between cr.effective_from and coalesce(cr.effective_until, d::date)
          )
        )
    )
  on conflict (rule_id, session_date) where rule_id is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.generate_sessions_between(uuid, date, date) from public;

-- p_rules 를 검증해 [p_from, p_until] 동안 유효한 규칙으로 넣는다.
-- p_rules: [{"weekday": 2, "start_time": "16:00", "end_time": "17:00"}, ...]
create function private.insert_class_rules(
  p_enrollment_id uuid,
  p_family_id uuid,
  p_rules jsonb,
  p_from date,
  p_until date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_rules constant integer := 14;
  -- 일정 변경마다 끝난 규칙이 남는다. 반복 호출로 무한히 늘지 않게 수강 과목당 상한을 둔다.
  c_max_total_rules constant integer := 60;
  v_rule jsonb;
  v_weekday smallint;
  v_start time;
  v_end time;
begin
  if jsonb_typeof(p_rules) is distinct from 'array'
    or jsonb_array_length(p_rules) not between 1 and c_max_rules then
    raise exception 'invalid_schedule';
  end if;
  if (select count(*) from public.class_rules r where r.enrollment_id = p_enrollment_id)
    + jsonb_array_length(p_rules) > c_max_total_rules then
    raise exception 'too_many_schedule_changes';
  end if;

  for v_rule in select * from jsonb_array_elements(p_rules) loop
    begin
      v_weekday := (v_rule ->> 'weekday')::smallint;
      v_start := (v_rule ->> 'start_time')::time;
      v_end := (v_rule ->> 'end_time')::time;
    exception when others then
      raise exception 'invalid_schedule';
    end;
    if v_weekday is null or v_weekday not between 1 and 7
      or v_start is null or v_end is null or v_end <= v_start then
      raise exception 'invalid_schedule';
    end if;

    insert into public.class_rules
      (family_id, enrollment_id, weekday, start_time, end_time, effective_from, effective_until)
    values (p_family_id, p_enrollment_id, v_weekday, v_start, v_end, p_from, p_until);
  end loop;

  -- 같은 요일·시작 시각이 두 번 있으면 같은 날 회차가 겹친다. 변환된 값으로 비교해 표기 차이도 잡는다.
  if exists (
    select 1 from public.class_rules r
    where r.enrollment_id = p_enrollment_id and r.effective_from = p_from
    group by r.weekday, r.start_time
    having count(*) > 1
  ) then
    raise exception 'invalid_schedule';
  end if;
end;
$$;

revoke all on function private.lock_session(uuid, integer) from public;
revoke all on function private.validate_session_slot(date, time, time) from public;
revoke all on function private.insert_class_rules(uuid, uuid, jsonb, date, date) from public;

-- ---------------------------------------------------------------------------
-- M2 함수 갱신
-- ---------------------------------------------------------------------------

create or replace function public.create_enrollment(
  p_child_id uuid,
  p_academy_id uuid,
  p_subject text,
  p_start_date date,
  p_end_date date,
  p_rules jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 진행 중(종료일이 오늘 이후거나 없음)인 수강 과목 수 상한. 회차 생성량을 묶어 둔다.
  c_max_active_enrollments constant integer := 30;
  c_max_start_days_ahead constant integer := 400;
  v_today date := private.family_today();
  v_family_id uuid := private.current_family_id();
  v_subject text := btrim(coalesce(p_subject, ''));
  v_enrollment_id uuid;
begin
  if v_family_id is null then
    raise exception 'not_in_family';
  end if;
  if char_length(v_subject) not between 1 and 30 then
    raise exception 'invalid_subject';
  end if;
  if p_start_date is null
    or p_start_date < v_today - 366
    or p_start_date > v_today + c_max_start_days_ahead
    or (p_end_date is not null and p_end_date < p_start_date) then
    raise exception 'invalid_period';
  end if;
  if (
    select count(*) from public.enrollments e
    where e.family_id = v_family_id and (e.end_date is null or e.end_date >= v_today)
  ) >= c_max_active_enrollments then
    raise exception 'too_many_enrollments';
  end if;
  if not exists (select 1 from public.children c where c.id = p_child_id and c.family_id = v_family_id) then
    raise exception 'child_not_found';
  end if;
  if not exists (select 1 from public.academies a where a.id = p_academy_id and a.family_id = v_family_id) then
    raise exception 'academy_not_found';
  end if;

  insert into public.enrollments (family_id, child_id, academy_id, subject, start_date, end_date)
  values (v_family_id, p_child_id, p_academy_id, v_subject, p_start_date, p_end_date)
  returning id into v_enrollment_id;

  perform private.insert_class_rules(v_enrollment_id, v_family_id, p_rules, p_start_date, p_end_date);
  perform private.generate_sessions_between(v_enrollment_id, p_start_date, private.session_horizon());
  return v_enrollment_id;
end;
$$;

-- 종료일 이후의 정규 예정 회차를 정리한다. 아무도 손대지 않은 것(version 1)은 지우고,
-- 메모·시간 변경 등 손댄 것은 이력이므로 취소로 남긴다. 보강·변경 회차는 따로 잡은 일정이라 그대로 둔다.
create or replace function public.end_enrollment(p_enrollment_id uuid, p_end_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
  v_today date := private.family_today();
  -- 이 날짜 이후의 예정 회차와 아직 시작하지 않은 규칙을 정리한다
  v_cutoff date;
begin
  select * into v_enrollment
  from public.enrollments e
  where e.id = p_enrollment_id
    and e.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  if p_end_date is null or p_end_date < v_enrollment.start_date then
    raise exception 'invalid_period';
  end if;

  update public.enrollments e set end_date = p_end_date where e.id = p_enrollment_id;

  if v_enrollment.end_date is not null and p_end_date > v_enrollment.end_date then
    -- 종료일을 늦추면 수강 종료 때문에 멈춘 규칙(옛 종료일 이후에 멈춘 것)을 이어 간다.
    -- 그보다 먼저 멈춘 규칙은 일정 변경으로 끝난 것이므로 그대로 둔다.
    update public.class_rules r
    set effective_until = p_end_date
    where r.enrollment_id = p_enrollment_id
      and r.effective_until >= v_enrollment.end_date;
    -- 지난 날짜는 다시 만들지 않는다
    perform private.generate_sessions_between(
      p_enrollment_id,
      greatest(v_enrollment.end_date + 1, v_today),
      least(p_end_date, private.session_horizon())
    );
    return;
  end if;

  v_cutoff := greatest(p_end_date, v_today - 1);
  delete from public.class_sessions s
  where s.enrollment_id = p_enrollment_id
    and s.session_date > v_cutoff
    and s.kind = 'regular'
    and s.status = 'scheduled'
    and s.version = 1;
  update public.class_sessions s
  set status = 'cancelled'
  where s.enrollment_id = p_enrollment_id
    and s.session_date > v_cutoff
    and s.kind = 'regular'
    and s.status = 'scheduled';
  delete from public.class_rules r
  where r.enrollment_id = p_enrollment_id
    and r.effective_from > v_cutoff;
  update public.class_rules r
  set effective_until = v_cutoff
  where r.enrollment_id = p_enrollment_id
    and (r.effective_until is null or r.effective_until > v_cutoff);
end;
$$;

-- 잘못 등록한 수강 과목만 지운다. 지난 회차나 사람이 바꾼 회차가 있으면 종료만 할 수 있다.
create or replace function public.delete_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 검사와 삭제 사이에 다른 사람이 회차를 바꾸거나 새로 만들지 못하게 수강 과목과 회차를 잠근다
  perform 1 from public.enrollments e
  where e.id = p_enrollment_id and e.family_id = private.current_family_id()
  for update;
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  perform 1 from public.class_sessions s where s.enrollment_id = p_enrollment_id for update;
  if exists (
    select 1 from public.class_sessions s
    where s.enrollment_id = p_enrollment_id
      and (s.session_date < private.family_today() or s.kind <> 'regular' or s.status <> 'scheduled')
  ) then
    raise exception 'enrollment_has_history';
  end if;

  delete from public.enrollments e where e.id = p_enrollment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create function public.set_session_status(
  p_session_id uuid,
  p_version integer,
  p_status public.class_session_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions := private.lock_session(p_session_id, p_version);
begin
  if v_session.kind = 'makeup' then
    if p_status not in ('makeup_scheduled', 'makeup_completed', 'cancelled') then
      raise exception 'invalid_status';
    end if;
  elsif p_status not in ('scheduled', 'completed', 'absent', 'academy_cancelled', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  -- 살아 있는 보강·변경이 있는 원 회차는 결석↔휴강만 바꿀 수 있다.
  -- 정상 진행으로 되돌리면 같은 수업이 두 번 잡히고, 취소하면 보강의 근거가 흐려진다.
  if exists (
    select 1 from public.class_sessions r
    where r.origin_session_id = p_session_id and r.status <> 'cancelled'
  ) and not (
    v_session.status in ('absent', 'academy_cancelled') and p_status in ('absent', 'academy_cancelled')
  ) then
    raise exception 'replacement_exists';
  end if;

  -- 취소했던 보강·변경을 되살릴 때 같은 원 회차에 다른 보강·변경이 이미 살아 있으면 안 된다
  if v_session.origin_session_id is not null
    and v_session.status = 'cancelled'
    and p_status <> 'cancelled'
    and exists (
      select 1 from public.class_sessions r
      where r.origin_session_id = v_session.origin_session_id
        and r.id <> p_session_id
        and r.status <> 'cancelled'
    ) then
    raise exception 'replacement_exists';
  end if;

  -- 결석·휴강이 아니게 되면 "보강 안 함" 표시도 의미가 없으므로 지운다
  update public.class_sessions s
  set status = p_status,
      makeup_waived = case when p_status in ('absent', 'academy_cancelled') then s.makeup_waived else false end
  where s.id = p_session_id;
end;
$$;

-- 이번 수업만 변경. 같은 날 시간만 바꾸면 그 회차를 고치고, 정규 회차를 다른 날로 옮기면
-- 원 회차를 취소로 남기고 변경 회차를 만든다. 결과 회차 id 를 돌려준다.
create function public.reschedule_session(
  p_session_id uuid,
  p_version integer,
  p_date date,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions := private.lock_session(p_session_id, p_version);
  v_new_id uuid;
begin
  perform private.validate_session_slot(p_date, p_start_time, p_end_time);
  if v_session.status not in ('scheduled', 'makeup_scheduled') then
    raise exception 'session_not_changeable';
  end if;

  if v_session.kind = 'regular' and p_date <> v_session.session_date then
    update public.class_sessions s set status = 'cancelled' where s.id = p_session_id;
    insert into public.class_sessions
      (family_id, enrollment_id, kind, origin_session_id, session_date, start_time, end_time)
    values
      (v_session.family_id, v_session.enrollment_id, 'rescheduled', p_session_id, p_date, p_start_time, p_end_time)
    returning id into v_new_id;
    return v_new_id;
  end if;

  update public.class_sessions s
  set session_date = p_date, start_time = p_start_time, end_time = p_end_time
  where s.id = p_session_id;
  return p_session_id;
end;
$$;

create function public.create_makeup(
  p_session_id uuid,
  p_version integer,
  p_date date,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions := private.lock_session(p_session_id, p_version);
  v_makeup_id uuid;
begin
  perform private.validate_session_slot(p_date, p_start_time, p_end_time);
  if v_session.kind = 'makeup' or v_session.status not in ('absent', 'academy_cancelled') then
    raise exception 'makeup_not_allowed';
  end if;
  if exists (
    select 1 from public.class_sessions r
    where r.origin_session_id = p_session_id and r.status <> 'cancelled'
  ) then
    raise exception 'replacement_exists';
  end if;

  -- 원 회차도 바꾼 것으로 기록해(version 증가) 배우자 화면의 옛 상태로 덮어쓰지 못하게 한다
  update public.class_sessions s set makeup_waived = false where s.id = p_session_id;
  insert into public.class_sessions
    (family_id, enrollment_id, kind, origin_session_id, session_date, start_time, end_time, status)
  values
    (v_session.family_id, v_session.enrollment_id, 'makeup', p_session_id, p_date, p_start_time, p_end_time,
     'makeup_scheduled')
  returning id into v_makeup_id;
  return v_makeup_id;
end;
$$;

create function public.set_makeup_waived(p_session_id uuid, p_version integer, p_waived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions := private.lock_session(p_session_id, p_version);
begin
  if v_session.kind = 'makeup' or v_session.status not in ('absent', 'academy_cancelled') then
    raise exception 'makeup_not_allowed';
  end if;
  update public.class_sessions s set makeup_waived = coalesce(p_waived, false) where s.id = p_session_id;
end;
$$;

-- 앞으로 전체 변경. p_from 전날까지 기존 규칙을 끝내고 p_from 부터 새 규칙을 적용한다.
-- p_from 이후의 손대지 않은 정규 예정 회차만 새로 만들고, 사람이 바꾼 회차는 이력으로 남긴다.
create function public.change_schedule_from(p_enrollment_id uuid, p_from date, p_rules jsonb)
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
    or p_from < private.family_today()
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

revoke all on function public.set_session_status(uuid, integer, public.class_session_status) from public, anon;
revoke all on function public.reschedule_session(uuid, integer, date, time, time) from public, anon;
revoke all on function public.create_makeup(uuid, integer, date, time, time) from public, anon;
revoke all on function public.set_makeup_waived(uuid, integer, boolean) from public, anon;
revoke all on function public.change_schedule_from(uuid, date, jsonb) from public, anon;

grant execute on function public.set_session_status(uuid, integer, public.class_session_status) to authenticated;
grant execute on function public.reschedule_session(uuid, integer, date, time, time) to authenticated;
grant execute on function public.create_makeup(uuid, integer, date, time, time) to authenticated;
grant execute on function public.set_makeup_waived(uuid, integer, boolean) to authenticated;
grant execute on function public.change_schedule_from(uuid, date, jsonb) to authenticated;
