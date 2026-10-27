/**
 * 공사별·월별 성과/투입/손익 집계 — 매출손익 화면과 ERP MCP(get_profit)가 함께 쓴다.
 *
 * 이 파일이 손익 집계의 유일한 지점이다. 공식 자체(관리비 6%·준공 잔여)는 calc.ts와
 * junggong-seonggwa.ts에 있고, 여기서는 그것들을 불러 공사별·월별로 묶기만 한다.
 * 화면과 채팅이 같은 함수를 거쳐야 같은 "손익"이라는 단어가 같은 숫자를 가리킨다.
 *
 * 조회(load…)와 계산(aggregate…)을 나눈 이유: 화면은 세션 클라이언트(RLS),
 * MCP 라우트는 service_role 클라이언트를 넘긴다. 계산은 DB를 몰라야 테스트할 수 있다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, 공사단가Row } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { calc합계, type 투입실적With상세 } from './calc'
import {
  build이력누계,
  calc준공잔여성과,
  load성과재료,
  sum준공잔여성과,
  type 공사이력Row,
  type 준공수주Row,
  type 준공잔여성과,
} from './junggong-seonggwa'
// 타입만 가져온다(빌드 후 사라짐) — 표 컴포넌트가 이 모양을 그대로 받는다
import type { PivotProjectRow } from '../sales/_components/PivotProjectTable'

export type 공사별손익재료 = {
  /** ⚠️ 선택 연도 것만 — load가 투입일로 잘라 온다. aggregate는 다시 자르지 않는다 */
  투입실적: 투입실적With상세[]
  단가목록: 공사단가Row[]
  /** 전 기간 — 준공 잔여 차감에 전 기간 누계가 필요하다. 월별 집계는 aggregate가 연도로 자른다 */
  공사이력전체: 공사이력Row[]
  수주: 준공수주Row[]
}

export type 공사별손익결과 = {
  pivotData: PivotProjectRow[]
  /** 월별 합계 (0 = 1월). 화면 KPI·차트와 MCP 합계가 이 배열에서 나온다 */
  monthly: { 성과: number; 투입: number }[]
  준공잔여목록: 준공잔여성과[]
  총준공반영액: number
}

function 연도범위(year: number) {
  return { yearStart: `${year}-01-01`, yearEnd: `${year + 1}-01-01` }
}

export async function load공사별손익재료(
  supabase: SupabaseClient<Database>,
  year: number,
): Promise<공사별손익재료> {
  const { yearStart, yearEnd } = 연도범위(year)
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

  // 쿼리 실패 시 0/빈 데이터를 정상처럼 내보내지 않도록 명시적으로 에러를 던진다.
  // (fetchAllRows는 자기 안에서 던지므로 여기 남는 건 페이지네이션 안 하는 단가 하나)
  if (단가결과.error) throw new Error(`매출손익 데이터 조회 실패: ${단가결과.error.message}`)

  return {
    투입실적: 투입실적행 as unknown as 투입실적With상세[],
    단가목록: (단가결과.data ?? []) as 공사단가Row[],
    공사이력전체: 성과재료.공사이력,
    수주: 성과재료.수주,
  }
}

export function aggregate공사별손익(재료: 공사별손익재료, year: number): 공사별손익결과 {
  const { yearStart, yearEnd } = 연도범위(year)
  const { 투입실적: 투입실적목록, 단가목록, 공사이력전체, 수주: 수주목록 } = 재료

  // 월별 집계는 선택 연도만 — 공사이력은 성과누계용이라 전 기간이 들어온다
  const 공사이력목록 = 공사이력전체.filter(
    (r) => r.작업일자 >= yearStart && r.작업일자 < yearEnd,
  )

  type 수주Info = { 지중no: string; 공사명: string }
  const 수주Map = new Map<number, 수주Info>(
    수주목록.map((r) => [r.id, { 지중no: r.지중no, 공사명: r.공사명 }]),
  )

  // 준공 = 그 공사의 성과 총액이 준공액이 되도록 잔여분을 준공월에 얹는다 (파생, DB 무변경)
  const 준공잔여목록 = calc준공잔여성과(수주목록, build이력누계(공사이력전체), yearStart, yearEnd)
  const 준공잔여Map = new Map(준공잔여목록.map((r) => [r.수주_id, r]))
  const 총준공반영액 = sum준공잔여성과(준공잔여목록)

  // 월별(전체 차트용) + 공사별(월별) 단일 패스 집계
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
  // 공사별상세에 등장한다(= 표에 새 행으로 나타난다) — 2026-07-31 요구사항의 의도다.
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
        // 성과에 이미 합쳐진 값 — 어느 달에 얼마가 준공으로 들어왔는지 구분하려고 같이 넘긴다
        준공: 준공 ? { 월: 준공.월, 금액: 준공.금액 } : undefined,
      }
    })
    .sort((a, b) => a.지중no.localeCompare(b.지중no, 'ko'))

  return { pivotData, monthly, 준공잔여목록, 총준공반영액 }
}
