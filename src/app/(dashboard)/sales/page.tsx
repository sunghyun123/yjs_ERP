import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { calc합계 } from '../_lib/calc'
import { formatEok } from '@/lib/format'
import { isoWeek } from './_lib/pivot'
import { YearSelector } from './_components/YearSelector'
import { CollapsibleChart } from './_components/CollapsibleChart'
import { ExcelExportButton } from './_components/ExcelExportButton'
import { PivotProjectTable, type PivotProjectRow } from './_components/PivotProjectTable'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const year = parseInt(yearParam ?? String(new Date().getFullYear()), 10)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const supabase = await createClient()

  const [투입실적결과, 단가결과, 공사이력결과, 수주결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', yearStart).lt('투입일', yearEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase
      .from('공사이력')
      .select('작업일자, 수주_id, 성과금액')
      .gte('작업일자', yearStart)
      .lt('작업일자', yearEnd),
    supabase.from('수주').select('id, 지중no, 공사명').order('지중no'),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]
  const 공사이력목록 = (공사이력결과.data ?? []) as {
    작업일자: string
    수주_id: number
    성과금액: number
  }[]

  type 수주Info = { 지중no: string; 공사명: string }
  const 수주Map = new Map<number, 수주Info>(
    ((수주결과.data ?? []) as (수주Info & { id: number })[]).map(r => [
      r.id,
      { 지중no: r.지중no, 공사명: r.공사명 },
    ]),
  )

  // 월별(전체 차트용) + 공사별(월별+주별) 단일 패스 집계
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 }))

  type 공사상세 = {
    monthly: { 성과: number; 투입: number }[]
    weekly: Map<string, { 성과: number; 투입: number; label: string }>
  }
  const 공사별상세 = new Map<number, 공사상세>()

  function get공사상세(id: number): 공사상세 {
    if (!공사별상세.has(id)) {
      공사별상세.set(id, {
        monthly: Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 })),
        weekly: new Map(),
      })
    }
    return 공사별상세.get(id)!
  }

  for (const row of 투입실적목록) {
    const m = parseInt(row.투입일.slice(5, 7), 10) - 1
    const amt = calc합계(row, 단가목록)
    monthly[m].투입 += amt
    const 상세 = get공사상세(row.수주_id)
    상세.monthly[m].투입 += amt
    const { key, label } = isoWeek(row.투입일)
    const wEntry = 상세.weekly.get(key) ?? { 성과: 0, 투입: 0, label }
    wEntry.투입 += amt
    상세.weekly.set(key, wEntry)
  }

  for (const row of 공사이력목록) {
    if (!row.작업일자) continue
    const m = parseInt(row.작업일자.slice(5, 7), 10) - 1
    const amt = row.성과금액 ?? 0
    monthly[m].성과 += amt
    const 상세 = get공사상세(row.수주_id)
    상세.monthly[m].성과 += amt
    const { key, label } = isoWeek(row.작업일자)
    const wEntry = 상세.weekly.get(key) ?? { 성과: 0, 투입: 0, label }
    wEntry.성과 += amt
    상세.weekly.set(key, wEntry)
  }

  const pivotData: PivotProjectRow[] = [...공사별상세.entries()]
    .map(([id, { monthly: pm, weekly }]) => {
      const info = 수주Map.get(id)
      const 성과 = pm.reduce((s, m) => s + m.성과, 0)
      const 투입 = pm.reduce((s, m) => s + m.투입, 0)
      return {
        id,
        지중no: info?.지중no ?? `(id:${id})`,
        공사명: info?.공사명 ?? '(공사명 없음)',
        성과금액: 성과,
        투입금액: 투입,
        손익금액: 성과 - 투입,
        monthly: pm.map(({ 성과, 투입 }) => ({ 성과, 투입, 손익: 성과 - 투입 })),
        weekly: [...weekly.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, { 성과, 투입, label }]) => ({
            week,
            label,
            성과,
            투입,
            손익: 성과 - 투입,
          })),
      }
    })
    .sort((a, b) => a.지중no.localeCompare(b.지중no, 'ko'))

  // 연간 합계
  const 총성과 = monthly.reduce((sum, m) => sum + m.성과, 0)
  const 총투입 = monthly.reduce((sum, m) => sum + m.투입, 0)
  const 총손익 = 총성과 - 총투입

  // 차트 데이터 (원 단위)
  const chartData = monthly.map(({ 성과, 투입 }, i) => ({
    month: `${i + 1}월`,
    성과금액: Math.round(성과),
    투입금액: Math.round(투입),
    손익금액: Math.round(성과 - 투입),
  }))

  const 손익KPI컬러 =
    총손익 >= 5_000_000 ? '#16a34a' : 총손익 <= -5_000_000 ? '#dc2626' : '#374151'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
            매출손익
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            공사이력·투입일 기준 월별 집계
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton pivotData={pivotData} chartData={chartData} year={year} />
          <YearSelector currentYear={year} />
        </div>
      </div>

      {/* KPI 스트립 */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 성과금액</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{formatEok(총성과)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 투입금액</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">{formatEok(총투입)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 손익</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 손익KPI컬러 }}>
            {formatEok(총손익)}
          </p>
        </div>
      </div>

      {/* 차트 (테이블 위) */}
      <CollapsibleChart
        data={chartData}
        year={year}
        총성과={총성과}
        총투입={총투입}
        총손익={총손익}
      />

      {/* 피벗 테이블 (메인) */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-sm font-medium text-gray-600">
            {year}년 공사별 성과
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-5">
          <PivotProjectTable data={pivotData} />
        </CardContent>
      </Card>
    </div>
  )
}
