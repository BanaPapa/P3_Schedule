-- M1: 보안 리뷰에서 찾은 권한 경계 케이스
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 비운다 (끝에서 rollback 된다)
truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'c@test.local');

-- 비로그인은 어떤 RPC도 못 쓴다
set local role anon;
select throws_ok($$select * from public.create_invitation()$$, '42501', null, 'anon cannot create invitations');
select throws_ok($$select public.accept_invitation('x', 'y')$$, '42501', null, 'anon cannot accept invitations');
select throws_ok(
  $$select public.revoke_invitation('00000000-0000-0000-0000-000000000000')$$,
  '42501', null, 'anon cannot revoke invitations'
);
reset role;

-- 가족 없는 사용자
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.create_invitation()$$,
  'P0001', 'not_in_family', 'user without a family cannot invite'
);
reset role;

-- A1: 가족 생성, 초대
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');
select * from public.create_invitation();

select ok(
  (select expires_at between now() + interval '7 days' - interval '1 minute'
                         and now() + interval '7 days' + interval '1 minute'
   from public.family_invitations),
  'invitations expire after seven days'
);
select throws_ok(
  $$select public.accept_invitation((select code from public.family_invitations), '아빠')$$,
  'P0001', 'already_in_family', 'a member cannot accept their own family invitation'
);
select throws_ok(
  $$insert into public.family_invitations (family_id) select id from public.families$$,
  '42501', null, 'invitations cannot be inserted directly'
);
select throws_ok(
  $$update public.family_invitations set revoked_at = null$$,
  '42501', null, 'invitations cannot be updated directly'
);
select throws_ok(
  $$update public.families set created_by = '44444444-4444-4444-4444-444444444444'$$,
  '42501', null, 'family creator cannot be changed'
);
select throws_ok(
  $$update public.family_members set user_id = '44444444-4444-4444-4444-444444444444'$$,
  '42501', null, 'member user cannot be swapped'
);
reset role;

select set_config('test.code', (select code from public.family_invitations), true);
select set_config('test.invite_id', (select id::text from public.family_invitations), true);

-- A2: 합류
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select public.accept_invitation(current_setting('test.code'), '엄마');
-- 다른 구성원의 호칭은 바꿀 수 없다
update public.family_members set display_name = '바뀜' where user_id <> auth.uid();
reset role;

select is(
  (select display_name from public.family_members where user_id = '11111111-1111-1111-1111-111111111111'),
  '아빠', 'a member cannot rename another member'
);

-- A1: 이미 수락된 초대는 취소할 수 없다
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  format($$select public.revoke_invitation(%L)$$, current_setting('test.invite_id')),
  'P0001', 'invitation_not_found', 'accepted invitation cannot be revoked'
);
reset role;

-- DB 제약: 가족당 열린 초대는 하나
delete from public.family_members where user_id = '22222222-2222-2222-2222-222222222222';
insert into public.family_invitations (family_id) select id from public.families;
select throws_ok(
  $$insert into public.family_invitations (family_id) select id from public.families$$,
  '23505', null, 'a family has at most one open invitation'
);
select lives_ok(
  $$update public.family_invitations set revoked_at = now() where accepted_at is null and revoked_at is null$$,
  'revoking frees the slot'
);
select lives_ok(
  $$insert into public.family_invitations (family_id) select id from public.families$$,
  'a new invitation can be opened after revoking'
);

select * from finish();
rollback;
