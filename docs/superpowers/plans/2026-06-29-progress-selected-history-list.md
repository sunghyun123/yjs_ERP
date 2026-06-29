# 선택 공사 이력 목록 (슬라이스 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공사이력 입력 화면에서 선택한 공사의 이력을 폼 아래에 최신순·10개씩 보여주고 행 클릭으로 수정/삭제하며, 입력칸 %는 전체 누계 기준으로 되돌린다.

**Architecture:** 수정 Sheet를 공용 컴포넌트 `이력수정Sheet`로 추출해 현황 탭과 입력 폼이 공유한다. 입력 폼은 이미 가진 `이력목록` 단일 소스를 `선택공사이력목록`(경량·클라이언트 페이지네이션)으로 렌더하고, 행 클릭 시 그 공사의 `이력목록`을 records로 넘겨 `이력수정Sheet`를 연다. 입력칸 %의 직전누계 자동 반영은 제거(전체 누계 기준으로 롤백)하되 `직전누계` 함수는 수정 Sheet가 계속 사용한다.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase, Vitest, Tailwind.

> **커밋 규칙 (CLAUDE.md):** Task 1~4는 기술적 변경(Tier A)이라 **커밋 메시지는 사용자가 직접 작성**한다. 각 커밋 스텝의 메시지는 *제안*이며, 실행 주체는 커밋 직전 멈추고 사용자에게 "왜"를 담은 최종 문구를 받는다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/app/(dashboard)/progress/_lib/pagination.ts` | 클라이언트 페이지 분할 순수함수 | **신규** |
| `src/app/(dashboard)/progress/_lib/pagination.test.ts` | 위 단위 테스트 | **신규** |
| `src/app/(dashboard)/progress/_components/이력수정Sheet.tsx` | 한 레코드 수정 UI(공용) | **신규(추출)** |
| `src/app/(dashboard)/progress/_components/선택공사이력목록.tsx` | 선택 공사 이력 목록(페이지네이션) | **신규** |
| `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx` | 현황 탭. 수정 Sheet를 위임 | 수정 |
| `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` | 입력 폼. % 롤백 + 목록 통합 | 수정 |

테스트 실행: `npx vitest run pagination` (파일명 substring 필터, 괄호 경로 회피)
타입 체크: `npx tsc --noEmit`
린트: `npm run lint`

> **린트 주의:** 이 디렉터리에는 기존 lint 에러가 있다(supabase `as any`, 한글 컴포넌트명 `rules-of-hooks`, 1회성 동기화 `set-state-in-effect`). 판정 기준은 "**직전 커밋 대비 신규 에러가 늘지 않음**"이다. 새 supabase 쿼리의 `as any`와 row 동기화 effect의 `set-state-in-effect`는 이 파일들의 기존 관례와 동일하므로 허용하되, 그 외 신규 위반은 만들지 않는다.

---

## Task 1: paginate 순수함수 (TDD)

**Files:**
- Test: `src/app/(dashboard)/progress/_lib/pagination.test.ts`
- Create: `src/app/(dashboard)/progress/_lib/pagination.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`pagination.test.ts` 전체 내용:

```ts
import { describe, it, expect } from 'vitest'
import { paginate } from './pagination'

describe('paginate (클라이언트 페이지 분할)', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1) // 1..25

  it('빈 배열이면 빈 페이지·totalPages 1·page 1', () => {
    expect(paginate([], 1, 10)).toEqual({ pageItems: [], totalPages: 1, page: 1 })
  })

  it('첫 페이지는 앞에서 pageSize개', () => {
    const r = paginate(items, 1, 10)
    expect(r.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(r.totalPages).toBe(3)
    expect(r.page).toBe(1)
  })

  it('마지막 페이지는 남은 개수만', () => {
    const r = paginate(items, 3, 10)
    expect(r.pageItems).toEqual([21, 22, 23, 24, 25])
    expect(r.totalPages).toBe(3)
  })

  it('정확히 나누어떨어지면 totalPages가 딱 맞는다', () => {
    expect(paginate(items.slice(0, 20), 2, 10).totalPages).toBe(2)
  })

  it('page가 1보다 작으면 1로 보정', () => {
    expect(paginate(items, 0, 10).page).toBe(1)
    expect(paginate(items, -5, 10).page).toBe(1)
  })

  it('page가 totalPages를 넘으면 마지막 페이지로 보정', () => {
    const r = paginate(items, 999, 10)
    expect(r.page).toBe(3)
    expect(r.pageItems).toEqual([21, 22, 23, 24, 25])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run pagination`
Expected: FAIL — `paginate is not a function` / module not found.

- [ ] **Step 3: 최소 구현**

`pagination.ts` 전체 내용:

```ts
// 클라이언트 측 페이지 분할. items는 호출부가 이미 원하는 순서로 정렬해서 넘긴다.
// page는 1-base. 범위를 벗어나면 [1, totalPages]로 보정해 항상 유효한 페이지를 반환한다.
// (목록 삭제로 항목이 줄어 현재 page가 떠도 빈 화면 대신 마지막 페이지를 보여주기 위함)
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { pageItems: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, Math.trunc(page)), totalPages)
  const start = (safePage - 1) * pageSize
  return { pageItems: items.slice(start, start + pageSize), totalPages, page: safePage }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run pagination`
Expected: PASS (전체 그린).

- [ ] **Step 5: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_lib/pagination.ts" "src/app/(dashboard)/progress/_lib/pagination.test.ts"
git commit -m "feat(progress): 클라이언트 페이지 분할 순수함수 paginate 추가"
```

---

## Task 2: 이력수정Sheet 공용 추출

현재 `ProgressHistoryTable` 안에 인라인으로 있는 수정 Sheet(작업일자 + 원/% 토글 성과 입력 + 저장/삭제)를 별도 컴포넌트로 추출한다. **records lazy-fetch는 호출부 책임**으로 두고 Sheet는 `records`/`loading`을 prop으로 받는다. 동작 보존 리팩터.

**Files:**
- Create: `src/app/(dashboard)/progress/_components/이력수정Sheet.tsx`
- Modify: `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx`

- [ ] **Step 1: 이력수정Sheet 파일 생성**

`이력수정Sheet.tsx` 전체 내용:

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Trash2 } from 'lucide-react'
import type { 공사이력행 } from '../_types'
import { 성과Input } from './성과Input'
import { 직전누계 } from '../_lib/percent'

export type 이력레코드 = { id: number; 작업일자: string; 성과금액: number | null }

export function 이력수정Sheet({
  open,
  onOpenChange,
  row,
  records,
  loading,
  onSaved,
  onDeleted,
  showToast,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: 공사이력행 | null
  records: 이력레코드[]          // 그 공사 전체 이력(직전누계 계산용). 호출부가 준비해 넘긴다.
  loading: boolean               // records 불러오는 중이면 % 입력 자리에 스피너
  onSaved: () => void            // 저장 성공 → 호출부가 재조회/닫기
  onDeleted: () => void          // 삭제 성공 → 호출부가 재조회/닫기
  showToast: (ok: boolean, msg: string) => void
}) {
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // row가 바뀌면(다른 행 클릭) 편집 필드를 그 행 값으로 1회 동기화. 반복 cascade가 아니라 규칙 부적용.
  useEffect(() => {
    if (!row) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditDate(row.작업일자)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditAmount(row.성과금액)
  }, [row])

  // 수정 대상 수주의 하도적용금액(=환산 base). 조인된 원자료로 계산.
  const editBase = useMemo(() => {
    const s = row?.수주
    if (!s || s.수주금액_공급가 == null || s.보험료율 == null || s.하도전용율 == null) return null
    return s.수주금액_공급가 * (1 - s.보험료율) * s.하도전용율
  }, [row])

  // 수정 중 레코드의 % 기준: 자기 자신을 뺀 "그 작업일자 직전" 누계.
  // strict <(직전누계) + id 필터 이중안전. editDate(작업일자 변경)를 바꿔도 자기 자신은 빠진다.
  const edit직전누계 = useMemo(
    () => 직전누계(records.filter((r) => r.id !== row?.id), editDate),
    [records, editDate, row],
  )

  const handleSave = async () => {
    if (!row) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any)
      .update({ 작업일자: editDate, 성과금액: editAmount })
      .eq('id', row.id)
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    showToast(true, '수정되었습니다.')
    onSaved()
  }

  const handleDelete = async () => {
    if (!row) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any).delete().eq('id', row.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    showToast(true, '삭제되었습니다.')
    onDeleted()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start gap-2 pr-8">
            <span className="font-mono text-xs text-gray-400 mt-0.5 shrink-0">{row?.수주?.지중no}</span>
            <SheetTitle className="text-base font-semibold text-left leading-snug">{row?.수주?.공사명}</SheetTitle>
          </div>
          <SheetDescription className="text-left">공사이력 수정</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
            <Input type="date" className="h-9 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="size-4 animate-spin" /> 이력 불러오는 중...
              </div>
            ) : (
              <성과Input
                value={editAmount}
                onChange={setEditAmount}
                하도적용금액={records.length > 0 ? editBase : null}
                직전누계={edit직전누계}
              />
            )}
          </div>
          <Button className="w-full bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            저장
          </Button>
          <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
            삭제
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: ProgressHistoryTable에서 수정 Sheet 로직 제거 + 위임**

`ProgressHistoryTable.tsx`를 다음과 같이 바꾼다.

(a) **import 정리.** 3~16줄을 다음으로 교체(Sheet/Label/Save/Trash2/성과Input/직전누계/useMemo 제거, 이력수정Sheet 추가):
```ts
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2, AlertCircle, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 공사이력행 } from '../_types'
import { 이력수정Sheet, type 이력레코드 } from './이력수정Sheet'
```

(b) **편집 state 축소.** 27~33줄
```ts
  const [editRow, setEditRow]       = useState<공사이력행 | null>(null)
  const [editDate, setEditDate]     = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [editRecords, setEditRecords] = useState<{ id: number; 작업일자: string; 성과금액: number | null }[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
```
를 다음으로 교체(date/amount/saving/deleting 제거):
```ts
  const [editRow, setEditRow]       = useState<공사이력행 | null>(null)
  const [editRecords, setEditRecords] = useState<이력레코드[]>([])
  const [editLoading, setEditLoading] = useState(false)
```

(c) **openEdit 단순화.** 67~80줄(현재 `openEdit`)을 다음으로 교체(date/amount set 제거, records fetch만):
```ts
  const openEdit = async (row: 공사이력행) => {
    setEditRow(row)
    setEditLoading(true)
    setEditRecords([])
    const supabase = createClient()
    const { data, error } = await (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액')
      .eq('수주_id', row.수주_id) as { data: 이력레코드[] | null; error: unknown }
    setEditLoading(false)
    if (error) { showToast(false, '이력을 불러오지 못했습니다. 원 단위로만 수정할 수 있습니다.'); return }
    setEditRecords(data ?? [])
  }
```

(d) **editBase·edit직전누계 useMemo, handleSave, handleDelete 삭제.** 현재 82~120줄(`// 수정 대상 수주의 하도적용금액` 주석부터 `handleDelete` 닫는 `}`까지) 전체를 삭제한다. (이 로직은 전부 이력수정Sheet 내부로 이동했다.)

(e) **인라인 Sheet JSX 교체.** 현재 236~275줄(`{/* 수정 Sheet */}`부터 `</Sheet>`까지)을 다음으로 교체:
```tsx
      {/* 수정 Sheet (공용 컴포넌트) */}
      <이력수정Sheet
        open={editRow != null}
        onOpenChange={(open) => { if (!open) setEditRow(null) }}
        row={editRow}
        records={editRecords}
        loading={editLoading}
        onSaved={() => { setEditRow(null); fetchData() }}
        onDeleted={() => { setEditRow(null); fetchData() }}
        showToast={showToast}
      />
```

- [ ] **Step 3: 타입·린트·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`editDate`/`editAmount`/`saving`/`deleting`/`Sheet`/`Label` 미사용·미정의 에러가 나면 위 교체 누락 — 확인.)

Run: `npm run lint`
Expected: 신규 에러 없음(직전 커밋 대비 증가 없음).

Run: `npx vitest run pagination`
Expected: PASS.

- [ ] **Step 4: 수동 확인 (현황 탭 회귀)**

`npm run dev` → 현황 탭에서 행 클릭 → 수정 Sheet가 추출 전과 동일하게 열리고, 원/% 토글·저장·삭제가 동작하는지 확인.

- [ ] **Step 5: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_components/이력수정Sheet.tsx" "src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx"
git commit -m "refactor(progress): 수정 Sheet를 이력수정Sheet 공용 컴포넌트로 추출"
```

---

## Task 3: 입력 폼 % 기준 롤백 (직전누계 자동 반영 제거)

입력칸 %를 전체 누계 기준 누적목표로 되돌린다. `직전누계값` 파생과 `직전누계` import를 폼에서 제거하고, `성과Input`에 `누계성과금액`(전체 총계)을 넘긴다.

**Files:**
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`

- [ ] **Step 1: 직전누계 import 제거**

17번째 줄 근처
```ts
import { 직전누계 } from '../_lib/percent'
```
을 **삭제**한다. (폼은 더 이상 직전누계를 직접 쓰지 않는다. `성과Input`/`이력수정Sheet`가 각자 필요한 것을 import한다.)

- [ ] **Step 2: 직전누계값 useMemo 제거**

현재 181~182줄
```ts
  // % 입력 기준: "이 작업일자 직전"까지의 누계. 최신 날짜면 총계와 같고, 백필이면 그 날짜 전까지만.
  const 직전누계값 = useMemo(() => 직전누계(이력목록, 작업일자), [이력목록, 작업일자])
```
을 **삭제**한다. (`누계성과금액`·`최근작업일자` useMemo는 그대로 둔다 — `useMemo` import도 그대로 필요.)

- [ ] **Step 3: 성과Input에 전체 누계 전달**

현재 366~371줄
```tsx
          <성과Input
            value={성과금액}
            onChange={set성과금액}
            하도적용금액={하도적용금액}
            직전누계={직전누계값}
          />
```
를 다음으로 교체:
```tsx
          <성과Input
            value={성과금액}
            onChange={set성과금액}
            하도적용금액={하도적용금액}
            직전누계={누계성과금액}
          />
```

- [ ] **Step 4: 타입·린트·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`직전누계값` 미정의 에러가 나면 Step 3 교체 누락.)

Run: `npm run lint`
Expected: 신규 에러 없음.

Run: `npx vitest run pagination`
Expected: PASS.

- [ ] **Step 5: 수동 확인 (자동 반영 제거)**

`npm run dev` → 입력 탭에서 공사 선택 → 작업일자만 바꿔도 % 입력칸이 자동으로 채워지지 않음을 확인. % 모드로 값을 입력하면 전체 누계 기준 누적%로 환산되는지 확인.

- [ ] **Step 6: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_components/ProgressInputForm.tsx"
git commit -m "feat(progress): 입력칸 % 기준을 전체 누계로 롤백 — 직전누계 자동 반영 제거"
```

---

## Task 4: 선택공사이력목록 + 입력 폼 통합

선택 공사의 이력을 폼 아래에 페이지네이션으로 표시하고, 행 클릭 시 `이력수정Sheet`를 열어 수정/삭제한다. 저장·삭제 후 `이력목록`을 재조회한다.

**Files:**
- Create: `src/app/(dashboard)/progress/_components/선택공사이력목록.tsx`
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`

- [ ] **Step 1: 선택공사이력목록 파일 생성**

`선택공사이력목록.tsx` 전체 내용:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatKRW } from '@/lib/format'
import { paginate } from '../_lib/pagination'
import type { 이력레코드 } from './이력수정Sheet'

export function 선택공사이력목록({
  records,
  onRowClick,
}: {
  records: 이력레코드[]
  onRowClick: (rec: 이력레코드) => void
}) {
  const [page, setPage] = useState(1)

  // 정본 정렬은 호출부 fetch 순서에 의존하지 않고 여기서 최신순으로 고정(저장 append로 순서가 흐트러져도 안전).
  const sorted = useMemo(
    () => [...records].sort((a, b) => (a.작업일자 < b.작업일자 ? 1 : a.작업일자 > b.작업일자 ? -1 : 0)),
    [records],
  )
  const { pageItems, totalPages, page: safePage } = paginate(sorted, page, 10)

  if (records.length === 0) return null

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">이 공사 이력</p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {pageItems.map((rec) => (
              <tr
                key={rec.id}
                className="border-b border-gray-100 last:border-b-0 hover:bg-blue-50/50 cursor-pointer transition-colors"
                onClick={() => onRowClick(rec)}
              >
                <td className="px-3 py-2 text-gray-600 tabular-nums">{rec.작업일자}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">{formatKRW(rec.성과금액 ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-2 text-sm">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="p-1 text-gray-500 disabled:opacity-30 hover:text-gray-800"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-gray-500 tabular-nums">{safePage} / {totalPages}</span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            className="p-1 text-gray-500 disabled:opacity-30 hover:text-gray-800"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ProgressInputForm import 추가**

17번째 줄 근처 `import { 성과Input } from './성과Input'` 아래에 추가:
```ts
import { 이력수정Sheet, type 이력레코드 } from './이력수정Sheet'
import { 선택공사이력목록 } from './선택공사이력목록'
```

- [ ] **Step 3: editRow state 추가**

`const [성과금액, set성과금액] = useState<number | null>(null)` 아래(현재 169줄 근처)에 추가:
```ts
  const [editRow, setEditRow] = useState<공사이력행 | null>(null)
```
그리고 16번째 줄 `import type { 공사이력Row } from '@/types/database'`를 다음으로 교체(`공사이력행` 타입 추가):
```ts
import type { 공사이력Row } from '@/types/database'
import type { 공사이력행 } from '../_types'
```

- [ ] **Step 4: 이력목록 재조회 헬퍼 추가**

`handle공사선택` 정의(현재 208줄) **위**에 추가:
```ts
  // 수정/삭제 후 이력만 다시 가져온다. handle공사선택은 담당공무까지 리셋하므로 재사용하지 않고 분리.
  const reload이력목록 = async () => {
    if (선택수주Id == null) return
    const supabase = createClient()
    const { data } = await (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액')
      .eq('수주_id', 선택수주Id)
      .order('작업일자', { ascending: false }) as { data: Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[] | null }
    set이력목록(data ?? [])
  }

  // 목록 행 클릭 → 선택수주 원자료로 공사이력행을 구성해 수정 Sheet를 연다.
  const openRow = (rec: 이력레코드) => {
    if (선택수주Id == null || 선택수주 == null) return
    setEditRow({
      id: rec.id,
      작업일자: rec.작업일자,
      성과금액: rec.성과금액,
      수주_id: 선택수주Id,
      수주: {
        지중no: 선택수주.지중no,
        공사명: 선택수주.공사명,
        수주금액_공급가: 선택수주.수주금액_공급가,
        보험료율: 선택수주.보험료율,
        하도전용율: 선택수주.하도전용율,
      },
    })
  }
```

> `선택수주`(수주목록항목)는 지중no·공사명·수주금액_공급가·보험료율·하도전용율을 모두 포함하므로 `공사이력행.수주`에 그대로 매핑된다. `선택수주` 변수는 현재 폼에 이미 선언돼 있다(`const 선택수주 = 수주목록.find(...)`).

- [ ] **Step 5: 저장 버튼 아래에 목록 + 수정 Sheet 렌더**

현재 410~418줄의 저장 `<Button>...</Button>` **닫는 태그 바로 아래**, 그 `<Button>`을 감싸는 `</div>`(현재 419줄) **앞**에 `선택공사이력목록`을 추가한다. 즉 저장 버튼 다음에:
```tsx
        </Button>

        {선택수주Id != null && (
          <선택공사이력목록 key={선택수주Id} records={이력목록} onRowClick={openRow} />
        )}
      </div>
```

> `key={선택수주Id}`: 공사를 바꾸면 목록이 remount되어 페이지가 1로 초기화된다.

그리고 컴포넌트 최상위 닫는 `</div>` **직전**(현재 467줄 `</div>` 위, 우측 패널 `</div>` 다음)에 수정 Sheet를 추가:
```tsx
      <이력수정Sheet
        open={editRow != null}
        onOpenChange={(open) => { if (!open) setEditRow(null) }}
        row={editRow}
        records={이력목록}
        loading={false}
        onSaved={() => { setEditRow(null); reload이력목록() }}
        onDeleted={() => { setEditRow(null); reload이력목록() }}
        showToast={showToast}
      />
    </div>
  )
}
```

> 입력 폼은 `이력목록`을 이미 메모리에 갖고 있으므로 records로 그대로 넘기고 `loading={false}`로 둔다(현황 탭처럼 별도 lazy-fetch 불필요).

- [ ] **Step 6: 타입·린트·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run lint`
Expected: 신규 에러 없음.

Run: `npx vitest run pagination`
Expected: PASS.

- [ ] **Step 7: 수동 확인 (목록·수정·삭제·페이지네이션)**

`npm run dev` → 입력 탭에서 이력이 많은(10건 초과) 공사 선택 →
1. 폼 아래 "이 공사 이력"에 최신순으로 10개 표시, 페이지 버튼으로 이동.
2. 행 클릭 → 수정 Sheet에서 원/% 토글로 값 보기·수정·삭제.
3. 저장/삭제 후 목록과 우측 "저장 후 전체 누계"·"마지막 등록 기록"이 갱신되는지 확인.
4. 새 이력 저장 시에도 목록에 반영되는지 확인.
5. 다른 공사로 바꾸면 페이지가 1로 돌아가는지 확인.

- [ ] **Step 8: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_components/선택공사이력목록.tsx" "src/app/(dashboard)/progress/_components/ProgressInputForm.tsx"
git commit -m "feat(progress): 입력 화면에 선택 공사 이력 목록 추가 — 인라인 수정/삭제"
```

---

## 완료 기준

- [ ] `paginate` 단위 테스트 그린, `npx vitest run pagination` 전체 통과.
- [ ] 입력 화면에서 공사 선택 시 그 공사 이력이 하단에 최신순·10개씩 표시되고 페이지 이동 가능.
- [ ] 하단 목록 행 클릭 → 수정 Sheet에서 원/% 토글로 수정·삭제, 저장 후 목록·누계 즉시 갱신.
- [ ] 입력칸 %는 전체 누계 기준(작업일자만 바꿔도 자동으로 값이 채워지지 않음).
- [ ] 현황 탭 수정 Sheet가 `이력수정Sheet` 공용 컴포넌트로 동작(중복 제거), 기존 동작 보존.
- [ ] `npx tsc --noEmit` / `npm run lint` 신규 에러 없음.
