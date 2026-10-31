-- M1: 자녀 프로필 공동 관리와 가족 간 격리
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 비운다 (끝에서 rollback 된다)
truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
reset role;

-- A2는 초대 수락을 거친 것으로 가정하고 바로 구성원으로 넣는다
insert into public.family_members (family_id, user_id, role, display_name)
  select id, '22222222-2222-2222-2222-222222222222', 'parent', '엄마'
  from public.families where name = '김씨네';
select set_config('test.family_a', (select id::text from public.families where name = '김씨네'), true);
select set_config('test.family_b', (select id::text from public.families where name = '박씨네'), true);

-- 비로그인
set local role anon;
select throws_ok($$select * from public.children$$, '42501', null, 'anon cannot read children');
reset role;

-- A1: 자녀 등록
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  format($$insert into public.children (family_id, name, color) values (%L, '첫째', '#2563eb')$$,
    current_setting('test.family_a')),
  'parent can add a child'
);
select throws_ok(
  format($$insert into public.children (family_id, name, color) values (%L, '둘째', 'blue')$$,
    current_setting('test.family_a')),
  '23514', null, 'invalid color is rejected'
);
select throws_ok(
  format($$update public.children set family_id = %L$$, current_setting('test.family_b')),
  '42501', null, 'a child cannot be moved to another family'
);
reset role;

-- A2: 배우자도 같은 자녀를 보고 수정한다
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select name from public.children), '첫째', 'spouse sees the child');
select lives_ok($$update public.children set name = '김첫째'$$, 'spouse can edit the child');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select name from public.children), '김첫째', 'edit by spouse is visible to the other parent');
reset role;

-- B1: 다른 가족 자녀는 보이지도, 바뀌지도 않는다
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.children), 0, 'other family sees no children');
select throws_ok(
  format($$insert into public.children (family_id, name) values (%L, '침입')$$,
    current_setting('test.family_a')),
  '42501', null, 'other family cannot add a child to our family'
);
update public.children set name = '변경';
delete from public.children;
reset role;

select is(
  (select name from public.children where family_id = current_setting('test.family_a')::uuid),
  '김첫째', 'other family cannot edit or delete our child'
);

-- A2: 삭제
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$delete from public.children$$, 'spouse can delete a child');
select is((select count(*)::int from public.children), 0, 'child is gone for the family');
reset role;

select is(
  (select count(*)::int from public.children where family_id = current_setting('test.family_a')::uuid),
  0, 'delete really removed the row'
);

select * from finish();
rollback;
