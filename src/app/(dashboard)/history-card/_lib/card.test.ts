import { describe, expect, it } from 'vitest'
import { build카드, 천원버림, toYYMMDD, type 카드입력 } from './card'
import type { 추출결과 } from './extract'
import type { 수주후보 } from './공사번호'

const 추출: 추출결과 = {
  공사번호: '3917-2025-3862 (01)',
  공사명: '평촌동70 (주)금성 750kW 신설',
  시공통보일자: '2026-01-08',
  사업소명: null,
  계약금액: 54232930,
  공급가액: 49302664,
  부가가치세: 4930266,
  공사개요: null,
  공사기간_시작: null,
  공사기간_끝: null,
  공사시행초안: ['케이블 포설', '접속 및 시험'],
}

const 기본입력 = (덮어쓰기: Partial<카드입력> = {}): 카드입력 => ({
  추출,
  규칙: { 머리글자: 'JY', 거래처_id: 4 },
  거래처요율: { 보험료제외율: 0.075, 하도전용율: 0.85 },
  수주목록: [{ ...수주('JY26-143', '3917-2026-0001') }],
  ...덮어쓰기,
})

function 수주(지중no: string, 공사번호: string, 덮어쓰기: Partial<수주후보> = {}): 수주후보 {
  return {
    id: 1, 지중no, 공사명: 'ERP 공사명', 공사번호, 원청사_id: 4,
    수주금액_공급가: 12_000_000, 보험료율: 0.075, 하도전용율: 0.81, ...덮어쓰기,
  }
}

describe('천원버림', () => {
  it('천원 미만은 버린다', () => expect(천원버림(9_943_800)).toBe('9,943천원'))
  it('부동소수 오차로 1천원이 깎이지 않는다', () => expect(천원버림(9_942_999.9999)).toBe('9,943천원'))
})

describe('toYYMMDD', () => {
  it('YYYY-MM-DD → YY.MM.DD', () => expect(toYYMMDD('2026-01-08')).toBe('26.01.08'))
  it('형식이 다르면 null', () => {
    expect(toYYMMDD('2026.01.08')).toBeNull()
    expect(toYYMMDD(null)).toBeNull()
  })
})

describe('build카드 — 신규 수주', () => {
  it('제안 번호 + 통보서 금액 + 거래처 요율로 카드를 만든다 (탭 들여쓰기)', () => {
    const r = build카드(기본입력())
    expect(r.번호상태).toBe('제안')
    expect(r.text).toBe([
      'JY26-144. 평촌동70 (주)금성 750kW 신설',
      '\t접수',
      '\t\t26.01.08 시공통보서 접수',
      '\t\t공급가액',
      '\t\t\t49,302천원',
      '\t\t영전사금액',
      '\t\t\t38,764천원', // 49,302,664 × 0.925 × 0.85 = 38,764,219.57
      '\t진행사항',
      '\t공사시행',
      '\t\t(AI 초안)',
      '\t\t케이블 포설',
      '\t\t접속 및 시험',
      '\t향후계획',
    ].join('\n'))
    expect(r.warnings).toEqual([])
  })

  it('규칙에 거래처가 없으면 영전사금액은 확인 필요 + 경고', () => {
    const r = build카드(기본입력({ 규칙: { 머리글자: 'TY', 거래처_id: null }, 거래처요율: null }))
    expect(r.text).toContain('\t\t영전사금액\n\t\t\t확인 필요')
    expect(r.warnings.some(w => w.includes('영전사금액'))).toBe(true)
  })

  it('공사시행 초안이 비면 (AI 초안) 표시도 넣지 않는다', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 공사시행초안: [] } }))
    expect(r.text).toContain('\t공사시행\n\t향후계획')
  })
})

describe('build카드 — 기존 수주', () => {
  it('ERP의 지중no·공사명·공급가·요율을 쓴다', () => {
    const r = build카드(기본입력({ 수주목록: [수주('JY26-004', '391720253862')] }))
    expect(r.번호상태).toBe('기존')
    expect(r.text.split('\n')[0]).toBe('JY26-004. ERP 공사명')
    expect(r.text).toContain('\t\t공급가액\n\t\t\t12,000천원')
    expect(r.text).toContain('\t\t영전사금액\n\t\t\t8,991천원') // 12,000,000 × 0.925 × 0.81
  })

  it('수주의 요율이 비면 확인 필요 (공급가를 영전사금액으로 적지 않는다)', () => {
    const r = build카드(기본입력({ 수주목록: [수주('JY26-004', '391720253862', { 하도전용율: null })] }))
    expect(r.text).toContain('\t\t영전사금액\n\t\t\t확인 필요')
  })

  it('수주의 원청사가 규칙의 거래처와 다르면 경고', () => {
    const r = build카드(기본입력({ 수주목록: [수주('SY26-001', '391720253862', { 원청사_id: 3 })] }))
    expect(r.warnings.some(w => w.includes('머리글자'))).toBe(true)
  })

  it('같은 공사번호가 2건이면 번호는 확인 필요, 후보를 경고에 나열, 금액은 통보서 기준', () => {
    const r = build카드(기본입력({
      수주목록: [수주('JY26-010', '391720253862'), 수주('JY26-011', '3917-2025-3862')],
    }))
    expect(r.번호상태).toBe('확인 필요')
    expect(r.후보).toEqual(['JY26-010', 'JY26-011'])
    expect(r.text.split('\n')[0]).toBe('확인 필요. 평촌동70 (주)금성 750kW 신설')
    expect(r.text).toContain('\t\t\t49,302천원')
  })
})

describe('build카드 — 검산과 빈 칸', () => {
  it('공급가 + 부가세 ≠ 계약금액이면 경고, 카드는 그대로', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 계약금액: 54_232_931 } }))
    expect(r.warnings.some(w => w.includes('공급가 + 부가세'))).toBe(true)
    expect(r.text).toContain('49,302천원')
  })

  it('공급가액을 못 읽으면 확인 필요 + 경고', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 공급가액: null } }))
    expect(r.text).toContain('\t\t공급가액\n\t\t\t확인 필요')
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('통보일자를 못 읽으면 날짜와 번호가 확인 필요', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 시공통보일자: null } }))
    expect(r.text.split('\n')[0]).toBe('확인 필요. 평촌동70 (주)금성 750kW 신설')
    expect(r.text).toContain('\t\t확인 필요 시공통보서 접수')
  })

  it('AI가 준 글자 안의 탭·줄바꿈은 공백으로 바꾼다 (가지 구조가 깨지지 않게)', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 공사명: '평촌동70\t금성\n신설', 공사시행초안: ['포설\n시험'] } }))
    expect(r.text.split('\n')[0]).toBe('JY26-144. 평촌동70 금성 신설')
    expect(r.text).toContain('\t\t포설 시험')
  })
})
