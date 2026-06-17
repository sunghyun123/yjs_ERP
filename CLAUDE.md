# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm run test         # Vitest (전체)
npm run sync:whitelist  # kakao_whitelist.json → Supabase whitelist 테이블 동기화
```

단일 테스트 파일 실행:
```bash
npx vitest run src/lib/whitelist.test.ts
```

## Architecture

**Stack**: Next.js 16 · React 19 · Supabase (PostgreSQL + Auth) · Tailwind CSS v4 · shadcn/ui (Radix) · TanStack Table · Recharts · Zod · React Hook Form

**인증 흐름**: 카카오 OAuth만 지원. 로그인 후 `whitelist` 테이블에 `kakao_id`가 있어야 대시보드 진입 가능. `(dashboard)/layout.tsx`에서 매 요청마다 화이트리스트를 재확인해 퇴사자를 즉시 차단.

**Supabase 클라이언트 3종**:
- `src/lib/supabase/server.ts` — Server Component · Route Handler · Server Action용 (`await cookies()`)
- `src/lib/supabase/client.ts` — Client Component용 (`'use client'`)
- `src/lib/supabase/admin.ts` — 스크립트 전용 (service role key)

**Route 구조**:
```
src/app/
  (dashboard)/          # 인증 필요 — layout.tsx에서 보호
    page.tsx            # 대시보드 홈
    gongmu/             # 공무 관리 + 주간보고
    input/              # 투입실적 입력
    orders/             # 수주 관리
    progress/           # 공정 진행
    sales/              # 매출손익
    admin/              # clients · rates · gongmu 관리 (admin 전용)
  login/                # 카카오 로그인
  actions/auth.ts       # signOut Server Action
  auth/callback/        # OAuth 콜백
  auth/signout/         # 로그아웃 Route Handler
  api/dashboard-sync/   # 대시보드 동기화 API
```

**페이지 패턴**: Server Component(`page.tsx`)가 Supabase에서 직접 fetch → Client Component(`_components/*Client.tsx`)에 props로 전달. 뮤테이션은 `_lib/actions.ts`의 Server Action으로 처리.

**DB 타입**: `src/types/database.ts`에 수동 관리. 테이블/컬럼명이 한글(`투입실적`, `공사단가` 등). 쿼리 타입 오류는 `as any`로 캐스트하는 곳이 있음 — 신규 테이블은 `Database` 타입에 직접 추가할 것.

**화이트리스트 관리**: `kakao_whitelist.json`(gitignore)을 수정 후 `npm run sync:whitelist` 실행 → DB에 upsert/delete 반영.

## Next.js 16 주요 변경사항

- `middleware.ts` 대신 `proxy.ts` (함수명도 `proxy`)
- `cookies()` · `searchParams` · `headers()` 모두 **async** — `await` 필요
- 코드 작성 전 `node_modules/next/dist/docs/` 가이드 확인
