# Family Hub

부부가 함께 쓰는 가족 통합 생활관리 앱입니다. 자녀의 학원 일정과 교육비를 중심으로 시작합니다.

## 로컬 실행

필요한 것: Node 24, pnpm 10, Docker Desktop

```bash
pnpm install
pnpm db:start                 # 로컬 Supabase (처음엔 이미지 다운로드로 몇 분 걸림)
cp .env.example .env.local    # pnpm exec supabase status 의 API_URL, PUBLISHABLE_KEY 를 채운다
pnpm dev                      # http://localhost:3000
```

로컬 Supabase는 이메일 인증이 꺼져 있어 가입하면 바로 로그인됩니다. 보낸 메일은 Mailpit(http://127.0.0.1:54324)에서 볼 수 있습니다.

## 테스트

```bash
pnpm test        # 단위
pnpm test:db     # DB 권한(RLS)·RPC
pnpm test:e2e    # 브라우저 시나리오 (로컬 Supabase 필요)
```

개발 규칙과 구조는 [CLAUDE.md](./CLAUDE.md)에 있습니다.
