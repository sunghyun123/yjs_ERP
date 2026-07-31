/**
 * 준공 잔여성과 — 준공월에 얹는 성과금액 (2026-07-31 사장님 요구사항)
 *
 * 규칙: 준공을 찍은 공사는 그 공사의 성과 총액이 준공액(총액)과 같아져야 한다.
 *   준공 잔여성과 = 준공액_공급가 − (그 공사의 공사이력 성과금액 **전 기간** 누계)
 *
 * 왜 차감 기준이 "기성누계"가 아니라 "공사이력 성과누계"인가:
 *   성과 축은 공사이력.성과금액만으로 만들어진다. 중복을 빼려면 그 축에 이미 더해진 금액을
 *   빼야 한다. 기성누계는 성과 축에 더해진 적이 없는 숫자라, 그걸 빼면 안 더한 것을 빼게 된다
 *   (2026-07-31 실측: 두 값이 일치하는 준공건 0건, 기성만 있고 공사이력이 빈 공사 143건
 *    → 기성누계로 차감하면 그만큼 매출에서 영구 누락).
 *
 * DB에 아무것도 쓰지 않는다. 준공액을 고치거나 준공을 해제하면 다음 조회에서 자동으로
 * 따라오게 하려는 것(파생) — 준공정산 행 적재 방식은 2026-07-08에 폐기됐다.
 *
 * ⚠️ 성과를 집계하는 화면은 전부 이 모듈을 거친다(매출손익 / 홈 차트 / 홈 KPI·대시보드 API).
 *    한 곳만 안 거치면 같은 "성과"라는 단어로 다른 숫자를 보여주게 된다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

/** 준공 판정에 필요한 수주 컬럼 + 표에 쓰는 식별자 */
export type 준공수주Row = {
  id: number
  지중no: string
  공사명: string
  공사구분: string | null
  준공여부: boolean
  준공일: string | null
  준공액_공급가: number | null
  수주금액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}

export type 공사이력Row = {
  작업일자: string
  수주_id: number
  성과금액: number | null
}

export type 준공잔여성과 = {
  수주_id: number
  준공일: string
  /** 준공일의 월 인덱스 (0 = 1월) */
  월: number
  /** 음수 가능 — 성과누계가 준공액을 넘은 경우. 0으로 깎지 않는다(조용히 틀린 값 방지). */
  금액: number
}

/**
 * 성과 집계에 필요한 원재료를 한 번에 읽는다.
 *
 * 공사이력을 기간으로 자르지 않는 이유: 차감할 성과누계가 '전 기간' 누계여야 하기 때문.
 * 작년에 잡힌 성과를 못 빼면 올해 준공월에 그만큼 이중 계상된다.
 * 호출부는 돌려받은 공사이력을 자기 기간으로 필터해서 월별 집계에 쓴다.
 */
export async function load성과재료(
  supabase: SupabaseClient<Database>,
): Promise<{ 공사이력: 공사이력Row[]; 수주: 준공수주Row[] }> {
  const [공사이력, 수주] = await Promise.all([
    // 준공정산 행 제외 — 2026-07-08부터 자동 적재를 중단하고 기존 행도 정리했지만,
    // 과거 백업 복원 등으로 유령 행이 되살아나도 매출이 오염되지 않도록 방어 필터로 유지한다.
    fetchAllRows('공사이력', (from, to) =>
      supabase
        .from('공사이력')
        .select('작업일자, 수주_id, 성과금액')
        .eq('준공정산', false)
        .order('id')
        .range(from, to),
    ),
    fetchAllRows('수주', (from, to) =>
      supabase
        .from('수주')
        .select(
          'id, 지중no, 공사명, 공사구분, 준공여부, 준공일, 준공액_공급가, 수주금액_공급가, 보험료율, 하도전용율',
        )
        .order('지중no')
        .range(from, to),
    ),
  ])
  return {
    공사이력: 공사이력 as unknown as 공사이력Row[],
    수주: 수주 as unknown as 준공수주Row[],
  }
}

/**
 * 수주_id → 공사이력 성과금액 전 기간 누계.
 * ⚠️ 기간으로 자른 목록을 넘기면 안 된다. 작년에 잡힌 성과를 못 빼서 이중 계상된다.
 */
export function build이력누계(
  rows: { 수주_id: number; 성과금액: number | null }[],
): Map<number, number> {
  const map = new Map<number, number>()
  for (const row of rows) {
    map.set(row.수주_id, (map.get(row.수주_id) ?? 0) + (row.성과금액 ?? 0))
  }
  return map
}

/**
 * 준공일이 [from, to) 안에 드는 공사들의 잔여성과. (from/to는 'YYYY-MM-DD', to는 미포함)
 *
 * 제외 대상: 준공일 또는 준공액이 비어 있는 건(2026-07-31 기준 77건 — 구ERP 이관분).
 * 귀속시킬 달도, 넣을 금액도 없으므로 조용히 0으로 넣지 않고 아예 빼놓는다.
 */
export function calc준공잔여성과(
  수주목록: 준공수주Row[],
  이력누계: Map<number, number>,
  from: string,
  to: string,
): 준공잔여성과[] {
  const out: 준공잔여성과[] = []
  for (const o of 수주목록) {
    if (!o.준공여부) continue
    if (!o.준공일 || o.준공액_공급가 == null) continue
    // 날짜는 문자열로만 비교한다 — new Date()를 쓰면 서버 시계(UTC)가 KST 달력을 밀어버린다
    if (o.준공일 < from || o.준공일 >= to) continue
    const 월 = parseInt(o.준공일.slice(5, 7), 10) - 1
    if (!Number.isInteger(월) || 월 < 0 || 월 > 11) continue
    out.push({
      수주_id: o.id,
      준공일: o.준공일,
      월,
      금액: o.준공액_공급가 - (이력누계.get(o.id) ?? 0),
    })
  }
  return out
}

/** 잔여성과 합계 — 준공 반영으로 성과가 얼마나 늘었는지 (음수 건도 그대로 상계) */
export function sum준공잔여성과(rows: 준공잔여성과[]): number {
  return rows.reduce((s, r) => s + r.금액, 0)
}
