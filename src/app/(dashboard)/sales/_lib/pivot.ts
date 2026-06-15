export function isoWeek(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const weekNo = Math.floor((d.getTime() - startOfWeek1.getTime()) / 604800000) + 1
  const month = d.getMonth() + 1
  const weekOfMonth = Math.ceil(d.getDate() / 7)
  return {
    key: `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    label: `${month}월 ${weekOfMonth}주`,
  }
}
