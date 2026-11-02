# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트

**Family Hub**: 부부가 자녀의 학원 일정·학원비·가족 일정을 함께 관리하는 앱. 기준 문서는 상세 PRD v1.0(2026-10-31)이다.
M1(가족 계정), M2(학원·수강 과목·반복 수업·통합 캘린더), M3(결석·휴강·일정 변경·보강), M4(학원비), M5(실시간 공유·변경 이력), M6(검증·배포 준비), 2차 여행, 3차 학교·학습, 4차 AI 도우미까지 PRD 전체가 구현되어 있다(클라우드 배포는 `docs/DEPLOY.md` 절차만 준비).
목표는 PRD 전체(1차 M1~M6, 2차 여행, 3차 학교·학습, 4차 AI)를 끝내는 것이다.

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
- **변경 이력**: `private.write_audit_log()` 트리거를 붙이면 `audit_logs` 에 행위자·이전/이후 값이 남는다. 새 도메인 테이블에도 붙인다. (자동 생성되는 `class_sessions` 는 insert 를 빼고 update/delete 만 남긴다.)
- **같은 가족끼리만 연결**: 다른 도메인 행을 참조할 때는 `(x_id, family_id)` 복합 외래키를 쓴다. 참조되는 테이블에는 `unique (id, family_id)` 를 둔다.

### 수업 일정 모델 (M2)

- `enrollments`(자녀 × 학원 × 과목, 기간) → `class_rules`(요일·시각, 유효 기간) → `class_sessions`(날짜별 회차, 상태).
- 회차는 **실제 행**이다. 결석·보강(M3), 회차별 학원비(M4)가 회차 단위로 움직인다.
- 정규 회차는 `private.generate_sessions_between()` 이 규칙에서 만든다. `(rule_id, session_date)` 유일 인덱스와 `on conflict do nothing` 으로 몇 번을 불러도 같다.
  - 수강 등록 때 3개월 뒤 달 말일까지 만들고, 캘린더 조회 때 `ensure_sessions_until(보는 범위 끝)` 으로 오늘 이후만 이어서 만든다(최대 400일).
- **규칙에서 만든 회차의 `session_date` 는 바꾸지 않는다.** 바꾸면 다시 만들 때 원래 날짜 회차가 또 생긴다.
- 지난 회차는 지우지 않는다. 수강을 그만두면 `end_enrollment` 로 종료한다. 종료일을 과거로 잡아도 **오늘 이후의 손대지 않은 정규**(`kind = 'regular'`, `status = 'scheduled'`) 회차만 지운다. 종료일을 늦추면 오늘부터만 다시 만든다.
- `delete_enrollment` 는 지난 회차도, 사람이 바꾼 회차(상태 변경·보강·변경)도 없을 때만 된다.

### 회차 변경 모델 (M3)

- `class_sessions.kind`: `regular`(규칙) / `makeup`(보강) / `rescheduled`(이번만 다른 날). 보강·변경은 `origin_session_id` 로 원 회차와 연결한다. 정규만 `rule_id` 를 가진다(체크 제약).
- 원 회차 하나에 살아 있는(취소 아닌) 보강·변경은 **하나뿐**이다(부분 유일 인덱스). 학원비(M4)는 이 연결로 중복·누락을 판단한다.
- 상태는 `set_session_status` RPC 로만 바꾼다. 보강은 `makeup_scheduled/makeup_completed/cancelled`, 나머지는 `scheduled/completed/absent/academy_cancelled/cancelled`. 살아 있는 보강·변경이 있으면 원 회차를 `scheduled/completed` 로 되돌릴 수 없다.
- **이번만 변경**(`reschedule_session`): 같은 날 시간만 바꾸면 그 회차를 고친다. 정규 회차를 다른 날로 옮기면 원 회차는 `cancelled`, 새 `rescheduled` 회차를 만든다(앱은 새 회차 화면으로 이동).
- **앞으로 전체 변경**(`change_schedule_from`): 기준일(오늘 ~ +400일) 전날까지 기존 규칙을 끝내고 새 규칙을 넣는다.
  - "손대지 않은 회차" = `kind = 'regular' and status = 'scheduled' and version = 1`. 이것만 지우고 다시 만든다. 메모·시간 변경·상태 변경한 회차는 남는다.
  - `generate_sessions_between` 은 그날 이미 **끝난(또는 지워진) 규칙의 정규 회차**가 있으면 건너뛴다. 남긴 회차와 새 회차가 겹치지 않게 하는 장치다.
  - 수강 과목당 규칙은 60개까지(`too_many_schedule_changes`).
- 수강 종료 때도 손대지 않은 회차만 지우고, 손댄 미래 정규 회차는 `cancelled` 로 남긴다.
- 원 회차 FK(`origin_session_id`)는 cascade 하지 않는다. 보강·변경 이력이 원 회차와 함께 사라지면 안 된다.
- 알려진 미처리(LOW): 같은 자녀의 시간 겹침 검사 없음, 미래 회차를 `completed` 로 표시 가능, 메모 저장은 version 검사를 거치지 않을 수 있음(직접 update).
- **보강 대기**: `makeup_waitlist` 뷰(security_invoker, RLS 적용) = 결석·휴강 + 살아 있는 보강 없음 + `makeup_waived = false`.
- 회차 RPC 는 화면이 읽은 `version` 을 받는다. 다르면 `session_conflict` 를 던지고, 앱은 `conflict()` 로 처리한다.
- 메모(`note`)만 직접 update 할 수 있다(컬럼 권한).
- 진행 중 수강 과목은 가족당 30개, 시작일은 오늘 기준 -366 ~ +400일. 앱 검증(`education/schemas.ts`)과 DB 상수를 같이 바꾼다.
- 날짜는 서울 기준 `date`/`time`. DB는 `private.family_today()`, 앱은 `src/lib/dates.ts` (`"YYYY-MM-DD"` 문자열). 서버 컴포넌트에서 오늘 날짜는 `requestToday()` 로 얻는다.
- 서버 액션은 `FormState`(`src/lib/form-state.ts`)를 돌려주고 클라이언트는 `useActionState` 로 받는다. 검증은 항상 서버 액션 안에서 zod로 한다.

### 학원비 모델 (M4)

- 청구 단위는 **수강 과목 × 월**(사용자 결정). 화면에서만 학원별로 묶는다.
- `tuition_policies`: 적용 시작 월별 정책(월정액/회차별/수동, 결석·휴강 청구 여부, 결제일). 어떤 달에는 그 달 이전에 시작한 가장 최근 정책을 쓴다. 저장은 `save_tuition_policy` (같은 월이면 덮어씀).
- 예상액은 저장하지 않는다. `tuition_estimates(월)`, `tuition_session_breakdown(과목, 월)` 이 정책과 회차로 그때그때 계산한다(security invoker → RLS).
- **청구 규칙(`private.session_billable`)**: 원 수업 1건당 한 번만 청구. 예정·완료 청구, 결석·휴강은 정책 플래그, 취소 미청구, 보강은 원 수업이 청구되지 않았을 때만 청구(결석 청구면 결석 보강 무료). 다른 날로 옮긴 수업은 원 회차가 취소이므로 옮긴 회차만 청구.
- `tuition_invoices` 는 확정 순간의 스냅샷(방식, 단가, 회차 수, 예상액, 기본 청구액). **일정이 바뀌어도 자동으로 바뀌지 않는다.** 앱은 `estimateChanged()` 로 차이를 알리고, 사용자가 `adjust_invoice` 를 불러야 바뀐다(스냅샷도 그때 갱신).
- 합계·납부·잔액은 `tuition_invoice_summaries` 뷰. 추가·할인 항목과 납부는 직접 insert/delete(RLS), 바뀌면 `private.touch_invoice` 가 청구서 version 을 올린다.
- 납부 기록이 있으면 확정 취소 불가, 청구서가 있으면 수강 과목 삭제 불가. 금액은 원 단위 정수(`src/lib/money.ts`).
- 회차별 청구 여부는 `private.billed_sessions` 한 곳에서 계산한다. 결석·휴강 판단 정책은 **청구 기준 월**(보강이면 원 수업의 달)의 정책. 수강 종료일 뒤의 정규 회차는 세지 않는다. 합계는 bigint.
- 상한: 청구서당 추가·할인 20개, 납부 50개(트리거). 할인으로 합계가 음수가 될 수 없다.
- 알려진 미처리: 정책 저장(`save_tuition_policy`)은 version 검사 없이 같은 달 정책을 덮어쓴다.

### 실시간 공유·변경 이력 (M5)

- `audit_logs` 하나만 Realtime publication 에 넣었다. 의미 있는 변경은 모두 이력 한 줄을 남기므로, 브라우저는 `RealtimeRefresher` 로 가족의 이력 insert 를 받아 배우자 변경일 때 `router.refresh()` 한다. Realtime 은 구독자의 RLS 로 거른다.
- 브라우저 클라이언트(`src/lib/supabase/client.ts`)는 세션을 늦게 읽는다. 구독 전에 `auth.getSession()` → `realtime.setAuth(token)` 을 해야 한다. 안 하면 익명으로 취급되어 "invalid column for filter" 로 거절된다.
- 이력 문장은 `src/features/history/describe.ts` 가 만든다. 자동 생성 회차, 규칙 삽입, 일정 변경으로 지워진 회차, 청구서 version 만 오른 기록은 숨긴다. 새 테이블에 audit 트리거를 붙이면 여기 문장도 추가한다.

### 여행 (2차)

- `trips`(기간 최대 60일, 전체 예산) → `trip_items`(날짜별 일정·장소, 여행 기간 밖이면 `invalid_trip_day`), `trip_budgets`(분류별 예산, 분류당 1행), `trip_expenses`(실제 지출, 여행 전 예약도 기록).
- 합계는 `trip_summaries`, 분류별 비교는 `trip_category_totals` 뷰. 여행 기간을 줄여 일정이 밖에 남으면 `trip_items_outside`.
- 통합: 캘린더(`getTripsBetween` → 월간 칸 표시, 날짜 목록 `TripAgenda`), 월별 비용(`/costs` = 교육비 + 지출일 기준 여행비).
- 아래 탭은 홈·캘린더·교육·여행·비용·관리. 교육비 화면(`/tuition`)은 비용 탭, 가족 화면(`/family`)은 관리 탭 아래에 있다.
- 학원은 관리 탭(`/manage`)에서 추가하고, 수강 과목은 학원 상세(`/manage/academies/[id]`) 안에서 추가한다. 교육 탭은 수강 과목 보기·보강 대기·일정 변경만 맡는다.

### 학교·학습 (3차)

- `school_events`(학사일정·행사·과제·시험·휴업, 여러 날 가능, 시험 점수, 과제 완료) + `school_event_items`(준비물 체크리스트). 요약 뷰 `school_event_summaries` 가 미준비 준비물 수를 준다.
- `study_subjects`(자녀별 과목·교재·목표, 자녀당 이름 유일) + `study_logs`(날짜·분·진도 단원·진도%·내용). `study_subject_summaries` 가 최근 진도와 총 학습 시간을 준다.
- 교육 탭 안에 학원·학교·학습 하위 메뉴(`EducationTabs`). 학교 일정은 캘린더(보라색 표시, `SchoolAgenda`)와 홈 "다가오는 학교 일정"에 함께 보인다.

### AI 도우미 (4차)

- **AI 는 제안만 한다(PRD).** 가정통신문·학원 공지(글·사진)에서 일정 후보를 뽑아 화면에 돌려줄 뿐 저장하지 않는다. 부모가 고치고 고른 항목만 `registerSuggestionsAction` 이 다시 zod 로 검증해 `school_events` 에 넣는다. 학원 휴강·보강 등은 "직접 확인할 것"으로만 보여 주고 수업·학원비를 바꾸지 않는다.
- 호출은 `src/features/ai/claude.ts` 한 곳: `-ai/sdk` 의 `beta.messages.parse` + `betaZodOutputFormat`(구조화 출력), 모델 `claude-opus-5-5`, 거절 시 서버 측 대체(`fallbacks: "default"`), `stop_reason: "refusal"`·타입별 예외를 사용자 메시지로 바꾼다. 추출은 effort `low`, 분석은 `medium`.
- `ANTHROPIC_API_KEY`(서버 전용)가 없으면 AI 화면은 꺼짐 안내만 보인다. `FAMILY_HUB_FAKE_AI=1` 은 E2E 전용 가짜 구현(API 미호출)이며 키가 없을 때만 켜진다(실제 키가 항상 우선).
- 부모가 고른 제안은 `create_school_events` RPC 로 한 트랜잭션에 저장한다. 업로드 사진은 파일 시그니처로 형식을 판단하고 3.5MB 까지 받는다(서버 액션 본문 한도 5MB, `next.config.ts`).
- 비용 상한: `record_ai_request` RPC 가 가족당 하루 30회를 원자적으로 센다. AI 를 부르기 전에 반드시 호출한다.
- 지출 분석에는 월별 합계와 "자녀 과목" 이름만 보낸다.

### Next.js 16 / Cache Components 주의점

- `cookies()`, `params`, `searchParams` 를 읽는 컴포넌트는 `<Suspense>` 안에 둔다. 페이지는 정적 껍데기 + Suspense 안의 데이터 컴포넌트로 나눈다. 레이아웃 최상단에서 세션을 await 하지 않는다.
- Suspense fallback 에 **입력 가능한 폼을 두지 않는다.** 실제 폼으로 교체될 때 입력값이 사라진다. 로그인·가입 페이지는 이 때문에 정적으로 두고 `?next=` 를 제출 순간 `window.location` 에서 읽는다.
- Partial Prefetching 프리렌더가 끝나면 Next가 진행 중인 fetch를 거절하는데, supabase-js는 이를 `{ error }` 로 바꿔 버린다. `src/lib/supabase/server.ts` 의 `prerenderSafeFetch` 가 이를 막는다. 서버용 Supabase 클라이언트는 반드시 `createClient()` 로 만든다.
- 서버 컴포넌트에서 `new Date()` 를 요청 데이터 없이 먼저 쓰면 빌드가 실패한다. `requestToday()`(`connection()` 후 날짜)를 쓴다.
- 클라이언트 컴포넌트의 `usePathname()` 도 동적 경로에서는 `<Suspense>` 안에 있어야 빌드된다(아래 탭 바 참고).
- 방문한 화면이 숨겨진 채(React Activity) DOM에 남는다. E2E에서는 `getByLabel` 대신 숨은 요소를 무시하는 `getByRole` 을 쓰고, `getByText` 는 `.filter({ visible: true })` 를 붙인다. 탭 이동은 주소 변경까지 기다리는 `goToTab()`, 카드는 보이는 것만 찾는 `card()` 를 쓴다(`e2e/helpers.ts`).
- 성공하면 폼이 있던 카드가 사라지는 동작(예: 다른 날로 옮기기)은 결과 메시지도 사라진다. 그럴 때는 결과 화면으로 `redirect` 한다.
- `"use server"` 파일에서 export 한 async 함수는 모두 외부에서 호출 가능한 엔드포인트가 된다. 헬퍼는 `queries.ts` 같은 서버 전용 모듈에 둔다.

## 범위와 순서

1차 범위는 학원 관리다. 여행은 2차, 학교·학습은 3차, AI는 4차다. 나중에 붙이기 쉽도록 데이터 구조를 설계한다.

- M1: 가족 계정 ✅
- M2: 학원·수강 과목·반복 수업, 통합 캘린더 ✅ (가족 공통 일정 `calendar_events` 는 아직 없음)
- M3: 결석·휴강·시간 변경·보강 연결 ✅
- M4: 학원비 정책, 월별 계산, 청구 확정, 납부 ✅
- M5: 변경 이력 화면, 실시간 동기화, 홈 대시보드 ✅
- M6: 접근 권한 검증, 계산 테스트, 모바일 실사용 테스트, 배포 준비 ✅ (`docs/ACCEPTANCE.md`, `docs/DEPLOY.md`)

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
