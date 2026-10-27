import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEok } from '@/lib/format'
import { partsKST } from '@/lib/kst'
import { YearSelector } from './_components/YearSelector'
import { CollapsibleChart } from './_components/CollapsibleChart'
import { ExcelExportButton } from './_components/ExcelExportButton'
import { PivotProjectTable } from './_components/PivotProjectTable'
import { aggregate공사별손익, load공사별손익재료 } from '../_lib/공사별손익'

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const parsedYear = parseInt(yearParam ?? '', 10)
  // ?year=abc 같은 잘못된 입력이면 NaN → 날짜 범위가 깨지므로 올해로 폴백.
  // 서버 시계는 UTC라 new Date().getFullYear()는 KST 1/1 00~09시에 전년을 준다 → partsKST 사용
  const year =
    Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : partsKST().year

  const supabase = await createClient()

  // 공사별 손익 집계는 _lib/공사별손익 한 곳 — ERP MCP(get_profit)도 같은 함수를 거친다
  const { pivotData, monthly, 준공잔여목록, 총준공반영액 } = aggregate공사별손익(
    await load공사별손익재료(supabase, year),
    year,
  )

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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
            매출손익
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            성과(작업일자·준공월)·투입일 기준 월별 집계
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton pivotData={pivotData} chartData={chartData} year={year} />
          <YearSelector currentYear={year} />
        </div>
      </div>

      {/* KPI 스트립 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 성과금액</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{formatEok(총성과)}</p>
          {준공잔여목록.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              그중 준공 반영 {formatEok(총준공반영액)} ({준공잔여목록.length}건)
            </p>
          )}
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 투입금액</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{formatEok(총투입)}</p>
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
