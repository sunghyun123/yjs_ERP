import type { 투입실적Row, 공사단가Row } from '@/types/database'

function get단가(
  단가목록: 공사단가Row[],
  투입구분: string,
  투입일: string,
): { 주간단가: number; 야간단가: number } {
  const applicable = 단가목록
    .filter((d) => d.투입구분 === 투입구분 && d.적용시작일 <= 투입일)
    .sort((a, b) => b.적용시작일.localeCompare(a.적용시작일))

  if (applicable.length === 0) return { 주간단가: 0, 야간단가: 0 }
  const d = applicable[0]
  return { 주간단가: d.주간단가, 야간단가: d.야간단가 ?? 0 }
}

export function calc투입금액(row: 투입실적Row, 단가목록: 공사단가Row[]): number {
  const d = row.투입일
  const s = (구분: string) => get단가(단가목록, 구분, d)

  const 직접노무비 =
    row.상용직_주 * s('상용직').주간단가 +
    row.상용직_야 * s('상용직').야간단가 +
    row.일용직_주 * s('일용직').주간단가 +
    row.일용직_야 * s('일용직').야간단가 +
    row.모범신호수_주 * s('모범신호수').주간단가 +
    row.모범신호수_야 * s('모범신호수').야간단가 +
    row.w6_주 * s('6W').주간단가 +
    row.w6_야 * s('6W').야간단가 +
    row.w3_주 * s('3W').주간단가 +
    row.w3_야 * s('3W').야간단가 +
    row.덤프15t_주 * s('덤프15T').주간단가 +
    row.덤프15t_야 * s('덤프15T').야간단가 +
    row.크레인_주 * s('크레인').주간단가 +
    row.크레인_야 * s('크레인').야간단가 +
    row.물청소차_주 * s('물청소차').주간단가 +
    row.물청소차_야 * s('물청소차').야간단가 +
    row.mcm_주 * s('MCM').주간단가 +
    row.mcm_야 * s('MCM').야간단가 +
    row.접속_주 * s('접속').주간단가 +
    row.접속_야 * s('접속').야간단가

  const 재료비 = (row.재료비인_주 + row.재료비인_야) * 161_000

  return 직접노무비 + 재료비 + row.외주1 + row.외주2
}
