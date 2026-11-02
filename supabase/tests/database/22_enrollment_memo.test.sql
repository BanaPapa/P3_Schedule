-- 과목명 없이 학원만으로 수강 등록, 비고(memo) 저장
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
insert into public.children (family_id, name) select id, '첫째' from public.families;
insert into public.academies (family_id, name) select id, '소리피아노' from public.families;

select lives_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), null,
    private.family_today(), null,
    '[{"weekday":2,"start_time":"16:00","end_time":"17:00"}]'::jsonb,
    '  체르니 30 진도  ')$$,
  'enrollment can be created without a subject'
);
select is((select subject from public.enrollments), null, 'subject stays empty');
select is((select memo from public.enrollments), '체르니 30 진도', 'memo is trimmed and saved');

select lives_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), '   ',
    private.family_today(), null,
    '[{"weekday":3,"start_time":"16:00","end_time":"17:00"}]'::jsonb)$$,
  'blank subject and missing memo are stored as empty'
);
select is(
  (select count(*)::int from public.enrollments where subject is null and memo is null), 1,
  'blank subject and memo become null'
);

select throws_ok(
  $$select public.create_enrollment(
    (select id from public.children), (select id from public.academies), null,
    private.family_today(), null,
    '[{"weekday":4,"start_time":"16:00","end_time":"17:00"}]'::jsonb,
    repeat('가', 501))$$,
  'P0001', 'invalid_input', 'memo longer than 500 characters is rejected'
);

-- 비고는 나중에 직접 고칠 수 있다(컬럼 권한)
select lives_ok(
  $$update public.enrollments set memo = '토요일 보충' where memo = '체르니 30 진도'$$,
  'memo can be updated directly'
);

select * from finish();
rollback;
