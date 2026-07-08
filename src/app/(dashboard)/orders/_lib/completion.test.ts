import { describe, it, expect } from 'vitest'
import { calc달성율, calc하도적용금액 } from './completion'

describe('calc달성율', () => {
  it('성과누계 ÷ 하도적용금액 × 100을 반환한다', () => {
    expect(calc달성율(5_000_000, 10_000_000)).toBe(50)
  })
  it('하도적용금액이 null이면 null', () => {
    expect(calc달성율(5_000_000, null)).toBeNull()
  })
  it('하도적용금액이 0이면 null (0으로 나누기 방지)', () => {
    expect(calc달성율(5_000_000, 0)).toBeNull()
  })
})

describe('calc하도적용금액', () => {
  it('공급가 × (1 − 보험료율) × 하도전용율', () => {
    // 1,000,000 × (1 − 0.075) × 0.85 = 786,250
    expect(calc하도적용금액(1_000_000, 0.075, 0.85)).toBeCloseTo(786_250, 4)
  })
  it('보험료율이 null이면 null', () => {
    expect(calc하도적용금액(1_000_000, null, 0.85)).toBeNull()
  })
  it('하도전용율이 null이면 null', () => {
    expect(calc하도적용금액(1_000_000, 0.075, null)).toBeNull()
  })
  it('공급가가 null이면 null', () => {
    expect(calc하도적용금액(null, 0.075, 0.85)).toBeNull()
  })
})
