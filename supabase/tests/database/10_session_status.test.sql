-- M3: 회차 상태 변경 (결석·휴강·취소·완료)
-- test.start = 다음 주 월요일. 화(2)·목(4) 16:00-17:00, 4주.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
reset role;

-- 1주차 화요일 회차
select set_config('test.tue', (
  select id::text from public.class_sessions where session_date = current_setting('test.start')::date + 1
), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  format($$select public.set_session_status(%L, 1, 'absent')$$, current_setting('test.tue')),
  'parent can mark a session absent'
);
select results_eq(
  format($$select status::text, version from public.class_sessions where id = %L$$, current_setting('test.tue')),
  $$values ('absent'::text, 2)$$,
  'status changes and the version is bumped'
);
select throws_ok(
  format($$select public.set_session_status(%L, 1, 'completed')$$, current_setting('test.tue')),
  'P0001', 'session_conflict', 'a stale version is rejected'
);
select throws_ok(
  format($$select public.set_session_status(%L, 2, 'makeup_completed')$$, current_setting('test.tue')),
  'P0001', 'invalid_status', 'a regular session cannot take a makeup status'
);
select lives_ok(
  format($$select public.set_session_status(%L, 2, 'scheduled')$$, current_setting('test.tue')),
  'a status can be reverted to scheduled'
);
select throws_ok(
  format($$update public.class_sessions set status = 'completed' where id = %L$$, current_setting('test.tue')),
  '42501', null, 'status cannot be updated directly'
);
select lives_ok(
  format($$update public.class_sessions set note = '감기' where id = %L$$, current_setting('test.tue')),
  'a note can be written directly'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'class_sessions' and action = 'update'),
  3, 'status and note changes are logged'
);
reset role;

-- B 가족
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  format($$select public.set_session_status(%L, 4, 'cancelled')$$, current_setting('test.tue')),
  'P0001', 'session_not_found', 'other family cannot change our session'
);
update public.class_sessions set note = '침입';
reset role;

select is(
  (select note from public.class_sessions where id = current_setting('test.tue')::uuid),
  '감기', 'other family cannot edit our note'
);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  format($$update public.class_sessions set note = %L where id = %L$$, repeat('가', 501), current_setting('test.tue')),
  '23514', null, 'notes are limited to 500 characters'
);
reset role;

select * from finish();
rollback;
