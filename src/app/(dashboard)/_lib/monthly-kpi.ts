import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, 공사단가Row } from '@/types/database'
import { formatEok } from '@/lib/format'
import { partsKST } from '@/lib/kst'
import { calc합계, type 투입실적With상세 } from './calc'
import { sumMonthlyRevenue, type RevenueHistoryRow } from './revenue'
import {
  build이력누계,
  calc준공잔여성과,
  load성과재료,
  sum준공잔여성과,
} from './junggong-seonggwa'

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
  // 서버 런타임은 UTC라 now.getMonth()/getDate()가 KST와 어긋날 수 있다(자정 무렵 하루/한 달 밀림).
  // KST 기준 연/월/일로 고정한다.
  const { year, month, day } = partsKST(now)
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
    comparisonDay: day,
    prevMonthDays,
  }
}

export async function getMonthlyKpiData(
  supabase: SupabaseClient<Database>,
  now = new Date(),
): Promise<MonthlyKpiData> {
  const period = getMonthlyPeriod(now)

  const [투입실적결과, 단가결과, 성과재료] = await Promise.all([
    supabase
      .from('투입실적')
      .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
      .gte('투입일', period.monthStart)
      .lt('투입일', period.monthEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    // 공사이력 전 기간 + 수주(준공 컬럼). 매출손익·홈 차트와 같은 재료·같은 규칙을 쓴다.
    load성과재료(supabase),
  ])

  const firstError = 투입실적결과.error ?? 단가결과.error
  if (firstError) {
    throw firstError
  }

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as unknown as 투입실적With상세[]
  const { 공사이력: 공사이력전체, 수주: 수주목록 } = 성과재료
  const 이력누계 = build이력누계(공사이력전체)

  // 성과금액은 일별 증분으로 적재됨 → 기간 내 모든 행을 합산한다.
  const 기간내이력 = (from: string, to: string) =>
    공사이력전체.filter(r => r.작업일자 >= from && r.작업일자 < to) as RevenueHistoryRow[]
  // 준공월 잔여성과 — 차감 기준(성과누계)은 기간이 아니라 전 기간이어야 한다
  const 준공반영 = (from: string, to: string) =>
    sum준공잔여성과(calc준공잔여성과(수주목록, 이력누계, from, to))

  const monthlyInput = 투입실적목록.reduce((sum, row) => sum + calc합계(row, 단가목록), 0)
  const monthlyRevenue =
    sumMonthlyRevenue(기간내이력(period.monthStart, period.monthEnd)) +
    준공반영(period.monthStart, period.monthEnd)
  const prevMonthRevenue =
    sumMonthlyRevenue(기간내이력(period.prevMonthStart, period.monthStart)) +
    준공반영(period.prevMonthStart, period.monthStart)
  // 이번 달은 오늘까지(MTD), 전월은 한 달 전체이므로 경과일 비율로 환산해 동기간 비교
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
