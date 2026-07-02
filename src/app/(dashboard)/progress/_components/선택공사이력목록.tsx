'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatKRW } from '@/lib/format'
import { paginate } from '../_lib/pagination'
import type { 이력레코드 } from './이력수정Sheet'

// 선택공사이력목록 (컴포넌트 함수명은 ASCII 대문자 시작 — react-hooks 린트가 훅 검사를 하는 조건)
export function SelectedHistoryList({
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
