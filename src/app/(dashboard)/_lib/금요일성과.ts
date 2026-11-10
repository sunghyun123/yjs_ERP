// src/app/(dashboard)/_lib/금요일성과.ts
/**
 * 매출손익 '금요일' 화면 — 월별 성과를 공무·대시보드와 같은 기간·같은 반올림으로 다시 센다 (2026-11-10)
 *
 * 목적은 하나, "매출손익과 공무 화면 숫자가 왜 다른가"를 표에서 보이게 하는 것.
 *   시공 기록 = 공사이력.성과금액만, 금요일 기준 주차 기간, 행마다 천원 반올림 → 공무 화면 월 누적과 천원까지 같다
 *   준공 반영 = 그 기간에 준공한 공사의 (준공액 − 시공 전 기간 누계) → 매출손익에만 있는 몫
 * 두 줄을 합치지 않고 나눠 보여주는 이유는 설계 문서 §7-1. 준공 반영의 크기가 곧 '시공 기록 누락'의 크기다.
 *
 * ⚠️ 규칙을 여기서 새로 만들지 않는다. 기간(주차.ts)·시공 합계(build월시공내역, 대시보드 split 과 같은 함수)·
 *    반올림(천원)·준공 반영(calc준공잔여성과)을 전부 기존 함수에서 가져온다. 복사하면 한쪽만 바뀌는 날 화면이 갈라진다.
 * ⚠️ 시계를 읽지 않는다. '금주 소속월'은 호출부가 KST(todayKST)로 정해서 넘긴다 — 서버 시계는 UTC다.
 * DB에 아무것도 쓰지 않는다(읽기 시점 파생).
 */
import { 달의주목록, 주목록기간, 최소월, type 연월 } from '../gongmu/_lib/주차'
import { 천원 } from '../gongmu/_lib/erp-실적'
import {
  build이력누계,
  calc준공잔여성과,
  type 공사이력Row,
  type 준공수주Row,
} from './junggong-seonggwa'
import { build월시공내역, sum월성과내역 } from './monthly-revenue-breakdown'

export type 금요일월성과 =
  /** 최소월 앞이거나 금주 소속월 뒤 — 화면에 '—' */
  | { 월: 연월; 표시: false }
  | {
      월: 연월
      표시: true
      /** 금요일 기준 기간 [from, to), to 미포함 */
      from: string
      to: string
      시공기록천원: number
      준공반영천원: number
      /** = 시공기록천원 + 준공반영천원 */
      성과천원: number
    }

/**
 * @param 공사이력전체 준공정산 제외, **전 기간** — 준공 반영의 차감 누계가 전 기간이어야 한다(load성과재료 결과 그대로)
 * @param 금주월 오늘(KST)이 속한 주의 소속월. 이 달보다 뒤는 표시하지 않는다
 */
export function build금요일성과(
  공사이력전체: 공사이력Row[],
  수주목록: 준공수주Row[],
  year: number,
  금주월: 연월,
): 금요일월성과[] {
  // 전 기간 누계는 한 번만 만든다 — 달마다 같은 값이다
  const 누계 = build이력누계(공사이력전체)

  return Array.from({ length: 12 }, (_, i): 금요일월성과 => {
    const 월 = `${year}-${String(i + 1).padStart(2, '0')}`
    // 'YYYY-MM' 문자열 비교 = 날짜 비교(0 채움 고정폭이라). new Date() 를 쓰지 않는다
    if (월 < 최소월 || 월 > 금주월) return { 월, 표시: false }

    const { from, to } = 주목록기간(달의주목록(월))
    // 대시보드 split.construction.totalThousand 와 같은 함수 — 투입실적은 야간 표시용이라 합계에 영향 없음([] 로 충분)
    const 시공기록천원 = sum월성과내역(build월시공내역(공사이력전체, 수주목록, [], from, to))
    const 준공반영천원 = calc준공잔여성과(수주목록, 누계, from, to).reduce(
      (s, r) => s + 천원(r.금액),
      0,
    )
    return {
      월,
      표시: true,
      from,
      to,
      시공기록천원,
      준공반영천원,
      성과천원: 시공기록천원 + 준공반영천원,
    }
  })
}
