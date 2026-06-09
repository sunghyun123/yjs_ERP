import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { calc투입금액 } from '../_lib/calc'
import { ProfitChart } from './ProfitChart'

export async function ProfitChartSection() {
  const supabase = await createClient()

  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  type 기성집계Row = {
    기성액_공급가: number | null
    기성일: string | null
    수주: { 보험료율: number | null; 하도전용율: number | null } | null
  }
  type 준공Row = {
    준공액_공급가: number | null
    준공일: string | null
    보험료율: number | null
    하도전용율: number | null
  }

  const [투입실적결과, 단가결과, 기성결과, 준공결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', yearStart).lt('투입일', yearEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase
      .from('기성')
      .select('기성액_공급가, 기성일, 수주!수주_id(보험료율, 하도전용율)')
      .gte('기성일', yearStart)
      .lt('기성일', yearEnd),
    // 올해 준공된 수주의 준공액 (성과금액에 합산)
    supabase
      .from('수주')
      .select('준공액_공급가, 준공일, 보험료율, 하도전용율')
      .gte('준공일', yearStart)
      .lt('준공일', yearEnd)
      .not('준공액_공급가', 'is', null),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]

  // 월별 집계 초기화 (1~12월)
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 }))

  for (const row of 투입실적목록) {
    const m = parseInt(row.투입일.slice(5, 7), 10) - 1
    monthly[m].투입 += calc투입금액(row, 단가목록)
  }

  for (const row of (기성결과.data ?? []) as 기성집계Row[]) {
    if (!row.기성일) continue
    const m = parseInt(row.기성일.slice(5, 7), 10) - 1
    const 기성액 = row.기성액_공급가 ?? 0
    const 수주 = row.수주 as { 보험료율: number | null; 하도전용율: number | null } | null
    const 보험료율 = 수주?.보험료율 ?? 0
    const 하도전용율 = 수주?.하도전용율 ?? 1
    monthly[m].성과 += 기성액 * (1 - 보험료율) * 하도전용율
  }

  for (const row of (준공결과.data ?? []) as 준공Row[]) {
    if (!row.준공일) continue
    const m = parseInt(row.준공일.slice(5, 7), 10) - 1
    const 준공액 = row.준공액_공급가 ?? 0
    const 보험료율 = row.보험료율 ?? 0
    const 하도전용율 = row.하도전용율 ?? 1
    monthly[m].성과 += 준공액 * (1 - 보험료율) * 하도전용율
  }

  // 단위: 백만원
  const chartData = monthly.map(({ 성과, 투입 }, i) => ({
    month: `${i + 1}월`,
    성과금액: Math.round(성과 / 1_000_000),
    투입금액: Math.round(투입 / 1_000_000),
    손익금액: Math.round((성과 - 투입) / 1_000_000),
  }))

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="text-sm font-medium text-gray-600">
          {year}년 월별 매출손익 현황
          <span className="ml-2 text-xs font-normal text-gray-400">(단위: 백만원)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5">
        <ProfitChart data={chartData} />
      </CardContent>
    </Card>
  )
}

export function ProfitChartSkeleton() {
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <Skeleton className="h-5 w-52" />
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5">
        <Skeleton className="h-[280px] w-full" />
      </CardContent>
    </Card>
  )
}
