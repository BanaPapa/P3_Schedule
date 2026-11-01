-- 4차: AI 제안 중 부모가 고른 학교 일정을 한 번에(원자적으로) 등록
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
insert into public.children (family_id, name) select id, '박첫째' from public.families;
reset role;
select set_config('test.child_b', (select id::text from public.children where name = '박첫째'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
reset role;
select set_config('test.child', (select id::text from public.children where name = '첫째'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.create_school_events(jsonb_build_array(
    jsonb_build_object('child_id', current_setting('test.child'), 'kind', 'event', 'event_date', '2027-05-01',
      'end_date', null, 'title', '현장체험학습', 'subject', null, 'memo', null, 'supplies', jsonb_build_array('도시락', '물병')),
    jsonb_build_object('child_id', current_setting('test.child'), 'kind', 'exam', 'event_date', '2027-05-10',
      'end_date', null, 'title', '단원평가', 'subject', '수학', 'memo', null, 'supplies', '[]'::jsonb)
  )),
  2, 'selected suggestions are registered with their supplies'
);
select results_eq(
  $$select (select count(*)::int from public.school_events), (select count(*)::int from public.school_event_items)$$,
  $$values (2, 2)$$,
  'events and supplies are saved'
);
select throws_ok(
  format($$select public.create_school_events(jsonb_build_array(
    jsonb_build_object('child_id', %L, 'kind', 'event', 'event_date', '2027-06-01', 'title', '좋은 일정', 'supplies', '[]'::jsonb),
    jsonb_build_object('child_id', %L, 'kind', 'event', 'event_date', '2027-06-02', 'title', '남의 아이', 'supplies', '[]'::jsonb)))$$,
    current_setting('test.child'), current_setting('test.child_b')),
  '23503', null, 'a child of another family is rejected'
);
select is((select count(*)::int from public.school_events), 2, 'a failure saves nothing from that batch');
select throws_ok(
  format($$select public.create_school_events((select jsonb_agg(jsonb_build_object(
      'child_id', %L, 'kind', 'event', 'event_date', '2027-07-01', 'title', 'x', 'supplies', '[]'::jsonb))
    from generate_series(1, 31)))$$, current_setting('test.child')),
  'P0001', 'invalid_input', 'at most 30 events at once'
);
reset role;

set local role anon;
select throws_ok($$select public.create_school_events('[]'::jsonb)$$, '42501', null, 'anon cannot register events');
reset role;

select * from finish();
rollback;
