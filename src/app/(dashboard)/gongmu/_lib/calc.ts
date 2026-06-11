// src/app/(dashboard)/gongmu/_lib/calc.ts
import type { 공무_주간보고Row, 공무_월간계획Row } from '@/types/database'

/** 해당 월 누적실적 = 현재 주차 포함 이전 주차들의 금주실적 합산 */
export function calc누적실적(
  rows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적'>[],
  currentWeek: number,
  currentYear: number,
): number {
  return rows
    .filter((r) => r.year < currentYear || (r.year === currentYear && r.week_no < currentWeek))
    .reduce((sum, r) => sum + r.금주실적, 0)
}

/** 금주 실적 합산 */
export function calc금주실적합산(rows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적'>[], week: number, year: number): number {
  return rows.filter((r) => r.year === year && r.week_no === week).reduce((sum, r) => sum + r.금주실적, 0)
}

/** 달성률 (%) */
export function calc달성률(누계: number, 계획: number): number | null {
  if (계획 <= 0) return null
  return Math.round((누계 / 계획) * 100 * 10) / 10
}

/** 월간계획 합산 (공사 or 공무 구분) */
export function calc월간계획(plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[], 구분: '공사' | '공무'): number {
  return plans.filter((p) => p.구분 === 구분).reduce((sum, p) => sum + p.월간계획금액, 0)
}
