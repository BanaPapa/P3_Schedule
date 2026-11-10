# PRD 인수 기준 ↔ 자동 테스트

PRD 10장 "개발 완료 기준"의 상황별 질문을 어떤 자동 테스트가 확인하는지 정리한다.
`pnpm test`(Vitest), `pnpm test:e2e`(Playwright, 모바일 화면)로 돌린다. pgTAP(`supabase/tests/database/`)은 파일만 남아 있고 운영 DB에서는 돌리지 않는다(테스트가 `truncate` 로 시작한다).

| PRD 질문 | 확인하는 테스트 |
|---|---|
| 배우자가 수정한 일정이 내 계정에도 반영되는가? | E2E `realtime-history.spec.ts` (다시 불러오지 않아도 반영), `family-onboarding.spec.ts` (배우자 수정이 보임), pgTAP `03_children` |
| 정규 수업을 변경해도 기존 수업 이력이 유지되는가? | pgTAP `12_schedule_change`, `13_session_review_fixes` (메모·결석·이동한 회차 보존, 중복 없음), E2E `session-changes.spec.ts` |
| 결석 수업과 보강 수업이 정확히 연결되는가? | pgTAP `11_makeup_and_reschedule` (원 회차 연결, 살아 있는 보강 1개), E2E `session-changes.spec.ts` (PRD 5장 시나리오 그대로) |
| 무료 보강이 학원비에 중복 계산되지 않는가? | pgTAP `14_tuition_estimate` (결석 청구 시 결석 보강 무료, 휴강 미청구 시 휴강 보강 청구), `17_tuition_review_fixes` (달을 넘긴 보강) |
| 부분 납부를 정확히 계산하는가? | pgTAP `15_tuition_invoice` (잔액 = 합계 − 납부), E2E `tuition.spec.ts` |
| 이미 확정한 청구 금액이 임의로 바뀌지 않는가? | pgTAP `15_tuition_invoice` (일정 변경 후에도 확정액 유지, 직접 수정 차단, 조정은 RPC로만), E2E `tuition.spec.ts` |
| 두 사람이 동시에 같은 일정을 수정하면 충돌을 감지하는가? | pgTAP `04_versioning_and_audit`, `10_session_status` (오래된 version 거절), E2E `family-onboarding.spec.ts` (충돌 안내) |
| 다른 가족 계정에서 우리 가족 정보를 볼 수 없도록 보호되는가? | 모든 pgTAP 파일의 "other family" 검사(가족·자녀·학원·수강·회차·청구·납부·이력), `16_realtime` (실시간 이벤트도 RLS), E2E `education-calendar.spec.ts` (다른 가족 자녀 id 무시) |

## 추가로 확인하는 것

| 항목 | 테스트 |
|---|---|
| 초대 링크 1회용·만료·정원 2명 | pgTAP `02_invitations`, `05_permission_edges`, E2E `family-onboarding.spec.ts` |
| 로그인 후 외부 사이트로 튀는 링크 차단 | Vitest `routes.test.ts` |
| 휴대폰 설치(PWA)·보안 헤더 | E2E `pwa-and-headers.spec.ts` |
| 회차 생성 범위·개수 상한(과도한 생성 방지) | pgTAP `08_enrollment_history`, `09_enrollment_review_fixes` |

## 사람이 확인할 것 (자동화하지 않음)

- 실제 휴대폰(iOS Safari, Android Chrome)에서 홈 화면에 추가 후 사용
- 운영 메일 발송: 가입 확인 메일이 도착하고 링크로 로그인되는지 (`docs/DEPLOY.md` 의 메일 템플릿 설정 후)
- 실제 학원 정책(결석·휴강·보강 청구 규칙)이 요금 정책 설정으로 표현되는지 가족이 직접 확인
