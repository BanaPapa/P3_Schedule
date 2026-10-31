-- M4: 요금 정책과 예상 학원비 계산
-- test.month = 두 달 뒤 1일. 그 달 시작, 화(2)·목(4) 16:00-17:00.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

truncate public.families, public.audit_logs cascade;

select set_config('test.month', (date_trunc('month', private.family_today()) + interval '2 months')::date::text, true);

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
  current_setting('test.month')::date, null,
  '[{"weekday":2,"start_time":"16:00","end_time":"17:00"},
    {"weekday":4,"start_time":"16:00","end_time":"17:00"}]'::jsonb
);
reset role;

select set_config('test.enrollment', (select id::text from public.enrollments), true);
-- 그 달 회차를 날짜순으로 1, 2, 3, 4 …
create temp table s (n integer primary key, id uuid);
insert into s
  select row_number() over (order by session_date), id from public.class_sessions
  where session_date between current_setting('test.month')::date
    and (current_setting('test.month')::date + interval '1 month - 1 day')::date;
select set_config('test.count', (select count(*)::text from s), true);
grant select on s to authenticated;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  format($$select method is null, estimated_amount is null, session_count from public.tuition_estimates(%L)$$,
    current_setting('test.month')),
  format($$values (true, true, %s)$$, current_setting('test.count')),
  'without a policy the month has sessions but no estimate'
);

-- 회차별 4만원
select lives_ok(
  format($$select public.save_tuition_policy(%L, %L, 'per_session', null, 40000, true, false, 5::smallint, null)$$,
    current_setting('test.enrollment'), current_setting('test.month')),
  'parent can save a per-session policy'
);
select results_eq(
  format($$select billable_count, estimated_amount::int, payment_day::int from public.tuition_estimates(%L)$$,
    current_setting('test.month')),
  format($$values (%1$s, %1$s * 40000, 5)$$, current_setting('test.count')),
  'every scheduled session is billed'
);

-- 1회차 결석(청구), 2회차 휴강(미청구)
select public.set_session_status((select id from s where n = 1), 1, 'absent');
select public.set_session_status((select id from s where n = 2), 1, 'academy_cancelled');
select is(
  (select billable_count from public.tuition_estimates(current_setting('test.month')::date)),
  current_setting('test.count')::int - 1,
  'an absence is billed, an academy cancellation is not'
);

-- 휴강 보강은 청구(원 수업이 청구되지 않았으므로), 결석 보강은 무료
select public.create_makeup((select id from s where n = 2), 2,
  current_setting('test.month')::date + 27, '20:00', '21:00');
select is(
  (select billable_count from public.tuition_estimates(current_setting('test.month')::date)),
  current_setting('test.count')::int,
  'a makeup for an unbilled cancellation is billed'
);
select public.create_makeup((select id from s where n = 1), 2,
  current_setting('test.month')::date + 27, '18:00', '19:00');
select is(
  (select billable_count from public.tuition_estimates(current_setting('test.month')::date)),
  current_setting('test.count')::int,
  'a makeup for a billed absence is free'
);

-- 3회차는 다른 날로 옮김(한 번만 청구), 4회차는 취소(미청구)
select public.reschedule_session((select id from s where n = 3), 1,
  current_setting('test.month')::date + 26, '19:00', '20:00');
select is(
  (select billable_count from public.tuition_estimates(current_setting('test.month')::date)),
  current_setting('test.count')::int,
  'a moved session is billed once'
);
select public.set_session_status((select id from s where n = 4), 1, 'cancelled');
select results_eq(
  format($$select billable_count, estimated_amount::int from public.tuition_estimates(%L)$$, current_setting('test.month')),
  format($$values (%1$s - 1, (%1$s - 1) * 40000)$$, current_setting('test.count')),
  'a cancelled session is not billed'
);

-- 결석도 미청구로 바꾸면 결석 보강이 청구된다(원 수업 1건당 한 번)
select public.save_tuition_policy(
  current_setting('test.enrollment')::uuid, current_setting('test.month')::date,
  'per_session', null, 40000, false, false, 5::smallint, null);
select is(
  (select billable_count from public.tuition_estimates(current_setting('test.month')::date)),
  current_setting('test.count')::int - 1,
  'when absences are not billed their makeups are'
);

-- 월정액
select public.save_tuition_policy(
  current_setting('test.enrollment')::uuid, current_setting('test.month')::date,
  'monthly', 300000, null, true, false, 5::smallint, null);
select results_eq(
  format($$select method::text, estimated_amount::int from public.tuition_estimates(%L)$$, current_setting('test.month')),
  $$values ('monthly'::text, 300000)$$,
  'a monthly policy charges the flat amount'
);
select is(
  (select count(*)::int from public.tuition_policies), 1,
  'saving the same month again updates the policy instead of adding one'
);

-- 다음 달부터 수동 → 이번 달은 그대로 월정액, 다음 달은 예상액 없음
select public.save_tuition_policy(
  current_setting('test.enrollment')::uuid, (current_setting('test.month')::date + interval '1 month')::date,
  'manual', null, null, true, false, null, '학원에서 매달 문자로 안내');
select results_eq(
  format($$select
      (select method::text from public.tuition_estimates(%1$L)),
      (select method::text from public.tuition_estimates((%1$L::date + interval '1 month')::date)),
      (select estimated_amount is null from public.tuition_estimates((%1$L::date + interval '1 month')::date))$$,
    current_setting('test.month')),
  $$values ('monthly'::text, 'manual'::text, true)$$,
  'each month uses the latest policy that started on or before it'
);

select is(
  (select count(*)::int from public.tuition_session_breakdown(
    current_setting('test.enrollment')::uuid, current_setting('test.month')::date) where billable),
  (select billable_count from public.tuition_estimates(current_setting('test.month')::date)),
  'the per-session breakdown agrees with the estimate'
);

-- 입력 검증
select throws_ok(
  format($$select public.save_tuition_policy(%L, %L, 'per_session', null, null, true, false, null, null)$$,
    current_setting('test.enrollment'), current_setting('test.month')),
  'P0001', 'invalid_policy', 'per-session policy needs a session price'
);
select throws_ok(
  format($$select public.save_tuition_policy(%L, %L, 'monthly', 300000, null, true, false, 32::smallint, null)$$,
    current_setting('test.enrollment'), current_setting('test.month')),
  'P0001', 'invalid_policy', 'payment day must be 1..31'
);
select throws_ok(
  $$insert into public.tuition_policies (family_id, enrollment_id, effective_month, method, monthly_amount)
    select family_id, id, date_trunc('month', current_date), 'monthly', 1 from public.enrollments$$,
  '42501', null, 'policies cannot be written directly'
);
reset role;

-- 다른 가족
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.tuition_estimates(current_setting('test.month')::date)),
  0, 'other family sees no estimates'
);
reset role;

select * from finish();
rollback;
