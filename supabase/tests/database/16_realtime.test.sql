-- M5: 실시간 공유 — 변경 이력(audit_logs)만 Realtime 으로 내보낸다
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(
  (select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'audit_logs'),
  1, 'audit logs are published to realtime'
);
select is(
  (select count(*)::int from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename <> 'audit_logs'),
  0, 'no other table is published (generated sessions would flood clients)'
);
-- Realtime 은 구독자의 RLS 로 거른다. 읽기 정책이 있어야 다른 가족 이력이 새지 않는다.
select ok(
  exists (select 1 from pg_policies where tablename = 'audit_logs' and cmd = 'SELECT'),
  'audit logs keep a select policy for realtime filtering'
);

select * from finish();
rollback;
