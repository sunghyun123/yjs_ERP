import { describe, it, expect } from 'vitest'
import type { PivotProjectRow } from '@/app/(dashboard)/sales/_components/PivotProjectTable'
import type { 공사별손익결과 } from '@/app/(dashboard)/_lib/공사별손익'
import {
  build공사목록응답,
  build손익응답,
  mcp인증,
  parse월,
  parse연도,
  parse준공연도,
  type 공사목록행,
} from './응답'

const 지금 = { year: 2026, month: 10 }

describe('mcp인증', () => {
  it('서버에 키가 없으면 500, 틀리면 401, 맞으면 통과(null)', () => {
    expect(mcp인증('Bearer k', undefined)).toEqual({ status: 500, error: 'Server misconfiguration' })
    expect(mcp인증('Bearer k', '')).toEqual({ status: 500, error: 'Server misconfiguration' })
    expect(mcp인증(null, 'k')).toEqual({ status: 401, error: 'Unauthorized' })
    expect(mcp인증('Bearer x', 'k')).toEqual({ status: 401, error: 'Unauthorized' })
    expect(mcp인증('Bearer k', 'k')).toBeNull()
  })
})

describe('입력 해석', () => {
  it('year: 없으면 올해, current, 4자리 숫자만 받고 범위 밖은 거절', () => {
    expect(parse연도(null, 지금)).toEqual({ ok: true, value: 2026 })
    expect(parse연도('current', 지금)).toEqual({ ok: true, value: 2026 })
    expect(parse연도('2025', 지금)).toEqual({ ok: true, value: 2025 })
    for (const bad of ['1999', '2101', '20x5', '2025.5', '25']) {
      expect(parse연도(bad, 지금).ok).toBe(false)
    }
    // 빈 문자열은 '파라미터 없음'이 아니다 — 기본값으로 바꾸지 않고 거절
    expect(parse연도('', 지금).ok).toBe(false)
  })

  it('month: 없으면 null(연간), current는 서버 기준 이번 달, 1~12만', () => {
    expect(parse월(null, 지금)).toEqual({ ok: true, value: null })
    expect(parse월('current', 지금)).toEqual({ ok: true, value: 10 })
    expect(parse월('3', 지금)).toEqual({ ok: true, value: 3 })
    for (const bad of ['0', '13', 'abc', '3.5', '-1']) {
      expect(parse월(bad, 지금).ok).toBe(false)
    }
    expect(parse월('', 지금).ok).toBe(false)
  })

  it('completed_year: 없으면 null(필터 없음)', () => {
    expect(parse준공연도(null, 지금)).toEqual({ ok: true, value: null })
    expect(parse준공연도('current', 지금)).toEqual({ ok: true, value: 2026 })
    expect(parse준공연도('1999', 지금).ok).toBe(false)
    expect(parse준공연도('', 지금).ok).toBe(false)
  })
})

// 공사별손익결과 픽스처 — 달값: { 월(1-based): [성과, 투입] }
function 행(
  id: number,
  지중no: string,
  달값: Record<number, [number, number]>,
  준공?: { 월: number; 금액: number },
): PivotProjectRow {
  const monthly = Array.from({ length: 12 }, () => ({ 성과: 0, 투입: 0, 손익: 0 }))
  for (const [월, [성과, 투입]] of Object.entries(달값)) {
    monthly[Number(월) - 1] = { 성과, 투입, 손익: 성과 - 투입 }
  }
  const 성과금액 = monthly.reduce((s, m) => s + m.성과, 0)
  const 투입금액 = monthly.reduce((s, m) => s + m.투입, 0)
  return { id, 지중no, 공사명: `공사${id}`, 성과금액, 투입금액, 손익금액: 성과금액 - 투입금액, monthly, 준공 }
}

function 결과(rows: PivotProjectRow[]): 공사별손익결과 {
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    성과: rows.reduce((s, r) => s + r.monthly[i].성과, 0),
    투입: rows.reduce((s, r) => s + r.monthly[i].투입, 0),
  }))
  return { pivotData: rows, monthly, 준공잔여목록: [], 총준공반영액: 0 }
}

const A = 행(1, 'A', { 10: [100, 300] })
const B = 행(2, 'B', { 10: [500, 100] }, { 월: 9, 금액: 200 }) // 준공 10월(인덱스 9)
const C = 행(3, 'C', { 3: [50, 0] })

describe('build손익응답', () => {
  it('월 지정: 그 달 값만, 손익 큰 순, 0/0 공사는 제외하고 건수를 남긴다', () => {
    const r = build손익응답(결과([A, B, C]), 2026, 10)
    expect(r.기준).toEqual({ 연도: 2026, 월: 10 })
    expect(r.단위).toBe('원')
    expect(r.공사).toEqual([
      { 지중no: 'B', 공사명: '공사2', 성과: 500, 투입: 100, 손익: 400, 준공반영액: 200 },
      { 지중no: 'A', 공사명: '공사1', 성과: 100, 투입: 300, 손익: -200 },
    ])
    expect(r.제외).toEqual({ '성과·투입 모두 0인 공사': 1 })
    expect(r.합계).toEqual({ 성과: 600, 투입: 400, 손익: 200 })
    expect(r.건수).toEqual({ 플러스: 1, 마이너스: 1, 영: 0 })
  })

  it('준공반영액은 준공이 얹힌 달에만 붙는다', () => {
    const r = build손익응답(결과([A, B, C]), 2026, 3)
    expect(r.공사.map((p) => p.지중no)).toEqual(['C'])
    expect(r.공사[0]).not.toHaveProperty('준공반영액')
    expect(r.제외['성과·투입 모두 0인 공사']).toBe(2)
    expect(r.건수).toEqual({ 플러스: 1, 마이너스: 0, 영: 0 })
  })

  it('연간: 월을 안 주면 연간 합, 기준.월은 null', () => {
    const r = build손익응답(결과([A, B, C]), 2026, null)
    expect(r.기준).toEqual({ 연도: 2026, 월: null })
    expect(r.공사.map((p) => [p.지중no, p.손익])).toEqual([['B', 400], ['C', 50], ['A', -200]])
    expect(r.공사[0].준공반영액).toBe(200)
    expect(r.합계).toEqual({ 성과: 650, 투입: 400, 손익: 250 })
    expect(r.제외['성과·투입 모두 0인 공사']).toBe(0)
    expect(r.건수).toEqual({ 플러스: 2, 마이너스: 1, 영: 0 })
  })

  it('성과와 투입이 같은 공사(손익 0)는 영으로 센다', () => {
    const r = build손익응답(결과([행(5, 'E', { 1: [50, 50] })]), 2026, 1)
    expect(r.건수).toEqual({ 플러스: 0, 마이너스: 0, 영: 1 })
  })

  it('합계는 행이 아니라 월별 합계에서 낸다 (화면 KPI와 같은 원천)', () => {
    const base = 결과([A])
    // 행 목록에 없는 금액이 월별 합계에 있다고 가정 — 합계는 그 숫자를 따라야 한다
    base.monthly[9] = { 성과: 999, 투입: 1 }
    expect(build손익응답(base, 2026, 10).합계).toEqual({ 성과: 999, 투입: 1, 손익: 998 })
  })

  it('금액은 원 단위 정수로 반올림', () => {
    const r = build손익응답(결과([행(4, 'D', { 1: [100.4, 0.6] })]), 2026, 1)
    expect(r.공사[0]).toMatchObject({ 성과: 100, 투입: 1, 손익: 99 })
  })
})

describe('build공사목록응답', () => {
  const rows: 공사목록행[] = [
    { 지중no: 'A', 공사명: 'a', 준공여부: true, 준공일: '2026-03-01' },
    { 지중no: 'B', 공사명: 'b', 준공여부: true, 준공일: '2025-12-31' },
    { 지중no: 'C', 공사명: 'c', 준공여부: false, 준공일: '2026-05-01' },
    { 지중no: 'D', 공사명: 'd', 준공여부: true, 준공일: null },
  ]

  it('필터 없으면 전체와 건수', () => {
    expect(build공사목록응답(rows, null)).toEqual({ 기준: {}, 건수: 4, 공사: rows })
  })

  it('준공연도: 준공여부 true이고 준공일이 그 해인 것만', () => {
    const r = build공사목록응답(rows, 2026)
    expect(r.기준).toEqual({ 준공연도: 2026 })
    expect(r.건수).toBe(1)
    expect(r.공사.map((p) => p.지중no)).toEqual(['A'])
    expect(r.제외).toEqual({ '준공됐지만 준공일 없음': 1 })
  })

  it('그 해 준공이 0건이면 정상(건수 0)', () => {
    expect(build공사목록응답(rows, 2030)).toEqual({
      기준: { 준공연도: 2030 }, 건수: 0,
      공사: [],
      제외: { '준공됐지만 준공일 없음': 1 },
    })
  })

  it('수주 전체가 0건이면 조회가 깨진 것 — 에러', () => {
    expect(() => build공사목록응답([], null)).toThrow(/수주 목록이 비어/)
    expect(() => build공사목록응답([], 2026)).toThrow(/수주 목록이 비어/)
  })
})
