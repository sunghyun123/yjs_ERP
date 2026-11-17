// src/app/(dashboard)/sales/_components/BasisToggle.tsx
'use client'

import { useRouter } from 'next/navigation'

/** 표 보기: 공사별 성과 / 시공 기록·준공 반영·성과 세 줄(월별). 기간은 둘 다 달력 월이다 */
export type SalesView = 'project' | 'breakdown'

/**
 * 표만 바꾸는 스왑 버튼. 상태는 URL(?view=breakdown)에 둔다 — 새로고침·링크 공유에도 같은 화면이 나오고,
 * 서버 컴포넌트가 그 값으로 다시 그린다(클라이언트 state 를 따로 두면 서버가 그린 표와 어긋날 수 있다).
 */
export function BasisToggle({ year, view }: { year: number; view: SalesView }) {
  const router = useRouter()
  const go = (next: SalesView) =>
    router.push(next === 'breakdown' ? `/sales?year=${year}&view=breakdown` : `/sales?year=${year}`)

  const btn = (value: SalesView, label: string) => (
    <button
      type="button"
      onClick={() => go(value)}
      aria-pressed={view === value}
      className={
        view === value
          ? 'px-3 h-9 text-sm bg-blue-600 text-white'
          : 'px-3 h-9 text-sm bg-white text-gray-600 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  )

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200 shadow-sm">
      {btn('project', '공사별')}
      {btn('breakdown', '시공·준공 나눠 보기')}
    </div>
  )
}
