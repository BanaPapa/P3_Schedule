-- M4 보안 리뷰 반영: 달을 넘긴 보강의 청구, 항목 상한, 음수 합계 방지, 과목 하나만 계산
-- test.month = 두 달 뒤 1일. 그 달 시작, 화(2)·목(4) 16:00-17:00, 회차당 4만원.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

truncate public.families, public.audit_logs cascade;

select set_config('test.month', (date_trunc('month', private.family_today()) + interval '2 months')::date::text, true);
select set_config('test.next', (date_trunc('month', private.family_today()) + interval '3 months')::date::text, true);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a1@test.local');

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
-- 이번 달은 결석 청구, 다음 달부터는 결석 미청구
select public.save_tuition_policy((select id from public.enrollments), current_setting('test.month')::date,
  'per_session', null, 40000, true, false, null, null);
select public.save_tuition_policy((select id from public.enrollments), current_setting('test.next')::date,
  'per_session', null, 40000, false, false, null, null);

-- 이번 달 첫 수업 결석(이번 달에 청구됨) → 보강은 다음 달 1일
select public.set_session_status(
  (select id from public.class_sessions where session_date >= current_setting('test.month')::date order by session_date limit 1),
  1, 'absent');
select public.create_makeup(
  (select id from public.class_sessions where status = 'absent'), 2,
  current_setting('test.next')::date, '20:00', '21:00');

select is(
  (select billable from public.tuition_session_breakdown(
    (select id from public.enrollments), current_setting('test.next')::date) where kind = 'makeup'),
  false, 'a makeup is judged by the policy of the missed class month, so it is not billed twice'
);
select is(
  (select count(*)::int from public.tuition_estimates(current_setting('test.month')::date, (select id from public.enrollments))),
  1, 'estimates can be computed for a single enrollment'
);

select public.confirm_invoice((select id from public.enrollments), current_setting('test.month')::date, 100000, null, '[]'::jsonb);
select set_config('test.family', (select id::text from public.families), true);

select throws_ok(
  format($$insert into public.tuition_invoice_items (family_id, invoice_id, kind, label, amount)
    select %L::uuid, id, 'discount', '과한 할인', 100001 from public.tuition_invoices$$, current_setting('test.family')),
  'P0001', 'invalid_item', 'discounts cannot make the total negative'
);
select lives_ok(
  format($$insert into public.tuition_invoice_items (family_id, invoice_id, kind, label, amount)
    select %L::uuid, i.id, 'extra', '항목' || n, 1000 from public.tuition_invoices i, generate_series(1, 20) n$$,
    current_setting('test.family')),
  'up to 20 items per invoice'
);
select throws_ok(
  format($$insert into public.tuition_invoice_items (family_id, invoice_id, kind, label, amount)
    select %L::uuid, id, 'extra', '하나 더', 1000 from public.tuition_invoices$$, current_setting('test.family')),
  'P0001', 'too_many_items', 'the 21st item is rejected'
);
reset role;

select * from finish();
rollback;
