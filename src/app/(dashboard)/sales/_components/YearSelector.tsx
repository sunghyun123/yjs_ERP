'use client'

import { useRouter } from 'next/navigation'
import { partsKST } from '@/lib/kst'
import type { SalesBasis } from './BasisToggle'

export function YearSelector({ currentYear, basis }: { currentYear: number; basis: SalesBasis }) {
  const router = useRouter()
  // 브라우저 시계라도 KST 로 못 박는다 — 해외·시간대 오설정 기기에서 연초에 목록이 한 해 밀리지 않게
  const now = partsKST().year
  const years = Array.from({ length: 5 }, (_, i) => now - 2 + i)
  // 연도를 바꿔도 보던 기준(금요일)을 유지한다 — 안 그러면 연도만 바꿨는데 표가 말일로 돌아간다
  const suffix = basis === 'friday' ? '&basis=friday' : ''

  return (
    <select
      value={currentYear}
      onChange={(e) => router.push(`/sales?year=${e.target.value}${suffix}`)}
      className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  )
}
