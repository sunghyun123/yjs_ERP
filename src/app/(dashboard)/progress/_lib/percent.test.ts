import { describe, it, expect } from 'vitest'
import { percentToWon, wonToPercent, 누적목표를증분으로, 직전누계, calc입력기준금액 } from './percent'
import { build미입력목록 } from './미입력'

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

describe('직전누계 (기준일 직전까지의 누계 증분, strict <)', () => {
  const recs = [
    { 작업일자: '2026-06-25', 성과금액: 100 },
    { 작업일자: '2026-06-26', 성과금액: 200 },
    { 작업일자: '2026-06-28', 성과금액: 400 },
  ]

  it('빈 배열이면 0', () => {
    expect(직전누계([], '2026-06-27')).toBe(0)
  })

  it('모든 레코드가 기준일 이전이면 전부 합산', () => {
    expect(직전누계(recs, '2026-06-29')).toBe(700)
  })

  it('기준일보다 이전인 레코드만 합산한다 (백필 27 → 25·26만)', () => {
    expect(직전누계(recs, '2026-06-27')).toBe(300)
  })

  it('기준일과 같은 날 레코드는 제외한다 (strict <, 수정 시 자기 제외 근거)', () => {
    expect(직전누계(recs, '2026-06-26')).toBe(100)
  })

  it('정렬 안 된 입력에서도 정확하다', () => {
    const unsorted = [recs[2], recs[0], recs[1]]
    expect(직전누계(unsorted, '2026-06-27')).toBe(300)
  })

  it('성과금액이 null인 레코드는 0으로 취급', () => {
    expect(직전누계([{ 작업일자: '2026-06-25', 성과금액: null }], '2026-06-27')).toBe(0)
  })
})

describe('calc입력기준금액 — % 기준 금액 (2026-11-18 PR-D)', () => {
  // 요율 0.1·0.85 → 하도 비율 0.765
  const 기본 = {
    준공여부: false,
    준공일: null as string | null,
    준공액_공급가: null as number | null,
    수주금액_공급가: 10_000_000 as number | null,
    보험료율: 0.1 as number | null,
    하도전용율: 0.85 as number | null,
  }

  it('준공 전이면 수주금액 기준', () => {
    expect(calc입력기준금액(기본)).toEqual({ 금액: 7_650_000, 기준: '수주금액' })
  })

  it('준공 + 준공일 + 준공액이 있으면 준공액 기준 (감액 공사)', () => {
    const r = calc입력기준금액({ ...기본, 준공여부: true, 준공일: '2026-10-31', 준공액_공급가: 8_000_000 })
    expect(r).toEqual({ 금액: 6_120_000, 기준: '준공액' })
  })

  it('준공인데 준공일이 비면 수주금액 기준 (미입력 탭도 목표 없음 = 제외)', () => {
    const r = calc입력기준금액({ ...기본, 준공여부: true, 준공일: null, 준공액_공급가: 8_000_000 })
    expect(r?.기준).toBe('수주금액')
  })

  it('준공 전인데 준공액이 있으면 수주금액 기준 (미입력 탭도 준공 전으로 본다)', () => {
    const r = calc입력기준금액({ ...기본, 준공여부: false, 준공일: '2026-10-31', 준공액_공급가: 8_000_000 })
    expect(r?.기준).toBe('수주금액')
  })

  it('준공액이 0이어도 준공 목표로 본다 (미입력 탭 조건이 != null)', () => {
    const r = calc입력기준금액({ ...기본, 준공여부: true, 준공일: '2026-10-31', 준공액_공급가: 0 })
    expect(r).toEqual({ 금액: 0, 기준: '준공액' })
  })

  it('요율이 하나라도 null이면 null (% 입력 불가, 원 모드)', () => {
    expect(calc입력기준금액({ ...기본, 보험료율: null })).toBeNull()
    expect(calc입력기준금액({ ...기본, 하도전용율: null })).toBeNull()
  })

  it('수주 기준인데 수주금액이 null이면 null', () => {
    expect(calc입력기준금액({ ...기본, 수주금액_공급가: null })).toBeNull()
  })

  // 계약 테스트: 입력 화면 100% = 미입력 탭 목표. 두 파일이 앞으로 갈라지면 여기서 깨진다.
  it('계약: 준공 공사의 기준 금액 = build미입력목록의 목표 (원 단위까지)', () => {
    const 수주 = {
      id: 1, 지중no: 'JY25-096', 공사명: '감액 공사',
      준공여부: true, 준공일: '2025-12-20', 준공액_공급가: 6_233_919,
      수주금액_공급가: 8_127_923, 보험료율: 0.0337, 하도전용율: 0.85,
    }
    const 목록 = build미입력목록([수주], [], [])
    expect(목록.남은).toHaveLength(1)
    expect(calc입력기준금액(수주)?.금액).toBe(목록.남은[0].목표)
  })
})
