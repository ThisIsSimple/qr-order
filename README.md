# QR 대기열 관리 서비스

QR 코드를 스캔해 손님이 직접 대기 등록하고, 매장이 실시간으로 대기열을 운영하는 SaaS. pnpm + Turborepo 모노레포.

## 구성

| 경로 | 설명 |
|---|---|
| `apps/web` | 홈페이지(랜딩·로그인·구독) + 손님 대기 등록 `/q/[storeCode]` — 포트 3000 |
| `apps/admin` | 매장 관리자 대기열 대시보드 — 포트 3001 |
| `supabase` | 백엔드: DB 마이그레이션·RLS·Edge Functions·seed |
| `packages/ui` | 공유 디자인 시스템 (Tailwind + shadcn 스타일) |
| `packages/db` | Supabase 클라이언트 래퍼 + 생성된 DB 타입 |
| `packages/types` | 도메인 타입 + Zod 스키마 (앱·엣지펑션 공유) |
| `packages/config` | 공유 tsconfig / eslint / tailwind preset |

## 시작하기

```bash
pnpm install
cp .env.example .env          # 로컬 Supabase 키로 채우기
pnpm db:start                 # 로컬 Supabase (Docker 필요)
pnpm dev                      # web(3000) + admin(3001) 동시 실행
```

## 스크립트

- `pnpm dev` — 모든 앱 개발 서버
- `pnpm build` / `pnpm lint` / `pnpm typecheck` — Turborepo 태스크
- `pnpm db:start` / `pnpm db:reset` / `pnpm db:types` — 로컬 DB & 타입 생성

기획안: `/Users/cordelia273/.claude/plans/qr-expressive-stallman.md`
