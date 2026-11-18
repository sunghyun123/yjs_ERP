import { calc하도적용표시금액 } from '@/app/(dashboard)/orders/_lib/completion'

export type 입력기준 = { 금액: number; 기준: '준공액' | '수주금액' }

type 준공칸 = { 준공여부: boolean; 준공일: string | null; 준공액_공급가: number | null }

/**
 * "준공 목표가 있다" — 입력 % 기준(calc입력기준금액)과 미입력 탭 목표(build미입력목록)가 같이 쓰는 유일한 정의.
 * 두 파일에 따로 적으면 한쪽만 바뀌어도 테스트가 통과한 채 100%와 목표가 갈라진다(PR-D 게이트 3 ①).
 * 준공액 0도 목표로 본다(!= null) — 미입력 탭이 원래 그렇게 셌다.
 */
export function has준공목표<T extends 준공칸>(s: T): s is T & { 준공일: string; 준공액_공급가: number } {
  return s.준공여부 && !!s.준공일 && s.준공액_공급가 != null
}

/**
 * 입력 화면의 % 기준 금액(100%가 뜻하는 원) — 2026-11-18 PR-D.
 *
 * 준공 목표가 있으면 준공액, 없으면 수주금액. 미입력 탭 목표(`미입력.ts`)와 100%가 같아지게 하려는 것:
 * 수주 기준이면 감액 공사에서 100%를 넣는 순간 '입력 초과'가 되고(PR-C 뒤로는 곧 매출 과다), 경고도 안 뜬다.
 * - "준공 목표 있음" 조건은 미입력 탭과 같은 함수(has준공목표)를 쓴다.
 * - 곱셈은 미입력 목표와 같은 함수(calc하도적용표시금액) — 반올림·곱셈 순서 차이가 생길 자리를 없앤다.
 * - 요율이 하나라도 없으면 null(% 입력을 끄고 원 모드). calc하도적용표시금액은 요율 null을 관대하게
 *   통과시키지만, 입력 쪽은 % 자체가 꺼지므로 두 화면이 다른 숫자를 내는 경우는 없다.
 * 대가: 준공을 찍는 순간 같은 공사의 % 의미가 바뀐다(저장값 원은 불변) → 화면에 `기준` 라벨로 드러낸다.
 */
export function calc입력기준금액(s: 준공칸 & {
  수주금액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}): 입력기준 | null {
  if (s.보험료율 == null || s.하도전용율 == null) return null
  const 준공목표 = has준공목표(s)
  const 기준값 = 준공목표 ? s.준공액_공급가 : s.수주금액_공급가
  if (기준값 == null) return null
  return {
    금액: calc하도적용표시금액(기준값, s.보험료율, s.하도전용율),
    기준: 준공목표 ? '준공액' : '수주금액',
  }
}

// % → 원: 입력 퍼센트를 하도적용금액(base) 기준 원 금액으로 환산해 반올림한다.
// base 가 없거나 0 이하, 또는 pct 가 유한수가 아니면 환산 불가 → null.
// (저장되는 정본은 항상 원이므로 여기서 정수 원으로 확정한다.)
export function percentToWon(pct: number, base: number | null): number | null {
  if (base == null || base <= 0) return null
  if (!Number.isFinite(pct)) return null
  return Math.round((pct / 100) * base)
}

// 원 → %: 원 금액을 base 기준 퍼센트로 역산한다. base 없거나 0 이하면 null.
export function wonToPercent(won: number, base: number | null): number | null {
  if (base == null || base <= 0) return null
  return (won / base) * 100
}

// 누적 목표 달성률(%)을 저장 정본인 "이번 증분(원)"으로 환산한다.
// 증분 = 누적목표원 − 현재누계. 목표 < 누계면 음수(하향 정정)를 그대로 반환한다(현실 수용).
// base 없거나 0 이하, pct 가 유한수 아니면 환산 불가 → null.
export function 누적목표를증분으로(누적목표pct: number, base: number | null, 누계: number): number | null {
  const 누적목표원 = percentToWon(누적목표pct, base)
  if (누적목표원 == null) return null
  return 누적목표원 - 누계
}

// 기준일 '직전'까지의 누계 증분(원). strict < 기준일.
// 날짜당 1건(unique 제약)이라 기준일과 같은 날 레코드는 자동 제외된다.
// 폼 백필(아직 없는 날짜)·수정 Sheet(자기 자신 제외) 양쪽이 같은 함수를 쓴다.
// ISO(YYYY-MM-DD) 문자열은 사전순 비교가 곧 날짜순이라 별도 파싱 없이 비교한다.
export function 직전누계(
  records: { 작업일자: string; 성과금액: number | null }[],
  기준일: string,
): number {
  return records.reduce(
    (sum, r) => (r.작업일자 < 기준일 ? sum + (r.성과금액 ?? 0) : sum),
    0,
  )
}
