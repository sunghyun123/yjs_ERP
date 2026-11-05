import { describe, expect, it } from 'vitest'
import { suggest지중no } from './번호'

describe('suggest지중no', () => {
  it('마지막 번호 + 1, 3자리 0채움', () => {
    expect(suggest지중no('JY', '2026-01-08', ['JY26-098', 'JY26-099'])).toBe('JY26-100')
  })
  it('문자열이 아니라 정수로 비교한다 ("99" > "100" 함정)', () => {
    expect(suggest지중no('JY', '2026-03-01', ['JY26-100', 'JY26-99'])).toBe('JY26-101')
  })
  it('그 연도의 번호가 없으면 001', () => {
    expect(suggest지중no('JY', '2027-01-02', ['JY26-143'])).toBe('JY27-001')
  })
  it('다른 머리글자·다른 연도는 무시한다', () => {
    expect(suggest지중no('JG', '2026-05-01', ['JY26-143', 'JG25-048', 'JG26-053'])).toBe('JG26-054')
  })
  it('0채움이 안 된 기존 번호(TY25-11)도 읽는다', () => {
    expect(suggest지중no('TY', '2025-12-01', ['TY25-010', 'TY25-11'])).toBe('TY25-012')
  })
  it('통보일자 형식이 틀리면 null', () => {
    expect(suggest지중no('JY', '26.01.08', [])).toBeNull()
  })
})
