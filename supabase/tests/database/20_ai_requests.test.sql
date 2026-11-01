-- 4차: AI 요청 사용량 상한 (가족당 하루 30회)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

truncate public.families, public.audit_logs cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'c@test.local');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('박씨네', '엄마');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('김씨네', '아빠');

select is(public.record_ai_request('extract'), 29, 'a request is recorded and the remaining count returned');
select lives_ok(
  $sql$do $do$ begin for i in 1..29 loop perform public.record_ai_request('analyze'); end loop; end $do$$sql$,
  'up to 30 requests a day'
);
select throws_ok($$select public.record_ai_request('extract')$$, 'P0001', 'ai_limit_reached', 'the 31st request is refused');
select throws_ok(
  $$insert into public.ai_requests (family_id, kind) select id, 'extract' from public.families$$,
  '42501', null, 'requests cannot be inserted directly'
);
reset role;

-- 다른 가족은 따로 센다
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is(public.record_ai_request('extract'), 29, 'each family has its own limit');
reset role;

-- 가족 없는 사용자
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.record_ai_request('extract')$$, 'P0001', 'not_in_family', 'a user without a family cannot use AI');
reset role;

select * from finish();
rollback;
