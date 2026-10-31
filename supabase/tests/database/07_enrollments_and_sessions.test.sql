-- M2: 수강 과목, 반복 수업 규칙, 수업 회차 생성
-- 날짜는 오늘 기준 상대값을 쓴다. test.start = 다음 주 월요일, test.end = 그로부터 4주 뒤 일요일.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

truncate public.families, public.audit_logs cascade;

select set_config('test.start', (date_trunc('week', private.family_today()) + interval '7 days')::date::text, true);
select set_config('test.end', (current_setting('test.start')::date + 27)::text, true);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

-- B 가족: 자녀와 학원
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
insert into public.children (family_id, name) select id, '박첫째' from public.families;
insert into public.academies (family_id, name) select id, '박수학' from public.families;
reset role;
select set_config('test.child_b', (select id::text from public.children where name = '박첫째'), true);
select set_config('test.academy_b', (select id::text from public.academies where name = '박수학'), true);

-- A 가족
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
insert into public.academies (family_id, name) select id, '튼튼영어' from public.families;
reset role;
select set_config('test.child_a', (select id::text from public.children where name = '첫째'), true);
select set_config('test.academy_a', (select id::text from public.academies where name = '튼튼영어'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 입력 검증
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '영어', %L, null, '[]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_a'), current_setting('test.start')),
  'P0001', 'invalid_schedule', 'an enrollment needs at least one weekly schedule'
);
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '영어', %L, null,
    '[{"weekday":8,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_a'), current_setting('test.start')),
  'P0001', 'invalid_schedule', 'weekday must be 1..7'
);
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '영어', %L, null,
    '[{"weekday":2,"start_time":"17:00","end_time":"16:00"}]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_a'), current_setting('test.start')),
  'P0001', 'invalid_schedule', 'end time must be after start time'
);
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '영어', %L, %L,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_a'),
    current_setting('test.end'), current_setting('test.start')),
  'P0001', 'invalid_period', 'end date cannot be before start date'
);
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '  ', %L, null,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_a'), current_setting('test.start')),
  'P0001', 'invalid_subject', 'blank subject is rejected'
);

-- 다른 가족의 자녀·학원으로는 만들 수 없다
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '수학', %L, null,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
    current_setting('test.child_b'), current_setting('test.academy_a'), current_setting('test.start')),
  'P0001', 'child_not_found', 'cannot enroll a child of another family'
);
select throws_ok(
  format($$select public.create_enrollment(%L, %L, '수학', %L, null,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_b'), current_setting('test.start')),
  'P0001', 'academy_not_found', 'cannot enroll into an academy of another family'
);

-- 화(2) 16:00-17:00, 목(4) 16:00-17:30, 4주
select lives_ok(
  format($$select public.create_enrollment(%L, %L, '  영어  ', %L, %L,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"},
      {"weekday":4,"start_time":"16:00","end_time":"17:30"}]'::jsonb)$$,
    current_setting('test.child_a'), current_setting('test.academy_a'),
    current_setting('test.start'), current_setting('test.end')),
  'parent can create an enrollment with weekly schedules'
);
select is((select subject from public.enrollments), '영어', 'subject is trimmed');
select is((select count(*)::int from public.class_rules), 2, 'one rule per weekly schedule');
select is((select count(*)::int from public.class_sessions), 8, 'creating generates every session in the period');
reset role;
select set_config('test.enrollment', (select id::text from public.enrollments), true);

select is(
  private.generate_sessions_between(
    current_setting('test.enrollment')::uuid,
    current_setting('test.start')::date, current_setting('test.end')::date),
  0, 'generating again creates nothing new'
);
select results_eq(
  $$select session_date, start_time::text, end_time::text from public.class_sessions order by session_date limit 2$$,
  format($$values (%L::date + 1, '16:00:00', '17:00:00'), (%L::date + 3, '16:00:00', '17:30:00')$$,
    current_setting('test.start'), current_setting('test.start')),
  'sessions fall on the rule weekdays and copy the rule times'
);
select is(
  (select count(*)::int from public.class_sessions where status <> 'scheduled'), 0,
  'generated sessions are scheduled'
);
select is(
  private.generate_sessions_between(
    current_setting('test.enrollment')::uuid,
    current_setting('test.end')::date + 1, current_setting('test.end')::date + 60),
  0, 'no sessions after the enrollment end date'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'class_sessions'), 0,
  'generated sessions are not logged one by one'
);

-- B 가족은 볼 수 없다
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.enrollments), 0, 'other family sees no enrollments');
select is((select count(*)::int from public.class_sessions), 0, 'other family sees no sessions');
select throws_ok(
  format($$select public.end_enrollment(%L, %L)$$, current_setting('test.enrollment'), current_setting('test.end')),
  'P0001', 'enrollment_not_found', 'other family cannot end our enrollment'
);
reset role;

-- A: 직접 쓰기 차단, 수강 종료
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.class_sessions (family_id, enrollment_id, session_date, start_time, end_time)
    select family_id, id, current_date, '10:00', '11:00' from public.enrollments$$,
  '42501', null, 'sessions cannot be inserted directly'
);
select throws_ok(
  format($$select public.end_enrollment(%L, %L::date - 1)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'P0001', 'invalid_period', 'cannot end before the start date'
);
-- 둘째 주 일요일에 종료
select lives_ok(
  format($$select public.end_enrollment(%L, %L::date + 13)$$,
    current_setting('test.enrollment'), current_setting('test.start')),
  'parent can end an enrollment'
);
select is(
  (select max(session_date) from public.class_sessions),
  current_setting('test.start')::date + 10,
  'scheduled sessions after the end date are removed'
);
select is(
  (select count(*)::int from public.class_rules where effective_until = current_setting('test.start')::date + 13),
  2, 'rules stop at the end date'
);
reset role;

select * from finish();
rollback;
