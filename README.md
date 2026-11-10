# Family Hub

부부가 함께 쓰는 가족 통합 생활관리 앱입니다. 자녀의 학원 일정과 교육비를 중심으로 시작합니다.

## 로컬 실행

필요한 것: Node 24, pnpm 10, 원격 Supabase 프로젝트

```bash
pnpm install
cp .env.example .env.local    # 원격 Supabase 프로젝트의 URL, publishable key 를 채운다
pnpm dev                      # http://localhost:3000
```

데이터베이스는 원격 Supabase 프로젝트를 쓴다. 마이그레이션(`supabase/migrations/`)은 `pnpm exec supabase link --project-ref <project-ref>` 후 `pnpm exec supabase db push`(또는 대시보드 SQL Editor)로 적용한다.

## 테스트

```bash
pnpm test        # 단위
pnpm test:e2e    # 브라우저 시나리오 (.env.local 의 원격 Supabase 를 사용 — 데이터가 남으니 신중히)
```

개발 규칙과 구조는 [CLAUDE.md](./CLAUDE.md)에 있습니다.
