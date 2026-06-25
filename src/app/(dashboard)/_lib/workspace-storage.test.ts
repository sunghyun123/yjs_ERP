import { describe, it, expect } from 'vitest'
import { deserializeWorkspace, serializeWorkspace } from './workspace-storage'

describe('workspace-storage', () => {
  it('null 입력이면 빈 객체', () => {
    expect(deserializeWorkspace(null)).toEqual({})
  })
  it('깨진 JSON이면 빈 객체 (throw 안 함)', () => {
    expect(deserializeWorkspace('{not json')).toEqual({})
  })
  it('객체가 아닌 JSON이면 빈 객체', () => {
    expect(deserializeWorkspace('42')).toEqual({})
  })
  it('직렬화→역직렬화 라운드트립', () => {
    const state = { inputForm: { 검색어: '지중-1', 투입일: '2026-06-25' } }
    expect(deserializeWorkspace(serializeWorkspace(state))).toEqual(state)
  })
})
