# 배포 (Supabase + Vercel)

로컬은 `pnpm db:start` 로 충분하다. 실제 사용하려면 Supabase 클라우드 프로젝트와 Vercel 이 필요하다.

## 1. Supabase 프로젝트

1. Supabase 대시보드에서 새 프로젝트를 만든다(리전: Northeast Asia (Seoul) 권장).
2. 로컬 저장소를 연결하고 마이그레이션을 올린다.
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push            # supabase/migrations/* 적용
   ```
3. Authentication 설정
   - **Email 확인 켜기** (Confirm email). 끄면 가입 화면이 "이미 가입된 이메일"을 알려 줘 계정 존재 여부가 드러난다.
   - Site URL: `https://<배포 주소>`
   - Redirect URLs: `https://<배포 주소>/auth/confirm`
   - 이메일 템플릿 "Confirm signup" 의 링크를 다음으로 바꾼다(앱의 `/auth/confirm` 이 토큰을 확인한다).
     ```
     {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup
     ```
     `RedirectTo` 는 앱이 `https://<배포 주소>/auth/confirm?next=…` 로 넘긴다.
   - 운영 메일 발송량이 많아지면 SMTP(예: Resend)를 연결한다. 기본 메일은 시간당 발송 수가 적다.
4. Realtime: 마이그레이션이 `audit_logs` 를 publication 에 넣으므로 따로 할 일은 없다.

## 2. Vercel

1. GitHub 저장소를 Vercel 에 Import 한다(Framework: Next.js, 빌드 명령 기본값).
2. 환경 변수
   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_…`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<배포 주소>` — 초대 링크·가입 확인 링크를 이 주소로 만든다. 운영에서는 꼭 넣는다. |
   | `ANTHROPIC_API_KEY` | (선택) AI 도우미용 Anthropic API 키. 서버에서만 쓰인다. 없으면 AI 화면이 꺼진다. |
3. 배포 후 확인
   - `/manifest.webmanifest`, `/icon/large` 가 로그인 없이 열리는지
   - 가입 → 확인 메일 → 링크로 로그인 → 가족 만들기 → 초대 링크로 배우자 합류
   - 두 휴대폰에서 한쪽이 바꾼 내용이 다른 쪽에 바로 보이는지

## 3. 운영 중 주의

- `FAMILY_HUB_FAKE_AI` 는 E2E 테스트 전용이다(실제 키가 있으면 무시된다). 운영 환경 변수에 넣지 않는다.
- AI 사용량은 가족당 하루 30회(`record_ai_request`). 비용 상한을 바꾸려면 마이그레이션 상수를 바꾼다.
- 서비스 키(`service_role`, `sb_secret_…`)는 앱에 쓰지 않는다. 모든 접근은 로그인한 사용자 권한 + RLS 로 한다.
- 스키마를 바꿀 때는 새 마이그레이션 파일을 추가하고 `pnpm test:db` 를 통과시킨 뒤 `supabase db push`.
- 로그인 세션 토큰 만료(기본 1시간) 전까지는 로그아웃해도 이미 발급된 토큰이 유효하다(Supabase 기본 동작).
