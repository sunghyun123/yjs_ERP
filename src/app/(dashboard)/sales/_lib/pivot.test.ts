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
})
