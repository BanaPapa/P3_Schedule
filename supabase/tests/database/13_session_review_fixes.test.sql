-- M3 보안 리뷰 반영: 일정 변경 시 중복·이력 손실 방지, 보강 상태 일관성, 규칙 증가 제한
-- test.start = 다음 주 월요일. 화(2)·목(4) 16:00-17:00, 4주(test.start ~ +27).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

create temp table s (day integer primary key, id uuid);
insert into s select session_date - current_setting('test.start')::date, id from public.class_sessions;
grant select on s to authenticated;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 2주차 화: 메모, 3주차 화: 결석, 4주차 화: 같은 주 목 18:00 으로 옮김
update public.class_sessions set note = '준비물: 단어장' where id = (select id from s where day = 8);
select public.set_session_status((select id from s where day = 15), 1, 'absent');
select public.reschedule_session(
  (select id from s where day = 22), 1, current_setting('test.start')::date + 24, '18:00', '19:00');

-- 같은 규칙으로 2주차부터 다시 적용
select public.change_schedule_from(
  (select id from public.enrollments), current_setting('test.start')::date + 7,
  '[{"weekday":2,"start_time":"16:00","end_time":"17:00"},
    {"weekday":4,"start_time":"16:00","end_time":"17:00"}]'::jsonb);

select is(
  (select note from public.class_sessions where id = (select id from s where day = 8)),
  '준비물: 단어장', 'a session with a note survives a schedule change'
);
select is(
  (select count(*)::int from public.class_sessions
    where kind = 'regular' and session_date = current_setting('test.start')::date + 8),
  1, 'no duplicate on the day of an edited session'
);
select is(
  (select count(*)::int from public.class_sessions
    where kind = 'regular' and session_date = current_setting('test.start')::date + 15),
  1, 'no duplicate on the day of an absence'
);
select is(
  (select count(*)::int from public.class_sessions
    where session_date = current_setting('test.start')::date + 22 and status <> 'cancelled'),
  0, 'a moved class does not come back on its original day'
);
select is(
  (select count(*)::int from public.class_sessions
    where kind = 'regular' and status = 'scheduled' and start_time = '16:00'
      and session_date in (select current_setting('test.start')::date + d from unnest(array[10, 17, 24]) d)),
  3, 'untouched sessions are regenerated'
);

-- 보강 안 함 표시는 결석·휴강이 아닐 때 풀린다
select public.set_session_status((select id from s where day = 1), 1, 'absent');
select public.set_makeup_waived((select id from s where day = 1), 2, true);
select public.set_session_status((select id from s where day = 1), 3, 'completed');
select public.set_session_status((select id from s where day = 1), 4, 'absent');
select ok(
  exists (select 1 from public.makeup_waitlist where id = (select id from s where day = 1)),
  'a session marked absent again goes back on the wait list'
);

-- 취소한 보강을 살릴 때 다른 보강이 있으면 이해할 수 있는 오류
select public.create_makeup(
  (select id from s where day = 15),
  (select version from public.class_sessions where id = (select id from s where day = 15)),
  current_setting('test.start')::date + 18, '16:00', '17:00');
select public.set_session_status(
  (select id from public.class_sessions where kind = 'makeup'), 1, 'cancelled');
select public.create_makeup(
  (select id from s where day = 15),
  (select version from public.class_sessions where id = (select id from s where day = 15)),
  current_setting('test.start')::date + 19, '16:00', '17:00');
select throws_ok(
  $$select public.set_session_status(
      (select id from public.class_sessions where kind = 'makeup' and status = 'cancelled'), 2, 'makeup_scheduled')$$,
  'P0001', 'replacement_exists', 'reviving a makeup while another is live is refused clearly'
);

-- 보강이 잡힌 원 수업은 결석↔휴강만 바꿀 수 있다
select throws_ok(
  $$select public.set_session_status((select id from s where day = 15),
      (select version from public.class_sessions where id = (select id from s where day = 15)), 'cancelled')$$,
  'P0001', 'replacement_exists', 'an origin with a live makeup cannot be cancelled'
);
select lives_ok(
  $$select public.set_session_status((select id from s where day = 15),
      (select version from public.class_sessions where id = (select id from s where day = 15)), 'academy_cancelled')$$,
  'an origin with a live makeup can switch between absent and academy-cancelled'
);

-- 종료하면 손댄 미래 회차는 지우지 않고 취소로 남긴다
select public.end_enrollment((select id from public.enrollments), current_setting('test.start')::date + 7);
select is(
  (select status::text from public.class_sessions where id = (select id from s where day = 8)),
  'cancelled', 'an edited future session is cancelled, not deleted, when the enrollment ends'
);

-- 종료일 없는 과목의 변경 시작일은 400일 이내
select public.create_enrollment(
  (select id from public.children), (select id from public.academies), '수학', private.family_today(), null,
  '[{"weekday":1,"start_time":"16:00","end_time":"17:00"}]'::jsonb);
select throws_ok(
  $$select public.change_schedule_from(
      (select id from public.enrollments where subject = '수학'), private.family_today() + 401,
      '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
  'P0001', 'invalid_period', 'a schedule change cannot start more than 400 days ahead'
);

-- 일정 변경을 수없이 반복해 규칙을 무한히 늘릴 수 없다
select throws_ok(
  $sql$do $do$
    begin
      for i in 1..30 loop
        perform public.change_schedule_from(
          (select id from public.enrollments where subject = '수학'), private.family_today() + i,
          '[{"weekday":1,"start_time":"16:00","end_time":"17:00"},
            {"weekday":2,"start_time":"16:00","end_time":"17:00"},
            {"weekday":3,"start_time":"16:00","end_time":"17:00"}]'::jsonb);
      end loop;
    end
  $do$$sql$,
  'P0001', 'too_many_schedule_changes', 'the number of rules per enrollment is limited'
);
reset role;

select * from finish();
rollback;
