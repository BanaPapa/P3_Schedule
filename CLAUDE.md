# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트

**Family Hub**: 부부가 자녀의 학원 일정·학원비·가족 일정을 함께 관리하는 앱. 기준 문서는 상세 PRD v1.0(2026-10-31)이다.
M1(가족 계정: 로그인, 가족 생성, 배우자 초대, 자녀 프로필)까지 구현되어 있다.

## 기술 스택

- Next.js 16 (App Router, `cacheComponents`, `partialPrefetching` 켜짐) + React 19 + TypeScript + Tailwind CSS v4
- Supabase: PostgreSQL, Auth(이메일+비밀번호), 나중에 Realtime. `@supabase/ssr` 로 쿠키 세션
- zod 4로 입력 검증, Vitest(단위), pgTAP(DB/RLS), Playwright(E2E)
- 배포는 Vercel 예정. 모바일 웹 + PWA로 시작한다.

## 명령어

로컬 Supabase(Docker 필요)를 먼저 띄운다. `.env.local` 은 `.env.example` 을 보고 `pnpm exec supabase status` 값으로 채운다.

```bash
pnpm db:start            # 로컬 Supabase 시작 (Studio: http://127.0.0.1:54323)
pnpm db:reset            # 마이그레이션을 처음부터 다시 적용
pnpm db:types            # DB 스키마 → src/lib/supabase/database.types.ts (마이그레이션 후 반드시 실행)
pnpm dev                 # 개발 서버 (http://localhost:3000)

pnpm lint
pnpm typecheck           # next typegen 후 tsc (라우트 타입 PageProps<"/x"> 생성 포함)
pnpm test                # Vitest 단위 테스트
pnpm test -- src/lib/routes.test.ts      # 파일 하나
pnpm test -- -t "safeNextPath"           # 이름으로 하나
pnpm test:coverage       # 80% 기준 (src/lib, features/**/schemas·format)
pnpm test:db             # pgTAP: supabase/tests/database/*.test.sql
pnpm test:e2e            # Playwright: build 후 3100 포트에서 실행. 로컬 Supabase 필요
pnpm exec playwright test -g "invite link"   # E2E 하나
```

pgTAP 파일은 `begin` 직후 `truncate public.families, public.audit_logs cascade;` 로 시작한다. 로컬 DB에 남은 개발·E2E 데이터와 섞이지 않게 하기 위해서이며, 끝에서 rollback 된다. 사용자 흉내는 `set_config('request.jwt.claims', ...)` + `set local role authenticated` 로 한다.

E2E는 3100 포트에 이미 떠 있는 서버를 재사용한다(`reuseExistingServer`). 코드를 바꿨는데 결과가 그대로면 3100 포트의 오래된 서버를 먼저 끈다.

## 구조

- `supabase/migrations/` — 스키마의 진실. 테이블, RLS, 컬럼 권한, RPC가 모두 여기 있다.
- `src/proxy.ts` → `src/lib/supabase/proxy.ts` — 요청마다 세션 갱신, 로그인 여부로 리다이렉트(`src/lib/routes.ts` 의 `resolveRouteAccess`)
- `src/features/<도메인>/` — `schemas.ts`(zod), `actions.ts`(서버 액션), `queries.ts`(서버 전용 조회 = 데이터 접근 계층), `components/`
- `src/lib/` — 도메인과 무관한 순수 로직(경로, 오류 메시지, 폼 상태, 초대 URL). 단위 테스트 대상.
- `src/app/(auth)` 로그인·가입, `src/app/(app)` 로그인 후 화면(헤더 포함), `onboarding`, `invite/[code]`

### 데이터 흐름 규칙

- **격리는 DB가 한다.** 모든 테이블에 RLS가 있고 `private.is_family_member(family_id)` 로 판정한다. 앱 코드에서 family_id로 거르는 것은 보조일 뿐이다.
- **클라이언트 권한은 컬럼 단위다.** `revoke all` 후 바꿔도 되는 컬럼만 `grant update (...)` 한다. `family_id`, `role`, `version` 은 클라이언트가 못 바꾼다. 새 테이블도 같은 방식으로 만든다.
- **아직 구성원이 아닌 사람의 일**(가족 생성, 초대 조회·수락)은 `security definer` RPC로만 한다. `set search_path = ''`, 스키마를 붙인 이름, `anon` 실행 권한 회수를 지킨다.
- **RPC 오류**는 `raise exception '<code>'`(SQLSTATE P0001)로 던지고, 같은 코드를 `src/lib/errors.ts` 의 `ERROR_MESSAGES` 에 한국어로 등록한다.
- **동시 수정 감지**: 수정 가능한 테이블은 `version` 컬럼과 `private.bump_version()` 트리거를 둔다. 화면이 읽은 version을 hidden input으로 보내고 `.eq("version", v)` 로 저장한다. 0행이면 `conflict()` 를 돌려주고, 화면은 편집을 닫고 최신 값 위에 메시지를 보여준다.
- **변경 이력**: `private.write_audit_log()` 트리거를 붙이면 `audit_logs` 에 행위자·이전/이후 값이 남는다. 새 도메인 테이블에도 붙인다.
- 서버 액션은 `FormState`(`src/lib/form-state.ts`)를 돌려주고 클라이언트는 `useActionState` 로 받는다. 검증은 항상 서버 액션 안에서 zod로 한다.

### Next.js 16 / Cache Components 주의점

- `cookies()`, `params`, `searchParams` 를 읽는 컴포넌트는 `<Suspense>` 안에 둔다. 페이지는 정적 껍데기 + Suspense 안의 데이터 컴포넌트로 나눈다. 레이아웃 최상단에서 세션을 await 하지 않는다.
- Suspense fallback 에 **입력 가능한 폼을 두지 않는다.** 실제 폼으로 교체될 때 입력값이 사라진다. 로그인·가입 페이지는 이 때문에 정적으로 두고 `?next=` 를 제출 순간 `window.location` 에서 읽는다.
- Partial Prefetching 프리렌더가 끝나면 Next가 진행 중인 fetch를 거절하는데, supabase-js는 이를 `{ error }` 로 바꿔 버린다. `src/lib/supabase/server.ts` 의 `prerenderSafeFetch` 가 이를 막는다. 서버용 Supabase 클라이언트는 반드시 `createClient()` 로 만든다.
- 방문한 화면이 숨겨진 채(React Activity) DOM에 남는다. E2E에서는 `getByLabel` 대신 숨은 요소를 무시하는 `getByRole` 을 쓰고, 화면 전환을 기다린 뒤 입력한다.
- `"use server"` 파일에서 export 한 async 함수는 모두 외부에서 호출 가능한 엔드포인트가 된다. 헬퍼는 `queries.ts` 같은 서버 전용 모듈에 둔다.

## 범위와 순서

1차 범위는 학원 관리다. 여행은 2차, 학교·학습은 3차, AI는 4차다. 나중에 붙이기 쉽도록 데이터 구조를 설계한다.

- M1: 가족 계정 ✅
- M2: 학원·수강 과목·반복 수업, 통합 캘린더
- M3: 결석·휴강·시간 변경·보강 연결
- M4: 학원비 정책, 월별 계산, 청구 확정, 납부
- M5: 변경 이력 화면, 실시간 동기화, 홈 대시보드
- M6: 접근 권한 검증, 계산 테스트, 모바일 실사용 테스트, 배포

1차 화면은 홈 / 캘린더 / 교육 / 교육비 네 개다.

## 도메인 규칙 (PRD 인수 테스트에 포함)

- 원칙: 기능은 분리하되 데이터는 연결한다. 일정은 통합 캘린더 하나, 비용은 통합 비용 관리 하나로 모은다. 수업 회차에서 학원·자녀·학원비 정책까지 따라갈 수 있어야 한다.
- 가족당 부모는 최대 2명(`c_max_parents`), 한 사용자는 한 가족에만 속한다. 초대는 1회용, 7일 만료, 가족당 열린 초대 1개.
- 수업 상태: 예정, 완료, 결석, 휴강, 취소, 보강 예정, 보강 완료.
- 보강은 원래 수업 회차와 연결한다. 무료 보강은 학원비에 다시 계산하지 않는다.
- 반복 수업 수정은 "이번 수업만"과 "앞으로 전체" 중에서 고른다. 지난 회차 이력은 바뀌면 안 된다.
- 학원비 방식: 월정액, 회차별(청구 대상 횟수 × 회당 금액), 추가·할인, 수동 조정. 학원마다 다르므로 코드에 박지 말고 정책 데이터로 둔다.
- 비용은 예상 학원비 / 확정 청구액 / 실제 납부액 / 미납 잔액으로 나눈다. 부분 납부 지원.
- **확정 청구액은 자동으로 바뀌지 않는다.** 일정이 바뀌면 예상액만 다시 계산하고, 확정액은 사용자가 확인한 뒤 조정한다.
- AI 기능(4차)은 제안만 하고 일정·학원비를 직접 확정하지 않는다.
