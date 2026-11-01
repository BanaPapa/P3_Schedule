-- 3차: 학교 관리(학사일정·행사·과제·시험·준비물)와 학습 관리(과목·진도·학습 기록)
-- 학교 일정은 통합 캘린더에 함께 보인다(앱에서 합친다).

create type public.school_event_kind as enum ('academic', 'event', 'homework', 'exam', 'holiday');

create table public.school_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  kind public.school_event_kind not null,
  event_date date not null,
  -- 방학·체험학습처럼 여러 날이면 마지막 날
  end_date date,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  subject text check (subject is null or char_length(subject) <= 30),
  memo text check (memo is null or char_length(memo) <= 500),
  -- 과제 완료
  done boolean not null default false,
  -- 시험 결과
  score numeric(6, 2) check (score is null or score >= 0),
  max_score numeric(6, 2) check (max_score is null or max_score > 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= event_date),
  check (end_date is null or end_date - event_date <= 120),
  check (score is null or max_score is null or score <= max_score),
  unique (id, family_id),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index school_events_family_id_event_date_idx on public.school_events (family_id, event_date);

-- 준비물 체크리스트
create table public.school_event_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 50),
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (event_id, family_id) references public.school_events (id, family_id) on delete cascade
);
create index school_event_items_event_id_idx on public.school_event_items (event_id);

create table public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  textbook text check (textbook is null or char_length(textbook) <= 50),
  goal text check (goal is null or char_length(goal) <= 200),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, name),
  unique (id, family_id),
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

-- 학습 기록 (진도 포함)
create table public.study_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  subject_id uuid not null,
  studied_on date not null,
  minutes integer check (minutes is null or minutes between 1 and 1440),
  unit text check (unit is null or char_length(unit) <= 50),
  progress_percent smallint check (progress_percent is null or progress_percent between 0 and 100),
  content text check (content is null or char_length(content) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (subject_id, family_id) references public.study_subjects (id, family_id) on delete cascade
);
create index study_logs_subject_id_studied_on_idx on public.study_logs (subject_id, studied_on desc);

create view public.school_event_summaries with (security_invoker = true) as
select e.*,
       (select count(*) from public.school_event_items i where i.event_id = e.id) as item_count,
       (select count(*) from public.school_event_items i where i.event_id = e.id and not i.checked) as unchecked_count
from public.school_events e;

create view public.study_subject_summaries with (security_invoker = true) as
select s.*,
       latest.unit as latest_unit,
       latest.progress_percent as latest_percent,
       latest.studied_on as latest_studied_on,
       coalesce((select sum(l.minutes) from public.study_logs l where l.subject_id = s.id), 0) as total_minutes
from public.study_subjects s
left join lateral (
  select l.unit, l.progress_percent, l.studied_on
  from public.study_logs l
  where l.subject_id = s.id and (l.unit is not null or l.progress_percent is not null)
  order by l.studied_on desc, l.created_at desc
  limit 1
) latest on true;

create trigger school_events_bump_version before update on public.school_events
  for each row execute function private.bump_version();
create trigger study_subjects_bump_version before update on public.study_subjects
  for each row execute function private.bump_version();

create trigger school_events_audit after insert or update or delete on public.school_events
  for each row execute function private.write_audit_log();
create trigger school_event_items_audit after insert or update or delete on public.school_event_items
  for each row execute function private.write_audit_log();
create trigger study_subjects_audit after insert or update or delete on public.study_subjects
  for each row execute function private.write_audit_log();
create trigger study_logs_audit after insert or update or delete on public.study_logs
  for each row execute function private.write_audit_log();

alter table public.school_events enable row level security;
alter table public.school_event_items enable row level security;
alter table public.study_subjects enable row level security;
alter table public.study_logs enable row level security;

revoke all on public.school_events, public.school_event_items, public.study_subjects, public.study_logs,
  public.school_event_summaries, public.study_subject_summaries from anon, authenticated;

grant select, delete on public.school_events to authenticated;
grant insert (family_id, child_id, kind, event_date, end_date, title, subject, memo, score, max_score)
  on public.school_events to authenticated;
grant update (kind, event_date, end_date, title, subject, memo, done, score, max_score)
  on public.school_events to authenticated;

grant select, delete on public.school_event_items to authenticated;
grant insert (family_id, event_id, label) on public.school_event_items to authenticated;
grant update (checked, label) on public.school_event_items to authenticated;

grant select, delete on public.study_subjects to authenticated;
grant insert (family_id, child_id, name, textbook, goal) on public.study_subjects to authenticated;
grant update (name, textbook, goal) on public.study_subjects to authenticated;

grant select, delete on public.study_logs to authenticated;
grant insert (family_id, subject_id, studied_on, minutes, unit, progress_percent, content) on public.study_logs to authenticated;

grant select on public.school_event_summaries, public.study_subject_summaries to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['school_events', 'school_event_items', 'study_subjects', 'study_logs'] loop
    execute format(
      'create policy "members read %1$s" on public.%1$I for select to authenticated using (private.is_family_member(family_id))',
      v_table);
    execute format(
      'create policy "members add %1$s" on public.%1$I for insert to authenticated with check (private.is_family_member(family_id))',
      v_table);
    execute format(
      'create policy "members update %1$s" on public.%1$I for update to authenticated using (private.is_family_member(family_id)) with check (private.is_family_member(family_id))',
      v_table);
    execute format(
      'create policy "members delete %1$s" on public.%1$I for delete to authenticated using (private.is_family_member(family_id))',
      v_table);
  end loop;
end;
$$;
