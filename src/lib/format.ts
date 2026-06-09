export function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n)) + '원'
}

export function formatEok(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100_000_000) {
    return (n / 100_000_000).toFixed(1) + '억원'
  }
  if (abs >= 10_000) {
    return Math.round(n / 10_000) + '만원'
  }
  return formatKRW(n)
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

export function formatPercent(n: number): string {
  return n.toFixed(1) + '%'
}
