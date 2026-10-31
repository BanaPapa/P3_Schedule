-- M5: 실시간 공유
-- 의미 있는 변경은 모두 audit_logs 에 한 줄씩 남는다. 이 테이블 하나만 Realtime 으로 내보내
-- 배우자 화면이 새로고침하게 한다. 자동 생성 회차 같은 대량 변경은 audit 에 남지 않으므로 클라이언트에 쏟아지지 않는다.
-- Realtime 의 postgres_changes 는 구독자 권한으로 RLS("members read audit logs")를 적용한다.

alter publication supabase_realtime add table public.audit_logs;
