/**
 * 미입력 목록 — 준공된 공사마다 작업일지로 아직 안 채운 공사이력 금액 (2026-11-17 PR-B)
 *
 * 목표(다 입력했을 때의 누계) = 하도 기준 준공액 = 준공액_공급가 × (1−보험료율) × 하도전용율.
 * 왜 준공액 전체가 아닌가: 공사이력 성과는 원래 하도적용금액 기준으로 입력된다(percent.ts).
 *   준공액 전체를 목표로 잡으면 작업일지대로 100% 입력해도 ~21%가 영원히 남고, 0으로 만들려면
 *   달성률 127%로 넘치게 입력해야 한다(2026-07-08 127.19% 사고와 같은 원인).
 *
 * 남은 금액과 입력 초과는 상계하지 않는다. 상계하면 오입력이 미입력을 지워서 진척이 좋아 보이고,
 * 준공 보정을 끄는 순간(PR-C) 초과분이 매출에 그대로 남는다. PR-C 조건 = 두 합계가 모두 0 근처.
 *
 * DB에 쓰지 않는다. 읽기 전용 파생.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { calc하도적용표시금액 } from '@/app/(dashboard)/orders/_lib/completion'

export type 미입력수주Row = {
  id: number
  지중no: string
  공사명: string
  준공여부: boolean
  준공일: string | null
  준공액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}

export type 이력금액Row = { 수주_id: number; 성과금액: number | null }
export type 기성금액Row = { 수주_id: number; 기성액_공급가: number | null }

export type 미입력행 = {
  수주_id: number
  지중no: string
  공사명: string
  준공일: string
  /** 하도 기준 준공액 */
  목표: number
  누계: number
  이력수: number
  /** 목표 − 누계. 남은 칸은 양수, 초과 칸은 음수 */
  금액: number
}

export type 기성만행 = { 수주_id: number; 지중no: string; 공사명: string; 기성누계: number }

export type 미입력목록 = {
  남은: 미입력행[]
  초과: 미입력행[]
  기성만: 기성만행[]
  남은합: number
  초과합: number
  /** |목표 − 누계| < 1,000원 — 다 입력한 준공 공사 */
  완료수: number
  /** 준공인데 준공일 또는 준공액이 비어 목표를 못 정한 건(구ERP 이관분). 조용히 사라지지 않게 센다 */
  제외수: number
}

/** 원 단위 반올림 잔차를 '다 입력함'으로 보는 폭 */
const 완료폭 = 1_000

export function build미입력목록(
  수주목록: 미입력수주Row[],
  이력: 이력금액Row[],
  기성: 기성금액Row[],
): 미입력목록 {
  const 누계 = new Map<number, number>()
  const 이력수 = new Map<number, number>()
  for (const r of 이력) {
    누계.set(r.수주_id, (누계.get(r.수주_id) ?? 0) + (r.성과금액 ?? 0))
    이력수.set(r.수주_id, (이력수.get(r.수주_id) ?? 0) + 1)
  }
  const 기성누계 = new Map<number, number>()
  for (const g of 기성) 기성누계.set(g.수주_id, (기성누계.get(g.수주_id) ?? 0) + (g.기성액_공급가 ?? 0))

  const 남은: 미입력행[] = []
  const 초과: 미입력행[] = []
  const 기성만: 기성만행[] = []
  let 완료수 = 0
  let 제외수 = 0

  for (const o of 수주목록) {
    if (!o.준공여부) {
      // 준공 전: 준공액이 없어 남은 금액을 정의할 수 없다. 기성은 있는데 이력이 0행인 것만 참고로 띄운다.
      const g = 기성누계.get(o.id) ?? 0
      if (g > 0 && !이력수.has(o.id)) 기성만.push({ 수주_id: o.id, 지중no: o.지중no, 공사명: o.공사명, 기성누계: g })
      continue
    }
    if (!o.준공일 || o.준공액_공급가 == null) {
      제외수++
      continue
    }
    const 목표 = calc하도적용표시금액(o.준공액_공급가, o.보험료율, o.하도전용율)
    const 합 = 누계.get(o.id) ?? 0
    const 행: 미입력행 = {
      수주_id: o.id,
      지중no: o.지중no,
      공사명: o.공사명,
      준공일: o.준공일,
      목표,
      누계: 합,
      이력수: 이력수.get(o.id) ?? 0,
      금액: 목표 - 합,
    }
    if (Math.abs(행.금액) < 완료폭) 완료수++
    else if (행.금액 > 0) 남은.push(행)
    else 초과.push(행)
  }

  // 날짜는 'YYYY-MM-DD' 문자열 비교 — new Date()를 거치지 않는다(서버 시계 UTC 문제 회피)
  const 준공일순 = (a: 미입력행, b: 미입력행) => a.준공일.localeCompare(b.준공일) || a.지중no.localeCompare(b.지중no)
  남은.sort(준공일순)
  초과.sort(준공일순)
  기성만.sort((a, b) => a.지중no.localeCompare(b.지중no))

  return {
    남은,
    초과,
    기성만,
    남은합: 남은.reduce((s, r) => s + r.금액, 0),
    초과합: 초과.reduce((s, r) => s + r.금액, 0),
    완료수,
    제외수,
  }
}

/**
 * 미입력 목록 재료를 읽는다. 세 표 모두 fetchAllRows — 1000행 캡에 조용히 잘리면
 * 누계가 모자라 '남은 금액'이 부풀고, 그 숫자로 입력 진척을 판단하게 된다.
 * 준공정산 행은 2026-07-08에 없앴지만 load성과재료와 같은 방어 필터를 둔다.
 *
 * RLS: 서버 클라이언트(anon key + 세션). 화이트리스트 밖이면 에러 없이 빈 배열이 오므로
 * 수주 0행은 실패로 본다(빈 목록을 '다 입력함'으로 보이게 하지 않는다).
 */
export async function load미입력재료(
  supabase: SupabaseClient<Database>,
): Promise<{ 수주: 미입력수주Row[]; 이력: 이력금액Row[]; 기성: 기성금액Row[] }> {
  const [수주, 이력, 기성] = await Promise.all([
    fetchAllRows('수주', (from, to) =>
      supabase
        .from('수주')
        .select('id, 지중no, 공사명, 준공여부, 준공일, 준공액_공급가, 보험료율, 하도전용율')
        .order('id')
        .range(from, to),
    ),
    fetchAllRows('공사이력', (from, to) =>
      supabase.from('공사이력').select('수주_id, 성과금액').eq('준공정산', false).order('id').range(from, to),
    ),
    fetchAllRows('기성', (from, to) =>
      supabase.from('기성').select('수주_id, 기성액_공급가').order('id').range(from, to),
    ),
  ])
  if (수주.length === 0) throw new Error('수주 조회 결과가 0행입니다(권한 또는 연결 문제). 빈 목록을 정상처럼 보여주지 않으려고 중단합니다.')
  return {
    수주: 수주 as unknown as 미입력수주Row[],
    이력: 이력 as unknown as 이력금액Row[],
    기성: 기성 as unknown as 기성금액Row[],
  }
}
