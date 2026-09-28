/**
 * 대시보드 실적 분리 — 시공 실적 / 정산 (2026-09-28 사장님 요구사항)
 *
 * 이 회사의 금액 기록은 두 축이다. 더하는 관계가 아니다(정산 대부분은 이미 시공으로 잡힌 일에 대한 청구).
 *   시공: 공무가 진행분을 금액으로 환산한 것 = 공사이력.성과금액            → build월시공내역 (monthly-revenue-breakdown.ts)
 *   정산: 실제로 끊은 계산서 = 그 달 기성 + 그 달 준공의 금회지불액         → build월정산내역 (여기)
 *
 * ⚠️ '준공 보정'(junggong-seonggwa.ts)과 '준공 정산'은 다른 숫자다.
 *    준공 보정 = 준공액 − 공사이력(시공) 누계 — 매출 인식 축의 중복 제거용
 *    준공 정산 = 준공액 − 기성 누계           — 새로 끊은 계산서 금액 (OrderForm 의 금회지불액)
 *    둘을 섞으면 기성을 두 번 세거나 시공을 빼게 된다.
 *
 * DB에 아무것도 쓰지 않는다(읽기 시점 파생).
 */
import { 천원 } from '../gongmu/_lib/erp-실적'
import type { 준공수주Row } from './junggong-seonggwa'

export type 정산기성Row = {
  id: number
  수주_id: number
  차수: number | null
  기성일: string | null
  기성액_공급가: number | null
}

export type 월정산내역Row = {
  수주_id: number
  지중no: string
  공사명: string
  /** '기성 N차' | '기성' | '준공' */
  구분: string
  /** 계산서 날짜의 '일' */
  일: number
  /** 천원, 음수 가능(환수) — 0으로 깎지 않는다 */
  금액천원: number
}

function 일(날짜: string): number {
  return parseInt(날짜.slice(8, 10), 10)
}

/**
 * [from, to) 에 끊은 계산서 목록. (from/to 는 'YYYY-MM-DD', to 는 미포함)
 *
 * @param 기성전체 기성 **전 행**(기성일이 빈 행 포함) — 준공 차감용 누계를 전 기간으로 만들어야 해서 자르지 않고 받는다.
 *                 기간으로 자른 목록을 넘기면 5월에 끊은 기성을 9월 준공에서 못 빼 이중 계상된다.
 */
export function build월정산내역(
  기성전체: 정산기성Row[],
  수주목록: 준공수주Row[],
  from: string,
  to: string,
): 월정산내역Row[] {
  const 수주맵 = new Map(수주목록.map((o) => [o.id, o]))
  const 이름 = (수주_id: number) => {
    const o = 수주맵.get(수주_id)
    return { 지중no: o?.지중no ?? '', 공사명: o?.공사명 ?? '(공사명 없음)' }
  }

  // 기성 누계는 기성일이 빈 행(2026-06 이관분)까지 포함한 전 기간 — 날짜가 없어도 돈은 이미 청구됐다
  const 기성누계 = new Map<number, number>()
  for (const g of 기성전체) {
    기성누계.set(g.수주_id, (기성누계.get(g.수주_id) ?? 0) + (g.기성액_공급가 ?? 0))
  }

  const rows: 월정산내역Row[] = []

  // 기성: 계산서 한 장 = 한 줄. 기성일이 빈 행은 귀속시킬 달이 없어 목록에서 빠진다
  for (const g of 기성전체) {
    // 날짜는 문자열로만 비교한다 — new Date()를 쓰면 서버 시계(UTC)가 KST 달력을 밀어버린다
    if (!g.기성일 || g.기성일 < from || g.기성일 >= to) continue
    rows.push({
      수주_id: g.수주_id,
      ...이름(g.수주_id),
      구분: g.차수 ? `기성 ${g.차수}차` : '기성',
      일: 일(g.기성일),
      금액천원: 천원(g.기성액_공급가),
    })
  }

  // 준공: 금회지불액 = 총 준공액 − 앞서 끊은 기성 전부. 준공액_공급가는 언제나 총액이다(2026-07-29)
  for (const o of 수주목록) {
    if (!o.준공여부 || !o.준공일 || o.준공액_공급가 == null) continue
    if (o.준공일 < from || o.준공일 >= to) continue
    rows.push({
      수주_id: o.id,
      ...이름(o.id),
      구분: '준공',
      일: 일(o.준공일),
      금액천원: 천원(o.준공액_공급가 - (기성누계.get(o.id) ?? 0)),
    })
  }

  return rows
    // 0천원 행은 감춘다 — 합계에 0을 보태던 행이라 총액은 바뀌지 않는다
    .filter((r) => r.금액천원 !== 0 && Number.isInteger(r.일))
    // 금액 큰 순. 같으면 지중no → 구분 → 일로 고정해 매 조회마다 순서가 흔들리지 않게 한다
    .sort(
      (a, b) =>
        b.금액천원 - a.금액천원 ||
        a.지중no.localeCompare(b.지중no, 'ko') ||
        a.구분.localeCompare(b.구분, 'ko') ||
        a.일 - b.일,
    )
}

/** 표에 보이는 행들의 합 — 캡션의 '정산'은 이 값이어야 한다 (따로 계산하지 않는다) */
export function sum월정산내역(rows: 월정산내역Row[]): number {
  return rows.reduce((sum, r) => sum + r.금액천원, 0)
}
