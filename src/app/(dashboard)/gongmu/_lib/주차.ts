// src/app/(dashboard)/gongmu/_lib/주차.ts
/**
 * 공무 주간 보고서의 주차 규칙 (2026-09-28 사용자 확정)
 *
 * - 한 주 = 월~일.
 * - 한 주는 통째로 한 달에 속하고, 소속 월은 그 주 '금요일'의 달이다.
 *   보고서를 그 주의 마지막 평일에 쓰기 때문이다. (예: 9/28~10/4 → 10월 1주차)
 *   ISO 8601(목요일 기준)과는 달이 목요일에 끝날 때 갈린다 — 2026-04-27 주는 ISO로 4월, 여기선 5월.
 *   그래서 src/lib/week.ts(ISO, 달에 걸친 주를 양쪽 달에 넣음)를 쓰지 않는다.
 * - 단, 해가 바뀌는 주는 1/1에서 자른다(2026-11-12): 앞 조각은 앞 해 12월, 뒤 조각은 새해 1월.
 *   연간 표의 약속 "한 해의 숫자는 그 해 안에 다 있다"를 지키려는 것 — 안 자르면 2026-01이
 *   2025-12-29~31 이관행 21.9억을 먹고, 2026-12-28~31 실적이 2027-01로 넘어간다.
 *   그래서 주정보.월요일(열쇠)과 시작(표시·기간)이 다를 수 있다. 끝을 addDays(월요일, 6)로 구하지 말 것.
 *
 * 날짜는 전부 'YYYY-MM-DD' 문자열로 다루고, 산술은 명시적 UTC 자정('...T00:00:00Z')에서만 한다.
 * 로컬 시계(서버=UTC, 브라우저=KST)에 따라 날짜가 밀리지 않게 하려는 것.
 * '오늘'은 이 파일이 정하지 않는다 — 호출부가 todayKST()로 넘긴다.
 */

/** 2026-01부터 본다(2026-11-12, 설계 §3-3 — 연간 표). 1~8월 담당은 공무 화면에서 수동 지정한다. */
export const 최소월 = '2026-01'

/** 'YYYY-MM' */
export type 연월 = string

export type 주정보 = {
  /** 그 주의 진짜 월요일 — 열쇠 전용(URL week=, 월요일Of(행 날짜)·금주월요일과 비교). 잘린 주에선 시작과 다르다 */
  월요일: string
  /** 이 달에 들어오는 첫날 (잘린 주의 뒤 조각이면 1/1) */
  시작: string
  /** 이 달에 들어오는 마지막 날, 포함 (잘린 주의 앞 조각이면 12/31) */
  끝: string
  소속월: 연월
  /** 그 달 안에서 1부터 */
  주차: number
  /** '1주차 9/28~10/4' — 시작~끝 */
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

type 조각 = { 시작: string; 끝: string; 소속월: 연월 }

/**
 * 한 주(월~일)를 해 경계에서 자른 조각. 해를 안 넘으면 1개(금요일의 달), 넘으면 2개(12월·1월).
 * 주의 소속을 정하는 규칙은 이 함수 하나다 — 소속월Of·달의주목록이 모두 여기만 거친다.
 */
function 주조각(월요일: string): 조각[] {
  const 일요일 = addDays(월요일, 6)
  const y = 월요일.slice(0, 4)
  const ny = 일요일.slice(0, 4)
  if (y === ny) return [{ 시작: 월요일, 끝: 일요일, 소속월: addDays(월요일, 4).slice(0, 7) }]
  return [
    { 시작: 월요일, 끝: `${y}-12-31`, 소속월: `${y}-12` },
    { 시작: `${ny}-01-01`, 끝: 일요일, 소속월: `${ny}-01` },
  ]
}

/** 그 날짜가 속한 달 — 해를 안 넘는 주는 금요일의 달, 잘린 주는 날짜가 든 조각의 달 */
export function 소속월Of(ymd: string): 연월 {
  // 조각은 그 주 7일을 빈틈없이 덮으므로 find 는 반드시 찾는다
  return 주조각(월요일Of(ymd)).find((c) => c.시작 <= ymd && ymd <= c.끝)!.소속월
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
  const out: 주정보[] = []
  // 이 달에 조각이 걸칠 수 있는 주 = 1일이 든 주 ~ 다음 달 1일이 든 주 (금요일 규칙상 그 밖의 주는 이 달일 수 없다)
  const 마지막월요일 = 월요일Of(`${다음달(ym)}-01`)
  for (let 월요일 = 월요일Of(`${ym}-01`); 월요일 <= 마지막월요일; 월요일 = addDays(월요일, 7)) {
    for (const c of 주조각(월요일)) {
      if (c.소속월 !== ym) continue
      const 주차 = out.length + 1
      out.push({ 월요일, 시작: c.시작, 끝: c.끝, 소속월: ym, 주차, label: `${주차}주차 ${md(c.시작)}~${md(c.끝)}` })
    }
  }
  return out
}

/** 주 목록이 덮는 기간 [from, to) — 첫 주 시작 ~ 마지막 주 끝 다음 날. to는 미포함. 월요일(열쇠)로 계산하지 않는다 */
export function 주목록기간(주목록: 주정보[]): { from: string; to: string } {
  return { from: 주목록[0].시작, to: addDays(주목록[주목록.length - 1].끝, 1) }
}

/**
 * 오늘이 속한 주의 소속월과 그 달 주차들이 덮는 기간.
 * 대시보드 실적(도넛·담당자별 진척)이 공무 화면·주간업무 보고서와 같은 달·같은 날짜를 보게 하려고 쓴다 (2026-10-23).
 * 예) 오늘 9/28(월) → 그 주 금요일 10/2 → 10월, 기간 9/28~11/1.
 */
export function 금주소속월기간(오늘: string): { 월: 연월; from: string; to: string } {
  const 월 = 소속월Of(오늘) // 월요일이 아니라 오늘 — 잘린 주에선 둘의 달이 다르다
  return { 월, ...주목록기간(달의주목록(월)) }
}

const 연월형식 = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * 볼 수 있는 달 = [최소월, 금주가 속한 달]. 미래 달은 실적이 없고, 최소월(2026-01) 앞은 보지 않는다(설계 2026-11-12 §3-3).
 * 공무 화면(resolve선택)과 대시보드 API(조회월기간)가 이 한 함수를 같이 쓴다 — 둘의 범위가 갈라지지 않게.
 * 'YYYY-MM' 문자열 비교 = 날짜 비교(0 채움 고정폭이라). 그래서 형식 검사가 먼저다.
 */
export function 조회가능월(m: string, 금주월: 연월): boolean {
  return 연월형식.test(m) && m >= 최소월 && m <= 금주월
}

export type 조회월결과 =
  | { ok: true; 기간: { 월: 연월; from: string; to: string } }
  | { ok: false; error: string }

/**
 * 대시보드 API ?month= → 그 달의 금요일 기준 기간 [from, to).
 * 화면(resolve선택)과 달리 잘못된 값을 금주 달로 바꾸지 않고 오류로 돌려준다(→ 400).
 * "9월을 달라"고 했는데 11월을 9월 칸에 그리는 사고를 막는다.
 * @param 오늘 KST 'YYYY-MM-DD' — 호출부가 formatKST(now)로 넘긴다. 서버 시계(UTC) 날짜를 넘기면
 *             새 달 첫 주 월요일 00~09시에 금주 달이 지난달로 잡혀 이번 달이 거절된다.
 */
export function 조회월기간(monthParam: string, 오늘: string): 조회월결과 {
  const 금주월 = 소속월Of(오늘)
  if (!연월형식.test(monthParam)) {
    return { ok: false, error: `month는 YYYY-MM 형식이어야 합니다: '${monthParam}'` }
  }
  if (!조회가능월(monthParam, 금주월)) {
    return {
      ok: false,
      error: `month는 ${최소월}~${금주월} 사이여야 합니다: '${monthParam}'`,
    }
  }
  return { ok: true, 기간: { 월: monthParam, ...주목록기간(달의주목록(monthParam)) } }
}

export type 연간월상태 = '완료' | '진행중' | '미래'

export type 연간조회결과 =
  | {
      ok: true
      연도: number
      /** 항상 12개, 1~12월 순서. 미래 달은 기간 null(실적이 없다 — 0이 아니다) */
      월목록: { 월: 연월; 상태: 연간월상태; 기간: { 월: 연월; from: string; to: string } | null }[]
      /** 첫 달 from ~ 마지막 비-미래 달 to — 기간 재료(투입실적)를 이 범위로 한 번 읽는다 */
      전체기간: { from: string; to: string }
    }
  | { ok: false; error: string }

/**
 * 대시보드 API ?year= → 그 해 12달의 상태와 금요일 기준 기간.
 * 새 날짜 규칙이 아니다 — 달 기간은 조회월기간(?month=)과 같은 달의주목록·주목록기간에서, 금주월은 소속월Of에서 온다.
 * PR-1(해 경계 자르기) 덕에 1월은 1/1부터, 12월은 12/31까지라 12달 합 = 한 해다.
 * 범위: 그 해 1월이 [최소월, 금주월] 안이어야 한다. 최소월이 1월이라 해 단위로만 검사한다(테스트로 못 박음).
 */
export function 연간조회월목록(yearParam: string, 오늘: string): 연간조회결과 {
  if (!/^\d{4}$/.test(yearParam)) {
    return { ok: false, error: `year는 YYYY 형식이어야 합니다: '${yearParam}'` }
  }
  const 금주월 = 소속월Of(오늘)
  const 첫달 = `${yearParam}-01`
  if (!조회가능월(첫달, 금주월)) {
    return {
      ok: false,
      error: `year는 ${최소월.slice(0, 4)}~${금주월.slice(0, 4)} 사이여야 합니다: '${yearParam}'`,
    }
  }
  const 월목록: Extract<연간조회결과, { ok: true }>['월목록'] = []
  for (let 월 = 첫달; 월.startsWith(yearParam); 월 = 다음달(월)) {
    const 상태: 연간월상태 = 월 > 금주월 ? '미래' : 월 === 금주월 ? '진행중' : '완료'
    월목록.push({ 월, 상태, 기간: 상태 === '미래' ? null : { 월, ...주목록기간(달의주목록(월)) } })
  }
  const 열린 = 월목록.filter((x) => x.기간 !== null)
  return {
    ok: true,
    연도: Number(yearParam),
    월목록,
    // 첫달이 조회가능월이라 열린 달은 최소 1개
    전체기간: { from: 열린[0].기간!.from, to: 열린[열린.length - 1].기간!.to },
  }
}

export type 선택상태 = {
  월: 연월
  주목록: 주정보[]
  선택주: 주정보
  금주월요일: string
  /** 오늘이 속한 달 — '· 금주' 표시 판정용 (잘린 주는 12월·1월 목록에 같은 열쇠로 하나씩 있다) */
  금주월: 연월
  이전가능: boolean
  다음가능: boolean
}

/**
 * URL 파라미터 → 화면 상태. 잘못됐거나 범위 밖이면 조용히 기본(금주)으로 돌린다.
 * 범위 = [최소월, 금주가 속한 달]. 미래 달은 실적이 없으므로 막는다.
 */
export function resolve선택(오늘: string, monthParam?: string, weekParam?: string): 선택상태 {
  const 금주월요일 = 월요일Of(오늘)
  const 금주월 = 소속월Of(오늘)
  const m = monthParam ?? ''
  const 유효 = 조회가능월(m, 금주월)
  const 월 = 유효 ? m : 금주월
  const 주목록 = 달의주목록(월)
  const 선택주 =
    주목록.find((w) => w.월요일 === weekParam) ??
    주목록.find((w) => w.월요일 === 금주월요일) ??
    주목록[주목록.length - 1]
  return { 월, 주목록, 선택주, 금주월요일, 금주월, 이전가능: 월 > 최소월, 다음가능: 월 < 금주월 }
}
