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
