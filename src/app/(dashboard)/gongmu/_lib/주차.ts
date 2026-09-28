// src/app/(dashboard)/gongmu/_lib/주차.ts
/**
 * 공무 주간 보고서의 주차 규칙 (2026-09-28 사용자 확정)
 *
 * - 한 주 = 월~일.
 * - 한 주는 통째로 한 달에 속하고, 소속 월은 그 주 '금요일'의 달이다.
 *   보고서를 그 주의 마지막 평일에 쓰기 때문이다. (예: 9/28~10/4 → 10월 1주차)
 *   ISO 8601(목요일 기준)과는 달이 목요일에 끝날 때 갈린다 — 2026-04-27 주는 ISO로 4월, 여기선 5월.
 *   그래서 src/lib/week.ts(ISO, 달에 걸친 주를 양쪽 달에 넣음)를 쓰지 않는다.
 *
 * 날짜는 전부 'YYYY-MM-DD' 문자열로 다루고, 산술은 명시적 UTC 자정('...T00:00:00Z')에서만 한다.
 * 로컬 시계(서버=UTC, 브라우저=KST)에 따라 날짜가 밀리지 않게 하려는 것.
 * '오늘'은 이 파일이 정하지 않는다 — 호출부가 todayKST()로 넘긴다.
 */

/** 9월 1주차(2026-08-31~)부터만 본다. 그 이전 이력은 담당 지정할 이유가 없다(과거 보고서를 다시 안 씀). */
export const 최소월 = '2026-09'

/** 'YYYY-MM' */
export type 연월 = string

export type 주정보 = {
  월요일: string
  일요일: string
  소속월: 연월
  /** 그 달 안에서 1부터 */
  주차: number
  /** '1주차 9/28~10/4' */
  label: string
}

function toUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`)
}

export function addDays(ymd: string, n: number): string {
  const d = toUTC(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function 월요일Of(ymd: string): string {
  const dow = toUTC(ymd).getUTCDay() // 0=일 … 6=토
  return addDays(ymd, -((dow + 6) % 7))
}

export function 소속월Of(월요일: string): 연월 {
  return addDays(월요일, 4).slice(0, 7)
}

export function 다음달(ym: 연월): 연월 {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function 이전달(ym: 연월): 연월 {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function md(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

export function 달의주목록(ym: 연월): 주정보[] {
  let 월요일 = 월요일Of(`${ym}-01`)
  if (소속월Of(월요일) !== ym) 월요일 = addDays(월요일, 7)
  const out: 주정보[] = []
  while (소속월Of(월요일) === ym) {
    const 일요일 = addDays(월요일, 6)
    const 주차 = out.length + 1
    out.push({ 월요일, 일요일, 소속월: ym, 주차, label: `${주차}주차 ${md(월요일)}~${md(일요일)}` })
    월요일 = addDays(월요일, 7)
  }
  return out
}

export type 선택상태 = {
  월: 연월
  주목록: 주정보[]
  선택주: 주정보
  금주월요일: string
  이전가능: boolean
  다음가능: boolean
}

/**
 * URL 파라미터 → 화면 상태. 잘못됐거나 범위 밖이면 조용히 기본(금주)으로 돌린다.
 * 범위 = [최소월, 금주가 속한 달]. 미래 달은 실적이 없으므로 막는다.
 */
export function resolve선택(오늘: string, monthParam?: string, weekParam?: string): 선택상태 {
  const 금주월요일 = 월요일Of(오늘)
  const 금주월 = 소속월Of(금주월요일)
  const m = monthParam ?? ''
  const 유효 = /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m >= 최소월 && m <= 금주월
  const 월 = 유효 ? m : 금주월
  const 주목록 = 달의주목록(월)
  const 선택주 =
    주목록.find((w) => w.월요일 === weekParam) ??
    주목록.find((w) => w.월요일 === 금주월요일) ??
    주목록[주목록.length - 1]
  return { 월, 주목록, 선택주, 금주월요일, 이전가능: 월 > 최소월, 다음가능: 월 < 금주월 }
}
