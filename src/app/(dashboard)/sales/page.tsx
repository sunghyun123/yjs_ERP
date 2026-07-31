import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { 공사단가Row } from '@/types/database'
import type { 투입실적With상세 } from '../_lib/calc'
import { calc합계 } from '../_lib/calc'
import { formatEok } from '@/lib/format'
import { partsKST } from '@/lib/kst'
import { YearSelector } from './_components/YearSelector'
import { CollapsibleChart } from './_components/CollapsibleChart'
import { ExcelExportButton } from './_components/ExcelExportButton'
import { PivotProjectTable, type PivotProjectRow } from './_components/PivotProjectTable'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import {
  build이력누계,
  calc준공잔여성과,
  load성과재료,
  sum준공잔여성과,
} from '../_lib/junggong-seonggwa'

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
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const supabase = await createClient()

  const [투입실적행, 단가결과, 성과재료] = await Promise.all([
    fetchAllRows('투입실적', (from, to) =>
      supabase
        .from('투입실적')
        .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
        .gte('투입일', yearStart)
        .lt('투입일', yearEnd)
        .order('id')
        .range(from, to),
    ),
    supabase.from('공사단가').select('*').order('적용시작일'),
    // 공사이력(전 기간) + 수주(준공 컬럼) — 홈 차트·홈 KPI도 같은 함수를 쓴다
    load성과재료(supabase),
  ])

  // 쿼리 실패 시 0/빈 데이터를 정상처럼 표시하지 않도록 명시적으로 에러를 던진다.
  // (fetchAllRows는 자기 안에서 던지므로 여기 남는 건 페이지네이션 안 하는 단가 하나)
  if (단가결과.error) throw new Error(`매출손익 데이터 조회 실패: ${단가결과.error.message}`)

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = 투입실적행 as unknown as 투입실적With상세[]
  const { 공사이력: 공사이력전체, 수주: 수주목록 } = 성과재료
  // 월별 집계는 선택 연도만 — 위 조회는 성과누계용이라 전 기간을 가져왔다
  const 공사이력목록 = 공사이력전체.filter(
    r => r.작업일자 >= yearStart && r.작업일자 < yearEnd,
  )

  type 수주Info = { 지중no: string; 공사명: string }
  const 수주Map = new Map<number, 수주Info>(
    수주목록.map(r => [r.id, { 지중no: r.지중no, 공사명: r.공사명 }]),
  )

  // 준공 = 그 공사의 성과 총액이 준공액이 되도록 잔여분을 준공월에 얹는다 (파생, DB 무변경)
  const 준공잔여목록 = calc준공잔여성과(수주목록, build이력누계(공사이력전체), yearStart, yearEnd)
  const 준공잔여Map = new Map(준공잔여목록.map(r => [r.수주_id, r]))
  const 총준공반영액 = sum준공잔여성과(준공잔여목록)

  // 월별(전체 차트용) + 공사별(월별+주별) 단일 패스 집계
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 }))

  type 공사상세 = {
    monthly: { 성과: number; 투입: number }[]
  }
  const 공사별상세 = new Map<number, 공사상세>()

  function get공사상세(id: number): 공사상세 {
    if (!공사별상세.has(id)) {
      공사별상세.set(id, {
        monthly: Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0 })),
      })
    }
    return 공사별상세.get(id)!
  }

  for (const row of 투입실적목록) {
    const m = parseInt(row.투입일.slice(5, 7), 10) - 1
    const amt = calc합계(row, 단가목록)
    monthly[m].투입 += amt
    get공사상세(row.수주_id).monthly[m].투입 += amt
  }

  for (const row of 공사이력목록) {
    if (!row.작업일자) continue
    const m = parseInt(row.작업일자.slice(5, 7), 10) - 1
    const amt = row.성과금액 ?? 0
    monthly[m].성과 += amt
    get공사상세(row.수주_id).monthly[m].성과 += amt
  }

  // 준공 잔여성과를 준공월에 얹는다. 공사이력·투입실적이 한 줄도 없던 공사도 여기서 처음
  // 공사별상세에 등장한다(= 표에 새 행으로 나타난다) — 그게 이번 요구사항의 의도다.
  for (const { 수주_id, 월, 금액 } of 준공잔여목록) {
    monthly[월].성과 += 금액
    get공사상세(수주_id).monthly[월].성과 += 금액
  }

  const pivotData: PivotProjectRow[] = [...공사별상세.entries()]
    .map(([id, { monthly: pm }]) => {
      const info = 수주Map.get(id)
      const 성과 = pm.reduce((s, m) => s + m.성과, 0)
      const 투입 = pm.reduce((s, m) => s + m.투입, 0)
      const 준공 = 준공잔여Map.get(id)
      return {
        id,
        지중no: info?.지중no ?? `(id:${id})`,
        공사명: info?.공사명 ?? '(공사명 없음)',
        성과금액: 성과,
        투입금액: 투입,
        손익금액: 성과 - 투입,
        monthly: pm.map(({ 성과, 투입 }) => ({ 성과, 투입, 손익: 성과 - 투입 })),
        // 성과에 이미 합쳐진 값 — 어느 달에 얼마가 준공으로 들어왔는지 표에서 구분하려고 같이 넘긴다
        준공: 준공 ? { 월: 준공.월, 금액: 준공.금액 } : undefined,
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
