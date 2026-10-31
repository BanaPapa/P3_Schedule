-- M3: 보강 연결, 보강 대기, 이번 수업만 변경
-- test.start = 다음 주 월요일. 화(2)·목(4) 16:00-17:00, 4주.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

truncate public.families, public.audit_logs cascade;

select set_config('test.start', (date_trunc('week', private.family_today()) + interval '7 days')::date::text, true);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local');

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
reset role;

select set_config('test.tue', (
  select id::text from public.class_sessions where session_date = current_setting('test.start')::date + 1
), true);
select set_config('test.thu', (
  select id::text from public.class_sessions where session_date = current_setting('test.start')::date + 3
), true);
select set_config('test.tue2', (
  select id::text from public.class_sessions where session_date = current_setting('test.start')::date + 8
), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 화요일 결석 → 보강 대기
select public.set_session_status(current_setting('test.tue')::uuid, 1, 'absent');
select is((select count(*)::int from public.makeup_waitlist), 1, 'an absent session waits for a makeup');

select throws_ok(
  format($$select public.create_makeup(%L, 1, %L::date + 4, '16:00', '17:00')$$,
    current_setting('test.thu'), current_setting('test.start')),
  'P0001', 'makeup_not_allowed', 'only absent or academy-cancelled sessions get a makeup'
);

-- 금요일 16:00 보강
select lives_ok(
  format($$select public.create_makeup(%L, 2, %L::date + 4, '16:00', '17:00')$$,
    current_setting('test.tue'), current_setting('test.start')),
  'parent can schedule a makeup'
);
select results_eq(
  format($$select kind::text, status::text, session_date, rule_id is null
           from public.class_sessions where origin_session_id = %L$$, current_setting('test.tue')),
  format($$values ('makeup'::text, 'makeup_scheduled'::text, %L::date + 4, true)$$, current_setting('test.start')),
  'the makeup is linked to the missed session'
);
select is((select count(*)::int from public.makeup_waitlist), 0, 'a session with a makeup leaves the wait list');
select throws_ok(
  format($$select public.create_makeup(%L, 3, %L::date + 5, '10:00', '11:00')$$,
    current_setting('test.tue'), current_setting('test.start')),
  'P0001', 'replacement_exists', 'a session cannot get two live makeups'
);
select throws_ok(
  format($$select public.set_session_status(%L, 3, 'scheduled')$$, current_setting('test.tue')),
  'P0001', 'replacement_exists', 'a session with a makeup cannot go back to scheduled'
);

select set_config('test.makeup', (
  select id::text from public.class_sessions where kind = 'makeup'
), true);
select throws_ok(
  format($$select public.set_session_status(%L, 1, 'absent')$$, current_setting('test.makeup')),
  'P0001', 'invalid_status', 'a makeup only takes makeup statuses or cancelled'
);
select lives_ok(
  format($$select public.set_session_status(%L, 1, 'makeup_completed')$$, current_setting('test.makeup')),
  'a makeup can be completed'
);

-- 보강 취소 → 다시 대기, 보강 안 함 → 대기에서 빠짐
select public.set_session_status(current_setting('test.makeup')::uuid, 2, 'cancelled');
select is((select count(*)::int from public.makeup_waitlist), 1, 'cancelling the makeup puts the session back on the wait list');
select lives_ok(
  format($$select public.set_makeup_waived(%L, 3, true)$$, current_setting('test.tue')),
  'parent can mark that no makeup is needed'
);
select is((select count(*)::int from public.makeup_waitlist), 0, 'a waived session leaves the wait list');

-- 목요일만 토요일 10:00 으로 변경
select lives_ok(
  format($$select public.reschedule_session(%L, 1, %L::date + 5, '10:00', '11:00')$$,
    current_setting('test.thu'), current_setting('test.start')),
  'a single session can move to another day'
);
select results_eq(
  format($$select
      (select status::text from public.class_sessions where id = %1$L),
      (select session_date from public.class_sessions where origin_session_id = %1$L and kind = 'rescheduled')$$,
    current_setting('test.thu')),
  format($$values ('cancelled'::text, %L::date + 5)$$, current_setting('test.start')),
  'the original is cancelled and a rescheduled session takes its place'
);
reset role;

select is(
  private.generate_sessions_between(
    (select id from public.enrollments), current_setting('test.start')::date, current_setting('test.start')::date + 27),
  0, 'the moved session is not regenerated on its original day'
);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
-- 같은 날 시간만 바꾸면 그 회차를 고친다
select lives_ok(
  format($$select public.reschedule_session(%L, 1, %L::date + 8, '18:00', '19:00')$$,
    current_setting('test.tue2'), current_setting('test.start')),
  'changing only the time keeps the same session'
);
select results_eq(
  format($$select kind::text, start_time::text, status::text from public.class_sessions where id = %L$$,
    current_setting('test.tue2')),
  $$values ('regular'::text, '18:00:00'::text, 'scheduled'::text)$$,
  'the regular session now has the new time'
);
select throws_ok(
  format($$select public.reschedule_session(%L, 2, %L::date + 6, '10:00', '11:00')$$,
    current_setting('test.thu'), current_setting('test.start')),
  'P0001', 'session_not_changeable', 'a cancelled session cannot be moved'
);

-- 바뀐 회차가 있으면 삭제는 막고, 종료는 정규 예정 회차만 정리한다
select throws_ok(
  $$select public.delete_enrollment((select id from public.enrollments))$$,
  'P0001', 'enrollment_has_history', 'an enrollment with changed sessions cannot be deleted'
);
select public.end_enrollment((select id from public.enrollments), current_setting('test.start')::date + 2);
select is(
  (select count(*)::int from public.class_sessions where kind <> 'regular' and status <> 'cancelled'),
  1, 'ending keeps the arranged rescheduled session'
);
reset role;

select * from finish();
rollback;
