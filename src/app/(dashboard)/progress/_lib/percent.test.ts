import { describe, it, expect } from 'vitest'
import { percentToWon, wonToPercent } from './percent'

describe('percentToWon', () => {
  it('입력% × base ÷ 100 을 반올림해 원으로 환산한다', () => {
    expect(percentToWon(50, 10_000_000)).toBe(5_000_000)
  })
  it('소수 % 도 반올림해 정수 원으로 환산한다', () => {
    // 33.33% of 786,250 = 262,057.125 → 반올림 262,057
    expect(percentToWon(33.33, 786_250)).toBe(262_057)
  })
  it('base 가 null 이면 null (환산 불가)', () => {
    expect(percentToWon(50, null)).toBeNull()
  })
  it('base 가 0 이하이면 null (0으로 나누기 방지)', () => {
    expect(percentToWon(50, 0)).toBeNull()
  })
  it('pct 가 유한수가 아니면(NaN) null', () => {
    expect(percentToWon(NaN, 10_000_000)).toBeNull()
  })
  it('100% 초과도 그대로 환산한다 (가드 없음)', () => {
    expect(percentToWon(110, 10_000_000)).toBe(11_000_000)
  })
})

describe('wonToPercent', () => {
  it('원 ÷ base × 100 을 반환한다', () => {
    expect(wonToPercent(5_000_000, 10_000_000)).toBe(50)
  })
  it('base 가 null 이면 null', () => {
    expect(wonToPercent(5_000_000, null)).toBeNull()
  })
  it('base 가 0 이하이면 null', () => {
    expect(wonToPercent(5_000_000, 0)).toBeNull()
  })
})

describe('라운드트립 (정본=원, % 표시 떨림이 정본을 훼손하지 않음)', () => {
  it('원 → % → 원 이 원본 원 값으로 복원된다', () => {
    const base = 786_250
    const won = 262_056
    const pct = wonToPercent(won, base)!
    expect(percentToWon(pct, base)).toBe(won)
  })
})
