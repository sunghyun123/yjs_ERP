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
