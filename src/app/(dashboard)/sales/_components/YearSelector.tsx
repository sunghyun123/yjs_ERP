'use client'

import { useRouter } from 'next/navigation'

export function YearSelector({ currentYear }: { currentYear: number }) {
  const router = useRouter()
  const now = new Date().getFullYear()
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
