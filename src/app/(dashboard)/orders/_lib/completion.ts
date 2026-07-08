// 달성율(%) = 성과누계 ÷ 하도적용금액 × 100. 분모가 없거나 0이면 null(0으로 나누기 방지).
export function calc달성율(성과누계: number, 하도적용금액: number | null): number | null {
  if (하도적용금액 == null || 하도적용금액 <= 0) return null
  return (성과누계 / 하도적용금액) * 100
}

// 하도적용금액 = 공급가 × (1 − 보험료율) × 하도전용율.
// 보험료율·하도전용율 중 하나라도 없으면 달성율 분모로 부적절하므로 null.
export function calc하도적용금액(
  공급가: number | null,
  보험료율: number | null,
  하도전용율: number | null,
): number | null {
  if (공급가 == null || 보험료율 == null || 하도전용율 == null) return null
  return 공급가 * (1 - 보험료율) * 하도전용율
}
