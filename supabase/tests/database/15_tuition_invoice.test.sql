-- M4: 청구 확정, 확정액 보호, 조정, 추가·할인 항목, 부분 납부
-- test.month = 두 달 뒤 1일. 그 달 시작, 화(2)·목(4) 16:00-17:00, 회차당 4만원.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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
select set_config('test.family', (select id::text from public.families where name = '김씨네'), true);
select set_config('test.count', (
  select count(*)::text from public.class_sessions
  where session_date between current_setting('test.month')::date
    and (current_setting('test.month')::date + interval '1 month - 1 day')::date
), true);
select set_config('test.first', (
  select id::text from public.class_sessions
  where session_date >= current_setting('test.month')::date order by session_date limit 1
), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  format($$select public.confirm_invoice(%L, %L, null, null, '[]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.month')),
  'P0001', 'policy_required', 'a month cannot be confirmed without a policy'
);

select public.save_tuition_policy(
  current_setting('test.enrollment')::uuid, current_setting('test.month')::date,
  'per_session', null, 40000, true, false, 5::smallint, null);

select lives_ok(
  format($$select public.confirm_invoice(%L, %L, null, null, '[]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.month')),
  'parent can confirm the month at the estimated amount'
);
select results_eq(
  $$select base_amount, billable_count, estimated_amount::int from public.tuition_invoices$$,
  format($$values (%1$s * 40000, %1$s, %1$s * 40000)$$, current_setting('test.count')),
  'the invoice keeps a snapshot of the estimate'
);
select throws_ok(
  format($$select public.confirm_invoice(%L, %L, null, null, '[]'::jsonb)$$,
    current_setting('test.enrollment'), current_setting('test.month')),
  'P0001', 'invoice_exists', 'a month is confirmed only once'
);

-- PRD: 일정이 바뀌어도 확정 청구액은 자동으로 바뀌지 않는다
select public.set_session_status(current_setting('test.first')::uuid, 1, 'cancelled');
select is(
  (select base_amount from public.tuition_invoices),
  current_setting('test.count')::int * 40000,
  'a confirmed amount does not change when the schedule changes'
);
select isnt(
  (select estimated_amount from public.tuition_estimates(current_setting('test.month')::date)),
  (select estimated_amount from public.tuition_invoices),
  'the estimate is recalculated and now differs from the confirmed snapshot'
);

-- 사용자가 확인한 뒤에만 조정
select throws_ok(
  $$select public.adjust_invoice((select id from public.tuition_invoices), 0, null, null)$$,
  'P0001', 'invoice_conflict', 'adjusting with a stale version is rejected'
);
select public.adjust_invoice(
  (select id from public.tuition_invoices), (select version from public.tuition_invoices), null, '1회 취소 반영');
select results_eq(
  $$select base_amount, estimated_amount::int, adjustment_reason from public.tuition_invoices$$,
  format($$values ((%1$s - 1) * 40000, (%1$s - 1) * 40000, '1회 취소 반영'::text)$$, current_setting('test.count')),
  'adjusting to the estimate updates the amount and the snapshot'
);

-- 교재비 2만원, 형제 할인 1만원
select lives_ok(
  format($$insert into public.tuition_invoice_items (family_id, invoice_id, kind, label, amount)
    select %L::uuid, id, 'extra'::public.tuition_item_kind, '교재비', 20000 from public.tuition_invoices
    union all
    select %L::uuid, id, 'discount'::public.tuition_item_kind, '형제 할인', 10000 from public.tuition_invoices$$,
    current_setting('test.family'), current_setting('test.family')),
  'extra and discount items can be added'
);
select results_eq(
  $$select total_amount::int, paid_amount::int, balance::int from public.tuition_invoice_summaries$$,
  format($$values ((%1$s - 1) * 40000 + 10000, 0, (%1$s - 1) * 40000 + 10000)$$, current_setting('test.count')),
  'total includes extras and discounts'
);

-- 부분 납부
select lives_ok(
  format($$insert into public.tuition_payments (family_id, invoice_id, paid_on, amount, method)
    select %L, id, current_date, 100000, '계좌이체' from public.tuition_invoices$$, current_setting('test.family')),
  'a partial payment can be recorded'
);
select results_eq(
  $$select paid_amount::int, balance::int from public.tuition_invoice_summaries$$,
  format($$values (100000, (%1$s - 1) * 40000 + 10000 - 100000)$$, current_setting('test.count')),
  'the balance is the total minus payments'
);
select throws_ok(
  format($$insert into public.tuition_payments (family_id, invoice_id, paid_on, amount)
    select %L, id, current_date, 0 from public.tuition_invoices$$, current_setting('test.family')),
  '23514', null, 'a payment must be positive'
);
select throws_ok(
  $$select public.cancel_invoice((select id from public.tuition_invoices), (select version from public.tuition_invoices))$$,
  'P0001', 'invoice_has_payments', 'an invoice with payments cannot be cancelled'
);
select throws_ok(
  $$update public.tuition_invoices set base_amount = 0$$,
  '42501', null, 'the confirmed amount cannot be changed directly'
);

-- 수동 방식: 금액을 직접 넣어야 확정된다
select public.create_enrollment(
  (select id from public.children), (select id from public.academies), '수학',
  current_setting('test.month')::date, null,
  '[{"weekday":1,"start_time":"16:00","end_time":"17:00"}]'::jsonb);
select public.save_tuition_policy(
  (select id from public.enrollments where subject = '수학'), current_setting('test.month')::date,
  'manual', null, null, true, false, null, null);
select throws_ok(
  format($$select public.confirm_invoice((select id from public.enrollments where subject = '수학'), %L, null, null, '[]'::jsonb)$$,
    current_setting('test.month')),
  'P0001', 'amount_required', 'a manual policy needs an amount to confirm'
);
select lives_ok(
  format($$select public.confirm_invoice((select id from public.enrollments where subject = '수학'), %L, 250000, null,
    '[{"kind":"extra","label":"교재비","amount":15000}]'::jsonb)$$, current_setting('test.month')),
  'a manual amount with items can be confirmed'
);
select throws_ok(
  $$select public.delete_enrollment((select id from public.enrollments where subject = '수학'))$$,
  'P0001', 'enrollment_has_history', 'an enrollment with an invoice cannot be deleted'
);
reset role;

-- 다른 가족
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.tuition_invoice_summaries), 0, 'other family sees no invoices');
select throws_ok(
  format($$insert into public.tuition_payments (family_id, invoice_id, paid_on, amount)
    values (%L, %L, current_date, 1000)$$,
    current_setting('test.family'),
    (select id from public.tuition_invoices limit 1)),
  '42501', null, 'other family cannot record a payment on our invoice'
);
reset role;

select * from finish();
rollback;
