// src/lib/week.ts

/** ISO 주차 계산 (ISO 8601: 월요일 시작, 목요일이 속한 주가 해당 연도의 주) */
export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // ISO week: 목요일 기준
  const dayNum = d.getUTCDay() || 7 // 0(일) → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

/** 해당 ISO 주차의 월요일(시작일) 반환 */
export function getWeekStart(isoYear: number, isoWeek: number): Date {
  // Jan 4는 항상 1주차에 속함
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (isoWeek - 1) * 7)
  return monday
}

/** 해당 ISO 주차의 일요일(종료일) 반환 */
export function getWeekEnd(isoYear: number, isoWeek: number): Date {
  const start = getWeekStart(isoYear, isoWeek)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return end
}

/** YYYY-MM-DD 형식으로 반환 */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** 해당 월(year/month)에 속하는 ISO 주차 목록 반환 (월 경계 포함) */
export function getWeeksInMonth(year: number, month: number): { isoYear: number; week: number; label: string }[] {
  const result: { isoYear: number; week: number; label: string }[] = []
  const seen = new Set<string>()

  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const { year: wy, week: wk } = getISOWeek(new Date(year, month - 1, d))
    const key = `${wy}-${wk}`
    if (!seen.has(key)) {
      seen.add(key)
      const start = getWeekStart(wy, wk)
      const end = getWeekEnd(wy, wk)
      result.push({
        isoYear: wy,
        week: wk,
        label: `${result.length + 1}주차 (${toDateStr(start).slice(5)}~${toDateStr(end).slice(5)})`,
      })
    }
  }
  return result
}

/** 오늘이 속한 ISO 주차 */
export function getCurrentWeek(): { year: number; week: number } {
  return getISOWeek(new Date())
}
