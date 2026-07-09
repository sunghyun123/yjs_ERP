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

// 표시용 하도적용 금액 — calc하도적용금액(엄격: 요율 없으면 null, 달성율 분모용)과 달리
// 있는 요율만 적용하고 없으면 공급가 그대로 반환한다(수주대장 표시 규칙).
export function calc하도적용표시금액(
  공급가: number | null,
  보험료율: number | null,
  하도전용율: number | null,
): number {
  const base = 공급가 ?? 0
  const 보험료제외 = 보험료율 != null ? base * (1 - 보험료율) : base
  return 하도전용율 != null ? 보험료제외 * 하도전용율 : 보험료제외
}
