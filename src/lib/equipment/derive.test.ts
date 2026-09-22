import { describe, expect, it } from 'vitest'
import { clampBlock, containedIds, renewalLabel, searchEquipment, sortByRenewal, summarize } from './derive'
import type { Asset, Block, EquipmentData, Stock } from './types'

const a = (values: Partial<Asset> = {}) => ({ id: 'a', category: '데스크탑', name: '업무 PC', asset_no: 'YJ-PC-001', block_id: null, identity_status: '확정', deleted_at: null, ...values } as Asset)
const s = (quantity: number | null) => ({ category: '모니터', quantity, deleted_at: null } as Stock)
describe('equipment counts preserve uncertainty', () => {
  it('distinguishes confirmed zero from unknown and partial counts', () => {
    expect(summarize([], [s(0)])[0].label).toBe('0개')
    expect(summarize([], [s(null)])[0].label).toBe('미확인')
    expect(summarize([], [s(4), s(null)])[0].label).toBe('확인된 4개 · 미확인 있음')
  })
  it('excludes deleted and unresolved duplicate assets from confirmed totals', () => {
    expect(summarize([a(), a({ deleted_at: '2026-09-22' }), a({ identity_status: '중복미확정' })], [])[0].known).toBe(1)
  })
  it('includes known presence with unknown quantity without creating a fake asset', () => {
    expect(summarize([a()], [], ['데스크탑'])[0].label).toBe('확인된 1개 · 미확인 있음')
  })
  it('finds unplaced assets by number without pretending a floor exists', () => {
    const data = { assets: [a()], stocks: [], blocks: [], people: [] } as unknown as EquipmentData
    expect(searchEquipment(data, 'YJ-PC')[0]).toMatchObject({ block_id: null, floor_id: null })
  })
})
describe('layout and renewal dates', () => {
  it('orders expired and upcoming renewals before undated services without mutating input', () => {
    const services = [
      {id:'internet',renewal_date:null},
      {id:'later',renewal_date:'2026-12-01'},
      {id:'ai',renewal_date:'2026-09-23'},
      {id:'expired',renewal_date:'2026-09-01'},
      {id:'hosting',renewal_date:null},
    ]
    expect(sortByRenewal(services).map(s=>s.id)).toEqual(['expired','ai','later','internet','hosting'])
    expect(services[0].id).toBe('internet')
  })
  it('handles region nesting and even malformed cycles without looping', () => {
    const blocks = [{id:'a',parent_id:'b'},{id:'b',parent_id:'a'},{id:'c',parent_id:'b'}] as Block[]
    expect([...containedIds(blocks[0], blocks)]).toEqual(['a','b','c'])
  })
  it('snaps while keeping resized blocks within the canvas', () => {
    expect(clampBlock({x:999,y:-5,width:140,height:80} as Block,1000,650)).toMatchObject({x:860,y:0,width:140,height:80})
  })
  it('uses the Korean date at the UTC day boundary', () => {
    const now = new Date('2026-09-21T15:00:00Z')
    expect(renewalLabel('2026-09-22',now)).toBe('오늘 갱신')
    expect(renewalLabel('2026-09-21',now)).toBe('1일 경과 · 만료')
    expect(renewalLabel(null,now)).toBe('날짜 미등록')
  })
})
