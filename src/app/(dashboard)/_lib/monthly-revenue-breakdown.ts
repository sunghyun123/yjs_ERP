/**
 * 월 성과 내역 — 총 공정률 도넛의 '실적'을 공사 한 줄씩으로 펼친 것 (2026-09-11 사장님 요구사항)
 *
 * ⚠️ 이 파일이 따로 있는 이유는 단 하나, "표의 합계가 도넛의 실적과 반드시 같아야 한다"는 제약이다.
 *    그래서 총액을 따로 계산하지 않는다 — 총액은 sum월성과내역(rows), 즉 화면에 보이는 행들의 합이다.
 *    천원 반올림도 여기서 행 단위로 끝낸다. 원 단위로 다 더한 뒤 마지막에 한 번 반올림하면
 *    행을 손으로 더한 값과 몇 천원 어긋나고, 보는 사람에게 그건 그냥 '틀린 표'다.
 *
 * 실적은 두 덩어리의 합이다 (monthly-kpi.ts 의 monthlyRevenue 와 같은 규칙·같은 재료):
 *   ① 그 달 공사이력.성과금액        → 공사별로 합치고, 성과가 찍힌 날짜를 모은다
 *   ② 그 달 준공 공사의 준공 잔여성과 → 같은 공사면 ①에 더해 한 줄로 합친다 (음수 가능)
 * ②만 있는 공사는 그 달 작업일이 없으므로 일자가 빈 배열이 된다.
 */
import { legacyRowTo상세, type 투입실적With상세 } from './calc'
import {
  calc준공잔여성과,
  type 공사이력Row as 성과이력Row,
  type 준공수주Row,
} from './junggong-seonggwa'

export type 월성과내역Row = {
  수주_id: number
  지중no: string
  공사명: string
  /** 천원 단위로 반올림된 금액 — 도넛과 표가 같은 숫자를 쓰도록 여기서 확정한다 */
  금액천원: number
  /** 그 달 성과가 찍힌 날의 '일'만, 오름차순 */
  일자: number[]
  /** 위 일자 중 야간 투입이 있었던 날 */
  야간일자: number[]
}

function 야간키(수주_id: number, 날짜: string): string {
  return `${수주_id}|${날짜}`
}

function 일(날짜: string): number {
  return parseInt(날짜.slice(8, 10), 10)
}

function has야간(row: 투입실적With상세): boolean {
  // 투입실적상세가 정본이고, 상세가 아직 없는 구형 행만 레거시 컬럼(_야)으로 읽는다 — calc.ts 와 같은 순서
  const 상세 = row.투입실적상세
  const 목록 = Array.isArray(상세) && 상세.length > 0 ? 상세 : legacyRowTo상세(row)
  return 목록.some((d) => Number(d.야간수량) > 0)
}

/**
 * [from, to) 기간의 공사별 성과 내역. (from/to 는 'YYYY-MM-DD', to 는 미포함)
 *
 * @param 공사이력전체 준공정산 제외된 전 기간 공사이력 — 기간 자르기는 여기서 한다
 * @param 이력누계     수주_id → 성과금액 '전 기간' 누계 (준공 잔여성과 차감용)
 * @param 투입실적     그 달 투입실적 — 금액이 아니라 오직 '그날 야간이었나' 표기에만 쓴다
 */
export function build월성과내역(
  공사이력전체: 성과이력Row[],
  수주목록: 준공수주Row[],
  이력누계: Map<number, number>,
  투입실적: 투입실적With상세[],
  from: string,
  to: string,
): 월성과내역Row[] {
  const 수주맵 = new Map(수주목록.map((o) => [o.id, o]))

  // 야간 여부는 공사이력에 아예 없는 정보라 투입실적에서 (수주_id + 같은 날)로 빌려온다.
  // 투입 입력이 안 된 날은 야간이어도 표기가 안 붙는다 — 금액과 무관한 표기라 감수한다.
  const 야간날 = new Set<string>()
  for (const row of 투입실적) {
    const 날짜 = String(row.투입일 ?? '')
    if (날짜 < from || 날짜 >= to) continue
    if (has야간(row)) 야간날.add(야간키(row.수주_id, 날짜))
  }

  type 집계 = { 금액원: number; 날짜: Set<string> }
  const 집계맵 = new Map<number, 집계>()
  const get집계 = (수주_id: number): 집계 => {
    let v = 집계맵.get(수주_id)
    if (!v) {
      v = { 금액원: 0, 날짜: new Set<string>() }
      집계맵.set(수주_id, v)
    }
    return v
  }

  // ① 그 달 공사이력
  for (const row of 공사이력전체) {
    // 날짜는 문자열로만 비교한다 — new Date()를 쓰면 서버 시계(UTC)가 KST 달력을 밀어버린다
    if (row.작업일자 < from || row.작업일자 >= to) continue
    const v = get집계(row.수주_id)
    v.금액원 += row.성과금액 ?? 0
    v.날짜.add(row.작업일자)
  }

  // ② 준공 잔여성과 — 같은 공사면 ①과 한 줄로 합친다 (준공만 있는 공사는 날짜가 빈 채로 새 줄이 생김)
  for (const r of calc준공잔여성과(수주목록, 이력누계, from, to)) {
    get집계(r.수주_id).금액원 += r.금액
  }

  const rows: 월성과내역Row[] = []
  for (const [수주_id, v] of 집계맵) {
    const 금액천원 = Math.round(v.금액원 / 1000)
    // 0천원 행은 감춘다 — 합계에 0을 보태던 행이라 총액은 바뀌지 않는다
    if (금액천원 === 0) continue
    const 수주 = 수주맵.get(수주_id)
    const 날짜목록 = [...v.날짜].sort()
    rows.push({
      수주_id,
      지중no: 수주?.지중no ?? '',
      공사명: 수주?.공사명 ?? '(공사명 없음)',
      금액천원,
      일자: 날짜목록.map(일).filter(Number.isInteger),
      야간일자: 날짜목록.filter((d) => 야간날.has(야간키(수주_id, d))).map(일).filter(Number.isInteger),
    })
  }

  // 금액 큰 순. 같으면 지중no로 고정해 매 조회마다 순서가 흔들리지 않게 한다
  return rows.sort((a, b) => b.금액천원 - a.금액천원 || a.지중no.localeCompare(b.지중no, 'ko'))
}

/** 표에 보이는 행들의 합 — 도넛의 '실적'은 이 값이어야 한다 (따로 계산하지 않는다) */
export function sum월성과내역(rows: 월성과내역Row[]): number {
  return rows.reduce((sum, r) => sum + r.금액천원, 0)
}
