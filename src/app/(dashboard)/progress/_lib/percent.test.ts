import { describe, it, expect } from 'vitest'
import { percentToWon, wonToPercent, 누적목표를증분으로 } from './percent'

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

describe('누적목표를증분으로 (% 모드 = 누적 목표 → 저장 정본인 증분 역산)', () => {
  const base = 10_000_000 // 하도적용금액 1천만원 → 1% = 10만원

  it('누계 10%(100만)에서 누적 50% 입력 → 증분 40%(400만)', () => {
    expect(누적목표를증분으로(50, base, percentToWon(10, base)!)).toBe(4_000_000)
  })

  it('누계 65%에서 100% 입력 → 증분 35%(공사 완료를 깔끔하게 100으로)', () => {
    expect(누적목표를증분으로(100, base, percentToWon(65, base)!)).toBe(3_500_000)
  })

  it('현재보다 낮은 목표(하향 정정)는 음수 증분으로 그대로 반환', () => {
    expect(누적목표를증분으로(50, base, percentToWon(60, base)!)).toBe(-1_000_000)
  })

  it('100% 초과 목표도 환산만 하고 막지 않는다 (차단은 UI 경고 담당)', () => {
    expect(누적목표를증분으로(120, base, percentToWon(100, base)!)).toBe(2_000_000)
  })

  it('base 없거나 0 이하이면 환산 불가 → null', () => {
    expect(누적목표를증분으로(50, null, 0)).toBeNull()
    expect(누적목표를증분으로(50, 0, 0)).toBeNull()
  })

  it('증분 환산 후 (누계+증분)을 %로 되돌리면 입력한 누적%와 일치', () => {
    const 누계 = percentToWon(30, base)!
    const 증분 = 누적목표를증분으로(75, base, 누계)!
    expect(wonToPercent(누계 + 증분, base)).toBe(75)
  })
})
