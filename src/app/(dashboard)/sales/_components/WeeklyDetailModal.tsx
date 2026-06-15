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
