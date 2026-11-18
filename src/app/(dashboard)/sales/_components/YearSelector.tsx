'use client'

import { useRouter } from 'next/navigation'
import { partsKST } from '@/lib/kst'

export function YearSelector({ currentYear }: { currentYear: number }) {
  const router = useRouter()
  // 브라우저 시계라도 KST 로 못 박는다 — 해외·시간대 오설정 기기에서 연초에 목록이 한 해 밀리지 않게
  const now = partsKST().year
  const years = Array.from({ length: 5 }, (_, i) => now - 2 + i)

  return (
    <select
      value={currentYear}
      onChange={(e) => router.push(`/sales?year=${e.target.value}`)}
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
