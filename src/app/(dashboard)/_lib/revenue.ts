export type RevenueHistoryRow = {
  작업일자: string
  성과금액: number | null
}

// 성과금액은 공사현황.xlsx 기준 일별 증분으로 적재된다 (단일 정본).
// 따라서 기간 내 모든 행을 합산한다 — 과거 월말 일괄행 가정(isMonthEndDate)은 폐기됨.
export function sumMonthlyRevenue(rows: RevenueHistoryRow[]): number {
  return rows.reduce((sum, row) => sum + (row.성과금액 ?? 0), 0)
}
