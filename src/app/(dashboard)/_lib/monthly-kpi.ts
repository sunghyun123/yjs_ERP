import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, 공사단가Row } from '@/types/database'
import { formatEok } from '@/lib/format'
import { calc합계, type 투입실적With상세 } from './calc'
import { sumMonthlyRevenue, type RevenueHistoryRow } from './revenue'

export type MonthlyKpiData = {
  year: number
  month: number
  label: string
  period: {
    monthStart: string
    monthEnd: string
    prevMonthStart: string
    comparisonDay: number
    prevMonthDays: number
  }
  amounts: {
    monthlyRevenue: number
    prevMonthRevenue: number
    prevMonthComparableRevenue: number
    revenueDelta: number
    monthlyInput: number
    monthlyProfit: number
  }
  formatted: {
    monthlyRevenue: string
    revenueDelta: string
    monthlyInput: string
    monthlyProfit: string
  }
  updatedAt: string
}

function getMonthlyPeriod(now: Date) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const mm = String(month).padStart(2, '0')

  const monthStart = `${year}-${mm}-01`
  const nextMm = String(month === 12 ? 1 : month + 1).padStart(2, '0')
  const nextYr = month === 12 ? year + 1 : year
  const monthEnd = `${nextYr}-${nextMm}-01`

  const firstOfPrevMonth = new Date(year, month - 2, 1)
  const prevYear = firstOfPrevMonth.getFullYear()
  const prevMm = String(firstOfPrevMonth.getMonth() + 1).padStart(2, '0')
  const prevMonthStart = `${prevYear}-${prevMm}-01`
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  return {
    year,
    month,
    monthStart,
    monthEnd,
    prevMonthStart,
    comparisonDay: now.getDate(),
    prevMonthDays,
  }
}

export async function getMonthlyKpiData(
  supabase: SupabaseClient<Database>,
  now = new Date(),
): Promise<MonthlyKpiData> {
  const period = getMonthlyPeriod(now)

  const [투입실적결과, 단가결과, 공사이력결과, 전월공사이력결과] = await Promise.all([
    supabase
      .from('투입실적')
      .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
      .gte('투입일', period.monthStart)
      .lt('투입일', period.monthEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    // 매출손익 마이그레이션 성과는 월말 행으로 들어간다.
    supabase
      .from('공사이력')
      .select('작업일자, 성과금액')
      .gte('작업일자', period.monthStart)
      .lt('작업일자', period.monthEnd),
    supabase
      .from('공사이력')
      .select('작업일자, 성과금액')
      .gte('작업일자', period.prevMonthStart)
      .lt('작업일자', period.monthStart),
  ])

  const firstError =
    투입실적결과.error ?? 단가결과.error ?? 공사이력결과.error ?? 전월공사이력결과.error
  if (firstError) {
    throw firstError
  }

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적With상세[]

  const monthlyInput = 투입실적목록.reduce((sum, row) => sum + calc합계(row, 단가목록), 0)
  const monthlyRevenue = sumMonthlyRevenue((공사이력결과.data ?? []) as RevenueHistoryRow[])
  const prevMonthRevenue = sumMonthlyRevenue(
    (전월공사이력결과.data ?? []) as RevenueHistoryRow[],
  )
  // 공사이력이 월말 일괄값이므로 전월 동기간(같은 날짜)을 일수 비율로 환산
  const prevMonthComparableRevenue =
    prevMonthRevenue * (period.comparisonDay / period.prevMonthDays)
  const revenueDelta = monthlyRevenue - prevMonthComparableRevenue
  const monthlyProfit = monthlyRevenue - monthlyInput

  return {
    year: period.year,
    month: period.month,
    label: `${period.month}월`,
    period,
    amounts: {
      monthlyRevenue,
      prevMonthRevenue,
      prevMonthComparableRevenue,
      revenueDelta,
      monthlyInput,
      monthlyProfit,
    },
    formatted: {
      monthlyRevenue: formatEok(monthlyRevenue),
      revenueDelta: `${revenueDelta >= 0 ? '+' : ''}${formatEok(revenueDelta)}`,
      monthlyInput: formatEok(monthlyInput),
      monthlyProfit: formatEok(monthlyProfit),
    },
    updatedAt: now.toISOString(),
  }
}
