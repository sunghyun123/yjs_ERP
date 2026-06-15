export function 손익색(v: number): string {
  if (v >= 5_000_000) return '#16a34a'
  if (v <= -5_000_000) return '#dc2626'
  return '#374151'
}
