import { describe, expect, it } from 'vitest'
import { 추출WireSchema, 추출JSONSchema, toKorean, 읽지못함 } from './extract'

const 정상 = {
  project_no: '3917-2025-3862 (01)',
  project_name: '평촌동70 (주)금성 750kW 신설',
  notice_date: '2026-01-08',
  office_name: '경기본부 안양지사',
  contract_amount: 54232930,
  supply_amount: 49302664,
  vat_amount: 4930266,
  overview: '고압 신설 1식',
  period_start: '2026-01-12',
  period_end: '2026-02-28',
  work_draft: ['케이블 포설', '접속 및 시험'],
}

describe('추출WireSchema', () => {
  it('정상 응답을 받는다', () => {
    expect(추출WireSchema.safeParse(정상).success).toBe(true)
  })
  it('칸이 빠지면 거부한다', () => {
    const 빠짐: Record<string, unknown> = { ...정상 }
    delete 빠짐.supply_amount
    expect(추출WireSchema.safeParse(빠짐).success).toBe(false)
  })
  it('null 칸을 받는다', () => {
    expect(추출WireSchema.safeParse({ ...정상, overview: null, supply_amount: null }).success).toBe(true)
  })
})

describe('work_draft 길이', () => {
  it('9줄도 응답은 받고 toKorean이 8줄로 자른다', () => {
    const w = 추출WireSchema.parse({ ...정상, work_draft: Array.from({ length: 9 }, (_, i) => `작업${i}`) })
    expect(toKorean(w).공사시행초안).toHaveLength(8)
  })
})

describe('추출JSONSchema', () => {
  it('strict 조건: 모든 칸 required, additionalProperties false', () => {
    expect([...추출JSONSchema.required].sort()).toEqual(Object.keys(추출JSONSchema.properties).sort())
    expect(추출JSONSchema.additionalProperties).toBe(false)
  })
  it('zod 스키마와 칸 이름이 같다 (두 벌이 갈라지지 않게)', () => {
    expect(Object.keys(추출JSONSchema.properties).sort()).toEqual(Object.keys(추출WireSchema.shape).sort())
  })
})

describe('toKorean', () => {
  it('영문 키를 한글 타입으로 옮긴다', () => {
    const k = toKorean(추출WireSchema.parse(정상))
    expect(k.공사번호).toBe('3917-2025-3862 (01)')
    expect(k.공급가액).toBe(49302664)
    expect(k.공사시행초안).toEqual(['케이블 포설', '접속 및 시험'])
  })
})

describe('읽지못함', () => {
  it('핵심 칸이 전부 비면 true', () => {
    const 빈 = toKorean(추출WireSchema.parse({
      ...정상, project_no: null, project_name: '', notice_date: null,
      contract_amount: null, supply_amount: null,
    }))
    expect(읽지못함(빈)).toBe(true)
  })
  it('하나라도 있으면 false (부분 판독은 카드에 확인 필요로 드러낸다)', () => {
    expect(읽지못함(toKorean(추출WireSchema.parse({ ...정상, project_name: null })))).toBe(false)
  })
})
