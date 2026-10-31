-- M2: 이력이 있는 수강 과목은 삭제하지 못한다, 오늘 기준 회차 만들기
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
insert into public.academies (family_id, name) select id, '튼튼영어' from public.families;

-- 오늘 시작, 매일 수업 → 생성 시 오늘부터 회차가 생긴다
select public.create_enrollment(
  (select id from public.children), (select id from public.academies), '영어',
  private.family_today(), null,
  '[{"weekday":1,"start_time":"16:00","end_time":"17:00"},
    {"weekday":2,"start_time":"16:00","end_time":"17:00"},
    {"weekday":3,"start_time":"16:00","end_time":"17:00"},
    {"weekday":4,"start_time":"16:00","end_time":"17:00"},
    {"weekday":5,"start_time":"16:00","end_time":"17:00"},
    {"weekday":6,"start_time":"16:00","end_time":"17:00"},
    {"weekday":7,"start_time":"16:00","end_time":"17:00"}]'::jsonb
);
select ok(
  (select count(*) from public.class_sessions) >= 60,
  'creating an enrollment generates sessions for the coming months'
);
select is(
  (select min(session_date) from public.class_sessions), private.family_today(),
  'sessions start on the start date'
);

select ok(
  public.ensure_sessions_until((private.family_today() + 200)::date) > 0,
  'ensure_sessions_until extends sessions further out'
);
select is(
  public.ensure_sessions_until((private.family_today() + 200)::date), 0,
  'ensure_sessions_until is idempotent'
);
select throws_ok(
  $$select public.ensure_sessions_until((private.family_today() + 5000)::date)$$,
  'P0001', 'range_too_far', 'cannot generate years ahead'
);

-- 오늘 시작한 과목은 지난 회차가 없으니 삭제 가능
select lives_ok(
  $$select public.delete_enrollment((select id from public.enrollments))$$,
  'an enrollment without past sessions can be deleted'
);
select is((select count(*)::int from public.class_sessions), 0, 'its sessions are deleted too');
reset role;

-- 지난 회차가 있는 과목은 삭제할 수 없다
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_enrollment(
  (select id from public.children), (select id from public.academies), '수학',
  (private.family_today() - 14)::date, null,
  '[{"weekday":1,"start_time":"16:00","end_time":"17:00"}]'::jsonb
);
select throws_ok(
  $$select public.delete_enrollment((select id from public.enrollments))$$,
  'P0001', 'enrollment_has_history', 'an enrollment with past sessions must be ended, not deleted'
);
select throws_ok(
  $$delete from public.children$$,
  '23503', null, 'a child with enrollments cannot be deleted'
);
reset role;

select * from finish();
rollback;
