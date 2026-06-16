import { describe, it, expect } from 'vitest'
import { reconcileWhitelist, type WhitelistUser } from './whitelist-sync'

const u = (kakao_id: string, user_name: string, role = 'worker'): WhitelistUser => ({
  kakao_id,
  user_name,
  role,
})

describe('reconcileWhitelist', () => {
  it('JSON의 모든 사용자를 upsert 대상으로 포함한다', () => {
    const json = [u('1', '김단후'), u('2', '김도윤')]
    const plan = reconcileWhitelist(json, [])
    expect(plan.toUpsert).toEqual(json)
    expect(plan.toDelete).toEqual([])
  })

  it('JSON에 없고 DB에만 있는 kakao_id를 삭제 대상으로 잡는다(퇴사자)', () => {
    const json = [u('1', '김단후')]
    const plan = reconcileWhitelist(json, ['1', '999'])
    expect(plan.toUpsert).toEqual(json)
    expect(plan.toDelete).toEqual(['999'])
  })

  it('DB에 이미 있는 사용자도 upsert에 포함해 정보 변경을 반영한다', () => {
    const json = [u('1', '김단후 변경')]
    const plan = reconcileWhitelist(json, ['1'])
    expect(plan.toUpsert).toEqual([u('1', '김단후 변경')])
    expect(plan.toDelete).toEqual([])
  })

  it('빈 JSON이면 DB의 모든 행을 삭제 대상으로 잡는다', () => {
    const plan = reconcileWhitelist([], ['1', '2'])
    expect(plan.toUpsert).toEqual([])
    expect(plan.toDelete).toEqual(['1', '2'])
  })
})
