# 카카오 단일 로그인 + 화이트리스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ERP 로그인을 카카오 OAuth 단일 방식으로 통일하고, 카카오 화이트리스트(kakao_id)로 외부 접근을 차단한다.

**Architecture:** Supabase Auth의 Kakao 공급자로 로그인 → 콜백 라우트에서 kakao_id를 `whitelist` 테이블과 대조해 미등록자를 거부 → 통과 시 ERP 진입. 명단은 `kakao_whitelist.json`을 원본으로 동기화 스크립트가 DB에 반영(reconcile). 대시보드 레이아웃이 매 요청마다 명단 재확인.

**Tech Stack:** Next.js 16(App Router, Route Handlers), React 19, @supabase/ssr, TypeScript, Vitest, ts-node(스크립트).

설계 스펙: `docs/superpowers/specs/2026-06-16-kakao-login-design.md`

---

## 파일 구조

| 파일 | 역할 | 생성/수정 |
|---|---|---|
| `supabase/whitelist.sql` | `whitelist` 테이블 DDL + RLS 정책 (Supabase SQL 에디터에서 실행) | 생성 |
| `src/types/database.ts` | `whitelist` 테이블 타입 추가 + Row 타입 re-export | 수정 |
| `src/lib/whitelist-sync.ts` | `reconcileWhitelist()` 순수 함수 (upsert/delete 계산) | 생성 |
| `src/lib/whitelist-sync.test.ts` | reconcile 단위 테스트 | 생성 |
| `src/lib/whitelist.ts` | `extractKakaoId()`(user→kakao_id) + `getWhitelistEntry()`(DB 조회) | 생성 |
| `src/lib/whitelist.test.ts` | extractKakaoId 단위 테스트 | 생성 |
| `scripts/sync-whitelist.ts` | JSON↔DB reconcile 실행 스크립트 | 생성 |
| `package.json` | `sync:whitelist` npm 스크립트 추가 | 수정 |
| `src/app/auth/callback/route.ts` | 카카오 OAuth 콜백 → 명단 검증 → 분기 | 생성 |
| `src/app/auth/signout/route.ts` | 쿠키 정리 로그아웃(강제 차단용, 무한루프 방지) | 생성 |
| `src/app/login/KakaoLoginButton.tsx` | 카카오 로그인 시작 버튼(client) | 생성 |
| `src/app/login/page.tsx` | 로그인 화면 — 카카오 버튼 + 에러 배너 | 수정 |
| `src/app/login/LoginForm.tsx` | 기존 이메일/비번 폼 | 삭제 |
| `src/app/(dashboard)/layout.tsx` | 명단 재확인 + 표시 이름을 whitelist에서 읽기 | 수정 |

---

## Task 1: `whitelist` 테이블 생성 + 타입

**Files:**
- Create: `supabase/whitelist.sql`
- Modify: `src/types/database.ts:460` (Tables 블록 끝에 추가) 및 Row re-export 영역

- [ ] **Step 1: 테이블 DDL 파일 작성**

Create `supabase/whitelist.sql`:

```sql
-- 카카오 화이트리스트: 로그인 허용 직원 명단 (원본은 kakao_whitelist.json)
create table if not exists public.whitelist (
  kakao_id   text primary key,
  user_name  text not null,
  role       text not null default 'worker',
  updated_at timestamptz not null default now()
);

alter table public.whitelist enable row level security;

-- 로그인한 사용자(콜백/레이아웃의 세션)는 명단을 조회할 수 있어야 검증이 동작한다.
-- 동기화 스크립트는 service-role 키라 RLS를 우회하므로 별도 정책 불필요.
drop policy if exists "whitelist_select_authenticated" on public.whitelist;
create policy "whitelist_select_authenticated"
  on public.whitelist
  for select
  to authenticated
  using (true);
```

- [ ] **Step 2: Supabase에서 실행 (수동 체크포인트)**

Supabase 대시보드 → SQL Editor에 `supabase/whitelist.sql` 내용을 붙여넣고 실행.
확인: Table Editor에 `whitelist` 테이블(빈 상태)이 보이면 성공.

- [ ] **Step 3: Database 타입에 whitelist 추가**

In `src/types/database.ts`, `공무_주간보고` 테이블 블록 바로 다음(라인 460의 `}` 뒤, `Tables` 닫힘 `}` 앞)에 추가:

```ts
      whitelist: {
        Row: {
          kakao_id: string
          user_name: string
          role: string
          updated_at: string
        }
        Insert: {
          kakao_id: string
          user_name: string
          role?: string
          updated_at?: string
        }
        Update: {
          kakao_id?: string
          user_name?: string
          role?: string
          updated_at?: string
        }
      }
```

- [ ] **Step 4: Row 타입 re-export 추가**

In `src/types/database.ts`, `dashboard_공사Row` re-export 줄 근처(라인 478 부근)에 추가:

```ts
export type whitelistRow = Database['public']['Tables']['whitelist']['Row']
```

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (PASS).

- [ ] **Step 6: Commit**

```bash
git add supabase/whitelist.sql src/types/database.ts
git commit -m "feat: whitelist 테이블 DDL 및 타입 추가"
```

---

## Task 2: `reconcileWhitelist` 순수 함수 (TDD)

JSON 명단과 DB의 현재 kakao_id 목록을 비교해 upsert/삭제 대상을 계산하는 순수 함수.

**Files:**
- Create: `src/lib/whitelist-sync.ts`
- Test: `src/lib/whitelist-sync.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/whitelist-sync.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { reconcileWhitelist, type WhitelistUser } from './whitelist-sync'

const u = (kakao_id: string, user_name: string, role = 'worker'): WhitelistUser => ({
  kakao_id,
  user_name,
  role,
})

describe('reconcileWhitelist', () => {
  it('JSON의 모든 사용자를 upsert 대상으로 포함한다', () => {
    const json = [u('1', '김단후'), u('2', '김도윤')]
    const plan = reconcileWhitelist(json, [])
    expect(plan.toUpsert).toEqual(json)
    expect(plan.toDelete).toEqual([])
  })

  it('JSON에 없고 DB에만 있는 kakao_id를 삭제 대상으로 잡는다(퇴사자)', () => {
    const json = [u('1', '김단후')]
    const plan = reconcileWhitelist(json, ['1', '999'])
    expect(plan.toUpsert).toEqual(json)
    expect(plan.toDelete).toEqual(['999'])
  })

  it('DB에 이미 있는 사용자도 upsert에 포함해 정보 변경을 반영한다', () => {
    const json = [u('1', '김단후 변경')]
    const plan = reconcileWhitelist(json, ['1'])
    expect(plan.toUpsert).toEqual([u('1', '김단후 변경')])
    expect(plan.toDelete).toEqual([])
  })

  it('빈 JSON이면 DB의 모든 행을 삭제 대상으로 잡는다', () => {
    const plan = reconcileWhitelist([], ['1', '2'])
    expect(plan.toUpsert).toEqual([])
    expect(plan.toDelete).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/whitelist-sync.test.ts`
Expected: FAIL — `whitelist-sync.ts` 모듈/`reconcileWhitelist`를 찾을 수 없음.

- [ ] **Step 3: 최소 구현 작성**

Create `src/lib/whitelist-sync.ts`:

```ts
export interface WhitelistUser {
  kakao_id: string
  user_name: string
  role: string
}

export interface ReconcilePlan {
  /** JSON에 있는 사용자 전체 (upsert 시 정보 변경도 반영됨) */
  toUpsert: WhitelistUser[]
  /** DB에는 있으나 JSON에 없는 kakao_id (퇴사자 등) */
  toDelete: string[]
}

/**
 * JSON 명단을 기준으로 DB 상태를 맞추기 위한 계획을 계산한다.
 * @param jsonUsers kakao_whitelist.json에서 파싱한 사용자 목록
 * @param dbKakaoIds 현재 whitelist 테이블에 존재하는 kakao_id 목록
 */
export function reconcileWhitelist(
  jsonUsers: WhitelistUser[],
  dbKakaoIds: string[]
): ReconcilePlan {
  const jsonIds = new Set(jsonUsers.map((u) => u.kakao_id))
  const toDelete = dbKakaoIds.filter((id) => !jsonIds.has(id))
  return { toUpsert: jsonUsers, toDelete }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/whitelist-sync.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whitelist-sync.ts src/lib/whitelist-sync.test.ts
git commit -m "feat: whitelist reconcile 순수 함수 추가"
```

---

## Task 3: 동기화 스크립트 + npm 스크립트 + 초기 시드

JSON을 읽어 `whitelist` 테이블을 reconcile한다. 기존 `scripts/` 패턴(`ts-node --project scripts/tsconfig.json`, `.env.local`, service-role 키)을 따른다.

**Files:**
- Create: `scripts/sync-whitelist.ts`
- Modify: `package.json:10` (scripts 블록)

- [ ] **Step 1: 스크립트 작성**

Create `scripts/sync-whitelist.ts`:

```ts
/**
 * 카카오 화이트리스트 동기화: kakao_whitelist.json → Supabase whitelist 테이블
 * JSON 기준으로 upsert(추가/갱신) + JSON에 없는 행 삭제(퇴사자).
 *
 * 실행: npm run sync:whitelist
 *   (또는: npx ts-node --project scripts/tsconfig.json scripts/sync-whitelist.ts)
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { reconcileWhitelist, type WhitelistUser } from '../src/lib/whitelist-sync'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(SUPABASE_URL, SERVICE_KEY) as any

interface JsonUser {
  kakao_id: string | number
  user_id?: string
  user_name: string
  role: string
}

async function main() {
  // 1. JSON 읽기
  const jsonPath = path.resolve(__dirname, '..', 'kakao_whitelist.json')
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as { users: JsonUser[] }
  const jsonUsers: WhitelistUser[] = parsed.users.map((u) => ({
    kakao_id: String(u.kakao_id),
    user_name: u.user_name,
    role: u.role,
  }))

  // 2. DB 현재 상태 조회
  const { data: existing, error: selErr } = await supabase
    .from('whitelist')
    .select('kakao_id')
  if (selErr) throw selErr
  const dbIds: string[] = (existing ?? []).map((r: { kakao_id: string }) => r.kakao_id)

  // 3. 계획 계산
  const plan = reconcileWhitelist(jsonUsers, dbIds)

  // 4. upsert
  if (plan.toUpsert.length > 0) {
    const rows = plan.toUpsert.map((u) => ({ ...u, updated_at: new Date().toISOString() }))
    const { error: upErr } = await supabase
      .from('whitelist')
      .upsert(rows, { onConflict: 'kakao_id' })
    if (upErr) throw upErr
  }

  // 5. 삭제
  if (plan.toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('whitelist')
      .delete()
      .in('kakao_id', plan.toDelete)
    if (delErr) throw delErr
  }

  console.log(
    `✅ whitelist 동기화 완료: upsert ${plan.toUpsert.length}건, 삭제 ${plan.toDelete.length}건`
  )
}

main().catch((e) => {
  console.error('❌ 동기화 실패:', e)
  process.exit(1)
})
```

- [ ] **Step 2: npm 스크립트 추가**

In `package.json`, `scripts` 블록에 추가 (`"test": "vitest run"` 다음 줄):

```json
    "test": "vitest run",
    "sync:whitelist": "ts-node --project scripts/tsconfig.json scripts/sync-whitelist.ts"
```

- [ ] **Step 3: 초기 시드 실행 (수동 체크포인트 — Task 1의 테이블 생성 완료 필요)**

Run: `npm run sync:whitelist`
Expected: `✅ whitelist 동기화 완료: upsert 10건, 삭제 0건`

- [ ] **Step 4: DB 확인**

Supabase Table Editor에서 `whitelist` 테이블에 10행(조성현 admin 포함)이 들어왔는지 확인.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-whitelist.ts package.json
git commit -m "feat: 화이트리스트 동기화 스크립트 및 npm 스크립트 추가"
```

---

## Task 4: kakao_id 추출 + 명단 조회 (`whitelist.ts`)

**Files:**
- Create: `src/lib/whitelist.ts`
- Test: `src/lib/whitelist.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성 (extractKakaoId)**

Create `src/lib/whitelist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractKakaoId } from './whitelist'
import type { User } from '@supabase/supabase-js'

// 테스트용 최소 User 형태 (필요한 필드만 채운 부분 객체)
const makeUser = (partial: Partial<User>): User => partial as User

describe('extractKakaoId', () => {
  it('카카오 identity의 provider_id에서 kakao_id를 추출한다', () => {
    const user = makeUser({
      identities: [
        // @ts-expect-error 테스트용 부분 객체
        { provider: 'kakao', id: 'abc', identity_data: { provider_id: '4834516923' } },
      ],
    })
    expect(extractKakaoId(user)).toBe('4834516923')
  })

  it('provider_id가 없으면 identity_data.sub를 사용한다', () => {
    const user = makeUser({
      // @ts-expect-error 테스트용 부분 객체
      identities: [{ provider: 'kakao', id: 'abc', identity_data: { sub: '777' } }],
    })
    expect(extractKakaoId(user)).toBe('777')
  })

  it('identity_data가 비면 identity.id로 폴백한다', () => {
    const user = makeUser({
      // @ts-expect-error 테스트용 부분 객체
      identities: [{ provider: 'kakao', id: '555', identity_data: {} }],
    })
    expect(extractKakaoId(user)).toBe('555')
  })

  it('user_metadata.provider_id로도 추출한다(identity 없을 때)', () => {
    const user = makeUser({ user_metadata: { provider_id: '123' } })
    expect(extractKakaoId(user)).toBe('123')
  })

  it('카카오 정보가 전혀 없으면 null을 반환한다', () => {
    expect(extractKakaoId(makeUser({ identities: [], user_metadata: {} }))).toBeNull()
    expect(extractKakaoId(null)).toBeNull()
  })

  it('숫자로 들어와도 문자열로 정규화한다', () => {
    const user = makeUser({
      // @ts-expect-error 테스트용 부분 객체
      identities: [{ provider: 'kakao', identity_data: { provider_id: 4834516923 } }],
    })
    expect(extractKakaoId(user)).toBe('4834516923')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/whitelist.test.ts`
Expected: FAIL — `whitelist.ts`/`extractKakaoId` 없음.

- [ ] **Step 3: 구현 작성**

Create `src/lib/whitelist.ts`:

```ts
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase 인증 사용자에서 카카오 회원번호(kakao_id)를 추출한다.
 * 카카오 identity → identity_data.provider_id → sub → identity.id → user_metadata 순으로 탐색.
 */
export function extractKakaoId(user: User | null): string | null {
  if (!user) return null

  const kakaoIdentity = user.identities?.find((i) => i.provider === 'kakao')
  if (kakaoIdentity) {
    const data = (kakaoIdentity.identity_data ?? {}) as Record<string, unknown>
    const fromData = data.provider_id ?? data.sub
    if (fromData != null) return String(fromData)
    if (kakaoIdentity.id) return String(kakaoIdentity.id)
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const fromMeta = meta.provider_id ?? meta.sub
  return fromMeta != null ? String(fromMeta) : null
}

export interface WhitelistEntry {
  user_name: string
  role: string
}

/**
 * kakao_id가 화이트리스트에 있으면 해당 항목을, 없으면 null을 반환한다.
 */
export async function getWhitelistEntry(
  supabase: SupabaseClient<Database>,
  kakaoId: string
): Promise<WhitelistEntry | null> {
  const { data } = await supabase
    .from('whitelist')
    .select('user_name, role')
    .eq('kakao_id', kakaoId)
    .maybeSingle()

  return (data as WhitelistEntry | null) ?? null
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/whitelist.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add src/lib/whitelist.ts src/lib/whitelist.test.ts
git commit -m "feat: kakao_id 추출 및 화이트리스트 조회 함수 추가"
```

---

## Task 5: 카카오 OAuth 콜백 라우트

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: 콜백 라우트 작성**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractKakaoId, getWhitelistEntry } from '@/lib/whitelist'

// 카카오 OAuth 리다이렉트 콜백. code 교환 → kakao_id 추출 → 화이트리스트 검증 → 분기.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const kakaoId = extractKakaoId(user)
  if (!kakaoId) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_allowed`)
  }

  const entry = await getWhitelistEntry(supabase, kakaoId)
  if (!entry) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_allowed`)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 2: 타입 체크 + 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (실제 OAuth 동작은 Task 7·8 완료 후 통합 수동 테스트)

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat: 카카오 OAuth 콜백 라우트 + 화이트리스트 검증"
```

---

## Task 6: 로그아웃 라우트 (쿠키 정리, 강제 차단용)

서버 컴포넌트(레이아웃)에서는 쿠키를 지울 수 없어 `signOut` 후에도 세션 쿠키가 남아 무한 리다이렉트가 날 수 있다. 라우트 핸들러는 쿠키를 쓸 수 있으므로 강제 로그아웃은 이 라우트를 경유한다.

**Files:**
- Create: `src/app/auth/signout/route.ts`

- [ ] **Step 1: 로그아웃 라우트 작성**

Create `src/app/auth/signout/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 세션 쿠키를 확실히 정리하고 로그인으로 보낸다. reason=not_allowed 시 에러 배너 표시.
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const supabase = await createClient()
  await supabase.auth.signOut()

  const reason = searchParams.get('reason')
  const suffix = reason ? `?error=${reason}` : ''
  return NextResponse.redirect(`${origin}/login${suffix}`)
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/signout/route.ts
git commit -m "feat: 쿠키 정리 로그아웃 라우트 추가"
```

---

## Task 7: 카카오 로그인 버튼 + 로그인 화면

**Files:**
- Create: `src/app/login/KakaoLoginButton.tsx`
- Modify: `src/app/login/page.tsx`
- Delete: `src/app/login/LoginForm.tsx`

- [ ] **Step 1: 카카오 로그인 버튼(client) 작성**

Create `src/app/login/KakaoLoginButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function KakaoLoginButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // 성공 시 카카오로 리다이렉트되어 이 아래는 실행되지 않음
    if (error) {
      setLoading(false)
      window.location.href = '/login?error=oauth'
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ backgroundColor: '#FEE500' }}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          로그인 중...
        </>
      ) : (
        '카카오로 로그인'
      )}
    </button>
  )
}
```

- [ ] **Step 2: 로그인 페이지 수정**

Replace the contents of `src/app/login/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KakaoLoginButton } from './KakaoLoginButton'

// 이미 로그인한 경우 홈으로 보냄
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/')

  const { error } = await searchParams
  const errorMessage =
    error === 'not_allowed'
      ? '등록되지 않은 사용자입니다. 전산담당자에게 문의하세요.'
      : error
        ? '로그인이 취소되었거나 실패했습니다. 다시 시도해 주세요.'
        : null

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#f1f4fb' }}
    >
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ backgroundColor: '#1e2d5a' }}
          >
            <span className="text-white text-sm font-bold tracking-tight">YEC</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1e2d5a' }}>
            YEC ERP
          </h1>
          <p className="mt-1 text-sm text-gray-500">영전사 전기공사 ERP 시스템</p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        <KakaoLoginButton />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 기존 LoginForm 삭제**

```bash
git rm src/app/login/LoginForm.tsx
```

- [ ] **Step 4: 타입 체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음. (LoginForm을 import하던 곳이 page.tsx뿐이라 참조 깨짐 없음)

- [ ] **Step 5: Commit**

```bash
git add src/app/login/KakaoLoginButton.tsx src/app/login/page.tsx
git commit -m "feat: 카카오 로그인 버튼으로 로그인 화면 교체"
```

---

## Task 8: 대시보드 레이아웃 명단 재확인 + 표시 이름

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: 레이아웃 수정**

Replace the contents of `src/app/(dashboard)/layout.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { extractKakaoId, getWhitelistEntry } from '@/lib/whitelist'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { MobileTabBar } from '@/components/sidebar/MobileTabBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 매 요청마다 화이트리스트 재확인 (퇴사자/명단 이탈자 즉시 차단)
  const kakaoId = extractKakaoId(user)
  const entry = kakaoId ? await getWhitelistEntry(supabase, kakaoId) : null
  if (!entry) {
    // 서버 컴포넌트에선 쿠키를 못 지우므로 로그아웃 라우트를 경유 (무한루프 방지)
    redirect('/auth/signout?reason=not_allowed')
  }

  const displayName = entry.user_name

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f1f4fb' }}>
      <Sidebar userName={displayName} />
      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        {children}
      </main>
      <MobileTabBar />
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음. (`사용자Row` import 제거됨 — 더 이상 미사용)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat: 대시보드 레이아웃 화이트리스트 재확인 및 표시 이름 연동"
```

---

## Task 9: 통합 수동 검증 + 마무리

실제 카카오 OAuth는 단위 테스트 불가 → 개발 서버에서 직접 확인한다. (사전: 카카오 앱·Supabase Kakao 공급자 설정 완료됨)

- [ ] **Step 1: 전체 테스트·타입·빌드**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 모든 테스트 PASS, 타입/빌드 에러 없음.

- [ ] **Step 2: 개발 서버 기동 후 정상 로그인 (등록된 본인 계정)**

Run: `npm run dev` → 브라우저에서 `/login` 접속.
확인 순서:
1. "카카오로 로그인" 버튼만 보임 (이메일/비번 폼 없음)
2. 버튼 클릭 → 카카오 동의 → `/auth/callback` 경유 → `/`(대시보드) 진입
3. 사이드바에 화이트리스트의 `user_name`(예: "조성현")이 표시됨

- [ ] **Step 3: 미등록자 거부 검증**

`whitelist` 테이블에 없는 카카오 계정으로 로그인 시도(또는 본인 행을 임시 삭제 후 재로그인):
- `/login?error=not_allowed`로 돌아오고 "등록되지 않은 사용자입니다…" 배너 표시
- 다시 `whitelist`에 행 복구(또는 `npm run sync:whitelist`) 후 정상 로그인 확인

- [ ] **Step 4: 세션 중 명단 이탈 검증 (선택)**

로그인 상태에서 Supabase Table Editor로 본인 행 삭제 → 페이지 새로고침 → `/auth/signout` 경유로 로그아웃되고 `/login?error=not_allowed` 표시(무한루프 없음). 확인 후 행 복구.

- [ ] **Step 5: 최종 커밋 (필요 시)**

검증 중 수정이 없었다면 Task 8까지의 커밋으로 완료. 수정이 있었다면:

```bash
git add -A
git commit -m "fix: 통합 검증 중 발견한 이슈 수정"
```

---

## 검증 기준 (Definition of Done)

- `npm test` 통과 (reconcileWhitelist 4건 + extractKakaoId 6건)
- `npx tsc --noEmit` 및 `npm run build` 무에러
- 로그인 화면에 카카오 버튼만 노출, 이메일/비번 경로 완전 제거
- 등록된 카카오 계정 → 로그인 성공 + 이름 표시
- 미등록 카카오 계정 → 거부 + 안내 배너
- `npm run sync:whitelist`로 명단 추가/삭제(퇴사자) 반영 확인
