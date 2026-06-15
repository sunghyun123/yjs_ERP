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
    const windowStart = page > 2 ? Math.max(1, page - 2) : 0
    for (let i = windowStart; i <= Math.min(totalPages - 1, page + 2); i++) pages.push(i)
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
