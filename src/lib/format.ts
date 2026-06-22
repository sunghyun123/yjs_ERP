import { formatKST } from './kst'

export function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n)) + '원'
}

export function formatEok(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100_000_000) {
    return (
      (n / 100_000_000).toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + '억원'
    )
  }
  if (abs >= 10_000) {
    return Math.round(n / 10_000).toLocaleString('ko-KR') + '만원'
  }
  return formatKRW(n)
}

export function formatDate(d: string | Date): string {
  // 이미 'YYYY-MM-DD' 형식 문자열이면 그대로 둔다(파싱 왕복 시 타임존으로 밀릴 위험 제거).
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  const date = typeof d === 'string' ? new Date(d) : d
  return formatKST(date)
}

export function formatPercent(n: number): string {
  return n.toFixed(1) + '%'
}
