import { describe, it, expect } from 'vitest'
import { formatWon, formatSummary, prepareEntry } from './format'
import type { AuditLogRow, LookupMaps } from './types'

function lookups(): LookupMaps {
  return {
    거래처: new Map([[10, '○○건설'], [11, '△△전력']]),
    공무담당자: new Map([[5, '홍길동']]),
    수주: new Map([[100, '○○현장 신설']]),
  }
}

function row(p: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: 1, table_name: '수주', operation: 'INSERT',
    row_id: 1, old_data: null, new_data: null, changed_at: '2026-06-24T00:00:00Z',
    ...p,
  }
}

describe('formatWon', () => {
  it('정수 원을 천단위 콤마로', () => {
    expect(formatWon(1200000)).toBe('1,200,000원')
  })
  it('null 은 대시', () => {
    expect(formatWon(null)).toBe('-')
  })
})

describe('formatSummary', () => {
  it('수주등록: 공사명·발주자(이름)·금액', () => {
    const s = formatSummary(row({
      table_name: '수주', operation: 'INSERT',
      new_data: { 공사명: '○○현장 신설', 발주자_id: 10, 수주금액_공급가: 1200000, 준공여부: false },
    }), lookups())
    expect(s).toContain('○○현장 신설')
    expect(s).toContain('○○건설')
    expect(s).toContain('1,200,000원')
  })

  it('FK 이름 해석 실패 시 id:N 로 폴백', () => {
    const s = formatSummary(row({
      table_name: '수주', operation: 'INSERT',
      new_data: { 공사명: 'X', 발주자_id: 999, 수주금액_공급가: null, 준공여부: false },
    }), lookups())
    expect(s).toContain('id:999')
  })

  it('기성: 수주명(수주_id 해석)·차수·기성액', () => {
    const s = formatSummary(row({
      table_name: '기성', operation: 'INSERT',
      new_data: { 수주_id: 100, 차수: 2, 기성액_공급가: 500000, 기성일: '2026-06-20' },
    }), lookups())
    expect(s).toContain('○○현장 신설')
    expect(s).toContain('2차')
    expect(s).toContain('500,000원')
  })

  it('DELETE 는 old_data 기준으로 요약', () => {
    const s = formatSummary(row({
      table_name: '거래처', operation: 'DELETE',
      old_data: { 거래처명: '폐업건설', 거래처코드: 'C001' },
    }), lookups())
    expect(s).toContain('폐업건설')
  })
})

describe('prepareEntry', () => {
  it('category 와 summary 를 합쳐 PreparedEntry 생성', () => {
    const e = prepareEntry(row({
      id: 7, table_name: '수주', operation: 'INSERT',
      new_data: { 공사명: 'Y현장', 발주자_id: 10, 수주금액_공급가: 100, 준공여부: false },
    }), lookups())
    expect(e.id).toBe(7)
    expect(e.category.label).toBe('수주등록')
    expect(e.summary).toContain('Y현장')
  })
})
