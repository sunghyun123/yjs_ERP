/**
 * 공무 페이지 — 공사이력을 담당공무별로 집계 (2026-09-28)
 *
 * ⚠️ 모든 합계는 행에서 파생한다. 카드·소계·요약이 같은 행 배열을 더하므로 서로 어긋날 수 없다.
 * ⚠️ 단위는 천원. 행마다 반올림하고 합계는 반올림된 행의 합이다 — 목록을 손으로 더한 값과
 *    카드 숫자가 1천원이라도 다르면 보는 사람에게 그건 '틀린 표'다(대시보드 실적 팝업과 같은 원칙).
 * 검산식: 담당자 합 + 삭제된 담당자 + 미지정 = 주 기준 기간의 공사 진행 합계.
 */
import { addDays, 월요일Of, 다음달, type 연월, type 주정보 } from './주차'

export type 담당자 = { id: number; 이름: string }

export type 원이력행 = {
  id: number
  수주_id: number
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
  지중no: string
  공사명: string
}

export type 실적행 = 원이력행 & { 천원: number; 월요일: string }

export type 담당묶음 = {
  /** 'p{id}' 담당 · 'x{id}' 삭제된 담당자 · 'none' 미지정 */
  key: string
  종류: '담당' | '삭제됨' | '미지정'
  담당공무_id: number | null
  이름: string
  선택주천원: number
  월누적천원: number
  건수: number
  /** 작업일자 오름차순 */
  행: 실적행[]
}

export type 담당자별실적 = { 묶음: 담당묶음[]; 선택주합천원: number; 월누적합천원: number }

export function 천원(원: number | null): number {
  return Math.round((원 ?? 0) / 1000)
}

function 주기준기간(주목록: 주정보[]): { from: string; to: string } {
  return { from: 주목록[0].월요일, to: addDays(주목록[주목록.length - 1].월요일, 7) }
}

function 달력기간(월: 연월): { from: string; to: string } {
  return { from: `${월}-01`, to: `${다음달(월)}-01` }
}

/** 주 기준 집계와 달력 기준 비교를 한 번의 조회로 하려고 두 기간의 합집합을 준다. to는 미포함. */
export function 조회기간(월: 연월, 주목록: 주정보[]): { from: string; to: string } {
  const w = 주기준기간(주목록)
  const c = 달력기간(월)
  return { from: w.from < c.from ? w.from : c.from, to: w.to > c.to ? w.to : c.to }
}

function 빈묶음(key: string, 종류: 담당묶음['종류'], 담당공무_id: number | null, 이름: string): 담당묶음 {
  return { key, 종류, 담당공무_id, 이름, 선택주천원: 0, 월누적천원: 0, 건수: 0, 행: [] }
}

export function build담당자별실적(
  행들: 원이력행[],
  담당자목록: 담당자[],
  주목록: 주정보[],
  선택월요일: string,
): 담당자별실적 {
  const { from, to } = 주기준기간(주목록)
  const 대상: 실적행[] = 행들
    .filter((r) => r.작업일자 >= from && r.작업일자 < to)
    .map((r) => ({ ...r, 천원: 천원(r.성과금액), 월요일: 월요일Of(r.작업일자) }))
    .sort((a, b) => a.작업일자.localeCompare(b.작업일자) || a.id - b.id)

  const 담당 = new Map<number, 담당묶음>(
    담당자목록.map((d) => [d.id, 빈묶음(`p${d.id}`, '담당', d.id, d.이름)]),
  )
  const 삭제됨 = new Map<number, 담당묶음>()
  const 미지정 = 빈묶음('none', '미지정', null, '미지정')

  for (const r of 대상) {
    let g: 담당묶음
    if (r.담당공무_id == null) {
      g = 미지정
    } else if (담당.has(r.담당공무_id)) {
      g = 담당.get(r.담당공무_id)!
    } else {
      // 담당자가 목록에서 지워진 행 — 미지정으로 치면 "지정했는데 미지정"이라는 거짓이 된다
      if (!삭제됨.has(r.담당공무_id)) {
        삭제됨.set(r.담당공무_id, 빈묶음(`x${r.담당공무_id}`, '삭제됨', r.담당공무_id, `삭제된 담당자 #${r.담당공무_id}`))
      }
      g = 삭제됨.get(r.담당공무_id)!
    }
    g.행.push(r)
    g.건수 += 1
    g.월누적천원 += r.천원
    if (r.월요일 === 선택월요일) g.선택주천원 += r.천원
  }

  const 묶음 = [...담당.values(), ...[...삭제됨.values()].sort((a, b) => a.key.localeCompare(b.key)), 미지정]
  return {
    묶음,
    선택주합천원: 묶음.reduce((s, g) => s + g.선택주천원, 0),
    월누적합천원: 묶음.reduce((s, g) => s + g.월누적천원, 0),
  }
}

export type 날짜금액 = { 날짜: string; 천원: number }

export type 달력비교 = {
  달력천원: number
  주기준천원: number
  /** 주기준 − 달력 */
  차이천원: number
  /** 주 기준엔 있고 달력엔 없는 날 (예: 9월의 8/31) */
  포함된날: 날짜금액[]
  /** 달력엔 있고 주 기준엔 없는 날 (예: 9월의 9/28~9/30) */
  빠진날: 날짜금액[]
}

export function build달력비교(행들: 원이력행[], 월: 연월, 주목록: 주정보[]): 달력비교 {
  const w = 주기준기간(주목록)
  const c = 달력기간(월)
  let 달력천원 = 0
  let 주기준천원 = 0
  const 포함 = new Map<string, number>()
  const 빠짐 = new Map<string, number>()
  for (const r of 행들) {
    const k = 천원(r.성과금액)
    const in주 = r.작업일자 >= w.from && r.작업일자 < w.to
    const in달 = r.작업일자 >= c.from && r.작업일자 < c.to
    if (in주) 주기준천원 += k
    if (in달) 달력천원 += k
    if (in주 && !in달) 포함.set(r.작업일자, (포함.get(r.작업일자) ?? 0) + k)
    if (in달 && !in주) 빠짐.set(r.작업일자, (빠짐.get(r.작업일자) ?? 0) + k)
  }
  const 목록 = (m: Map<string, number>) =>
    [...m].sort(([a], [b]) => a.localeCompare(b)).map(([날짜, 천원]) => ({ 날짜, 천원 }))
  return { 달력천원, 주기준천원, 차이천원: 주기준천원 - 달력천원, 포함된날: 목록(포함), 빠진날: 목록(빠짐) }
}

function md(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

/**
 * 요약 카드의 설명 줄. 두 숫자가 다른 게 오류가 아니라 주차 규칙 때문임을 그 자리에서 말한다.
 * '대시보드'라고 쓰지 않는다 — 대시보드 실적은 지금 준공분까지 합친 값이라 이 숫자와 다르다.
 */
export function 설명줄(b: 달력비교, 월: 연월): string {
  const m = Number(월.slice(5, 7))
  if (b.포함된날.length === 0 && b.빠진날.length === 0) return `달력 기준 ${m}월과 같음`
  const sign = b.차이천원 > 0 ? '+' : b.차이천원 < 0 ? '-' : ''
  const 사유: string[] = []
  if (b.포함된날.length > 0) 사유.push(`${b.포함된날.map((d) => md(d.날짜)).join(', ')} 실적 포함(${m}월 주차 소속)`)
  if (b.빠진날.length > 0) 사유.push(`${b.빠진날.map((d) => md(d.날짜)).join(', ')} 실적 제외(다른 달 주차 소속)`)
  return (
    `달력 기준 ${m}월: ${b.달력천원.toLocaleString('ko-KR')}천원 · ` +
    `차이 ${sign}${Math.abs(b.차이천원).toLocaleString('ko-KR')}천원 = ${사유.join(', ')}`
  )
}
