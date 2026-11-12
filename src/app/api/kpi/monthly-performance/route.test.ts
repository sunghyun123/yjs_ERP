// src/app/api/kpi/monthly-performance/route.test.ts
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 은 파일 맨 위로 끌어올려지므로 가짜 함수도 vi.hoisted 로 같이 끌어올린다
const m = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({ 가짜: 'supabase' })),
  getMonthlyKpiData: vi.fn(),
  load투입원가재료: vi.fn(),
  load성과재료: vi.fn(),
  getMonthlySplit: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: m.createAdminClient }))
// 나머지 export(getMonthlyPeriod 등 순수 함수)는 진짜를 쓴다 — 바꾸는 건 DB를 읽는 함수뿐
vi.mock('@/app/(dashboard)/_lib/monthly-kpi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/monthly-kpi')>()),
  getMonthlyKpiData: m.getMonthlyKpiData,
  load투입원가재료: m.load투입원가재료,
}))
vi.mock('@/app/(dashboard)/_lib/junggong-seonggwa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/junggong-seonggwa')>()),
  load성과재료: m.load성과재료,
}))
vi.mock('@/app/(dashboard)/_lib/monthly-split', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/monthly-split')>()),
  getMonthlySplit: m.getMonthlySplit,
}))

import { GET } from './route'

const KEY = 'test-key'
const 요청 = (query = '', auth: string | null = `Bearer ${KEY}`) =>
  new NextRequest(`http://localhost/api/kpi/monthly-performance${query}`, {
    headers: auth === null ? {} : { authorization: auth },
  })

// 기존 응답(MonthlyKpiData)의 칸 이름 전부 — 값은 가짜, 모양만 본다
const 가짜KPI = {
  year: 2026,
  month: 11,
  label: '11월',
  period: { monthStart: '2026-11-01', monthEnd: '2026-12-01', prevMonthStart: '2026-10-01', comparisonDay: 10, prevMonthDays: 31 },
  amounts: { monthlyRevenue: 1, prevMonthRevenue: 2, prevMonthComparableRevenue: 3, revenueDelta: 4, monthlyInput: 5, monthlyProfit: 6 },
  formatted: { monthlyRevenue: 'a', revenueDelta: 'b', monthlyInput: 'c', monthlyProfit: 'd' },
  breakdown: { rows: [], totalThousand: 0 },
  updatedAt: '2026-11-10T03:00:00.000Z',
}
const 가짜split = (월: string, from: string, to: string) => ({
  month: 월,
  from,
  to,
  construction: { rows: [], totalThousand: 494834 },
  settlement: { rows: [], totalThousand: 0 },
})

/** KST 시각을 서버 시계(UTC)로 고정한다. Date 만 가짜로 — 타이머까지 멈추면 await 가 안 풀린다 */
function 지금은(utcIso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(utcIso))
}

beforeEach(() => {
  vi.stubEnv('DASHBOARD_API_KEY', KEY)
  m.createAdminClient.mockClear()
  m.getMonthlyKpiData.mockReset().mockResolvedValue(가짜KPI)
  m.load투입원가재료.mockReset().mockResolvedValue({ year: 2026, 투입실적: [], 단가: [] })
  m.load성과재료.mockReset().mockResolvedValue({ 공사이력: [], 수주: [] })
  m.getMonthlySplit
    .mockReset()
    .mockImplementation(async (_s: unknown, 기간: { 월: string; from: string; to: string }) =>
      가짜split(기간.월, 기간.from, 기간.to),
    )
  지금은('2026-11-10T03:00:00Z') // KST 11/10(화) 12:00 — 금주 달 11월
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('month 없음 — 대시보드 하위호환 (지금과 같은 모양)', () => {
  it('응답 = 기존 KPI 칸 전부 + split, 칸이 하나도 빠지거나 늘지 않는다', async () => {
    const res = await GET(요청())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ...가짜KPI, split: 가짜split('2026-11', '2026-11-02', '2026-11-30') })
    expect(Object.keys(body).sort()).toEqual([...Object.keys(가짜KPI), 'split'].sort())
  })

  it('split 은 금주 소속월 기간, 투입재료도 그 기간으로 따로 읽는다', async () => {
    await GET(요청())
    expect(m.getMonthlySplit).toHaveBeenCalledTimes(1)
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-11', from: '2026-11-02', to: '2026-11-30' })
    expect(m.load투입원가재료).toHaveBeenCalledWith(expect.anything(), {
      year: 2026,
      monthStart: '2026-11-02',
      monthEnd: '2026-11-30',
    })
  })

  it('split 만 실패하면 지금처럼 split: null + 200 (기존 칸은 살린다)', async () => {
    m.getMonthlySplit.mockRejectedValue(new Error('기성 조회 실패'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(요청())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...가짜KPI, split: null })
  })
})

describe('month 있음 — { month, split } 만', () => {
  it('?month=2026-10 → 10월 금요일 기준 기간(9/28~11/1), 달력 월 KPI 는 계산하지 않는다', async () => {
    const res = await GET(요청('?month=2026-10'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      month: '2026-10',
      split: 가짜split('2026-10', '2026-09-28', '2026-11-02'),
    })
    expect(m.getMonthlyKpiData).not.toHaveBeenCalled()
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-10', from: '2026-09-28', to: '2026-11-02' })
    expect(m.load투입원가재료).toHaveBeenCalledTimes(1)
    expect(m.load투입원가재료).toHaveBeenCalledWith(expect.anything(), {
      year: 2026,
      monthStart: '2026-09-28',
      monthEnd: '2026-11-02',
    })
  })

  it('금주 달을 month 로 주면 split 은 month 없는 응답의 split 과 같다', async () => {
    const 없음 = await (await GET(요청())).json()
    const 있음 = await (await GET(요청('?month=2026-11'))).json()
    expect(있음.split).toEqual(없음.split)
  })

  it('KST 경계: 2026-11-30(월) 00:30 KST(= UTC 11/29 15:30)에 ?month=2026-12 는 200', async () => {
    지금은('2026-11-29T15:30:00Z')
    const res = await GET(요청('?month=2026-12'))
    expect(res.status).toBe(200)
    expect((await res.json()).split).toEqual(가짜split('2026-12', '2026-11-30', '2027-01-01'))
  })

  it('최소월 2026-01 → 200, 기간은 1/1 ~ 2/2 미포함 (2025-12-29~31 이관행이 빠진다)', async () => {
    const res = await GET(요청('?month=2026-01'))
    expect(res.status).toBe(200)
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-01', from: '2026-01-01', to: '2026-02-02' })
  })

  it('연 경계: 2027-01-01 03:00 KST(= UTC 12/31 18:00)에 ?month=2027-01 은 200, 기간은 1/1부터', async () => {
    지금은('2026-12-31T18:00:00Z')
    const res = await GET(요청('?month=2027-01'))
    expect(res.status).toBe(200)
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2027-01', from: '2027-01-01', to: '2027-02-01' })
  })

  it('split 실패는 null 로 감싸지 않고 500', async () => {
    m.getMonthlySplit.mockRejectedValue(new Error('기성 조회 실패'))
    const res = await GET(요청('?month=2026-10'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '기성 조회 실패' })
  })
})

describe('400 — 요청한 쪽이 고칠 것, DB 는 읽지 않는다', () => {
  it.each([
    ['형식 오류', '?month=2026-9'],
    ['없는 달', '?month=2026-13'],
    ['날짜까지', '?month=2026-10-01'],
    ['빈 값', '?month='],
    ['최소월 앞', '?month=2025-12'],
    ['금주 달 뒤', '?month=2026-12'],
  ])('%s (%s) → 400', async (_이름, query) => {
    const res = await GET(요청(query))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toEqual(expect.any(String))
    expect(m.createAdminClient).not.toHaveBeenCalled()
    expect(m.getMonthlySplit).not.toHaveBeenCalled()
  })
})

describe('인증이 month 검사보다 먼저', () => {
  it('키가 틀리면 month 가 잘못돼도 401', async () => {
    const res = await GET(요청('?month=2026-13', 'Bearer wrong'))
    expect(res.status).toBe(401)
  })
  it('서버 키가 없으면 500', async () => {
    vi.stubEnv('DASHBOARD_API_KEY', '')
    const res = await GET(요청('?month=2026-10'))
    expect(res.status).toBe(500)
  })
})
