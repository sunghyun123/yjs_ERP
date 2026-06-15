# 매출손익 페이지 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ProjectTable을 PivotProjectTable로 교체하고 7가지 변경사항(제목·지브라·페이징·손익색·레이아웃·이익률제거·피벗확장)을 한 번에 반영한다.

**Architecture:** `PivotProjectRow` 타입을 `PivotProjectTable.tsx`에 정의하고 `page.tsx`·`ExcelExportButton.tsx`에서 import한다. `isoWeek` 순수 함수는 `_lib/pivot.ts`로 추출해 vitest 단위 테스트를 작성한다. `ProjectTable.tsx`는 교체 후 삭제한다.

**Tech Stack:** Next.js 16 (App Router, Server Component), React 19, TypeScript, Tailwind CSS v4, vitest (신규 추가), xlsx

---

## File Map

| 작업 | 경로 |
|---|---|
| 신규 (테스트) | `src/app/(dashboard)/sales/_lib/pivot.test.ts` |
| 신규 (유틸) | `src/app/(dashboard)/sales/_lib/pivot.ts` |
| 신규 | `src/app/(dashboard)/sales/_components/PivotProjectTable.tsx` |
| 신규 | `src/app/(dashboard)/sales/_components/WeeklyDetailModal.tsx` |
| 수정 | `src/app/(dashboard)/sales/_components/CollapsibleChart.tsx` |
| 수정 | `src/app/(dashboard)/sales/_components/ExcelExportButton.tsx` |
| 수정 | `src/app/(dashboard)/sales/page.tsx` |
| 삭제 | `src/app/(dashboard)/sales/_components/ProjectTable.tsx` |
| 수정 | `package.json` (vitest devDep + test 스크립트) |
| 신규 | `vitest.config.ts` |

---

## Task 1: Vitest 설치 + `isoWeek` 실패 테스트 작성

**Files:**
- Create: `vitest.config.ts`
- Create: `src/app/(dashboard)/sales/_lib/pivot.test.ts`
- Modify: `package.json`

- [ ] **Step 1: vitest 설치**

```bash
npm install -D vitest
```

- [ ] **Step 2: `vitest.config.ts` 생성**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: `package.json` scripts에 test 추가**

`"scripts"` 블록에 아래 한 줄을 추가한다:

```json
"test": "vitest run"
```

- [ ] **Step 4: `pivot.test.ts` 실패 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { isoWeek } from './pivot'

describe('isoWeek', () => {
  it('2026-01-19는 2026-W04, 1월 3주를 반환한다', () => {
    const result = isoWeek('2026-01-19')
    expect(result.key).toBe('2026-W04')
    expect(result.label).toBe('1월 3주')
  })

  it('같은 날짜를 두 번 호출하면 동일한 key를 반환한다', () => {
    expect(isoWeek('2026-06-15').key).toBe(isoWeek('2026-06-15').key)
  })

  it('연말 경계(12-31, 01-01)에서 오류 없이 동작한다', () => {
    expect(() => isoWeek('2025-12-31')).not.toThrow()
    expect(() => isoWeek('2026-01-01')).not.toThrow()
  })
})
```

- [ ] **Step 5: 테스트 실행 — FAIL 확인**

```bash
npm test
```

Expected: `Cannot find module './pivot'` 류의 오류로 FAIL

---

## Task 2: `_lib/pivot.ts` 구현 + 테스트 통과

**Files:**
- Create: `src/app/(dashboard)/sales/_lib/pivot.ts`

- [ ] **Step 1: `pivot.ts` 작성**

```ts
export function isoWeek(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const weekNo = Math.floor((d.getTime() - startOfWeek1.getTime()) / 604800000) + 1
  const month = d.getMonth() + 1
  const weekOfMonth = Math.ceil(d.getDate() / 7)
  return {
    key: `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    label: `${month}월 ${weekOfMonth}주`,
  }
}
```

> **계산 검증**: Jan 19, 2026 (Monday) → jan4 = Sunday → startOfWeek1 = Dec 29, 2025 → diff = 21일 → weekNo = 4 → key = `2026-W04`. `Math.ceil(19/7)` = 3 → label = `1월 3주`.

- [ ] **Step 2: 테스트 실행 — PASS 확인**

```bash
npm test
```

Expected:
```
✓ isoWeek > 2026-01-19는 2026-W04, 1월 3주를 반환한다
✓ isoWeek > 같은 날짜를 두 번 호출하면 동일한 key를 반환한다
✓ isoWeek > 연말 경계(12-31, 01-01)에서 오류 없이 동작한다
Test Files  1 passed (1)
```

- [ ] **Step 3: 커밋**

```bash
git add vitest.config.ts package.json package-lock.json \
  src/app/\(dashboard\)/sales/_lib/pivot.ts \
  src/app/\(dashboard\)/sales/_lib/pivot.test.ts
git commit -m "test: vitest 설정 + isoWeek 순수 함수 추가"
```

---

## Task 3: `PivotProjectTable.tsx` 신규 생성

**Files:**
- Create: `src/app/(dashboard)/sales/_components/PivotProjectTable.tsx`

- [ ] **Step 1: 파일 전체 작성**

```tsx
'use client'

import { useState, useDeferredValue } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatEok } from '@/lib/format'
import { WeeklyDetailModal } from './WeeklyDetailModal'

export type PivotProjectRow = {
  id: number
  지중no: string
  공사명: string
  성과금액: number
  투입금액: number
  손익금액: number
  monthly: Array<{ 성과: number; 투입: number; 손익: number }>
  weekly: Array<{ week: string; label: string; 성과: number; 투입: number; 손익: number }>
}

type Props = {
  data: PivotProjectRow[]
  year: number
}

const PAGE_SIZE = 25
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function 손익색(v: number): string {
  if (v >= 5_000_000) return '#16a34a'
  if (v <= -5_000_000) return '#dc2626'
  return '#374151'
}

function Paginator({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const pages: (number | null)[] = []
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i)
  } else {
    if (page > 2) { pages.push(0); if (page > 3) pages.push(null) }
    for (let i = Math.max(0, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) pages.push(i)
    if (page < totalPages - 3) { if (page < totalPages - 4) pages.push(null); pages.push(totalPages - 1) }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
      >
        〈
      </button>
      {pages.map((p, i) =>
        p === null ? (
          <span key={`e${i}`} className="px-2 py-1 text-sm text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-2 py-1 text-sm rounded ${p === page ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {p + 1}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
      >
        〉
      </button>
    </div>
  )
}

function ExpandedBlock({
  row,
  onCollapse,
  onWeekly,
}: {
  row: PivotProjectRow
  onCollapse: () => void
  onWeekly: () => void
}) {
  const hasWeekly = row.weekly.length > 0
  const expandedBg = '#eff6ff'

  return (
    <>
      {/* 헤더 행 */}
      <tr
        className="border-b border-blue-100 cursor-pointer hover:bg-blue-100/50"
        style={{ background: expandedBg }}
        onClick={onCollapse}
      >
        <td className="py-2 px-2 font-mono text-xs text-gray-400 border-l-2 border-blue-400">
          {row.지중no}
        </td>
        <td className="py-2 px-2 text-gray-700 font-medium text-xs" colSpan={14}>
          <span className="inline-flex items-center gap-1">
            <ChevronDown className="size-3 text-blue-400 shrink-0" />
            {row.공사명}
          </span>
        </td>
      </tr>

      {/* 성과 행 */}
      <tr className="border-b border-blue-50" style={{ background: expandedBg }}>
        <td className="py-1.5 px-2 text-blue-500 text-xs font-medium border-l-2 border-blue-400">성과</td>
        <td className="py-1.5 px-2" />
        {row.monthly.map((m, i) => (
          <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs text-gray-600">
            {m.성과 === 0 ? '—' : formatEok(m.성과)}
          </td>
        ))}
        <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold text-gray-700">
          {formatEok(row.성과금액)}
        </td>
      </tr>

      {/* 투입 행 */}
      <tr className="border-b border-blue-50" style={{ background: expandedBg }}>
        <td className="py-1.5 px-2 text-amber-500 text-xs font-medium border-l-2 border-blue-400">투입</td>
        <td className="py-1.5 px-2" />
        {row.monthly.map((m, i) => (
          <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs text-gray-600">
            {m.투입 === 0 ? '—' : formatEok(m.투입)}
          </td>
        ))}
        <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold text-gray-700">
          {formatEok(row.투입금액)}
        </td>
      </tr>

      {/* 손익 행 */}
      <tr className="border-b border-gray-100" style={{ background: expandedBg }}>
        <td className="py-1.5 px-2 text-gray-500 text-xs font-medium border-l-2 border-blue-400">손익</td>
        <td className="py-1.5 px-2">
          {hasWeekly && (
            <button
              onClick={e => { e.stopPropagation(); onWeekly() }}
              className="text-xs text-blue-500 underline cursor-pointer whitespace-nowrap"
            >
              주별로 보기 →
            </button>
          )}
        </td>
        {row.monthly.map((m, i) => (
          <td
            key={i}
            className="py-1.5 px-2 text-right tabular-nums text-xs font-medium"
            style={{ color: 손익색(m.손익) }}
          >
            {m.손익 === 0 ? '—' : formatEok(m.손익)}
          </td>
        ))}
        <td
          className="py-1.5 px-2 text-right tabular-nums text-xs font-bold"
          style={{ color: 손익색(row.손익금액) }}
        >
          {formatEok(row.손익금액)}
        </td>
      </tr>
    </>
  )
}

export function PivotProjectTable({ data }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [weeklyTarget, setWeeklyTarget] = useState<PivotProjectRow | null>(null)
  const dq = useDeferredValue(query)

  const filtered = dq
    ? data.filter(
        r =>
          r.지중no.toLowerCase().includes(dq.toLowerCase()) ||
          r.공사명.toLowerCase().includes(dq.toLowerCase()),
      )
    : data

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleQueryChange(q: string) {
    setQuery(q)
    setPage(0)
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Input
          placeholder="지중No 또는 공사명 검색..."
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
        {totalPages > 1 && (
          <Paginator page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 1100 }}>
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2.5 px-2 font-medium text-gray-500 w-24">지중No</th>
              <th className="text-left py-2.5 px-2 font-medium text-gray-500 min-w-[140px]">공사명</th>
              {MONTHS.map(m => (
                <th key={m} className="text-right py-2.5 px-2 font-medium text-gray-500 w-16">{m}</th>
              ))}
              <th className="text-right py-2.5 px-2 font-medium text-gray-500 w-20">합계</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row, index) => {
              if (expandedIds.has(row.id)) {
                return (
                  <ExpandedBlock
                    key={row.id}
                    row={row}
                    onCollapse={() => toggleExpand(row.id)}
                    onWeekly={() => setWeeklyTarget(row)}
                  />
                )
              }

              const zebraClass = index % 2 === 1 ? 'bg-gray-50/50' : ''
              return (
                <tr
                  key={row.id}
                  className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors ${zebraClass}`}
                  onClick={() => toggleExpand(row.id)}
                >
                  <td className="py-2 px-2 font-mono text-gray-400">{row.지중no}</td>
                  <td className="py-2 px-2 text-gray-700 max-w-[180px] truncate">
                    <span className="inline-flex items-center gap-1">
                      <ChevronRight className="size-3 text-gray-300 shrink-0" />
                      {row.공사명}
                    </span>
                  </td>
                  {row.monthly.map((m, i) => (
                    <td
                      key={i}
                      className="py-2 px-2 text-right tabular-nums"
                      style={{ color: 손익색(m.손익) }}
                    >
                      {m.손익 === 0 ? '—' : formatEok(m.손익)}
                    </td>
                  ))}
                  <td
                    className="py-2 px-2 text-right tabular-nums font-semibold"
                    style={{ color: 손익색(row.손익금액) }}
                  >
                    {formatEok(row.손익금액)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Paginator page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <WeeklyDetailModal row={weeklyTarget} onClose={() => setWeeklyTarget(null)} />
    </div>
  )
}
```

- [ ] **Step 2: 커밋 (WeeklyDetailModal 생성 전이라 tsc 오류 있음 — Task 4 후 해소)**

```bash
git add src/app/\(dashboard\)/sales/_components/PivotProjectTable.tsx
git commit -m "feat: PivotProjectTable — 타입 정의 + 피벗 확장 테이블 컴포넌트"
```

---

## Task 4: `WeeklyDetailModal.tsx` 신규 생성

**Files:**
- Create: `src/app/(dashboard)/sales/_components/WeeklyDetailModal.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
'use client'

import { useEffect } from 'react'
import type { PivotProjectRow } from './PivotProjectTable'
import { formatEok } from '@/lib/format'

type Props = {
  row: PivotProjectRow | null
  onClose: () => void
}

function 손익색(v: number): string {
  if (v >= 5_000_000) return '#16a34a'
  if (v <= -5_000_000) return '#dc2626'
  return '#374151'
}

export function WeeklyDetailModal({ row, onClose }: Props) {
  useEffect(() => {
    if (!row) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [row, onClose])

  if (!row) return null

  const 합계성과 = row.weekly.reduce((s, w) => s + w.성과, 0)
  const 합계투입 = row.weekly.reduce((s, w) => s + w.투입, 0)
  const 합계손익 = 합계성과 - 합계투입

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-mono text-xs text-gray-400">{row.지중no}</p>
          <p className="font-semibold text-gray-800 mt-0.5">{row.공사명}</p>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2.5 px-4 font-medium text-gray-500">주</th>
                <th className="text-right py-2.5 px-4 font-medium text-gray-500">성과금액</th>
                <th className="text-right py-2.5 px-4 font-medium text-gray-500">투입금액</th>
                <th className="text-right py-2.5 px-4 font-medium text-gray-500">손익</th>
              </tr>
            </thead>
            <tbody>
              {row.weekly.map(w => (
                <tr key={w.week} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="py-2 px-4 text-gray-600">{w.label}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-gray-700">
                    {formatEok(w.성과)}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-gray-700">
                    {formatEok(w.투입)}
                  </td>
                  <td
                    className="py-2 px-4 text-right tabular-nums font-medium"
                    style={{ color: 손익색(w.손익) }}
                  >
                    {formatEok(w.손익)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                <td className="py-3 px-4 font-bold text-gray-700">합계</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-gray-700">
                  {formatEok(합계성과)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-gray-700">
                  {formatEok(합계투입)}
                </td>
                <td
                  className="py-3 px-4 text-right tabular-nums font-bold"
                  style={{ color: 손익색(합계손익) }}
                >
                  {formatEok(합계손익)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/\(dashboard\)/sales/_components/WeeklyDetailModal.tsx
git commit -m "feat: WeeklyDetailModal — 공사별 주별 상세 모달"
```

---

## Task 5: `CollapsibleChart.tsx` 업데이트

**Files:**
- Modify: `src/app/(dashboard)/sales/_components/CollapsibleChart.tsx`

헤더에 연간 합계(성과·투입·손익)를 인라인으로 표시하고 props 3개를 추가한다.

- [ ] **Step 1: 파일 전체를 아래로 교체**

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SalesChart, type SalesChartRow } from './SalesChart'
import { formatEok } from '@/lib/format'

type Props = {
  data: SalesChartRow[]
  year: number
  총성과: number
  총투입: number
  총손익: number
}

export function CollapsibleChart({ data, year, 총성과, 총투입, 총손익 }: Props) {
  const [open, setOpen] = useState(false)

  const 손익컬러 =
    총손익 >= 5_000_000 ? '#16a34a' : 총손익 <= -5_000_000 ? '#dc2626' : '#374151'

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader
        className="px-5 py-4 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-gray-600 shrink-0">
            {year}년 월별 매출손익
          </span>
          <div className="flex items-center gap-4 ml-2 flex-1">
            <span className="text-xs text-gray-500">
              성과{' '}
              <span className="font-semibold text-blue-600">{formatEok(총성과)}</span>
            </span>
            <span className="text-xs text-gray-500">
              투입{' '}
              <span className="font-semibold text-amber-500">{formatEok(총투입)}</span>
            </span>
            <span className="text-xs text-gray-500">
              손익{' '}
              <span className="font-semibold" style={{ color: 손익컬러 }}>
                {formatEok(총손익)}
              </span>
            </span>
          </div>
          {open ? (
            <ChevronDown className="size-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-gray-400 shrink-0" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-5 pb-5">
          <SalesChart data={data} />
        </CardContent>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/\(dashboard\)/sales/_components/CollapsibleChart.tsx
git commit -m "feat: CollapsibleChart — 헤더에 연간 성과/투입/손익 합계 표시"
```

---

## Task 6: `ExcelExportButton.tsx` 업데이트

**Files:**
- Modify: `src/app/(dashboard)/sales/_components/ExcelExportButton.tsx`

`ProjectRow` → `PivotProjectRow` 교체, 이익률 제거, 시트 3개(공사별·월별피벗·월별합계)로 재편.

- [ ] **Step 1: 파일 전체를 아래로 교체**

```tsx
'use client'

import * as XLSX from 'xlsx'
import type { PivotProjectRow } from './PivotProjectTable'
import type { SalesChartRow } from './SalesChart'

type Props = {
  pivotData: PivotProjectRow[]
  chartData: SalesChartRow[]
  year: number
}

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export function ExcelExportButton({ pivotData, chartData, year }: Props) {
  function handleExport() {
    const wb = XLSX.utils.book_new()

    // 시트 1: 공사별 (연간 합계, 이익률 제거)
    const sheet1 = XLSX.utils.aoa_to_sheet([
      ['지중No', '공사명', '성과금액(원)', '투입금액(원)', '손익금액(원)'],
      ...pivotData.map(r => [r.지중no, r.공사명, r.성과금액, r.투입금액, r.손익금액]),
    ])
    XLSX.utils.book_append_sheet(wb, sheet1, '공사별')

    // 시트 2: 월별 피벗 (공사 × 월)
    const pivotHeader = [
      '지중No',
      '공사명',
      ...MONTHS.flatMap(m => [`${m}성과`, `${m}투입`, `${m}손익`]),
    ]
    const sheet2 = XLSX.utils.aoa_to_sheet([
      pivotHeader,
      ...pivotData.map(r => [
        r.지중no,
        r.공사명,
        ...r.monthly.flatMap(m => [m.성과, m.투입, m.손익]),
      ]),
    ])
    XLSX.utils.book_append_sheet(wb, sheet2, '월별 피벗')

    // 시트 3: 월별 합계
    const sheet3 = XLSX.utils.aoa_to_sheet([
      ['월', '성과금액(원)', '투입금액(원)', '손익금액(원)'],
      ...chartData.map(r => [r.month, r.성과금액, r.투입금액, r.손익금액]),
    ])
    XLSX.utils.book_append_sheet(wb, sheet3, '월별 합계')

    XLSX.writeFile(wb, `매출손익현황_${year}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors"
    >
      ⬇ 엑셀 내보내기
    </button>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/\(dashboard\)/sales/_components/ExcelExportButton.tsx
git commit -m "feat: ExcelExportButton — PivotProjectRow 타입 + 3시트(공사별·월별피벗·월별합계)"
```

---

## Task 7: `page.tsx` 전면 업데이트

**Files:**
- Modify: `src/app/(dashboard)/sales/page.tsx`

집계 로직 교체(월별+공사별+주별 단일 패스), `pivotData` 빌드, 레이아웃 재구성(제목 변경·차트 위·피벗 테이블·이익률 KPI 제거).

- [ ] **Step 1: 파일 전체를 아래로 교체**

```tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { calc합계 } from '../_lib/calc'
import { formatEok } from '@/lib/format'
import { isoWeek } from './_lib/pivot'
import { YearSelector } from './_components/YearSelector'
import { CollapsibleChart } from './_components/CollapsibleChart'
import { ExcelExportButton } from './_components/ExcelExportButton'
import { PivotProjectTable, type PivotProjectRow } from './_components/PivotProjectTable'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()), 10)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const supabase = await createClient()

  const [투입실적결과, 단가결과, 공사이력결과, 수주결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', yearStart).lt('투입일', yearEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase
      .from('공사이력')
      .select('작업일자, 수주_id, 성과금액')
      .gte('작업일자', yearStart)
      .lt('작업일자', yearEnd),
    supabase.from('수주').select('id, 지중no, 공사명').order('지중no'),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]
  const 공사이력목록 = (공사이력결과.data ?? []) as {
    작업일자: string
    수주_id: number
    성과금액: number
  }[]

  type 수주Info = { 지중no: string; 공사명: string }
  const 수주Map = new Map<number, 수주Info>(
    ((수주결과.data ?? []) as (수주Info & { id: number })[]).map(r => [
      r.id,
      { 지중no: r.지중no, 공사명: r.공사명 },
    ]),
  )

  // 월별(전체 차트용) + 공사별(월별+주별) 단일 패스 집계
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 }))

  type 공사상세 = {
    monthly: { 성과: number; 투입: number }[]
    weekly: Map<string, { 성과: number; 투입: number; label: string }>
  }
  const 공사별상세 = new Map<number, 공사상세>()

  function get공사상세(id: number): 공사상세 {
    if (!공사별상세.has(id)) {
      공사별상세.set(id, {
        monthly: Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 })),
        weekly: new Map(),
      })
    }
    return 공사별상세.get(id)!
  }

  for (const row of 투입실적목록) {
    const m = parseInt(row.투입일.slice(5, 7), 10) - 1
    const amt = calc합계(row, 단가목록)
    monthly[m].투입 += amt
    const 상세 = get공사상세(row.수주_id)
    상세.monthly[m].투입 += amt
    const { key, label } = isoWeek(row.투입일)
    const wEntry = 상세.weekly.get(key) ?? { 성과: 0, 투입: 0, label }
    wEntry.투입 += amt
    상세.weekly.set(key, wEntry)
  }

  for (const row of 공사이력목록) {
    if (!row.작업일자) continue
    const m = parseInt(row.작업일자.slice(5, 7), 10) - 1
    const amt = row.성과금액 ?? 0
    monthly[m].성과 += amt
    const 상세 = get공사상세(row.수주_id)
    상세.monthly[m].성과 += amt
    const { key, label } = isoWeek(row.작업일자)
    const wEntry = 상세.weekly.get(key) ?? { 성과: 0, 투입: 0, label }
    wEntry.성과 += amt
    상세.weekly.set(key, wEntry)
  }

  const pivotData: PivotProjectRow[] = [...공사별상세.entries()]
    .map(([id, { monthly: pm, weekly }]) => {
      const info = 수주Map.get(id)
      const 성과 = pm.reduce((s, m) => s + m.성과, 0)
      const 투입 = pm.reduce((s, m) => s + m.투입, 0)
      return {
        id,
        지중no: info?.지중no ?? `(id:${id})`,
        공사명: info?.공사명 ?? '(공사명 없음)',
        성과금액: 성과,
        투입금액: 투입,
        손익금액: 성과 - 투입,
        monthly: pm.map(({ 성과, 투입 }) => ({ 성과, 투입, 손익: 성과 - 투입 })),
        weekly: [...weekly.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, { 성과, 투입, label }]) => ({
            week,
            label,
            성과,
            투입,
            손익: 성과 - 투입,
          })),
      }
    })
    .sort((a, b) => a.지중no.localeCompare(b.지중no, 'ko'))

  // 연간 합계
  const 총성과 = monthly.reduce((sum, m) => sum + m.성과, 0)
  const 총투입 = monthly.reduce((sum, m) => sum + m.투입, 0)
  const 총손익 = 총성과 - 총투입

  // 차트 데이터 (원 단위)
  const chartData = monthly.map(({ 성과, 투입 }, i) => ({
    month: `${i + 1}월`,
    성과금액: Math.round(성과),
    투입금액: Math.round(투입),
    손익금액: Math.round(성과 - 투입),
  }))

  const 손익KPI컬러 =
    총손익 >= 5_000_000 ? '#16a34a' : 총손익 <= -5_000_000 ? '#dc2626' : '#374151'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
            매출손익
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            공사이력·투입일 기준 월별 집계
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton pivotData={pivotData} chartData={chartData} year={year} />
          <YearSelector currentYear={year} />
        </div>
      </div>

      {/* KPI 스트립 */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 성과금액</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{formatEok(총성과)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 투입금액</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">{formatEok(총투입)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 손익</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 손익KPI컬러 }}>
            {formatEok(총손익)}
          </p>
        </div>
      </div>

      {/* 차트 (테이블 위) */}
      <CollapsibleChart
        data={chartData}
        year={year}
        총성과={총성과}
        총투입={총투입}
        총손익={총손익}
      />

      {/* 피벗 테이블 (메인) */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-sm font-medium text-gray-600">
            {year}년 공사별 성과
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-5">
          <PivotProjectTable data={pivotData} year={year} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음 (ProjectTable.tsx는 아직 삭제 전이므로 고아 파일로 남아 있어도 빌드에 영향 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/sales/page.tsx
git commit -m "feat: page.tsx — pivotData 집계 + 레이아웃 재구성(제목·차트위·이익률제거)"
```

---

## Task 8: `ProjectTable.tsx` 삭제 + 최종 검증

**Files:**
- Delete: `src/app/(dashboard)/sales/_components/ProjectTable.tsx`

- [ ] **Step 1: 파일 삭제**

```bash
rm src/app/\(dashboard\)/sales/_components/ProjectTable.tsx
```

- [ ] **Step 2: tsc 최종 검증**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```

Expected: Build succeeded

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: ProjectTable 삭제 — PivotProjectTable로 완전 교체"
```

---

## 검토 체크리스트 (스펙 → 플랜 커버리지)

| 스펙 항목 | 커버하는 Task |
|---|---|
| 1. 페이지 제목 "매출손익" | Task 7 (page.tsx 헤더) |
| 2. 지브라 패턴 (홀수 행 bg-gray-50/50) | Task 3 (PivotProjectTable collapsed row) |
| 3. 페이징 25건 + 하단 페이지네이터 | Task 3 (Paginator 컴포넌트) |
| 4. 손익색 \|손익\| ≥ 5M 조건 | Task 3, 4, 5 (손익색 함수) |
| 5. 차트를 테이블 위로 + 헤더에 연간 합계 | Task 5 (CollapsibleChart), Task 7 (순서) |
| 6. 이익률 완전 제거 | Task 3 (PivotProjectTable), Task 6 (ExcelExportButton), Task 7 (KPI) |
| 7. 피벗 확장 테이블 (펼침 + 주별 링크) | Task 3 (ExpandedBlock), Task 4 (WeeklyDetailModal) |
| ISO 주 계산 헬퍼 | Task 1-2 (pivot.ts + 테스트) |
| ExcelExportButton 3시트 | Task 6 |
| 주별 데이터 없는 공사 — "주별로 보기" 숨김 | Task 3 (`hasWeekly` 조건) |
| ProjectTable.tsx 삭제 | Task 8 |
