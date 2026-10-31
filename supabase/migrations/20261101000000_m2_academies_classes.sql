-- M2: 학원, 수강 과목, 반복 수업 규칙, 수업 회차
--
-- 원칙
-- * 수업은 회차(class_sessions) 행으로 저장한다. 결석·보강(M3)과 회차별 학원비(M4)가 회차 단위로 움직인다.
-- * 정규 수업 회차는 규칙(class_rules)에서 만든다. (rule_id, session_date) 가 유일하므로 몇 번 만들어도 중복되지 않는다.
--   규칙에서 만든 회차의 session_date 는 바꾸지 않는다. 바꾸면 다시 만들 때 원래 날짜 회차가 또 생긴다.
-- * 지난 회차는 지우지 않는다. 수강을 그만두면 "종료"해서 이후의 예정 회차만 지운다.
-- * 다른 테이블은 (id, family_id) 복합 외래키로 참조해 같은 가족 데이터끼리만 연결되게 한다.
-- * 날짜·시각은 서울 기준 date / time 으로 저장한다.

create type public.class_session_status as enum (
  'scheduled',         -- 예정
  'completed',         -- 완료
  'absent',            -- 결석
  'academy_cancelled', -- 휴강 (학원 사정)
  'cancelled',         -- 취소
  'makeup_scheduled',  -- 보강 예정
  'makeup_completed'   -- 보강 완료
);

alter table public.children add constraint children_id_family_id_key unique (id, family_id);

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  phone text check (phone is null or char_length(phone) <= 30),
  contact_name text check (contact_name is null or char_length(contact_name) <= 30),
  memo text check (memo is null or char_length(memo) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);
create index academies_family_id_idx on public.academies (family_id);

-- 자녀·학원 FK 는 no action 이다. 수강 과목이 있으면 자녀·학원을 지울 수 없고,
-- 가족을 통째로 지울 때는 같은 문장 안에서 함께 지워지므로 통과한다.
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  academy_id uuid not null,
  subject text not null check (char_length(btrim(subject)) between 1 and 30),
  start_date date not null,
  end_date date,
  memo text check (memo is null or char_length(memo) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (id, family_id),
  foreign key (child_id, family_id) references public.children (id, family_id),
  foreign key (academy_id, family_id) references public.academies (id, family_id)
);
create index enrollments_family_id_idx on public.enrollments (family_id);
create index enrollments_child_id_idx on public.enrollments (child_id);
create index enrollments_academy_id_idx on public.enrollments (academy_id);

create table public.class_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  enrollment_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1=월 … 7=일
  start_time time not null,
  end_time time not null,
  effective_from date not null,
  effective_until date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (effective_until is null or effective_until >= effective_from),
  unique (id, family_id),
  foreign key (enrollment_id, family_id) references public.enrollments (id, family_id) on delete cascade
);
create index class_rules_enrollment_id_idx on public.class_rules (enrollment_id);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  enrollment_id uuid not null,
  -- 정규 수업이면 만든 규칙. 보강·추가 수업(M3)은 null.
  rule_id uuid,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  status public.class_session_status not null default 'scheduled',
  note text check (note is null or char_length(note) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (enrollment_id, family_id) references public.enrollments (id, family_id) on delete cascade,
  foreign key (rule_id, family_id) references public.class_rules (id, family_id) on delete set null (rule_id)
);
create unique index class_sessions_rule_id_session_date_key
  on public.class_sessions (rule_id, session_date) where rule_id is not null;
create index class_sessions_family_id_session_date_idx on public.class_sessions (family_id, session_date);
create index class_sessions_enrollment_id_session_date_idx on public.class_sessions (enrollment_id, session_date);

-- ---------------------------------------------------------------------------
-- 내부 함수
-- ---------------------------------------------------------------------------

create function private.family_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

-- 수강 등록 때 미리 만들어 두는 범위: 3개월 뒤 달의 말일까지. 그 이후는 캘린더가 ensure_sessions_until 로 만든다.
create function private.session_horizon()
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', private.family_today()) + interval '4 months' - interval '1 day')::date;
$$;

-- 수강 과목의 규칙으로 [p_from, p_until] 안의 정규 회차를 만든다. 이미 있는 회차는 건드리지 않는다.
create function private.generate_sessions_between(p_enrollment_id uuid, p_from date, p_until date)
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
  on conflict (rule_id, session_date) where rule_id is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.family_today() from public;
revoke all on function private.session_horizon() from public;
revoke all on function private.generate_sessions_between(uuid, date, date) from public;
grant execute on function private.family_today() to authenticated;

-- ---------------------------------------------------------------------------
-- 트리거
-- ---------------------------------------------------------------------------

create trigger academies_bump_version before update on public.academies
  for each row execute function private.bump_version();
create trigger enrollments_bump_version before update on public.enrollments
  for each row execute function private.bump_version();
create trigger class_rules_bump_version before update on public.class_rules
  for each row execute function private.bump_version();
create trigger class_sessions_bump_version before update on public.class_sessions
  for each row execute function private.bump_version();

create trigger academies_audit after insert or update or delete on public.academies
  for each row execute function private.write_audit_log();
create trigger enrollments_audit after insert or update or delete on public.enrollments
  for each row execute function private.write_audit_log();
create trigger class_rules_audit after insert or update or delete on public.class_rules
  for each row execute function private.write_audit_log();
-- 규칙에서 자동으로 만든 회차까지 남기면 이력이 묻힌다. 바꾸거나 지운 것만 남긴다.
create trigger class_sessions_audit after update or delete on public.class_sessions
  for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- 권한과 RLS
-- ---------------------------------------------------------------------------

alter table public.academies enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_rules enable row level security;
alter table public.class_sessions enable row level security;

revoke all on public.academies, public.enrollments, public.class_rules, public.class_sessions
  from anon, authenticated;

grant select, delete on public.academies to authenticated;
grant insert (family_id, name, phone, contact_name, memo) on public.academies to authenticated;
grant update (name, phone, contact_name, memo) on public.academies to authenticated;

-- 수강 과목 생성·종료·삭제는 회차 생성과 묶여야 하므로 RPC 로만 한다
grant select on public.enrollments to authenticated;
grant update (subject, memo) on public.enrollments to authenticated;

grant select on public.class_rules to authenticated;
grant select on public.class_sessions to authenticated;

create policy "members read academies" on public.academies
  for select to authenticated using (private.is_family_member(family_id));
create policy "members add academies" on public.academies
  for insert to authenticated with check (private.is_family_member(family_id));
create policy "members update academies" on public.academies
  for update to authenticated
  using (private.is_family_member(family_id)) with check (private.is_family_member(family_id));
create policy "members delete academies" on public.academies
  for delete to authenticated using (private.is_family_member(family_id));

create policy "members read enrollments" on public.enrollments
  for select to authenticated using (private.is_family_member(family_id));
create policy "members update enrollments" on public.enrollments
  for update to authenticated
  using (private.is_family_member(family_id)) with check (private.is_family_member(family_id));

create policy "members read class rules" on public.class_rules
  for select to authenticated using (private.is_family_member(family_id));

create policy "members read class sessions" on public.class_sessions
  for select to authenticated using (private.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- p_rules: [{"weekday": 2, "start_time": "16:00", "end_time": "17:00"}, ...]
create function public.create_enrollment(
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
  c_max_rules constant integer := 14;
  -- 진행 중(종료일이 오늘 이후거나 없음)인 수강 과목 수 상한. 회차 생성량을 묶어 둔다.
  c_max_active_enrollments constant integer := 30;
  c_max_start_days_ahead constant integer := 400;
  v_today date := private.family_today();
  v_family_id uuid := private.current_family_id();
  v_subject text := btrim(coalesce(p_subject, ''));
  v_enrollment_id uuid;
  v_rule jsonb;
  v_weekday smallint;
  v_start time;
  v_end time;
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
  if jsonb_typeof(p_rules) is distinct from 'array'
    or jsonb_array_length(p_rules) not between 1 and c_max_rules then
    raise exception 'invalid_schedule';
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
    values (v_family_id, v_enrollment_id, v_weekday, v_start, v_end, p_start_date, p_end_date);
  end loop;

  -- 같은 요일·시작 시각이 두 번 있으면 같은 날 회차가 겹친다. "16:00" 과 "16:00:00" 처럼
  -- 표기만 다른 값도 잡도록 변환된 값으로 비교한다. 예외가 나면 위의 insert 도 모두 취소된다.
  if exists (
    select 1 from public.class_rules r
    where r.enrollment_id = v_enrollment_id
    group by r.weekday, r.start_time
    having count(*) > 1
  ) then
    raise exception 'invalid_schedule';
  end if;

  perform private.generate_sessions_between(v_enrollment_id, p_start_date, private.session_horizon());
  return v_enrollment_id;
end;
$$;

-- 캘린더가 보려는 날짜까지 정규 회차를 만든다. 지난 날짜는 다시 만들지 않는다.
create function public.ensure_sessions_until(p_until date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_days_ahead constant integer := 400;
  v_family_id uuid := private.current_family_id();
  v_today date := private.family_today();
  v_total integer := 0;
  v_enrollment_id uuid;
begin
  if v_family_id is null then
    raise exception 'not_in_family';
  end if;
  if p_until is null or p_until > v_today + c_max_days_ahead then
    raise exception 'range_too_far';
  end if;

  for v_enrollment_id in
    select e.id from public.enrollments e
    where e.family_id = v_family_id
      and (e.end_date is null or e.end_date >= v_today)
  loop
    v_total := v_total + private.generate_sessions_between(v_enrollment_id, v_today, p_until);
  end loop;
  return v_total;
end;
$$;

-- 수강 종료(또는 종료일 변경). 오늘 이후의 예정 회차만 지운다.
-- 과거 날짜로 종료해도 이미 지난 회차는 이력이므로 남긴다(필요하면 M3에서 상태를 바꾼다).
create function public.end_enrollment(p_enrollment_id uuid, p_end_date date)
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

-- 잘못 등록한 수강 과목을 지운다. 지난 회차가 있으면 이력 보호를 위해 종료만 할 수 있다.
create function public.delete_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.enrollments e
    where e.id = p_enrollment_id and e.family_id = private.current_family_id()
  ) then
    raise exception 'enrollment_not_found';
  end if;
  if exists (
    select 1 from public.class_sessions s
    where s.enrollment_id = p_enrollment_id and s.session_date < private.family_today()
  ) then
    raise exception 'enrollment_has_history';
  end if;

  delete from public.enrollments e where e.id = p_enrollment_id;
end;
$$;

revoke all on function public.create_enrollment(uuid, uuid, text, date, date, jsonb) from public, anon;
revoke all on function public.ensure_sessions_until(date) from public, anon;
revoke all on function public.end_enrollment(uuid, date) from public, anon;
revoke all on function public.delete_enrollment(uuid) from public, anon;

grant execute on function public.create_enrollment(uuid, uuid, text, date, date, jsonb) to authenticated;
grant execute on function public.ensure_sessions_until(date) to authenticated;
grant execute on function public.end_enrollment(uuid, date) to authenticated;
grant execute on function public.delete_enrollment(uuid) to authenticated;
