-- M2: 학원 등록과 가족 간 격리
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 비운다 (끝에서 rollback 된다)
truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
reset role;
select set_config('test.family_b', (select id::text from public.families where name = '박씨네'), true);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');

select lives_ok(
  $$insert into public.academies (family_id, name, phone, contact_name)
    select id, '튼튼영어', '02-123-4567', '김원장' from public.families$$,
  'parent can register an academy'
);
select is((select version from public.academies), 1, 'academy starts at version 1');
select lives_ok(
  $$update public.academies set name = '튼튼영어 본원', memo = '셔틀 있음'$$,
  'parent can edit an academy'
);
select is((select version from public.academies), 2, 'edits bump the version');
select throws_ok(
  format($$update public.academies set family_id = %L$$, current_setting('test.family_b')),
  '42501', null, 'an academy cannot be moved to another family'
);
select throws_ok(
  format($$insert into public.academies (family_id, name) values (%L, '침입')$$, current_setting('test.family_b')),
  '42501', null, 'cannot register an academy for another family'
);
select throws_ok(
  $$insert into public.academies (family_id, name) select id, '   ' from public.families$$,
  '23514', null, 'blank academy name is rejected'
);
select is(
  (select count(*)::int from public.audit_logs where table_name = 'academies'),
  2, 'academy changes are logged'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.academies), 0, 'other family sees no academies');
delete from public.academies;
reset role;

select is((select count(*)::int from public.academies), 1, 'other family cannot delete our academy');

select * from finish();
rollback;
