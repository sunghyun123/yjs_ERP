'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { 손익색 } from '../_lib/colors'

/* ------------------------------------------------------------------ */
/*  Types — kept identical so page.tsx / ExcelExportButton 그대로 동작  */
/* ------------------------------------------------------------------ */

export type PivotProjectRow = {
  id: number
  지중no: string
  공사명: string
  성과금액: number
  투입금액: number
  손익금액: number
  monthly: Array<{ 성과: number; 투입: number; 손익: number }>
}

type Props = {
  data: PivotProjectRow[]
}

type Metric = '성과' | '투입' | '손익'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const METRICS: Metric[] = ['성과', '투입', '손익']

/** 지표별 라벨 색 — 성과 파랑 / 투입 주황 / 손익은 흑·적자색을 값에서 따로 처리 */
const METRIC_COLOR: Record<Metric, string> = {
  성과: '#2563eb',
  투입: '#d97706',
  손익: '#374151',
}

/** 컬럼 너비(px) — 원 단위(일의 자리까지) 표기를 위해 넉넉히. sticky left 오프셋도 여기서 파생 */
const COL = { no: 88, name: 200, metric: 48, sum: 128, month: 104 } as const
const TABLE_WIDTH = COL.no + COL.name + COL.metric + COL.sum + COL.month * 12
const LEFT_NAME = COL.no // 공사명 sticky 시작 = 지중No 너비
const LEFT_METRIC = COL.no + COL.name // 지표 sticky 시작 = 지중No + 공사명

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function rowTotal(row: PivotProjectRow, metric: Metric) {
  if (metric === '성과') return row.성과금액
  if (metric === '투입') return row.투입금액
  return row.손익금액
}

/** 원 단위(일의 자리까지, 천단위 콤마). 0은 '—', 손익 흑자는 +접두사 */
function formatCell(value: number, metric: Metric) {
  if (value === 0) return '—'
  const won = Math.round(value).toLocaleString('ko-KR')
  if (metric === '손익' && value > 0) return `+${won}`
  return won
}

/** 손익만 흑자/적자 색, 성과·투입은 기본색 */
function cellColor(value: number, metric: Metric) {
  if (value === 0) return '#d1d5db' // gray-300
  if (metric === '손익') return 손익색(value)
  return '#374151' // gray-700
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PivotProjectTable({ data }: Props) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const rows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (q.length === 0) return data
    return data.filter(
      row =>
        row.지중no.toLowerCase().includes(q) ||
        row.공사명.toLowerCase().includes(q),
    )
  }, [data, deferredQuery])

  /** 전체 합계 — 지표별 월별 총합 + 총계 */
  const totals = useMemo(() => {
    const make = () => ({ monthly: Array.from({ length: 12 }, () => 0), total: 0 })
    const result: Record<Metric, { monthly: number[]; total: number }> = {
      성과: make(),
      투입: make(),
      손익: make(),
    }
    for (const row of rows) {
      for (const metric of METRICS) {
        for (let i = 0; i < 12; i++) result[metric].monthly[i] += row.monthly[i]?.[metric] ?? 0
        result[metric].total += rowTotal(row, metric)
      }
    }
    return result
  }, [rows])

  return (
    <div className="space-y-4">
      {/* ── 툴바: 단위 안내 + 검색 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-gray-400">단위: 원</span>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="지중No 또는 공사명 검색"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      {/* ── 표: 가로·세로 동시 스크롤 + 헤더 고정 ── */}
      <div className="overflow-auto rounded-lg border border-gray-200" style={{ maxHeight: '70vh' }}>
        <table
          className="border-separate border-spacing-0 text-xs"
          style={{ width: TABLE_WIDTH, tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: COL.no }} />
            <col style={{ width: COL.name }} />
            <col style={{ width: COL.metric }} />
            <col style={{ width: COL.sum }} />
            {MONTHS.map(m => (
              <col key={m} style={{ width: COL.month }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-gray-50">
              <th
                className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-left font-medium text-gray-500"
                style={{ left: 0 }}
              >
                지중No
              </th>
              <th
                className="sticky top-0 z-30 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-left font-medium text-gray-500"
                style={{ left: LEFT_NAME }}
              >
                공사명
              </th>
              <th
                className="sticky top-0 z-30 whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-2 py-2.5 text-center font-medium text-gray-500"
                style={{ left: LEFT_METRIC }}
              >
                지표
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-right font-semibold text-gray-600">
                합계
              </th>
              {MONTHS.map(month => (
                <th
                  key={month}
                  className="sticky top-0 z-20 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-right font-medium text-gray-500"
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-10 text-center text-sm text-gray-400">
                  조건에 맞는 공사가 없습니다.
                </td>
              </tr>
            ) : (
              <>
                {/* ── 전체 합계 그룹 (맨 위) ── */}
                {METRICS.map((metric, mIdx) => {
                  const isFirst = mIdx === 0
                  const isLast = mIdx === METRICS.length - 1
                  const t = totals[metric]
                  const sep = cn(isFirst && 'border-t border-gray-200', isLast && 'border-b-2 border-gray-300')
                  return (
                    <tr key={`total-${metric}`} className="bg-gray-100 font-semibold">
                      {isFirst && (
                        <>
                          <td
                            rowSpan={3}
                            className={cn('sticky left-0 z-10 whitespace-nowrap bg-gray-100 px-3 py-2.5 align-top text-gray-600', sep)}
                            style={{ left: 0 }}
                          >
                            합계
                          </td>
                          <td
                            rowSpan={3}
                            className={cn('sticky z-10 whitespace-nowrap border-r border-gray-300 bg-gray-100 px-3 py-2.5 align-top text-gray-400', sep)}
                            style={{ left: LEFT_NAME }}
                          >
                            {rows.length.toLocaleString('ko-KR')}건
                          </td>
                        </>
                      )}
                      <td
                        className={cn('sticky z-10 whitespace-nowrap border-r border-gray-300 bg-gray-100 px-2 py-2.5 text-center', sep)}
                        style={{ left: LEFT_METRIC, color: METRIC_COLOR[metric] }}
                      >
                        {metric}
                      </td>
                      <td
                        className={cn('whitespace-nowrap border-r border-gray-200 px-3 py-2.5 text-right tabular-nums', sep)}
                        style={{ color: cellColor(t.total, metric) }}
                      >
                        {formatCell(t.total, metric)}
                      </td>
                      {t.monthly.map((value, i) => (
                        <td
                          key={MONTHS[i]}
                          className={cn('whitespace-nowrap px-2 py-2.5 text-right tabular-nums', sep)}
                          style={{ color: cellColor(value, metric) }}
                        >
                          {formatCell(value, metric)}
                        </td>
                      ))}
                    </tr>
                  )
                })}

                {/* ── 공사별 그룹 ── */}
                {rows.map((row, index) => {
                  const bg = index % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'
                  return METRICS.map((metric, mIdx) => {
                    const isFirst = mIdx === 0
                    const groupTop = isFirst ? 'border-t-2 border-gray-200' : ''
                    const total = rowTotal(row, metric)
                    return (
                      <tr key={`${row.id}-${metric}`} className={cn('transition-colors hover:bg-slate-50', bg)}>
                        {isFirst && (
                          <>
                            <td
                              rowSpan={3}
                              className={cn('sticky left-0 z-10 whitespace-nowrap px-3 py-2 align-top font-mono text-gray-500', bg, groupTop)}
                              style={{ left: 0 }}
                            >
                              {row.지중no}
                            </td>
                            <td
                              rowSpan={3}
                              className={cn('sticky z-10 border-r border-gray-200 px-3 py-2 align-top', bg, groupTop)}
                              style={{ left: LEFT_NAME }}
                            >
                              <span className="block truncate font-medium text-gray-800" title={row.공사명}>
                                {row.공사명}
                              </span>
                            </td>
                          </>
                        )}
                        <td
                          className={cn('sticky z-10 whitespace-nowrap border-r border-gray-200 px-2 py-2 text-center font-medium', bg, groupTop)}
                          style={{ left: LEFT_METRIC, color: METRIC_COLOR[metric] }}
                        >
                          {metric}
                        </td>
                        <td
                          className={cn('whitespace-nowrap border-r border-gray-100 px-3 py-2 text-right font-semibold tabular-nums', groupTop)}
                          style={{ color: cellColor(total, metric) }}
                        >
                          {formatCell(total, metric)}
                        </td>
                        {MONTHS.map((month, i) => {
                          const value = row.monthly[i]?.[metric] ?? 0
                          return (
                            <td
                              key={month}
                              className={cn('whitespace-nowrap px-2 py-2 text-right tabular-nums', groupTop)}
                              style={{ color: cellColor(value, metric) }}
                            >
                              {formatCell(value, metric)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        총 {rows.length.toLocaleString('ko-KR')}건
      </p>
    </div>
  )
}
