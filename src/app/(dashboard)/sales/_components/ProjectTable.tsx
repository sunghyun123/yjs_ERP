'use client'

import { useState, useDeferredValue } from 'react'
import { Input } from '@/components/ui/input'
import { formatEok } from '@/lib/format'

export type ProjectRow = {
  id: number
  지중no: string
  공사명: string
  성과금액: number
  투입금액: number
  손익금액: number
  이익률: number
}

export function ProjectTable({ data }: { data: ProjectRow[] }) {
  const [query, setQuery] = useState('')
  const dq = useDeferredValue(query)

  const filtered = dq
    ? data.filter(
        r =>
          r.지중no.toLowerCase().includes(dq.toLowerCase()) ||
          r.공사명.toLowerCase().includes(dq.toLowerCase()),
      )
    : data

  const 합계성과 = filtered.reduce((s, r) => s + r.성과금액, 0)
  const 합계투입 = filtered.reduce((s, r) => s + r.투입금액, 0)
  const 합계손익 = 합계성과 - 합계투입
  const 합계이익률 = 합계성과 > 0 ? (합계손익 / 합계성과) * 100 : 0

  return (
    <div className="space-y-3">
      <Input
        placeholder="지중No 또는 공사명 검색..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="max-w-xs h-9 text-sm"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2.5 px-3 font-medium text-gray-500 w-28">지중No</th>
              <th className="text-left py-2.5 px-3 font-medium text-gray-500">공사명</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-500">성과금액</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-500">투입금액</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-500">손익</th>
              <th className="text-right py-2.5 px-3 font-medium text-gray-500 w-20">이익률</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr
                key={row.id}
                className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
              >
                <td className="py-2 px-3 font-mono text-xs text-gray-400">{row.지중no}</td>
                <td className="py-2 px-3 text-gray-700 max-w-[260px] truncate">{row.공사명}</td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                  {formatEok(row.성과금액)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                  {formatEok(row.투입금액)}
                </td>
                <td
                  className="py-2 px-3 text-right tabular-nums font-medium"
                  style={{
                    color:
                      row.손익금액 > 0 ? '#22c55e' : row.손익금액 < 0 ? '#ef4444' : '#94a3b8',
                  }}
                >
                  {formatEok(row.손익금액)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-500">
                  {row.성과금액 > 0 ? row.이익률.toFixed(1) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50/50">
              <td className="py-3 px-3 font-bold text-gray-700" colSpan={2}>
                합계 ({filtered.length}건)
              </td>
              <td className="py-3 px-3 text-right tabular-nums font-bold text-gray-700">
                {formatEok(합계성과)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums font-bold text-gray-700">
                {formatEok(합계투입)}
              </td>
              <td
                className="py-3 px-3 text-right tabular-nums font-bold"
                style={{ color: 합계손익 > 0 ? '#22c55e' : 합계손익 < 0 ? '#ef4444' : '#0f172a' }}
              >
                {formatEok(합계손익)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums font-bold text-gray-700">
                {합계성과 > 0 ? 합계이익률.toFixed(1) + '%' : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
