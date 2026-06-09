import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { calc합계 } from '../_lib/calc'
import { ProfitChart } from './ProfitChart'

export async function ProfitChartSection() {
  const supabase = await createClient()

  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const [투입실적결과, 단가결과, 공사이력결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', yearStart).lt('투입일', yearEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase.from('공사이력').select('작업일자, 성과금액').gte('작업일자', yearStart).lt('작업일자', yearEnd),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]

  // 월별 집계 초기화 (1~12월)
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 }))

  for (const row of 투입실적목록) {
    const m = parseInt(row.투입일.slice(5, 7), 10) - 1
    monthly[m].투입 += calc합계(row, 단가목록)
  }

  for (const row of (공사이력결과.data ?? []) as { 작업일자: string; 성과금액: number }[]) {
    if (!row.작업일자) continue
    const m = parseInt(row.작업일자.slice(5, 7), 10) - 1
    monthly[m].성과 += row.성과금액 ?? 0
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
