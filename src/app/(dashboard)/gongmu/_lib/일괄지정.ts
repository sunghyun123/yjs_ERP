/**
 * 담당 일괄 지정 (PR-1.5, 2026-11-12) — 공무 미지정 팝업에서 여러 공사를 한 번에.
 * 시공 = 공사이력.담당공무_id(이력 행마다), 정산 = 수주.정산담당자_id(공사마다). 담당의 정의는 그대로다.
 *
 * ⚠️ 한 문장 `.in('id', ids)`로 쓴다 — 문장이 반쯤 실행되는 일은 없다(원자성). 그러나 `.is(칸, null)` 조건에
 *    안 걸린 행(그 사이 남이 지정)은 빠진 채 나머지가 정상 커밋된다 = 롤백이 아니다. 그래서 돌아온 id 수를
 *    요청 수와 비교해 'partial'로 알린다. 빈 칸만 채우므로 부분 반영이 기존 담당을 지우지는 않는다.
 * ⚠️ RLS(is_whitelisted)에 막히면 에러가 아니라 200 + []다 — .select('id')로 바뀐 행을 돌려받아야 잡힌다
 *    (update-공사이력.ts와 같은 판정, 기대 수가 1이 아니라 N).
 * 클라이언트는 호출부가 넘긴다 — 테스트에서 가짜를 꽂으려는 것.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { 공사별로묶기, type 실적행, type 정산행 } from './erp-실적'

export type 일괄결과 =
  | { ok: true; ids: number[] }
  | { ok: false; reason: 'error' }
  | { ok: false; reason: 'not-updated' }
  /** 일부만 커밋됨 — ids는 실제로 바뀐 행(되돌리기 대상) */
  | { ok: false; reason: 'partial'; ids: number[]; 기대: number }

type 결과 = { data: { id: number }[] | null; error: unknown }
type 클라 = SupabaseClient<Database>

function 정리(ids: number[]): number[] {
  return [...new Set(ids)]
}

function 판정({ data, error }: 결과, 요청: number[], 작업: string): 일괄결과 {
  if (error) {
    // 사용자에겐 "실패"만 보이므로 원인은 콘솔에 남긴다
    console.error(`[일괄 ${작업} 실패]`, { 요청, error })
    return { ok: false, reason: 'error' }
  }
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length === 0) return { ok: false, reason: 'not-updated' }
  if (ids.length !== 요청.length) return { ok: false, reason: 'partial', ids, 기대: 요청.length }
  return { ok: true, ids }
}

export async function 시공담당지정(sb: 클라, 이력ids: number[], 담당공무_id: number): Promise<일괄결과> {
  const 요청 = 정리(이력ids)
  // 보낼 게 없으면 0행이 돌아와 "권한 없음"으로 오진된다 — 요청 없이 성공
  if (요청.length === 0) return { ok: true, ids: [] }
  const res = await sb.from('공사이력').update({ 담당공무_id }).in('id', 요청).is('담당공무_id', null).select('id')
  return 판정(res, 요청, '시공 담당 지정')
}

export async function 시공담당되돌리기(sb: 클라, 이력ids: number[], 담당공무_id: number): Promise<일괄결과> {
  const 요청 = 정리(이력ids)
  if (요청.length === 0) return { ok: true, ids: [] }
  // eq(방금값): 그 사이 다른 사람으로 바뀐 행은 되돌리지 않는다
  const res = await sb.from('공사이력').update({ 담당공무_id: null }).in('id', 요청).eq('담당공무_id', 담당공무_id).select('id')
  return 판정(res, 요청, '시공 담당 되돌리기')
}

export async function 정산담당지정(sb: 클라, 수주ids: number[], 정산담당자_id: number): Promise<일괄결과> {
  const 요청 = 정리(수주ids)
  if (요청.length === 0) return { ok: true, ids: [] }
  // 공사 단위 칸 — 이 공사의 모든 달 정산이 이 사람 몫이 된다(화면에 명시)
  const res = await sb.from('수주').update({ 정산담당자_id }).in('id', 요청).is('정산담당자_id', null).select('id')
  return 판정(res, 요청, '정산 담당 지정')
}

export async function 정산담당되돌리기(sb: 클라, 수주ids: number[], 정산담당자_id: number): Promise<일괄결과> {
  const 요청 = 정리(수주ids)
  if (요청.length === 0) return { ok: true, ids: [] }
  const res = await sb.from('수주').update({ 정산담당자_id: null }).in('id', 요청).eq('정산담당자_id', 정산담당자_id).select('id')
  return 판정(res, 요청, '정산 담당 되돌리기')
}

/** 작업 = 문구의 동사. 되돌리기에 "지정됐습니다"가 뜨면 반대 사실을 말하게 된다 */
export function 일괄결과메시지(r: Exclude<일괄결과, { ok: true }>, 작업: '지정' | '되돌리기' = '지정'): string {
  if (작업 === '되돌리기') {
    if (r.reason === 'partial') {
      return `되돌리기: ${r.기대}건 중 ${r.ids.length}건만 되돌렸습니다. 나머지는 그 사이 담당이 바뀌어 그대로 두었습니다. 목록을 새로 읽었습니다.`
    }
    return r.reason === 'not-updated'
      ? '되돌리기: 되돌린 항목이 없습니다 (그 사이 담당이 바뀌었거나 권한이 없음).'
      : '되돌리기: 저장에 실패했습니다.'
  }
  if (r.reason === 'partial') {
    return `${r.기대}건 중 ${r.ids.length}건만 지정됐습니다. 나머지는 그 사이 다른 담당이 지정됐거나 권한이 없습니다. 목록을 새로 읽었습니다.`
  }
  return r.reason === 'not-updated' ? '지정되지 않았습니다 (권한이 없거나 이미 지정된 항목).' : '저장에 실패했습니다.'
}

/** 팝업의 한 줄 = 공사 하나. ids = 저장할 때 보낼 id(시공: 이력 id들 / 정산: 수주 id 하나) */
export type 지정항목 = {
  수주_id: number
  지중no: string
  공사명: string
  천원: number
  날짜들: string[]
  구분들?: string[]
  ids: number[]
}

/**
 * 미지정 묶음의 행(= 지금 보는 달의 주 기준 기간 안, 화면에 보이는 그 행들)을 공사별로.
 * Q2 가: 저장 대상은 이 목록의 ids뿐 — 다른 달의 미지정 행은 보내지 않는다.
 */
export function 시공미지정공사목록(행들: 실적행[]): 지정항목[] {
  // 주 단위가 아니라 달 전체를 한 번에 묶는다 — 여러 주에 걸친 공사를 주마다 따로 체크하게 하지 않으려고
  return 공사별로묶기(행들).map((g) => ({
    수주_id: g.수주_id, 지중no: g.지중no, 공사명: g.공사명, 천원: g.천원, 날짜들: g.날짜들, ids: g.행.map((r) => r.id),
  }))
}

/** 정산은 칸이 수주에 있으므로 ids = [수주_id] — 지정하면 그 공사의 모든 달 정산에 적용된다 */
export function 정산미지정공사목록(행들: 정산행[]): 지정항목[] {
  const m = new Map<number, 지정항목 & { 구분들: string[] }>()
  for (const r of 행들) {
    let g = m.get(r.수주_id)
    if (!g) {
      g = { 수주_id: r.수주_id, 지중no: r.지중no, 공사명: r.공사명, 천원: 0, 날짜들: [], 구분들: [], ids: [r.수주_id] }
      m.set(r.수주_id, g)
    }
    g.천원 += r.금액천원
    if (!g.날짜들.includes(r.날짜)) g.날짜들.push(r.날짜)
    if (!g.구분들.includes(r.구분)) g.구분들.push(r.구분)
  }
  for (const g of m.values()) g.날짜들.sort()
  return [...m.values()]
}
