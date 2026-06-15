import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { calc합계 } from '../_lib/calc'
import { formatEok } from '@/lib/format'
import { YearSelector } from './_components/YearSelector'
import { CollapsibleChart } from './_components/CollapsibleChart'
import { ExcelExportButton } from './_components/ExcelExportButton'
import { ProjectTable } from './_components/ProjectTable'

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
    supabase.from('공사이력').select('작업일자, 수주_id, 성과금액').gte('작업일자', yearStart).lt('작업일자', yearEnd),
    supabase.from('수주').select('id, 지중no, 공사명').order('지중no'),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]

  // 월별 집계 (1~12월)
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 }))

  for (const row of 투입실적목록) {
    const m = parseInt(row.투입일.slice(5, 7), 10) - 1
    monthly[m].투입 += calc합계(row, 단가목록)
  }

  const 공사이력목록 = (공사이력결과.data ?? []) as { 작업일자: string; 수주_id: number; 성과금액: number }[]

  for (const row of 공사이력목록) {
    if (!row.작업일자) continue
    const m = parseInt(row.작업일자.slice(5, 7), 10) - 1
    monthly[m].성과 += row.성과금액 ?? 0
  }

  // 공사별 집계
  const 공사별 = new Map<number, { 성과: number; 투입: number }>()
  for (const row of 투입실적목록) {
    const id = row.수주_id
    if (!공사별.has(id)) 공사별.set(id, { 성과: 0, 투입: 0 })
    공사별.get(id)!.투입 += calc합계(row, 단가목록)
  }
  for (const row of 공사이력목록) {
    if (!row.작업일자) continue
    const id = row.수주_id
    if (!공사별.has(id)) 공사별.set(id, { 성과: 0, 투입: 0 })
    공사별.get(id)!.성과 += row.성과금액 ?? 0
  }

  type 수주Info = { 지중no: string; 공사명: string }
  const 수주Map = new Map<number, 수주Info>(
    ((수주결과.data ?? []) as (수주Info & { id: number })[]).map(r => [r.id, { 지중no: r.지중no, 공사명: r.공사명 }])
  )

  const projectData = [...공사별.entries()]
    .map(([id, { 성과, 투입 }]) => {
      const info = 수주Map.get(id)
      const 손익 = 성과 - 투입
      return {
        id,
        지중no: info?.지중no ?? `(id:${id})`,
        공사명: info?.공사명 ?? '(공사명 없음)',
        성과금액: 성과,
        투입금액: 투입,
        손익금액: 손익,
        이익률: 성과 > 0 ? (손익 / 성과) * 100 : 0,
      }
    })
    .sort((a, b) => a.지중no.localeCompare(b.지중no, 'ko'))

  // 연간 합계
  const 총성과 = monthly.reduce((sum, m) => sum + m.성과, 0)
  const 총투입 = monthly.reduce((sum, m) => sum + m.투입, 0)
  const 총손익 = 총성과 - 총투입
  const 총이익률 = 총성과 > 0 ? (총손익 / 총성과) * 100 : 0

  // 차트 데이터 (원 단위 — 툴팁에서 정확한 원 단위로 표시)
  const chartData = monthly.map(({ 성과, 투입 }, i) => ({
    month: `${i + 1}월`,
    성과금액: Math.round(성과),
    투입금액: Math.round(투입),
    손익금액: Math.round(성과 - 투입),
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
            매출손익 현황
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            공사이력·투입일 기준 월별 집계
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton projectData={projectData} chartData={chartData} year={year} />
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
          <p className="text-xs text-gray-500">{year}년 누적 손익 / 이익률</p>
          <p
            className="text-2xl font-bold mt-1"
            style={{ color: 총손익 >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {formatEok(총손익)}&nbsp;·&nbsp;{총성과 > 0 ? 총이익률.toFixed(1) + '%' : '—'}
          </p>
        </div>
      </div>

      {/* 공사별 테이블 (주인공) */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-sm font-medium text-gray-600">
            {year}년 공사별 성과
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-5">
          <ProjectTable data={projectData} />
        </CardContent>
      </Card>

      {/* 월별 차트 (접기/펼치기) */}
      <CollapsibleChart data={chartData} year={year} />
    </div>
  )
}
