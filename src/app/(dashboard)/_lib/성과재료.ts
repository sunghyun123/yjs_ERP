/**
 * 성과 집계 원재료 읽기 — 공사이력(전 기간) + 수주를 한 번에 읽는다.
 *
 * 성과(매출) = 공사이력.성과금액의 합뿐이다. 준공은 매출에 아무것도 더하지 않는다.
 *   2026-07-31 ~ 2026-11-18 동안은 여기 있던 '준공 잔여성과'(준공액 − 공사이력 누계)를 준공월에
 *   얹었지만, 사장님이 목격한 사건으로 거슬러 올라갈 수 없는 장부 보정이라 PR-C에서 폐지했다
 *   (진행 문서 docs/superpowers/specs/2026-11-17-revenue-simplification-roadmap.md §3-2).
 *   준공액과 공사이력 누계의 차이는 이제 매출이 아니라 미입력 탭(progress)에서 '차이'로만 보인다.
 *
 * ⚠️ 성과를 집계하는 화면은 전부 이 재료를 거친다(매출손익 / 홈 차트·KPI / 대시보드 API / MCP).
 *    한 곳만 다른 쿼리로 읽으면 같은 "성과"라는 단어로 다른 숫자를 보여주게 된다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

/** 성과 집계·화면에 쓰는 수주 컬럼 — 준공 칸은 매출이 아니라 도넛 상태·정산(build월정산내역)에서 쓴다 */
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
  /**
   * 정산 담당(2026-10-29) — 대시보드 담당자별 '정산' 칸은 이 칸으로만 나뉜다(build월정산내역).
   * 선택 칸인 이유: 매출 집계만 하는 호출부·테스트는 필요 없다. 아래 select 문자열에서 빠지면
   * 캐스트(as unknown as) 때문에 tsc 가 못 잡고 전원이 '정산 미지정'으로 보이니 손으로 맞춰야 한다.
   */
  정산담당자_id?: number | null
}

export type 공사이력Row = {
  작업일자: string
  수주_id: number
  성과금액: number | null
  /**
   * 시공 담당 — 대시보드 담당자별 진척이 이 칸으로 나뉜다(build월시공내역의 담당별).
   * 선택 칸인 이유: 매출 집계만 하는 호출부·테스트는 이 칸이 필요 없다. 아래 select 문자열에 빠지면
   * 캐스트(as unknown as) 때문에 tsc 가 못 잡고 전원이 '미지정'으로 보이니 손으로 맞춰야 한다.
   */
  담당공무_id?: number | null
}

/**
 * 성과 집계에 필요한 원재료를 한 번에 읽는다.
 *
 * 공사이력을 기간으로 자르지 않는 이유: 호출부마다 보는 기간이 다르다(이번 달·전월·연간·12개월).
 * 한 번 읽어 나눠 주고, 호출부가 자기 기간으로 필터해서 월별 집계에 쓴다.
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
        .select('작업일자, 수주_id, 성과금액, 담당공무_id')
        .eq('준공정산', false)
        .order('id')
        .range(from, to),
    ),
    fetchAllRows('수주', (from, to) =>
      supabase
        .from('수주')
        .select(
          'id, 지중no, 공사명, 공사구분, 준공여부, 준공일, 준공액_공급가, 수주금액_공급가, 보험료율, 하도전용율, 정산담당자_id',
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
