// src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx
import { Card, CardContent } from '@/components/ui/card'
import type { 공무_월간계획Row, 공무_주간보고Row } from '@/types/database'
import { calc누적실적, calc금주실적합산, calc달성률, calc월간계획 } from '../../_lib/calc'
import { formatEok } from '@/lib/format'

type Props = {
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  allRows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적' | '구분'>[]
  currentWeek: number
  currentYear: number
}

function PlanCard({
  label, 계획, 누계, 달성률,
}: { label: string; 계획: number; 누계: number; 달성률: number | null }) {
  const pct = 달성률 ?? 0
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardContent className="px-5 py-4">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-xl font-bold text-gray-900">{formatEok(계획)}</p>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          누계 {formatEok(누계)}
          {달성률 !== null ? ` · 달성률 ${달성률}%` : ' · 계획 미설정'}
        </p>
      </CardContent>
    </Card>
  )
}

export function MonthlySummary({ plans, allRows, currentWeek, currentYear }: Props) {
  const 공사계획 = calc월간계획(plans, '공사')
  const 공무계획 = calc월간계획(plans, '공무')

  const 공사rows = allRows.filter((r) => r.구분 === '공사')
  const 공무rows = allRows.filter((r) => r.구분 === '공무')

  const 공사누계 = calc누적실적(공사rows, currentWeek, currentYear) + calc금주실적합산(공사rows, currentWeek, currentYear)
  const 공무누계 = calc누적실적(공무rows, currentWeek, currentYear) + calc금주실적합산(공무rows, currentWeek, currentYear)
  const 금주합산 = calc금주실적합산(allRows, currentWeek, currentYear)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <PlanCard label="월간계획 (공사)" 계획={공사계획} 누계={공사누계} 달성률={calc달성률(공사누계, 공사계획)} />
      <PlanCard label="월간계획 (공무)" 계획={공무계획} 누계={공무누계} 달성률={calc달성률(공무누계, 공무계획)} />
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">이번주 금주실적</p>
          <p className="text-xl font-bold text-gray-900">{formatEok(금주합산)}</p>
          <p className="text-xs text-gray-500 mt-1.5">공사+공무 합산</p>
        </CardContent>
      </Card>
    </div>
  )
}
