import { describe, it, expect } from 'vitest'
import { isoWeek } from './pivot'

describe('isoWeek', () => {
  it('2026-01-19는 2026-W04, 1월 3주를 반환한다', () => {
    const result = isoWeek('2026-01-19')
    expect(result.key).toBe('2026-W04')
    expect(result.label).toBe('1월 3주')
  })

  it('같은 날짜를 두 번 호출하면 동일한 key를 반환한다', () => {
    expect(isoWeek('2026-06-15').key).toBe(isoWeek('2026-06-15').key)
  })

  it('연말 경계(12-31, 01-01)에서 오류 없이 동작한다', () => {
    expect(() => isoWeek('2025-12-31')).not.toThrow()
    expect(() => isoWeek('2026-01-01')).not.toThrow()
  })

  it('같은 ISO 주의 모든 날짜(월~일)는 동일한 label을 반환한다', () => {
    // 2026-W04: Jan 19 (Mon) ~ Jan 25 (Sun)
    const labels = ['2026-01-19', '2026-01-20', '2026-01-21', '2026-01-22',
                    '2026-01-23', '2026-01-24', '2026-01-25'].map(d => isoWeek(d).label)
    expect(new Set(labels).size).toBe(1)
    expect(labels[0]).toBe('1월 3주')
  })
})
