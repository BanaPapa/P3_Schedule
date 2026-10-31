-- M1: 가족 생성, 가족 간 격리, 직접 쓰기 차단
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 비운다 (끝에서 rollback 된다)
truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'c@test.local');

-- 비로그인
set local role anon;
select throws_ok(
  $$select public.create_family('김씨네', '아빠')$$,
  '42501', null, 'anon cannot call create_family'
);
reset role;

-- A1: 가족 생성
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.create_family('  김씨네  ', '아빠')$$, 'parent can create a family');
select is((select name from public.families), '김씨네', 'family name is trimmed and visible to its member');
select is(
  (select role::text from public.family_members where user_id = auth.uid()),
  'owner', 'creator becomes owner'
);
select throws_ok(
  $$select public.create_family('둘째집', '아빠')$$,
  'P0001', 'already_in_family', 'a user belongs to at most one family'
);
select throws_ok(
  $$insert into public.families (name) values ('직접 생성')$$,
  '42501', null, 'families cannot be inserted directly'
);
select throws_ok(
  $$insert into public.family_members (family_id, user_id, display_name)
    select id, '44444444-4444-4444-4444-444444444444', '침입자' from public.families$$,
  '42501', null, 'members cannot be inserted directly'
);
select throws_ok(
  $$update public.family_members set role = 'parent' where user_id = auth.uid()$$,
  '42501', null, 'members cannot change their role'
);
select lives_ok(
  $$update public.family_members set display_name = '김아빠' where user_id = auth.uid()$$,
  'members can rename themselves'
);
reset role;

-- B1: 다른 가족
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.create_family('박씨네', '엄마')$$, 'second parent creates another family');
select is((select count(*)::int from public.families), 1, 'a family sees only its own family row');
select is((select count(*)::int from public.family_members), 1, 'a family sees only its own members');
update public.families set name = '바뀐 이름' where name = '김씨네';
reset role;

select is(
  (select name from public.families where created_by = '11111111-1111-1111-1111-111111111111'),
  '김씨네', 'another family cannot rename our family'
);

-- C: 입력값 검증
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.create_family('   ', '아빠')$$,
  'P0001', 'invalid_family_name', 'blank family name is rejected'
);
select throws_ok(
  $$select public.create_family('우리집', '')$$,
  'P0001', 'invalid_display_name', 'blank display name is rejected'
);
reset role;

select * from finish();
rollback;
