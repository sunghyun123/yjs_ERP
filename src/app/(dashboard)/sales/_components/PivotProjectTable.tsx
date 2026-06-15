'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatEok } from '@/lib/format'
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

/** 컬럼 너비(px) — table-fixed + colgroup으로 정확히 고정. sticky left 오프셋도 여기서 파생 */
const COL = { no: 92, name: 240, sum: 104, month: 74 } as const
const TABLE_WIDTH = COL.no + COL.name + COL.sum + COL.month * 12
const LEFT_NAME = COL.no // 공사명 sticky 시작 위치 = 지중No 너비

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function rowTotal(row: PivotProjectRow, metric: Metric) {
  if (metric === '성과') return row.성과금액
  if (metric === '투입') return row.투입금액
  return row.손익금액
}

/** 0은 '—', 손익 흑자는 +접두사 */
function formatCell(value: number, metric: Metric) {
  if (value === 0) return '—'
  if (metric === '손익' && value > 0) return `+${formatEok(value)}`
  return formatEok(value)
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
  const [metric, setMetric] = useState<Metric>('손익')
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

  /** 전체 합계 행 — 월별 총합 + 총계 */
  const totals = useMemo(() => {
    const monthly = Array.from({ length: 12 }, () => 0)
    let total = 0
    for (const row of rows) {
      for (let i = 0; i < 12; i++) monthly[i] += row.monthly[i]?.[metric] ?? 0
      total += rowTotal(row, metric)
    }
    return { monthly, total }
  }, [rows, metric])

  const metricColor = metric === '성과' ? '#2563eb' : metric === '투입' ? '#d97706' : '#374151'

  return (
    <div className="space-y-4">
      {/* ── 툴바: 지표 토글 + 검색 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {METRICS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setMetric(item)}
              className={cn(
                'h-8 rounded-md px-4 text-sm font-medium transition-colors',
                metric === item
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
              )}
            >
              {item}
            </button>
          ))}
        </div>

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

      {/* ── 표 ── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table
          className="border-separate border-spacing-0 text-xs"
          style={{ width: TABLE_WIDTH, tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: COL.no }} />
            <col style={{ width: COL.name }} />
            <col style={{ width: COL.sum }} />
            {MONTHS.map(m => (
              <col key={m} style={{ width: COL.month }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-gray-50">
              <th
                className="sticky left-0 z-20 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-left font-medium text-gray-500"
                style={{ left: 0 }}
              >
                지중No
              </th>
              <th
                className="sticky z-20 whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-left font-medium text-gray-500"
                style={{ left: LEFT_NAME }}
              >
                공사명
              </th>
              <th
                className="whitespace-nowrap border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-right font-semibold"
                style={{ color: metricColor }}
              >
                합계
              </th>
              {MONTHS.map(month => (
                <th
                  key={month}
                  className="whitespace-nowrap border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-right font-medium text-gray-500"
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-10 text-center text-sm text-gray-400">
                  조건에 맞는 공사가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const bg = index % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'
                const total = rowTotal(row, metric)
                return (
                  <tr key={row.id} className={cn('transition-colors hover:bg-slate-50', bg)}>
                    <td
                      className={cn('sticky left-0 z-10 whitespace-nowrap border-b border-gray-100 px-3 py-2 font-mono text-gray-500', bg)}
                      style={{ left: 0 }}
                    >
                      {row.지중no}
                    </td>
                    <td
                      className={cn('sticky z-10 border-b border-r border-gray-100 px-3 py-2', bg)}
                      style={{ left: LEFT_NAME }}
                    >
                      <span className="block truncate font-medium text-gray-800" title={row.공사명}>
                        {row.공사명}
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap border-b border-r border-gray-100 px-3 py-2 text-right font-semibold tabular-nums"
                      style={{ color: cellColor(total, metric) }}
                    >
                      {formatCell(total, metric)}
                    </td>
                    {MONTHS.map((month, i) => {
                      const value = row.monthly[i]?.[metric] ?? 0
                      return (
                        <td
                          key={month}
                          className="whitespace-nowrap border-b border-gray-100 px-2 py-2 text-right tabular-nums"
                          style={{ color: cellColor(value, metric) }}
                        >
                          {formatCell(value, metric)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td
                  className="sticky left-0 z-10 whitespace-nowrap border-t border-gray-200 bg-gray-100 px-3 py-2.5 text-gray-600"
                  style={{ left: 0 }}
                >
                  합계
                </td>
                <td
                  className="sticky z-10 whitespace-nowrap border-t border-r border-gray-200 bg-gray-100 px-3 py-2.5 text-gray-400"
                  style={{ left: LEFT_NAME }}
                >
                  {rows.length.toLocaleString('ko-KR')}건
                </td>
                <td
                  className="whitespace-nowrap border-t border-r border-gray-200 px-3 py-2.5 text-right tabular-nums"
                  style={{ color: cellColor(totals.total, metric) }}
                >
                  {formatCell(totals.total, metric)}
                </td>
                {totals.monthly.map((value, i) => (
                  <td
                    key={MONTHS[i]}
                    className="whitespace-nowrap border-t border-gray-200 px-2 py-2.5 text-right tabular-nums"
                    style={{ color: cellColor(value, metric) }}
                  >
                    {formatCell(value, metric)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-gray-400">
        총 {rows.length.toLocaleString('ko-KR')}건
      </p>
    </div>
  )
}
