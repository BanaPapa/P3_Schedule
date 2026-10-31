-- M3: 앞으로 전체 일정 변경
-- test.start = 다음 주 월요일. 화(2)·목(4) 16:00-17:00, 4주(test.start ~ +27).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

truncate public.families, public.audit_logs cascade;

select set_config('test.start', (date_trunc('week', private.family_today()) + interval '7 days')::date::text, true);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
insert into public.academies (family_id, name) select id, '튼튼영어' from public.families;
select public.create_enrollment(
  (select id from public.children), (select id from public.academies), '영어',
  current_setting('test.start')::date, current_setting('test.start')::date + 27,
  '[{"weekday":2,"start_time":"16:00","end_time":"17:00"},
    {"weekday":4,"start_time":"16:00","end_time":"17:00"}]'::jsonb
);
-- 3주차 화요일은 휴강
select public.set_session_status(
  (select id from public.class_sessions where session_date = current_setting('test.start')::date + 15),
  1, 'academy_cancelled'
);
reset role;
select set_config('test.enrollment', (select id::text from public.enrollments), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 2주차부터 수요일 17:00-18:00 으로
select lives_ok(
  format($$select public.change_schedule_from(%L, %L::date + 7,
    '[{"weekday":3,"start_time":"17:00","end_time":"18:00"}]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'parent can change the schedule from a date on'
);
select is(
  (select count(*)::int from public.class_sessions
    where session_date < current_setting('test.start')::date + 7 and start_time = '16:00'),
  2, 'sessions before the change date are untouched'
);
select is(
  (select count(*)::int from public.class_sessions
    where session_date >= current_setting('test.start')::date + 7 and status = 'scheduled' and start_time = '16:00'),
  0, 'old scheduled sessions from the change date are removed'
);
select results_eq(
  format($$select session_date from public.class_sessions where start_time = '17:00' order by session_date$$),
  format($$values (%1$L::date + 9), (%1$L::date + 16), (%1$L::date + 23)$$, current_setting('test.start')),
  'new sessions follow the new weekday'
);
select is(
  (select count(*)::int from public.class_sessions where status = 'academy_cancelled'),
  1, 'an already changed session is kept as history'
);
select is(
  (select count(*)::int from public.class_rules where effective_until = current_setting('test.start')::date + 6),
  2, 'old rules stop the day before'
);
select results_eq(
  $$select effective_from - (select start_date from public.enrollments), effective_until - effective_from
    from public.class_rules where weekday = 3$$,
  $$values (7, 20)$$,
  'the new rule runs from the change date to the enrollment end'
);

select throws_ok(
  format($$select public.change_schedule_from(%L, private.family_today() - 1,
    '[{"weekday":3,"start_time":"17:00","end_time":"18:00"}]'::jsonb)$$, current_setting('test.enrollment')),
  'P0001', 'invalid_period', 'the change date cannot be in the past'
);
select throws_ok(
  format($$select public.change_schedule_from(%L, %L::date + 28,
    '[{"weekday":3,"start_time":"17:00","end_time":"18:00"}]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'P0001', 'invalid_period', 'the change date cannot be after the enrollment ends'
);
select throws_ok(
  format($$select public.change_schedule_from(%L, %L::date + 14,
    '[{"weekday":3,"start_time":"17:00","end_time":"18:00"},
      {"weekday":3,"start_time":"17:00:00","end_time":"19:00"}]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'P0001', 'invalid_schedule', 'duplicate schedules are rejected'
);

-- 3주차부터 다시 같은 규칙으로 바꿔도 회차가 겹치지 않는다
select lives_ok(
  format($$select public.change_schedule_from(%L, %L::date + 14,
    '[{"weekday":3,"start_time":"17:00","end_time":"18:00"}]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'changing again from a later date works'
);
select is(
  (select count(*)::int from public.class_sessions where start_time = '17:00'),
  3, 'no duplicate sessions after changing twice'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  format($$select public.change_schedule_from(%L, %L::date + 14,
    '[{"weekday":3,"start_time":"17:00","end_time":"18:00"}]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'P0001', 'enrollment_not_found', 'other family cannot change our schedule'
);
reset role;

select * from finish();
rollback;
