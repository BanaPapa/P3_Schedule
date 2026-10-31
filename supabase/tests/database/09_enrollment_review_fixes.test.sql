-- M2 보안 리뷰 반영: 과거 회차 보호, 종료일 연장, 중복 규칙, 기간·개수 제한
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
insert into public.academies (family_id, name) select id, '튼튼영어' from public.families;

-- 10일 전 시작, 매일 수업
select public.create_enrollment(
  (select id from public.children), (select id from public.academies), '영어',
  (private.family_today() - 10)::date, null,
  '[{"weekday":1,"start_time":"16:00","end_time":"17:00"},
    {"weekday":2,"start_time":"16:00","end_time":"17:00"},
    {"weekday":3,"start_time":"16:00","end_time":"17:00"},
    {"weekday":4,"start_time":"16:00","end_time":"17:00"},
    {"weekday":5,"start_time":"16:00","end_time":"17:00"},
    {"weekday":6,"start_time":"16:00","end_time":"17:00"},
    {"weekday":7,"start_time":"16:00","end_time":"17:00"}]'::jsonb
);

-- 과거 날짜로 종료해도 이미 지난 회차는 남는다
select public.end_enrollment((select id from public.enrollments), (private.family_today() - 5)::date);
select is(
  (select count(*)::int from public.class_sessions where session_date < private.family_today()),
  10, 'ending in the past keeps past sessions'
);
select is(
  (select count(*)::int from public.class_sessions where session_date >= private.family_today()),
  0, 'ending removes sessions from today on'
);
select is(
  (select count(*)::int from public.class_rules), 7,
  'rules that already ran are kept'
);

-- 종료일을 미래로 늘리면 오늘부터만 다시 만든다
select public.end_enrollment((select id from public.enrollments), (private.family_today() + 3)::date);
select is(
  (select count(*)::int from public.class_sessions where session_date >= private.family_today()),
  4, 'extending regenerates from today to the new end date'
);
select is((select count(*)::int from public.class_sessions), 14, 'no past session is duplicated');

-- "16:00" 과 "16:00:00" 은 같은 시각이다
select throws_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), '수학', private.family_today(), null,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"},
      {"weekday":2,"start_time":"16:00:00","end_time":"18:00"}]'::jsonb)$$,
  'P0001', 'invalid_schedule', 'the same weekday and start time cannot appear twice'
);

-- 시작일 상한
select throws_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), '수학',
    (private.family_today() + 500)::date, null,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
  'P0001', 'invalid_period', 'start date cannot be far in the future'
);

-- 공백 과목으로 직접 수정할 수 없다
select throws_ok(
  $$update public.enrollments set subject = '   '$$,
  '23514', null, 'subject cannot be blank on direct update'
);

-- 진행 중인 수강 과목 개수 제한 (이미 1개 있음)
select lives_ok(
  $sql$do $do$
    begin
      for i in 1..29 loop
        perform public.create_enrollment(
          (select id from public.children), (select id from public.academies), '과목' || i,
          private.family_today(), private.family_today(),
          '[{"weekday":1,"start_time":"16:00","end_time":"17:00"}]'::jsonb);
      end loop;
    end
  $do$$sql$,
  'up to 30 active enrollments are allowed'
);
select throws_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), '하나 더',
    private.family_today(), null,
    '[{"weekday":1,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
  'P0001', 'too_many_enrollments', 'the 31st active enrollment is rejected'
);
reset role;

-- 지난 과목은 개수에 들어가지 않는다
update public.enrollments set end_date = private.family_today() - 1, start_date = private.family_today() - 2
  where subject like '과목%';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), '하나 더',
    private.family_today(), null,
    '[{"weekday":1,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
  'ended enrollments do not count toward the limit'
);
reset role;

select * from finish();
rollback;
