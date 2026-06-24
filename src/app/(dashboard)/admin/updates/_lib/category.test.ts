import { describe, it, expect } from 'vitest'
import { deriveCategory } from './category'
import type { AuditLogRow } from './types'

function row(p: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: 1, table_name: '수주', operation: 'INSERT',
    row_id: 1, old_data: null, new_data: null, changed_at: '2026-06-24T00:00:00Z',
    ...p,
  }
}

describe('deriveCategory', () => {
  it('수주 INSERT → 수주등록', () => {
    expect(deriveCategory(row({ table_name: '수주', operation: 'INSERT' })))
      .toEqual({ group: '수주', label: '수주등록' })
  })

  it('수주 UPDATE 준공여부 false→true → 준공완료', () => {
    const c = deriveCategory(row({
      table_name: '수주', operation: 'UPDATE',
      old_data: { 준공여부: false }, new_data: { 준공여부: true },
    }))
    expect(c).toEqual({ group: '준공완료', label: '준공완료' })
  })

  it('수주 UPDATE 준공여부 변화 없음 → 수주수정', () => {
    const c = deriveCategory(row({
      table_name: '수주', operation: 'UPDATE',
      old_data: { 준공여부: false }, new_data: { 준공여부: false },
    }))
    expect(c).toEqual({ group: '수주', label: '수주수정' })
  })

  it('수주 DELETE → 수주삭제', () => {
    expect(deriveCategory(row({ table_name: '수주', operation: 'DELETE' })))
      .toEqual({ group: '수주', label: '수주삭제' })
  })

  it('기성 INSERT → 기성등록', () => {
    expect(deriveCategory(row({ table_name: '기성', operation: 'INSERT' })))
      .toEqual({ group: '기성', label: '기성등록' })
  })

  it('공사이력 UPDATE → 공사이력 수정', () => {
    expect(deriveCategory(row({ table_name: '공사이력', operation: 'UPDATE' })))
      .toEqual({ group: '공사이력', label: '공사이력 수정' })
  })

  it('투입실적상세도 투입실적 그룹으로 묶인다', () => {
    expect(deriveCategory(row({ table_name: '투입실적상세', operation: 'INSERT' })))
      .toEqual({ group: '투입실적', label: '투입실적 등록' })
  })

  it('거래처 UPDATE → 마스터 그룹', () => {
    expect(deriveCategory(row({ table_name: '거래처', operation: 'UPDATE' })))
      .toEqual({ group: '마스터', label: '마스터: 거래처 수정' })
  })
})
