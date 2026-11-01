-- 2차: 가족 여행 (여행, 일정표, 예산, 지출)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

truncate public.families, public.audit_logs cascade;

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

select lives_ok(
  $$insert into public.trips (family_id, title, destination, start_date, end_date, budget_amount)
    select id, '제주 여름 여행', '제주', '2027-07-20', '2027-07-23', 1500000 from public.families$$,
  'parent can create a trip'
);
select throws_ok(
  $$insert into public.trips (family_id, title, start_date, end_date)
    select id, '거꾸로', '2027-07-23', '2027-07-20' from public.families$$,
  '23514', null, 'end date cannot be before start date'
);
select throws_ok(
  $$insert into public.trips (family_id, title, start_date, end_date)
    select id, '너무 긴 여행', '2027-01-01', '2027-04-01' from public.families$$,
  '23514', null, 'a trip is at most 60 days'
);
reset role;
select set_config('test.trip', (select id::text from public.trips), true);
select set_config('test.family', (select id::text from public.families where name = '김씨네'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- 일정표
select lives_ok(
  format($$insert into public.trip_items (family_id, trip_id, day_date, start_time, title, place_name)
    values (%L, %L, '2027-07-21', '10:00', '성산일출봉', '성산일출봉 매표소')$$,
    current_setting('test.family'), current_setting('test.trip')),
  'parent can add an itinerary item'
);
select throws_ok(
  format($$insert into public.trip_items (family_id, trip_id, day_date, title)
    values (%L, %L, '2027-07-25', '여행 뒤')$$, current_setting('test.family'), current_setting('test.trip')),
  'P0001', 'invalid_trip_day', 'an item must fall within the trip'
);
select throws_ok(
  format($$update public.trips set end_date = '2027-07-20' where id = %L$$, current_setting('test.trip')),
  'P0001', 'trip_items_outside', 'shortening a trip cannot leave items outside it'
);

-- 예산과 지출
select lives_ok(
  format($$insert into public.trip_budgets (family_id, trip_id, category, planned_amount)
    values (%1$L, %2$L, 'lodging', 600000), (%1$L, %2$L, 'food', 400000)$$,
    current_setting('test.family'), current_setting('test.trip')),
  'parent can plan a budget per category'
);
select throws_ok(
  format($$insert into public.trip_budgets (family_id, trip_id, category, planned_amount)
    values (%L, %L, 'food', 1)$$, current_setting('test.family'), current_setting('test.trip')),
  '23505', null, 'one budget row per category'
);
select lives_ok(
  format($$insert into public.trip_expenses (family_id, trip_id, spent_on, category, amount, description)
    values (%1$L, %2$L, '2027-06-01', 'lodging', 550000, '호텔 예약'),
           (%1$L, %2$L, '2027-07-21', 'food', 85000, '흑돼지')$$,
    current_setting('test.family'), current_setting('test.trip')),
  'expenses can be recorded, including before the trip'
);
select throws_ok(
  format($$insert into public.trip_expenses (family_id, trip_id, spent_on, category, amount)
    values (%L, %L, '2027-07-21', 'food', 0)$$, current_setting('test.family'), current_setting('test.trip')),
  '23514', null, 'an expense must be positive'
);
select results_eq(
  $$select planned_total::int, spent_total::int, budget_amount from public.trip_summaries$$,
  $$values (1000000, 635000, 1500000)$$,
  'the summary adds planned and spent amounts'
);
select results_eq(
  $$select category::text, planned_amount::int, spent_amount::int from public.trip_category_totals order by category$$,
  $$values ('food'::text, 400000, 85000), ('lodging', 600000, 550000)$$,
  'totals per category compare plan and spending'
);
select is(
  (select count(*)::int from public.audit_logs where table_name like 'trip%'), 6,
  'travel changes are logged'
);
reset role;

-- 다른 가족
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.trips), 0, 'other family sees no trips');
select throws_ok(
  format($$insert into public.trip_expenses (family_id, trip_id, spent_on, category, amount)
    values (%L, %L, '2027-07-21', 'food', 1000)$$, current_setting('test.family'), current_setting('test.trip')),
  '42501', null, 'other family cannot add expenses to our trip'
);
select throws_ok(
  format($$update public.trips set family_id = (select id from public.families) where id = %L$$, current_setting('test.trip')),
  '42501', null, 'a trip cannot be moved to another family'
);
reset role;

select * from finish();
rollback;
