-- M1: 동시 수정 감지용 version 컬럼과 변경 이력(audit_logs)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 비운다 (끝에서 rollback 된다)
truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;

select is((select version from public.children), 1, 'new rows start at version 1');

-- 화면에서 읽은 version(1)으로 저장
update public.children set name = '김첫째' where version = 1;
select is((select version from public.children), 2, 'each update bumps the version');

-- 다른 사람이 먼저 저장한 뒤 옛 version(1)으로 저장하면 아무 행도 바뀌지 않는다
update public.children set name = '덮어쓰기' where version = 1;
select is((select name from public.children), '김첫째', 'stale version does not overwrite');

select throws_ok(
  $$update public.children set version = 99$$,
  '42501', null, 'clients cannot set version directly'
);

delete from public.children;

select results_eq(
  $$select table_name, action from public.audit_logs order by id$$,
  $$values ('families'::text, 'insert'::text),
           ('family_members', 'insert'),
           ('children', 'insert'),
           ('children', 'update'),
           ('children', 'delete')$$,
  'inserts, updates and deletes are logged in order'
);
select is(
  (select count(*)::int from public.audit_logs where actor_id = auth.uid()),
  5, 'the acting parent is recorded'
);
select is(
  (select old_data ->> 'name' from public.audit_logs where action = 'delete'),
  '김첫째', 'deleted data is kept in the log'
);
select is(
  (select new_data ->> 'name' from public.audit_logs where table_name = 'children' and action = 'update'),
  '김첫째', 'updated data is kept in the log'
);
select throws_ok(
  $$insert into public.audit_logs (family_id, table_name, record_id, action)
    select id, 'children', id, 'insert' from public.families$$,
  '42501', null, 'clients cannot write audit logs'
);
select throws_ok(
  $$delete from public.audit_logs$$,
  '42501', null, 'clients cannot delete audit logs'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.audit_logs), 0, 'other family cannot read our audit logs');
reset role;

select * from finish();
rollback;
