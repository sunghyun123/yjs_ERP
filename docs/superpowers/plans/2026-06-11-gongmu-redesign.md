# 공무 보고서 UI 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공무 보고서 3단계 네비게이션을 2단계로 단순화하고(대시보드 1-page + 개인상세), 월 이동 네비게이션과 textarea 기반 작업 입력을 추가한다.

**Architecture:** `/gongmu` 대시보드를 KPI 3카드 + 담당자 4열 그리드로 전면 재설계한다. 개인 상세 페이지에는 헤더 월 이동과 WeeklyReportForm 통합 월간 현황 카드를 추가한다. 불필요해진 `total/page.tsx`와 `MonthlySummary.tsx`를 삭제한다.

**Tech Stack:** Next.js 16 App Router (Server Components, async searchParams), Supabase, TypeScript, Tailwind CSS, shadcn/ui Button

---

## File Map

| 파일 | 변경 |
|------|------|
| `src/app/(dashboard)/gongmu/page.tsx` | 전면 재작성 |
| `src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx` | 전면 재작성 |
| `src/app/(dashboard)/gongmu/[id]/page.tsx` | 수정 (월 이동, prop 정리) |
| `src/app/(dashboard)/gongmu/total/page.tsx` | **삭제** |
| `src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx` | **삭제** |

---

## Task 1: 대시보드 재설계 + total 삭제

**Files:**
- Rewrite: `src/app/(dashboard)/gongmu/page.tsx`
- Delete: `src/app/(dashboard)/gongmu/total/page.tsx`

- [ ] **Step 1: total/page.tsx 삭제**

```bash
rm "src/app/(dashboard)/gongmu/total/page.tsx"
```

- [ ] **Step 2: page.tsx 전체 교체**

`src/app/(dashboard)/gongmu/page.tsx` 를 아래 내용으로 교체한다.

```tsx
// src/app/(dashboard)/gongmu/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import { formatEok } from '@/lib/format'
import { calc달성률 } from './_lib/calc'

export const metadata = { title: '공무 보고서 | 영전사 ERP' }

function shiftMonth(yyyy: number, mm: number, delta: number): string {
  const d = new Date(yyyy, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function pctColor(pct: number) {
  return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
}

export default async function GongmuPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const monthStr = sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [calYearStr, calMonthStr] = monthStr.split('-')
  const calYear = Number(calYearStr)
  const calMonth = Number(calMonthStr)

  const { year: curYear, week: curWeek } = getCurrentWeek()
  const weekNos = getWeeksInMonth(calYear, calMonth).map((w) => w.week)

  // 금주 실적 KPI 카드 타이틀용 레이블 (현재 주차 기준)
  const curMonthWeeks = getWeeksInMonth(curYear, now.getMonth() + 1)
  const curWeekEntry = curMonthWeeks.find((w) => w.week === curWeek)
  const curWeekLabel = curWeekEntry
    ? `${now.getMonth() + 1}월 ${curWeekEntry.label.match(/^\d+주차/)?.[0] ?? `${curWeek}주차`}`
    : `${curWeek}주차`

  const supabase = await createClient()
  const { data: 공무들raw } = await supabase.from('공무담당자').select('id, 이름').order('이름')
  const 공무들 = (공무들raw ?? []) as { id: number; 이름: string }[]

  if (공무들.length === 0) {
    return (
      <div className="p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <p className="text-sm text-gray-500">등록된 공무담당자가 없습니다.</p>
      </div>
    )
  }

  const ids = 공무들.map((g) => g.id)

  const [plansResult, monthRowsResult, weekRowsResult] = await Promise.all([
    supabase
      .from('공무_월간계획')
      .select('공무_id, 구분, 월간계획금액')
      .in('공무_id', ids)
      .eq('year', calYear)
      .eq('month', calMonth),
    supabase
      .from('공무_주간보고')
      .select('공무_id, 구분, 금주실적')
      .in('공무_id', ids)
      .eq('year', calYear)
      .in('week_no', weekNos),
    supabase
      .from('공무_주간보고')
      .select('공무_id, 구분, 금주실적')
      .in('공무_id', ids)
      .eq('year', curYear)
      .eq('week_no', curWeek),
  ])

  const plans = (plansResult.data ?? []) as { 공무_id: number; 구분: string; 월간계획금액: number }[]
  const monthRows = (monthRowsResult.data ?? []) as { 공무_id: number; 구분: string; 금주실적: number }[]
  const weekRows = (weekRowsResult.data ?? []) as { 공무_id: number; 구분: string; 금주실적: number }[]

  // 전체 KPI
  const 총계획공사 = plans.filter((p) => p.구분 === '공사').reduce((s, p) => s + p.월간계획금액, 0)
  const 총계획공무 = plans.filter((p) => p.구분 === '공무').reduce((s, p) => s + p.월간계획금액, 0)
  const 총누계공사 = monthRows.filter((r) => r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 총누계공무 = monthRows.filter((r) => r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)
  const 총금주공사 = weekRows.filter((r) => r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 총금주공무 = weekRows.filter((r) => r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)

  // 담당자별 집계
  const personData = 공무들.map((g) => ({
    ...g,
    계획공사: plans.filter((p) => p.공무_id === g.id && p.구분 === '공사').reduce((s, p) => s + p.월간계획금액, 0),
    계획공무: plans.filter((p) => p.공무_id === g.id && p.구분 === '공무').reduce((s, p) => s + p.월간계획금액, 0),
    누계공사: monthRows.filter((r) => r.공무_id === g.id && r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0),
    누계공무: monthRows.filter((r) => r.공무_id === g.id && r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0),
    금주: weekRows.filter((r) => r.공무_id === g.id).reduce((s, r) => s + r.금주실적, 0),
  }))

  const 시그마금주 = weekRows.reduce((s, r) => s + r.금주실적, 0)
  const 공사달성 = calc달성률(총누계공사, 총계획공사) ?? 0
  const 공무달성 = calc달성률(총누계공무, 총계획공무) ?? 0

  return (
    <div className="p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">공무 보고서</h1>
          <p className="text-sm text-gray-500 mt-0.5">{calYear}년 {calMonth}월</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/gongmu?month=${shiftMonth(calYear, calMonth, -1)}`}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            ◀ {new Date(calYear, calMonth - 2, 1).getMonth() + 1}월
          </Link>
          <span className="border border-[#1e2d5a] bg-[#1e2d5a] text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
            {calMonth}월
          </span>
          <Link
            href={`/gongmu?month=${shiftMonth(calYear, calMonth, 1)}`}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {new Date(calYear, calMonth, 1).getMonth() + 1}월 ▶
          </Link>
        </div>
      </div>

      {/* KPI 3카드 */}
      <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">전체 종합 현황</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([
          {
            title: '총 월간계획',
            rows: [
              { tag: '공사', tagCls: 'bg-blue-100 text-blue-800', amount: formatEok(총계획공사) },
              { tag: '공무', tagCls: 'bg-green-100 text-green-800', amount: formatEok(총계획공무) },
            ],
          },
          {
            title: '총 월간실적 (누적)',
            rows: [
              { tag: '공사', tagCls: 'bg-blue-100 text-blue-800', amount: formatEok(총누계공사) },
              { tag: '공무', tagCls: 'bg-green-100 text-green-800', amount: formatEok(총누계공무) },
            ],
          },
          {
            title: `금주 실적 (${curWeekLabel})`,
            rows: [
              { tag: '공사', tagCls: 'bg-blue-100 text-blue-800', amount: formatEok(총금주공사) },
              { tag: '공무', tagCls: 'bg-green-100 text-green-800', amount: formatEok(총금주공무) },
            ],
          },
        ] as const).map(({ title, rows }) => (
          <div key={title} className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 mb-3">{title}</p>
            {rows.map(({ tag, tagCls, amount }) => (
              <div key={tag} className="flex justify-between items-center mb-2 last:mb-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${tagCls}`}>{tag}</span>
                <span className="text-base font-bold text-[#1e2d5a]">{amount}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 담당자 그리드 */}
      <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">
        담당자별 현황 · 클릭하면 상세 보고서로 이동
      </p>
      <div className="grid grid-cols-4 gap-3">
        {/* Σ 전체 합산 카드 */}
        <div className="bg-gradient-to-br from-[#1e2d5a] to-[#2d45a8] rounded-2xl p-5">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base mb-3">
            Σ
          </div>
          <p className="font-bold text-white mb-0.5">월간 전체 합산</p>
          <p className="text-xs text-white/60 mb-3">
            금주 실적 <strong className="text-white">{formatEok(시그마금주)}</strong>
          </p>
          {([
            { label: '공사 달성률 (월간)', pct: 공사달성, 실적: 총누계공사, 계획: 총계획공사 },
            { label: '공무 달성률 (월간)', pct: 공무달성, 실적: 총누계공무, 계획: 총계획공무 },
          ] as const).map(({ label, pct, 실적, 계획 }) => (
            <div key={label} className="mb-3 last:mb-0">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] text-white/60 font-semibold">{label}</span>
                <span className="text-xs font-bold text-white">{계획 > 0 ? `${pct}%` : '—'}</span>
              </div>
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-300" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-[10px] text-white/50 mt-0.5 text-right">
                {formatEok(실적)} / {formatEok(계획)}
              </p>
            </div>
          ))}
        </div>

        {/* 개인 카드 */}
        {personData.map((g) => {
          const 공사달성률 = calc달성률(g.누계공사, g.계획공사) ?? 0
          const 공무달성률 = calc달성률(g.누계공무, g.계획공무) ?? 0
          return (
            <Link key={g.id} href={`/gongmu/${g.id}?month=${monthStr}`} className="block">
              <div className="bg-white rounded-2xl p-5 shadow-sm border-[1.5px] border-transparent hover:border-blue-400 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-base mb-3">
                  {g.이름.slice(0, 1)}
                </div>
                <p className="font-bold text-[#1e2d5a] mb-0.5">{g.이름}</p>
                <p className="text-xs text-gray-400 mb-3">
                  금주 실적 <strong className="text-[#1e2d5a]">{formatEok(g.금주)}</strong>
                </p>
                {([
                  { label: '공사 달성률 (월간)', pct: 공사달성률, 실적: g.누계공사, 계획: g.계획공사 },
                  { label: '공무 달성률 (월간)', pct: 공무달성률, 실적: g.누계공무, 계획: g.계획공무 },
                ] as const).map(({ label, pct, 실적, 계획 }) => (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] text-gray-400 font-semibold">{label}</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: 계획 > 0 ? pctColor(pct) : '#d1d5db' }}
                      >
                        {계획 > 0 ? `${pct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: 계획 > 0 ? pctColor(pct) : '#e5e7eb',
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                      {formatEok(실적)} / {formatEok(계획)}
                    </p>
                  </div>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

오류 없음을 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/page.tsx
git rm src/app/\(dashboard\)/gongmu/total/page.tsx
git commit -m "feat: 공무 대시보드 재설계 — KPI 카드 + 담당자 그리드 + 월 이동"
```

---

## Task 2: WeeklyReportForm 재설계

**Files:**
- Rewrite: `src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx`

이 Task는 Task 3보다 먼저 실행해야 한다. Task 3에서 `allRows` prop을 page.tsx에서 전달하기 전에, WeeklyReportForm이 먼저 optional prop을 받아야 TypeScript가 통과한다.

- [ ] **Step 1: WeeklyReportForm.tsx 전체 교체**

`src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx` 를 아래 내용으로 교체한다.

```tsx
'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { save주간보고, upsert월간계획 } from '../../_lib/actions'
import { exportWeeklyReport } from '../../_lib/excel'
import { getWeeksInMonth } from '@/lib/week'
import { formatEok } from '@/lib/format'
import type { 공무_주간보고Row, 공무_월간계획Row } from '@/types/database'

type 수주항목 = { id: number; 지중no: string; 공사명: string }
type 보고행 = {
  id?: number
  지중no: string
  공사명: string
  금주작업: string
  차주작업: string
  금주계획: number
  금주실적: number
  차주계획: number
  구분: '공사' | '공무'
  비고: string
  isDraft?: boolean
  erp_공사이력_id?: number | null
  erp_기성_id?: number | null
}

type Props = {
  공무_id: number
  year: number
  week_no: number
  savedRows: 공무_주간보고Row[]
  이력초안: { id: number; 수주_id: number | null; 성과금액: number | null; 작업내용: string | null }[]
  기성초안: { id: number; 수주_id: number | null; 기성액_공급가: number | null; 작업내용: string | null }[]
  수주목록: 수주항목[]
  공무담당자목록: { id: number; 이름: string }[]
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  month: number
  이름: string
  weekLabel: string
  /** 해당 연도 전체 주간보고 집계 (월간 현황 카드 표시용, optional) */
  allRows?: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적' | '구분'>[]
}

// ── 편집 셀 공통 스타일 ──────────────────────────────────────
function cellCls(isDraft: boolean, extra = '') {
  const base = isDraft
    ? 'w-full rounded-md border border-blue-200 bg-blue-100/60 px-2 py-1 text-sm text-[#1e2d5a] outline-none focus:border-blue-400 focus:bg-blue-100'
    : 'w-full rounded-md border border-blue-100 bg-blue-50/60 px-2 py-1 text-sm text-[#1e2d5a] outline-none focus:border-blue-400 focus:bg-blue-50'
  return extra ? `${base} ${extra}` : base
}

function NumberCell({ value, onChange, isDraft }: { value: number; onChange: (v: number) => void; isDraft: boolean }) {
  return (
    <input
      type="number"
      className={cellCls(isDraft, 'text-right')}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  )
}

function TextCell({ value, onChange, placeholder, isDraft }: { value: string; onChange: (v: string) => void; placeholder?: string; isDraft: boolean }) {
  return (
    <input
      type="text"
      className={cellCls(isDraft)}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TextAreaCell({ value, onChange, placeholder, isDraft }: { value: string; onChange: (v: string) => void; placeholder?: string; isDraft: boolean }) {
  return (
    <textarea
      className={cellCls(isDraft, 'resize-vertical min-h-[66px] leading-relaxed font-sans py-1.5')}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function 공사SearchCell({ value, onChange, 수주목록, isDraft }: { value: string; onChange: (지중no: string, 공사명: string) => void; 수주목록: 수주항목[]; isDraft: boolean }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => { setQuery(value) }, [value])
  const filtered = query
    ? 수주목록.filter((s) => s.지중no.includes(query) || s.공사명.includes(query)).slice(0, 8)
    : []

  return (
    <div className="relative">
      <input
        type="text"
        className={cellCls(isDraft, 'pr-6')}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        value={query}
        placeholder="지중No 검색..."
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-48 max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s.지중no, s.공사명); setQuery(s.지중no); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
            >
              <span className="font-mono text-gray-400 mr-1">{s.지중no}</span>{s.공사명}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(query, query); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t"
          >
            &quot;{query}&quot; 직접 입력
          </button>
        </div>
      )}
    </div>
  )
}

export function WeeklyReportForm({
  공무_id, year, week_no, savedRows, 이력초안, 기성초안,
  수주목록, 공무담당자목록: _공무담당자목록,
  plans, month, 이름, weekLabel, allRows = [],
}: Props) {
  const [pending, startTransition] = useTransition()
  const [공사계획금액, set공사계획금액] = useState(plans.find((p) => p.구분 === '공사')?.월간계획금액 ?? 0)
  const [공무계획금액, set공무계획금액] = useState(plans.find((p) => p.구분 === '공무')?.월간계획금액 ?? 0)

  // 월간 현황 계산
  const monthWeekNos = new Set(getWeeksInMonth(year, month).map((w) => w.week))
  const 월간rows = allRows.filter((r) => monthWeekNos.has(r.week_no))
  const 공사누계 = 월간rows.filter((r) => r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 공무누계 = 월간rows.filter((r) => r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)
  const 금주공사 = allRows.filter((r) => r.week_no === week_no && r.year === year && r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 금주공무 = allRows.filter((r) => r.week_no === week_no && r.year === year && r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)
  const 공사달성 = 공사계획금액 > 0 ? Math.round((공사누계 / 공사계획금액) * 100 * 10) / 10 : null
  const 공무달성 = 공무계획금액 > 0 ? Math.round((공무누계 / 공무계획금액) * 100 * 10) / 10 : null

  function pctColor(pct: number) {
    return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
  }

  const weekShort = weekLabel.match(/^\d+주차/)?.[0] ?? weekLabel

  const initRows = (): 보고행[] => {
    const saved: 보고행[] = savedRows.map((r) => ({
      id: r.id,
      지중no: r.지중no ?? '',
      공사명: r.공사명,
      금주작업: r.금주작업 ?? '',
      차주작업: r.차주작업 ?? '',
      금주계획: r.금주계획,
      금주실적: r.금주실적,
      차주계획: r.차주계획,
      구분: r.구분,
      비고: r.비고 ?? '',
      erp_공사이력_id: r.erp_공사이력_id,
      erp_기성_id: r.erp_기성_id,
    }))
    const drafts공사: 보고행[] = 이력초안.map((d) => {
      const 수주 = 수주목록.find((s) => s.id === d.수주_id)
      return {
        지중no: 수주?.지중no ?? '',
        공사명: 수주?.공사명 ?? '',
        금주작업: d.작업내용 ?? '',
        차주작업: '',
        금주계획: 0,
        금주실적: d.성과금액 ?? 0,
        차주계획: 0,
        구분: '공사',
        비고: '',
        isDraft: true,
        erp_공사이력_id: d.id,
      }
    })
    const drafts공무: 보고행[] = 기성초안.map((d) => ({
      지중no: '',
      공사명: '',
      금주작업: d.작업내용 ?? '',
      차주작업: '',
      금주계획: 0,
      금주실적: d.기성액_공급가 ?? 0,
      차주계획: 0,
      구분: '공무',
      비고: '',
      isDraft: true,
      erp_기성_id: d.id,
    }))
    return [...saved, ...drafts공사, ...drafts공무]
  }

  const [rows, setRows] = useState<보고행[]>(initRows)
  const update = (i: number, patch: Partial<보고행>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = (구분: '공사' | '공무') =>
    setRows((prev) => [...prev, { 지중no: '', 공사명: '', 금주작업: '', 차주작업: '', 금주계획: 0, 금주실적: 0, 차주계획: 0, 구분, 비고: '' }])
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    startTransition(async () => {
      await upsert월간계획(공무_id, year, month, '공사', 공사계획금액)
      await upsert월간계획(공무_id, year, month, '공무', 공무계획금액)
      await save주간보고(
        공무_id, year, week_no,
        rows.map((r, i) => ({
          공무_id, year, week_no,
          항목순서: i,
          지중no: r.지중no || null,
          공사명: r.공사명,
          금주작업: r.금주작업 || null,
          차주작업: r.차주작업 || null,
          금주계획: r.금주계획,
          금주실적: r.금주실적,
          차주계획: r.차주계획,
          구분: r.구분,
          비고: r.비고 || null,
          erp_공사이력_id: r.erp_공사이력_id ?? null,
          erp_기성_id: r.erp_기성_id ?? null,
        })),
      )
    })
  }

  const th = 'text-[10px] font-semibold text-gray-500 px-2 py-2.5 bg-gray-50 text-left whitespace-nowrap'
  const thR = 'text-[10px] font-semibold text-gray-500 px-2 py-2.5 bg-gray-50 text-right whitespace-nowrap'

  const renderTable = (구분: '공사' | '공무') => {
    const tableRows = rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.구분 === 구분)
    const sumLabel = tableRows.reduce((s, r) => s + r.금주실적, 0).toLocaleString()

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-[#1e2d5a] text-white text-sm font-semibold px-4 py-2.5 flex justify-between items-center">
          <span>{구분 === '공사' ? '공사 파트' : '공무 파트'}</span>
          <span className="text-blue-300 font-normal text-xs">금주 실적: {sumLabel}원</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 구분 === '공사' ? 860 : 720 }}>
            <colgroup>
              {구분 === '공사' && (
                <>
                  <col style={{ width: 96 }} />
                  <col style={{ width: 190 }} />
                </>
              )}
              {구분 === '공무' && <col style={{ width: 36 }} />}
              <col style={{ width: '24%', minWidth: 200 }} />
              <col style={{ width: '24%', minWidth: 200 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 28 }} />
            </colgroup>
            <thead>
              <tr>
                {구분 === '공사' && <th className={th}>지중No</th>}
                <th className={th}>{구분 === '공사' ? '공사명' : '#'}</th>
                <th className={th}>금주 작업</th>
                <th className={th}>차주 작업</th>
                <th className={thR}>금주계획</th>
                <th className={thR}>금주실적</th>
                <th className={thR}>차주계획</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, rowIdx) => (
                <tr key={r.idx} className={r.isDraft ? 'bg-blue-50' : ''}>
                  {구분 === '공사' && (
                    <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                      <공사SearchCell
                        value={r.지중no}
                        onChange={(지중no, 공사명) => update(r.idx, { 지중no, 공사명 })}
                        수주목록={수주목록}
                        isDraft={r.isDraft ?? false}
                      />
                    </td>
                  )}
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    {구분 === '공사'
                      ? <TextCell value={r.공사명} onChange={(v) => update(r.idx, { 공사명: v })} isDraft={r.isDraft ?? false} />
                      : <span className="text-gray-400 px-1 text-sm">{rowIdx + 1}</span>
                    }
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-top">
                    <TextAreaCell
                      value={r.금주작업}
                      onChange={(v) => update(r.idx, { 금주작업: v })}
                      placeholder="작업 내용..."
                      isDraft={r.isDraft ?? false}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-top">
                    <TextAreaCell
                      value={r.차주작업}
                      onChange={(v) => update(r.idx, { 차주작업: v })}
                      placeholder="차주 계획..."
                      isDraft={r.isDraft ?? false}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    <NumberCell value={r.금주계획} onChange={(v) => update(r.idx, { 금주계획: v })} isDraft={r.isDraft ?? false} />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    <NumberCell value={r.금주실적} onChange={(v) => update(r.idx, { 금주실적: v })} isDraft={r.isDraft ?? false} />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    <NumberCell value={r.차주계획} onChange={(v) => update(r.idx, { 차주계획: v })} isDraft={r.isDraft ?? false} />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle text-center">
                    <button type="button" onClick={() => removeRow(r.idx)} className="text-gray-300 hover:text-red-400 px-1 text-base leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => addRow(구분)}
          className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-600 border-t border-dashed border-gray-200 hover:bg-gray-50 transition-colors"
        >
          + {구분 === '공사' ? '공사' : '공무'} 행 추가
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* 월간 현황 통합 카드 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">
            {year}년 {month}월 월간 현황
          </span>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-3 py-1">
            계획 수정 가능
          </span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {/* 공사 */}
          <div>
            <span className="inline-block text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded mb-2">공사</span>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-gray-400 w-7 shrink-0">계획</span>
              <input
                type="number"
                className="flex-1 h-7 border border-gray-200 rounded-md px-2 text-xs text-right font-semibold text-[#1e2d5a] bg-blue-50/60 outline-none focus:border-blue-400 min-w-0"
                value={공사계획금액 || ''}
                placeholder="0"
                onChange={(e) => set공사계획금액(Number(e.target.value) || 0)}
              />
              <span className="text-[10px] text-gray-400 shrink-0">원</span>
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-bold text-[#1e2d5a]">{formatEok(공사누계)}</span>
              <span className="text-xs font-bold" style={{ color: 공사달성 !== null ? pctColor(공사달성) : '#d1d5db' }}>
                {공사달성 !== null ? `${공사달성}%` : '—'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(공사달성 ?? 0, 100)}%` }} />
            </div>
          </div>
          {/* 공무 */}
          <div>
            <span className="inline-block text-[11px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded mb-2">공무</span>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-gray-400 w-7 shrink-0">계획</span>
              <input
                type="number"
                className="flex-1 h-7 border border-gray-200 rounded-md px-2 text-xs text-right font-semibold text-[#1e2d5a] bg-blue-50/60 outline-none focus:border-blue-400 min-w-0"
                value={공무계획금액 || ''}
                placeholder="0"
                onChange={(e) => set공무계획금액(Number(e.target.value) || 0)}
              />
              <span className="text-[10px] text-gray-400 shrink-0">원</span>
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-bold text-[#1e2d5a]">{formatEok(공무누계)}</span>
              <span className="text-xs font-bold" style={{ color: 공무달성 !== null ? pctColor(공무달성) : '#d1d5db' }}>
                {공무달성 !== null ? `${공무달성}%` : '—'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(공무달성 ?? 0, 100)}%` }} />
            </div>
          </div>
          {/* 금주 실적 패널 */}
          <div className="border-l border-gray-100 pl-5">
            <p className="text-[11px] font-bold text-gray-400 tracking-wide mb-1">
              금주 실적 ({month}월 {weekShort})
            </p>
            <p className="text-2xl font-extrabold text-[#1e2d5a] mt-2 mb-1">
              {formatEok(금주공사 + 금주공무)}
            </p>
            <p className="text-[11px] text-gray-400">
              공사 {formatEok(금주공사)} + 공무 {formatEok(금주공무)}
            </p>
          </div>
        </div>
      </div>

      {renderTable('공사')}
      {renderTable('공무')}

      <div className="flex justify-between items-center mt-2">
        {(이력초안.length > 0 || 기성초안.length > 0) ? (
          <p className="text-xs text-blue-500">✦ 파란 배경 행은 ERP에서 불러온 초안입니다.</p>
        ) : <span />}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-400 text-blue-600"
            onClick={() =>
              exportWeeklyReport(이름, year, week_no, weekLabel, rows.map((r) => ({
                지중no: r.지중no || null,
                공사명: r.공사명,
                금주작업: r.금주작업 || null,
                차주작업: r.차주작업 || null,
                금주계획: r.금주계획,
                금주실적: r.금주실적,
                차주계획: r.차주계획,
                구분: r.구분,
                비고: r.비고 || null,
              })))
            }
          >
            ↓ 엑셀 내보내기
          </Button>
          <Button
            size="sm"
            className="bg-[#1e2d5a] hover:bg-[#2d45a8] text-white"
            onClick={handleSave}
            disabled={pending}
          >
            {pending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

오류 없음을 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/\[id\]/_components/WeeklyReportForm.tsx
git commit -m "feat: WeeklyReportForm — 월간 현황 통합 카드, textarea 작업란, 컬럼 개선"
```

---

## Task 3: `[id]/page.tsx` 월 이동 + MonthlySummary 삭제

**Files:**
- Modify: `src/app/(dashboard)/gongmu/[id]/page.tsx`
- Delete: `src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx`

Task 2가 완료된 후 실행한다 (WeeklyReportForm에 `allRows` prop이 정의되어 있어야 함).

- [ ] **Step 1: MonthlySummary.tsx 삭제**

```bash
git rm src/app/\(dashboard\)/gongmu/\[id\]/_components/MonthlySummary.tsx
```

- [ ] **Step 2: `[id]/page.tsx` 교체**

`src/app/(dashboard)/gongmu/[id]/page.tsx` 를 아래 내용으로 교체한다.

```tsx
// src/app/(dashboard)/gongmu/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import type { 공무담당자Row, 공무_주간보고Row } from '@/types/database'
import { WeeklyReportForm } from './_components/WeeklyReportForm'

function shiftMonth(yyyy: number, mm: number, delta: number): string {
  const d = new Date(yyyy, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function GongmuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; week?: string; month?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const 공무_id = Number(id)
  if (isNaN(공무_id)) notFound()

  const supabase = await createClient()
  const { data: 공무raw } = await supabase.from('공무담당자').select('id, 이름').eq('id', 공무_id).single()
  const 공무 = 공무raw as Pick<공무담당자Row, 'id' | '이름'> | null
  if (!공무) notFound()

  // 월 파싱: YYYY-MM 형식 또는 구형 숫자 형식 모두 처리
  const now = new Date()
  let calYear: number
  let calMonth: number
  if (sp.month && sp.month.includes('-')) {
    const [y, m] = sp.month.split('-')
    calYear = Number(y)
    calMonth = Number(m)
  } else if (sp.month) {
    calYear = now.getFullYear()
    calMonth = Number(sp.month)
  } else {
    calYear = now.getFullYear()
    calMonth = now.getMonth() + 1
  }

  const { year: curYear, week: curWeek } = getCurrentWeek()
  const weekOptions = getWeeksInMonth(calYear, calMonth)

  // week/year 파라미터 없으면 해당 달의 첫 주차로 기본값 설정
  const selectedYear = sp.year ? Number(sp.year) : (weekOptions[0]?.isoYear ?? calYear)
  const selectedWeek = sp.week ? Number(sp.week) : (weekOptions[0]?.week ?? curWeek)

  const [planResult, allRowsResult, weekRowsResult, 수주Result, 공무담당자Result] = await Promise.all([
    supabase.from('공무_월간계획').select('구분, 월간계획금액').eq('공무_id', 공무_id).eq('year', calYear).eq('month', calMonth),
    supabase.from('공무_주간보고').select('week_no, year, 금주실적, 구분').eq('공무_id', 공무_id).eq('year', selectedYear),
    supabase.from('공무_주간보고').select('*').eq('공무_id', 공무_id).eq('year', selectedYear).eq('week_no', selectedWeek).order('항목순서'),
    supabase.from('수주').select('id, 지중no, 공사명').eq('준공여부', false).order('지중no'),
    supabase.from('공무담당자').select('id, 이름').order('이름'),
  ])

  const weekRows = (weekRowsResult.data ?? []) as 공무_주간보고Row[]
  const savedErp이력Ids = new Set(weekRows.map((r) => r.erp_공사이력_id).filter(Boolean))
  const savedErp기성Ids = new Set(weekRows.map((r) => r.erp_기성_id).filter(Boolean))

  const weekStart = weekOptions.find((w) => w.week === selectedWeek)
  const weekDates = weekStart
    ? { start: weekStart.label.match(/\((.+)~/)![1], end: weekStart.label.match(/~(.+)\)/)![1] }
    : null

  const [이력초안Result, 기성초안Result] = weekDates
    ? await Promise.all([
        supabase.from('공사이력')
          .select('id, 수주_id, 작업일자, 성과금액, 작업내용')
          .eq('담당공무_id', 공무_id)
          .gte('작업일자', `${selectedYear}-${weekDates.start}`)
          .lte('작업일자', `${selectedYear}-${weekDates.end}`),
        supabase.from('기성')
          .select('id, 수주_id, 기성일, 기성액_공급가, 작업내용')
          .eq('담당공무_id', 공무_id)
          .gte('기성일', `${selectedYear}-${weekDates.start}`)
          .lte('기성일', `${selectedYear}-${weekDates.end}`),
      ])
    : [{ data: [] }, { data: [] }]

  const 이력초안 = ((이력초안Result.data ?? []) as { id: number; 수주_id: number | null; 작업일자: string; 성과금액: number | null; 작업내용: string | null }[])
    .filter((r) => !savedErp이력Ids.has(r.id))
  const 기성초안 = ((기성초안Result.data ?? []) as { id: number; 수주_id: number | null; 기성일: string | null; 기성액_공급가: number | null; 작업내용: string | null }[])
    .filter((r) => !savedErp기성Ids.has(r.id))

  const monthStr = `${calYear}-${String(calMonth).padStart(2, '0')}`
  const prevMonth = shiftMonth(calYear, calMonth, -1)
  const nextMonth = shiftMonth(calYear, calMonth, 1)

  return (
    <div className="p-6" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-base shrink-0">
            {공무.이름.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{공무.이름}</h1>
            <p className="text-sm text-gray-400">주간업무보고</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 월 이동 */}
          <div className="flex gap-1.5">
            <Link
              href={`/gongmu/${공무_id}?month=${prevMonth}`}
              className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              ◀ {new Date(calYear, calMonth - 2, 1).getMonth() + 1}월
            </Link>
            <span className="border border-[#1e2d5a] bg-[#1e2d5a] text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
              {calMonth}월
            </span>
            <Link
              href={`/gongmu/${공무_id}?month=${nextMonth}`}
              className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {new Date(calYear, calMonth, 1).getMonth() + 1}월 ▶
            </Link>
          </div>
          <Link href={`/gongmu?month=${monthStr}`} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            ← 목록
          </Link>
        </div>
      </div>

      {/* 주차 탭 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {weekOptions.map((w) => (
          <Link
            key={`${w.isoYear}-${w.week}`}
            href={`/gongmu/${공무_id}?year=${w.isoYear}&week=${w.week}&month=${monthStr}`}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
              w.week === selectedWeek && w.isoYear === selectedYear
                ? 'bg-[#1e2d5a] text-white border-[#1e2d5a]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {w.label}
            {w.week === curWeek && w.isoYear === curYear && ' ✦'}
          </Link>
        ))}
      </div>

      <WeeklyReportForm
        공무_id={공무_id}
        year={selectedYear}
        week_no={selectedWeek}
        savedRows={weekRows}
        이력초안={이력초안}
        기성초안={기성초안}
        수주목록={수주Result.data ?? []}
        공무담당자목록={공무담당자Result.data ?? []}
        plans={planResult.data ?? []}
        month={calMonth}
        이름={공무.이름}
        weekLabel={weekOptions.find((w) => w.week === selectedWeek)?.label ?? ''}
        allRows={allRowsResult.data ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

오류 없음을 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/\[id\]/page.tsx
git commit -m "feat: 공무 상세 페이지 — 월 이동 네비게이션, allRows 연결, MonthlySummary 제거"
```

---

## 완료 확인

모든 Task 완료 후 브라우저에서 아래 동작을 확인한다:

1. `/gongmu` — 3 KPI 카드 표시, ◀/▶ 월 이동, 담당자 카드 그리드 (Σ + 개인)
2. `/gongmu?month=2026-05` — 5월 데이터로 전환, KPI 변경 확인
3. `/gongmu/[id]` — 헤더에 월 이동 버튼, 월간 현황 카드 (계획 입력 + 달성률 바), 테이블에 textarea
4. `/gongmu/[id]?month=2026-05` — 5월로 이동, 주차 탭이 5월 주차로 변경
5. 주간보고 행 추가/저장 — 기존과 동일하게 동작
6. 엑셀 내보내기 — 기존과 동일하게 동작
7. `/gongmu/total` — 404 (삭제 확인)
