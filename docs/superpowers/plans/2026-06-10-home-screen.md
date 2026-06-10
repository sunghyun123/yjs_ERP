# 홈 화면 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면 KPI 카드에서 계획금액을 제거하고 전월대비 성과금액을 추가하며, 진행중 공사 현황을 "ERP 미입력 공사" 섹션으로 교체한다.

**Architecture:** 외부 대시보드(www.yjsboard.com)가 `POST /api/dashboard-sync`로 공사 목록을 전송하면 `dashboard_공사` 테이블에 누적 저장된다. 홈 서버 컴포넌트가 이 테이블을 읽어 ERP 등록 여부(공사이력 AND 투입실적)를 확인하고 상태 표시와 빠른 입력 버튼을 렌더링한다.

**Tech Stack:** Next.js 16 (App Router), Supabase (`@supabase/ssr`, `@supabase/supabase-js`), TypeScript, Tailwind CSS, shadcn/ui

---

## 파일 구조

| 액션 | 경로 | 역할 |
|---|---|---|
| Create | `src/app/api/dashboard-sync/route.ts` | POST API 엔드포인트 |
| Create | `src/lib/supabase/admin.ts` | 서비스 롤 Supabase 클라이언트 |
| Modify | `src/types/database.ts` | dashboard_공사 타입 추가 |
| Modify | `src/app/(dashboard)/_components/KpiCards.tsx` | 계획금액 제거, 전월대비 추가 |
| Create | `src/app/(dashboard)/_components/UnregisteredProjects.tsx` | 미입력 공사 섹션 |
| Modify | `src/app/(dashboard)/page.tsx` | ActiveProjects → UnregisteredProjects |
| Modify | `src/app/(dashboard)/progress/page.tsx` | searchParams 수주_id, 날짜 처리 |
| Modify | `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` | defaultSuuId prop 추가 |
| Modify | `src/app/(dashboard)/input/page.tsx` | searchParams 수주_id, 날짜 처리 |
| Modify | `src/app/(dashboard)/input/_components/InputForm.tsx` | defaultSuuId prop 추가 |

---

## Task 1: DB 마이그레이션 — dashboard_공사 테이블

**Files:**
- Create: Supabase Dashboard SQL Editor에서 실행
- Modify: `src/types/database.ts`

- [ ] **Step 1: Supabase Dashboard에서 SQL 실행**

Supabase Dashboard → SQL Editor에서 아래 쿼리 실행:

```sql
CREATE TABLE dashboard_공사 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  지중no TEXT NOT NULL,
  공사명 TEXT NOT NULL,
  진행날짜 DATE NOT NULL,
  등록일 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  삭제됨 BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (지중no, 진행날짜)
);

ALTER TABLE dashboard_공사 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON dashboard_공사
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: database.ts에 타입 추가**

`src/types/database.ts`의 `Tables` 블록 안 (예: `계획금액:` 블록 바로 아래)에 추가:

```typescript
      dashboard_공사: {
        Row: {
          id: number
          지중no: string
          공사명: string
          진행날짜: string
          등록일: string
          삭제됨: boolean
        }
        Insert: {
          id?: number
          지중no: string
          공사명: string
          진행날짜: string
          등록일?: string
          삭제됨?: boolean
        }
        Update: {
          id?: number
          지중no?: string
          공사명?: string
          진행날짜?: string
          등록일?: string
          삭제됨?: boolean
        }
      }
```

파일 맨 아래 re-export 블록에도 추가:

```typescript
export type dashboard_공사Row    = Database['public']['Tables']['dashboard_공사']['Row']
export type dashboard_공사Insert = Database['public']['Tables']['dashboard_공사']['Insert']
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

오류 없으면 통과.

- [ ] **Step 4: 커밋**

```bash
git add src/types/database.ts
git commit -m "feat: dashboard_공사 DB 타입 추가"
```

---

## Task 2: 서비스 롤 클라이언트 + API 엔드포인트

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/app/api/dashboard-sync/route.ts`

- [ ] **Step 1: admin 클라이언트 생성**

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

`.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 Supabase Dashboard → Settings → API → service_role 키를 복사해 추가.

- [ ] **Step 2: API 엔드포인트 작성**

```typescript
// src/app/api/dashboard-sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.DASHBOARD_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { constructions } = body as { constructions?: unknown[] }
  if (!Array.isArray(constructions)) {
    return NextResponse.json({ error: '"constructions" must be an array' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let inserted = 0
  let skipped = 0

  for (const item of constructions) {
    const c = item as { 지중no?: string; 공사명?: string; 진행날짜?: string }
    if (!c.지중no || !c.공사명 || !c.진행날짜) continue

    const { error } = await supabase.from('dashboard_공사').insert({
      지중no: c.지중no,
      공사명: c.공사명,
      진행날짜: c.진행날짜,
    })

    if (error?.code === '23505') {
      skipped++
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      inserted++
    }
  }

  return NextResponse.json({ inserted, skipped })
}
```

`.env.local`에 `DASHBOARD_API_KEY=your-secret-key-here` 추가.

- [ ] **Step 3: 로컬에서 curl로 테스트**

```bash
npm run dev
```

별도 터미널에서:

```bash
curl -X POST http://localhost:3000/api/dashboard-sync \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{"constructions":[{"지중no":"TY25-TEST","공사명":"테스트 공사","진행날짜":"2026-06-09"}]}'
```

예상 응답: `{"inserted":1,"skipped":0}`

두 번 실행하면: `{"inserted":0,"skipped":1}` (중복 무시 확인)

인증 없이 호출:
```bash
curl -X POST http://localhost:3000/api/dashboard-sync \
  -H "Content-Type: application/json" \
  -d '{}'
```
예상 응답: `{"error":"Unauthorized"}` (status 401)

- [ ] **Step 4: Supabase Dashboard에서 테스트 데이터 확인**

Table Editor → dashboard_공사 → TY25-TEST 행이 있는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/supabase/admin.ts src/app/api/dashboard-sync/route.ts
git commit -m "feat: POST /api/dashboard-sync 엔드포인트 추가"
```

---

## Task 3: KpiCards — 계획금액 제거, 전월대비 추가

**Files:**
- Modify: `src/app/(dashboard)/_components/KpiCards.tsx`

- [ ] **Step 1: KpiCards.tsx 전체 교체**

```tsx
// src/app/(dashboard)/_components/KpiCards.tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CircleDollarSign, TrendingUp, Wallet, ArrowUpDown } from 'lucide-react'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { formatEok } from '@/lib/format'
import { calc합계 } from '../_lib/calc'

export async function KpiCards() {
  const supabase = await createClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')

  const monthStart = `${year}-${mm}-01`
  const monthEnd = new Date(year, month, 1).toISOString().slice(0, 10)

  // 전월 동기간: 같은 날짜 범위, 한 달 전
  const firstOfPrevMonth = new Date(year, month - 2, 1)
  const prevYear = firstOfPrevMonth.getFullYear()
  const prevMm = String(firstOfPrevMonth.getMonth() + 1).padStart(2, '0')
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
  const prevDay = Math.min(day, prevMonthLastDay)
  const prevMonthStart = `${prevYear}-${prevMm}-01`
  const prevMonthEnd = `${prevYear}-${prevMm}-${String(prevDay).padStart(2, '0')}`

  const [투입실적결과, 단가결과, 공사이력결과, 전월공사이력결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', monthStart).lt('투입일', monthEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase.from('공사이력').select('성과금액').gte('작업일자', monthStart).lte('작업일자', `${year}-${mm}-${dd}`),
    supabase.from('공사이력').select('성과금액').gte('작업일자', prevMonthStart).lte('작업일자', prevMonthEnd),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]

  const 이번달투입금액 = 투입실적목록.reduce((sum, row) => sum + calc합계(row, 단가목록), 0)

  const 이번달성과금액 = ((공사이력결과.data ?? []) as { 성과금액: number }[]).reduce(
    (sum, r) => sum + (r.성과금액 ?? 0),
    0,
  )
  const 전월성과금액 = ((전월공사이력결과.data ?? []) as { 성과금액: number }[]).reduce(
    (sum, r) => sum + (r.성과금액 ?? 0),
    0,
  )
  const 전월대비성과금액 = 이번달성과금액 - 전월성과금액
  const 이번달손익금액 = 이번달성과금액 - 이번달투입금액

  const 월표시 = `${month}월`

  const cards = [
    {
      title: `${월표시} 성과금액`,
      value: formatEok(이번달성과금액),
      sub: null,
      icon: CircleDollarSign,
      color: '#3d5af1',
    },
    {
      title: `전월대비 성과`,
      value: (전월대비성과금액 >= 0 ? '+' : '') + formatEok(전월대비성과금액),
      sub: `전월 동기간 대비`,
      icon: ArrowUpDown,
      color: 전월대비성과금액 >= 0 ? '#22c55e' : '#ef4444',
    },
    {
      title: `${월표시} 투입금액`,
      value: formatEok(이번달투입금액),
      sub: null,
      icon: Wallet,
      color: '#f59e0b',
    },
    {
      title: `${월표시} 손익금액`,
      value: formatEok(이번달손익금액),
      sub: null,
      icon: TrendingUp,
      color: 이번달손익금액 >= 0 ? '#22c55e' : '#ef4444',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ title, value, sub, icon: Icon, color }) => (
        <Card key={title} className="bg-white shadow-sm border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
            <div className="p-2 rounded-lg" style={{ backgroundColor: color + '18' }}>
              <Icon className="size-4" style={{ color }} />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-white shadow-sm border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 브라우저 확인**

`npm run dev` → `http://localhost:3000` → KPI 카드가 4개 (성과금액, 전월대비, 투입금액, 손익금액)인지 확인. 계획금액 카드 없는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/_components/KpiCards.tsx
git commit -m "feat: KPI 계획금액 제거, 전월대비 성과금액 카드 추가"
```

---

## Task 4: UnregisteredProjects 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/_components/UnregisteredProjects.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/app/(dashboard)/_components/UnregisteredProjects.tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UnregisteredProjectsClient } from './UnregisteredProjectsClient'

export type ProjectStatus = {
  id: number
  지중no: string
  공사명: string
  진행날짜: string
  수주_id: number | null
  has공사이력: boolean
  has투입실적: boolean
}

export async function UnregisteredProjects() {
  const supabase = await createClient()

  // 미삭제 항목 전체
  const { data: pending } = await supabase
    .from('dashboard_공사')
    .select('id, 지중no, 공사명, 진행날짜')
    .eq('삭제됨', false)
    .order('진행날짜', { ascending: true })

  if (!pending || pending.length === 0) {
    return (
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">ERP 미입력 공사</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <p className="text-sm text-gray-400 text-center py-6">미입력 공사가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  const 지중nos = [...new Set(pending.map((p) => p.지중no))]

  // 수주 매핑
  const { data: 수주들 } = await supabase
    .from('수주')
    .select('id, 지중no')
    .in('지중no', 지중nos)

  const 수주Map = new Map((수주들 ?? []).map((s) => [s.지중no, s.id]))

  const 수주ids = [...수주Map.values()]
  const dates = [...new Set(pending.map((p) => p.진행날짜))]

  // 공사이력, 투입실적 한꺼번에 조회
  const [이력결과, 실적결과] = await Promise.all([
    수주ids.length > 0
      ? supabase.from('공사이력').select('수주_id, 작업일자').in('수주_id', 수주ids).in('작업일자', dates)
      : Promise.resolve({ data: [] }),
    수주ids.length > 0
      ? supabase.from('투입실적').select('수주_id, 투입일').in('수주_id', 수주ids).in('투입일', dates)
      : Promise.resolve({ data: [] }),
  ])

  const 이력Set = new Set(
    ((이력결과.data ?? []) as { 수주_id: number; 작업일자: string }[]).map(
      (r) => `${r.수주_id}_${r.작업일자}`,
    ),
  )
  const 실적Set = new Set(
    ((실적결과.data ?? []) as { 수주_id: number; 투입일: string }[]).map(
      (r) => `${r.수주_id}_${r.투입일}`,
    ),
  )

  const statuses: ProjectStatus[] = pending
    .map((p) => {
      const 수주_id = 수주Map.get(p.지중no) ?? null
      const key = 수주_id ? `${수주_id}_${p.진행날짜}` : null
      return {
        id: p.id,
        지중no: p.지중no,
        공사명: p.공사명,
        진행날짜: p.진행날짜,
        수주_id,
        has공사이력: key ? 이력Set.has(key) : false,
        has투입실적: key ? 실적Set.has(key) : false,
      }
    })
    .filter((p) => !(p.has공사이력 && p.has투입실적)) // 둘 다 있으면 제외

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-sm font-medium text-gray-600">
          ERP 미입력 공사
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({statuses.length}건)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <UnregisteredProjectsClient items={statuses} />
      </CardContent>
    </Card>
  )
}

export function UnregisteredProjectsSkeleton() {
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 클라이언트 컴포넌트 작성**

```tsx
// src/app/(dashboard)/_components/UnregisteredProjectsClient.tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteUnregisteredProject } from '../_actions/dashboard'
import type { ProjectStatus } from './UnregisteredProjects'

const PAGE_SIZE = 10

function StatusBadge({ has공사이력, has투입실적 }: { has공사이력: boolean; has투입실적: boolean }) {
  if (!has공사이력 && !has투입실적) {
    return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 whitespace-nowrap">
        ✗ 이력·실적 미입력
      </span>
    )
  }
  if (!has투입실적) {
    return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        ⚠ 실적 미입력
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      ⚠ 이력 미입력
    </span>
  )
}

export function UnregisteredProjectsClient({ items }: { items: ProjectStatus[] }) {
  const [page, setPage] = useState(0)
  const [pending, startTransition] = useTransition()

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleDelete = (id: number) => {
    startTransition(async () => {
      await deleteUnregisteredProject(id)
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">미입력 공사가 없습니다.</p>
  }

  return (
    <div className="space-y-2">
      {pageItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {item.지중no} · {item.공사명}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">진행일 {item.진행날짜}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <StatusBadge has공사이력={item.has공사이력} has투입실적={item.has투입실적} />
            {!item.has공사이력 && item.수주_id && (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 border-blue-400 text-blue-600">
                <Link href={`/progress?수주_id=${item.수주_id}&날짜=${item.진행날짜}`}>
                  이력 입력
                </Link>
              </Button>
            )}
            {!item.has투입실적 && item.수주_id && (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 border-blue-400 text-blue-600">
                <Link href={`/input?수주_id=${item.수주_id}&날짜=${item.진행날짜}`}>
                  실적 입력
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 border-slate-300 text-slate-400"
              onClick={() => handleDelete(item.id)}
              disabled={pending}
            >
              ✕
            </Button>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                i === page
                  ? 'bg-[#1e2d5a] text-white border-[#1e2d5a]'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Server Action 작성**

```typescript
// src/app/(dashboard)/_actions/dashboard.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function deleteUnregisteredProject(id: number) {
  const supabase = await createClient()
  await supabase.from('dashboard_공사').update({ 삭제됨: true }).eq('id', id)
  revalidatePath('/')
}
```

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(dashboard\)/_components/UnregisteredProjects.tsx \
        src/app/\(dashboard\)/_components/UnregisteredProjectsClient.tsx \
        src/app/\(dashboard\)/_actions/dashboard.ts
git commit -m "feat: ERP 미입력 공사 컴포넌트 추가"
```

---

## Task 5: 공사이력/투입실적 페이지 URL params 처리

공사 버튼 클릭 시 해당 수주와 날짜가 미리 선택된 상태로 이동.

**Files:**
- Modify: `src/app/(dashboard)/progress/page.tsx`
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`
- Modify: `src/app/(dashboard)/input/page.tsx`
- Modify: `src/app/(dashboard)/input/_components/InputForm.tsx`

- [ ] **Step 1: progress/page.tsx — searchParams에서 수주_id, 날짜 읽어 폼에 전달**

`searchParams` 타입에 `수주_id`, `날짜` 추가 후 `ProgressInputForm`에 props 전달:

```tsx
// src/app/(dashboard)/progress/page.tsx 의 searchParams 타입 변경
searchParams: Promise<{ tab?: string; date_from?: string; date_to?: string; 수주_id?: string; 날짜?: string }>
```

`ProgressInputForm` 호출 부분 변경:
```tsx
<ProgressInputForm
  수주목록={수주목록}
  default수주Id={params.수주_id ? Number(params.수주_id) : null}
  default날짜={params.날짜 ?? null}
/>
```

- [ ] **Step 2: ProgressInputForm — default props 적용**

`Props` 타입에 추가:
```typescript
type Props = {
  수주목록: 수주목록항목[]
  default수주Id?: number | null
  default날짜?: string | null
}
```

`useState` 초기값 변경:
```typescript
// 기존
const [선택수주Id, set선택수주Id] = useState<number | null>(null)
const [작업일자, set작업일자] = useState(() => new Date().toISOString().slice(0, 10))

// 변경
const [선택수주Id, set선택수주Id] = useState<number | null>(default수주Id ?? null)
const [작업일자, set작업일자] = useState(() => default날짜 ?? new Date().toISOString().slice(0, 10))
```

`ProgressInputForm` 함수 시그니처 변경:
```typescript
export function ProgressInputForm({ 수주목록, default수주Id, default날짜 }: Props) {
```

컴포넌트 마운트 시 default 수주가 있으면 이력 로드 (`useEffect` 추가):
```typescript
useEffect(() => {
  if (default수주Id != null) {
    handle공사선택(default수주Id)
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: input/page.tsx — 동일하게 수주_id, 날짜 처리**

`src/app/(dashboard)/input/page.tsx`의 searchParams 타입 확인 후 동일 패턴으로 `default수주Id`, `default날짜` props를 InputForm에 전달. InputForm의 Props와 초기 state도 동일하게 수정.

- [ ] **Step 4: 타입 체크 + 동작 확인**

```bash
npx tsc --noEmit
```

브라우저에서 `/progress?수주_id=1&날짜=2026-06-09` 접근 → 해당 공사가 미리 선택되어 있는지, 날짜가 채워져 있는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(dashboard\)/progress/page.tsx \
        src/app/\(dashboard\)/progress/_components/ProgressInputForm.tsx \
        src/app/\(dashboard\)/input/page.tsx \
        src/app/\(dashboard\)/input/_components/InputForm.tsx
git commit -m "feat: 공사이력/투입실적 폼 URL param 사전 선택 지원"
```

---

## Task 6: 홈 페이지 조합

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: page.tsx 수정**

```tsx
// src/app/(dashboard)/page.tsx
import { Suspense } from 'react'
import { KpiCards, KpiCardsSkeleton } from './_components/KpiCards'
import { ProfitChartSection, ProfitChartSkeleton } from './_components/ProfitChartSection'
import { UnregisteredProjects, UnregisteredProjectsSkeleton } from './_components/UnregisteredProjects'

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
          대시보드
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          영전사 ERP 현황
        </p>
      </div>

      <Suspense fallback={<KpiCardsSkeleton />}>
        <KpiCards />
      </Suspense>

      <Suspense fallback={<ProfitChartSkeleton />}>
        <ProfitChartSection />
      </Suspense>

      <Suspense fallback={<UnregisteredProjectsSkeleton />}>
        <UnregisteredProjects />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: 브라우저 전체 확인**

`npm run dev` → `http://localhost:3000`

체크리스트:
- KPI 카드 4개 (성과금액, 전월대비, 투입금액, 손익금액) — 계획금액 없음
- 매출손익 차트 정상 표시
- "ERP 미입력 공사" 섹션 표시 (비어있으면 "미입력 공사가 없습니다." 텍스트)
- curl로 테스트 데이터 추가 후 목록에 표시되는지 확인
- ✕ 버튼 클릭 시 목록에서 제거되는지 확인

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: 홈 화면 ActiveProjects → UnregisteredProjects 교체"
```
