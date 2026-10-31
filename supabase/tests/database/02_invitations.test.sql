-- M1: 배우자 초대 (생성, 미리보기, 수락, 만료, 정원)
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 비운다 (끝에서 rollback 된다)
truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'c@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'd@test.local');

-- 비로그인은 초대 조회 불가
set local role anon;
select throws_ok(
  $$select * from public.get_invitation('anything')$$,
  '42501', null, 'anon cannot preview invitations'
);
reset role;

-- B1: 다른 가족 생성
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
reset role;

-- A1: 가족 생성 후 초대
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');

select lives_ok($$select * from public.create_invitation()$$, 'member can create an invitation');
select lives_ok($$select * from public.create_invitation()$$, 'member can re-issue an invitation');
select is(
  (select count(*)::int from public.family_invitations
    where revoked_at is null and accepted_at is null),
  1, 're-issuing revokes the previous open invitation'
);
reset role;

-- 시나리오별 코드를 고정한다
update public.family_invitations set code = 'revoked-code' where revoked_at is not null;
update public.family_invitations set code = 'active-code' where revoked_at is null;
-- 가족당 열린 초대는 하나뿐이라 만료 초대는 박씨네에 만든다
insert into public.family_invitations (family_id, code, expires_at)
  select id, 'expired-code', now() - interval '1 minute' from public.families where name = '박씨네';

-- B1: 다른 가족 소속이면 수락 불가, 초대 목록도 안 보임
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.family_invitations where code in ('active-code', 'revoked-code')),
  0, 'other family cannot see our invitations'
);
select throws_ok(
  $$select public.accept_invitation('active-code', '엄마')$$,
  'P0001', 'already_in_family', 'member of another family cannot accept'
);
reset role;

-- C: 미리보기와 수락
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select family_name, inviter_name, status from public.get_invitation('active-code')$$,
  $$values ('김씨네'::text, '아빠'::text, 'valid'::text)$$,
  'invitee sees family name, inviter and status'
);
select is_empty($$select * from public.get_invitation('no-such-code')$$, 'unknown code returns nothing');
select is(
  (select status from public.get_invitation('expired-code')), 'expired',
  'expired invitation reports expired'
);
select throws_ok(
  $$select public.accept_invitation('no-such-code', '엄마')$$,
  'P0001', 'invitation_not_found', 'unknown code is rejected'
);
select throws_ok(
  $$select public.accept_invitation('revoked-code', '엄마')$$,
  'P0001', 'invitation_revoked', 'revoked invitation is rejected'
);
select throws_ok(
  $$select public.accept_invitation('expired-code', '엄마')$$,
  'P0001', 'invitation_expired', 'expired invitation is rejected'
);
select lives_ok($$select public.accept_invitation('active-code', '엄마')$$, 'invitee joins the family');
select is((select name from public.families), '김씨네', 'joined parent sees the family');
select is(
  (select role::text from public.family_members where user_id = auth.uid()),
  'parent', 'joined parent has parent role'
);
reset role;

-- D: 이미 쓴 초대, 정원 초과
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.accept_invitation('active-code', '삼촌')$$,
  'P0001', 'invitation_used', 'used invitation cannot be reused'
);
reset role;

insert into public.family_invitations (family_id, code)
  select id, 'extra-code' from public.families where name = '김씨네';
select set_config(
  'test.extra_id',
  (select id::text from public.family_invitations where code = 'extra-code'),
  true
);

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.accept_invitation('extra-code', '삼촌')$$,
  'P0001', 'family_full', 'a family holds at most two parents'
);
reset role;

-- A1: 정원이 차면 초대 불가, 초대 취소
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.create_invitation()$$,
  'P0001', 'family_full', 'full family cannot issue invitations'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  format($$select public.revoke_invitation(%L)$$, current_setting('test.extra_id')),
  'P0001', 'invitation_not_found', 'other family cannot revoke our invitation'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  format($$select public.revoke_invitation(%L)$$, current_setting('test.extra_id')),
  'member can revoke an invitation'
);
select isnt(
  (select revoked_at from public.family_invitations where code = 'extra-code'), null,
  'revoked invitation is marked'
);
reset role;

select * from finish();
rollback;
