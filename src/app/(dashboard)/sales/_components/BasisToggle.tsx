// src/app/(dashboard)/sales/_components/BasisToggle.tsx
'use client'

import { useRouter } from 'next/navigation'

export type SalesBasis = 'month-end' | 'friday'

/**
 * 표만 바꾸는 스왑 버튼. 상태는 URL(?basis=friday)에 둔다 — 새로고침·링크 공유에도 같은 화면이 나오고,
 * 서버 컴포넌트가 그 값으로 다시 그린다(클라이언트 state 를 따로 두면 서버가 그린 표와 어긋날 수 있다).
 */
export function BasisToggle({ year, basis }: { year: number; basis: SalesBasis }) {
  const router = useRouter()
  const go = (next: SalesBasis) =>
    router.push(next === 'friday' ? `/sales?year=${year}&basis=friday` : `/sales?year=${year}`)

  const btn = (value: SalesBasis, label: string) => (
    <button
      type="button"
      onClick={() => go(value)}
      aria-pressed={basis === value}
      className={
        basis === value
          ? 'px-3 h-9 text-sm bg-blue-600 text-white'
          : 'px-3 h-9 text-sm bg-white text-gray-600 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  )

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200 shadow-sm">
      {btn('month-end', '말일 기준')}
      {btn('friday', '금요일 기준')}
    </div>
  )
}
