export type RevenueHistoryRow = {
  작업일자: string
  성과금액: number | null
}

export function isMonthEndDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return day === new Date(year, month, 0).getDate()
}

export function sumMonthlyRevenue(rows: RevenueHistoryRow[]): number {
  return rows
    .filter((row) => isMonthEndDate(row.작업일자))
    .reduce((sum, row) => sum + (row.성과금액 ?? 0), 0)
}
