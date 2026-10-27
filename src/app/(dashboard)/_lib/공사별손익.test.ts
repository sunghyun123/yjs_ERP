import { describe, it, expect } from 'vitest'
import { aggregate공사별손익, type 공사별손익재료 } from './공사별손익'
import type { 투입실적With상세 } from './calc'
import type { 준공수주Row } from './junggong-seonggwa'

const 수주 = (over: Partial<준공수주Row> & { id: number }): 준공수주Row => ({
  지중no: `JG26-${String(over.id).padStart(3, '0')}`,
  공사명: `공사${over.id}`,
  공사구분: '지중',
  준공여부: false,
  준공일: null,
  준공액_공급가: null,
  수주금액_공급가: 10_000,
  보험료율: null,
  하도전용율: null,
  ...over,
})

// 단가목록을 비워 두면 사내 금액이 0이라 합계 = 외주1(사외) 그대로 — 공식 자체는 calc.test가 맡는다
const 투입 = (수주_id: number, 투입일: string, 외주1: number) =>
  ({ 수주_id, 투입일, 외주1, 외주2: 0, 기타재료비: 0, 투입실적상세: [] }) as unknown as 투입실적With상세

const 재료 = (over: Partial<공사별손익재료>): 공사별손익재료 => ({
  투입실적: [],
  단가목록: [],
  공사이력전체: [],
  수주: [],
  ...over,
})

describe('aggregate공사별손익', () => {
  it('공사별·월별로 성과와 투입을 나눠 담고 손익 = 성과 − 투입', () => {
    const r = aggregate공사별손익(
      재료({
        수주: [수주({ id: 1 })],
        공사이력전체: [{ 작업일자: '2026-03-10', 수주_id: 1, 성과금액: 1000 }],
        투입실적: [투입(1, '2026-03-20', 400)],
      }),
      2026,
    )
    expect(r.pivotData).toHaveLength(1)
    const row = r.pivotData[0]
    expect([row.성과금액, row.투입금액, row.손익금액]).toEqual([1000, 400, 600])
    expect(row.monthly[2]).toEqual({ 성과: 1000, 투입: 400, 손익: 600 })
    expect(r.monthly[2]).toEqual({ 성과: 1000, 투입: 400 })
  })

  it('다른 해 공사이력은 월별 집계에서 빠지지만 준공 잔여 차감에는 들어간다', () => {
    const r = aggregate공사별손익(
      재료({
        수주: [수주({ id: 2, 준공여부: true, 준공일: '2026-05-15', 준공액_공급가: 10_000 })],
        공사이력전체: [
          { 작업일자: '2025-12-01', 수주_id: 2, 성과금액: 3000 },
          { 작업일자: '2026-02-01', 수주_id: 2, 성과금액: 2000 },
        ],
      }),
      2026,
    )
    const row = r.pivotData[0]
    // 잔여 = 10,000 − (3,000 + 2,000) = 5,000 을 5월(인덱스 4)에 얹는다
    expect(row.성과금액).toBe(7000)
    expect(row.monthly[1].성과).toBe(2000)
    expect(row.monthly[4].성과).toBe(5000)
    expect(row.준공).toEqual({ 월: 4, 금액: 5000 })
    expect(r.총준공반영액).toBe(5000)
    expect(r.monthly[11].성과).toBe(0) // 2025-12 성과는 2026 월별에 안 들어감
  })

  it('이력·투입이 없어도 준공 잔여가 있으면 행으로 나타난다', () => {
    const r = aggregate공사별손익(
      재료({ 수주: [수주({ id: 3, 준공여부: true, 준공일: '2026-07-01', 준공액_공급가: 500 })] }),
      2026,
    )
    expect(r.pivotData.map((p) => [p.id, p.성과금액])).toEqual([[3, 500]])
  })

  it('행은 지중no 순으로 정렬한다', () => {
    const r = aggregate공사별손익(
      재료({
        수주: [수주({ id: 9, 지중no: 'B' }), 수주({ id: 8, 지중no: 'A' })],
        공사이력전체: [
          { 작업일자: '2026-01-01', 수주_id: 9, 성과금액: 1 },
          { 작업일자: '2026-01-01', 수주_id: 8, 성과금액: 1 },
        ],
      }),
      2026,
    )
    expect(r.pivotData.map((p) => p.지중no)).toEqual(['A', 'B'])
  })
})
