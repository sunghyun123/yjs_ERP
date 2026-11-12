import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  시공담당지정, 시공담당되돌리기, 정산담당지정, 정산담당되돌리기, 일괄결과메시지,
  시공미지정공사목록, 정산미지정공사목록,
} from './일괄지정'
import type { 실적행, 정산행 } from './erp-실적'

type 호출 = { table?: string; update?: unknown; in?: [string, unknown]; is?: [string, unknown]; eq?: [string, unknown]; select?: string }

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: 호출 = {}
  let 요청수 = 0
  const chain = {
    update(p: unknown) { calls.update = p; return chain },
    in(c: string, v: unknown) { calls.in = [c, v]; return chain },
    is(c: string, v: unknown) { calls.is = [c, v]; return chain },
    eq(c: string, v: unknown) { calls.eq = [c, v]; return chain },
    select(s: string) { calls.select = s; return Promise.resolve(result) },
  }
  const client = { from(t: string) { 요청수++; calls.table = t; return chain } } as unknown as SupabaseClient<Database>
  return { client, calls, 요청수: () => 요청수 }
}

describe('시공담당지정', () => {
  it('요청한 수만큼 돌아오면 성공 — 담당 칸 하나만, 빈 칸에만 쓴다', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }, { id: 2 }], error: null })
    await expect(시공담당지정(client, [1, 2], 9)).resolves.toEqual({ ok: true, ids: [1, 2] })
    expect(calls).toEqual({
      table: '공사이력', update: { 담당공무_id: 9 }, in: ['id', [1, 2]], is: ['담당공무_id', null], select: 'id',
    })
  })
  it('중복 id는 한 번만 보낸다 — 안 그러면 기대 수가 부풀어 성공이 partial로 오진된다', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }, { id: 2 }], error: null })
    await expect(시공담당지정(client, [1, 2, 2], 9)).resolves.toEqual({ ok: true, ids: [1, 2] })
    expect(calls.in).toEqual(['id', [1, 2]])
  })
  it('일부만 돌아오면 partial — 나머지는 이미 커밋됐으므로 돌아온 id를 들고 간다(되돌리기용)', async () => {
    const { client } = fakeClient({ data: [{ id: 1 }], error: null })
    await expect(시공담당지정(client, [1, 2, 3], 9)).resolves.toEqual({ ok: false, reason: 'partial', ids: [1], 기대: 3 })
  })
  it('0행이면 not-updated — RLS에 막히면 에러가 아니라 200 + []로 온다', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(시공담당지정(client, [1, 2], 9)).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('data가 null이어도 not-updated', async () => {
    const { client } = fakeClient({ data: null, error: null })
    await expect(시공담당지정(client, [1], 9)).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('에러면 error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    await expect(시공담당지정(client, [1], 9)).resolves.toEqual({ ok: false, reason: 'error' })
  })
  it('빈 목록이면 요청 없이 성공 — 0행을 "권한 없음"으로 오진하지 않는다', async () => {
    const { client, 요청수 } = fakeClient({ data: [], error: null })
    await expect(시공담당지정(client, [], 9)).resolves.toEqual({ ok: true, ids: [] })
    expect(요청수()).toBe(0)
  })
})

describe('시공담당되돌리기', () => {
  it('방금 값인 행만 null로 — 그 사이 다른 사람으로 바뀐 행은 건드리지 않는다', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }, { id: 2 }], error: null })
    await expect(시공담당되돌리기(client, [1, 2], 9)).resolves.toEqual({ ok: true, ids: [1, 2] })
    expect(calls).toEqual({
      table: '공사이력', update: { 담당공무_id: null }, in: ['id', [1, 2]], eq: ['담당공무_id', 9], select: 'id',
    })
  })
})

describe('정산담당지정 / 되돌리기 — 수주 칸', () => {
  it('지정: 수주.정산담당자_id 빈 칸에만', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 30 }], error: null })
    await expect(정산담당지정(client, [30], 8)).resolves.toEqual({ ok: true, ids: [30] })
    expect(calls).toEqual({
      table: '수주', update: { 정산담당자_id: 8 }, in: ['id', [30]], is: ['정산담당자_id', null], select: 'id',
    })
  })
  it('되돌리기: 방금 값인 수주만 null로', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 30 }], error: null })
    await expect(정산담당되돌리기(client, [30], 8)).resolves.toEqual({ ok: true, ids: [30] })
    expect(calls).toEqual({
      table: '수주', update: { 정산담당자_id: null }, in: ['id', [30]], eq: ['정산담당자_id', 8], select: 'id',
    })
  })
})

describe('일괄결과메시지', () => {
  it('partial은 몇 중 몇인지 말한다', () => {
    expect(일괄결과메시지({ ok: false, reason: 'partial', ids: [1], 기대: 3 }))
      .toBe('3건 중 1건만 지정됐습니다. 나머지는 그 사이 다른 담당이 지정됐거나 권한이 없습니다. 목록을 새로 읽었습니다.')
  })
  it('not-updated / error', () => {
    expect(일괄결과메시지({ ok: false, reason: 'not-updated' })).toBe('지정되지 않았습니다 (권한이 없거나 이미 지정된 항목).')
    expect(일괄결과메시지({ ok: false, reason: 'error' })).toBe('저장에 실패했습니다.')
  })
  it('되돌리기는 되돌리기 문구로 — "지정됐습니다"라고 반대 사실을 말하지 않는다', () => {
    expect(일괄결과메시지({ ok: false, reason: 'partial', ids: [1], 기대: 3 }, '되돌리기'))
      .toBe('되돌리기: 3건 중 1건만 되돌렸습니다. 나머지는 그 사이 담당이 바뀌어 그대로 두었습니다. 목록을 새로 읽었습니다.')
    expect(일괄결과메시지({ ok: false, reason: 'not-updated' }, '되돌리기'))
      .toBe('되돌리기: 되돌린 항목이 없습니다 (그 사이 담당이 바뀌었거나 권한이 없음).')
    expect(일괄결과메시지({ ok: false, reason: 'error' }, '되돌리기')).toBe('되돌리기: 저장에 실패했습니다.')
  })
})

const 행 = (id: number, 수주_id: number, 작업일자: string, 천원: number): 실적행 => ({
  id, 수주_id, 작업일자, 성과금액: 천원 * 1000, 담당공무_id: null, 지중no: `J${수주_id}`, 공사명: `공사${수주_id}`,
  천원, 월요일: '2026-01-05',
})

describe('시공미지정공사목록', () => {
  it('그 달의 미지정 행을 주를 가리지 않고 공사별로 — 이력 id 전부, 날짜는 중복 없이', () => {
    const 목록 = 시공미지정공사목록([
      행(1, 10, '2026-01-02', 100), 행(2, 20, '2026-01-06', 50), 행(3, 10, '2026-01-20', 30), 행(4, 10, '2026-01-20', 5),
    ])
    expect(목록).toEqual([
      { 수주_id: 10, 지중no: 'J10', 공사명: '공사10', 천원: 135, 날짜들: ['2026-01-02', '2026-01-20'], ids: [1, 3, 4] },
      { 수주_id: 20, 지중no: 'J20', 공사명: '공사20', 천원: 50, 날짜들: ['2026-01-06'], ids: [2] },
    ])
  })
})

const 정 = (수주_id: number, 구분: string, 날짜: string, 금액천원: number): 정산행 => ({
  수주_id, 지중no: `J${수주_id}`, 공사명: `공사${수주_id}`, 구분, 일: Number(날짜.slice(8)), 날짜, 금액천원,
  담당공무_id: null, 담당: '', 월요일: '2026-01-05',
})

describe('정산미지정공사목록', () => {
  it('계산서를 공사별로 — ids는 수주 id 하나, 구분은 모아 적는다', () => {
    expect(정산미지정공사목록([정(30, '기성 1차', '2026-01-09', 200), 정(30, '준공', '2026-01-23', -20), 정(40, '기성', '2026-01-12', 70)]))
      .toEqual([
        { 수주_id: 30, 지중no: 'J30', 공사명: '공사30', 천원: 180, 날짜들: ['2026-01-09', '2026-01-23'], 구분들: ['기성 1차', '준공'], ids: [30] },
        { 수주_id: 40, 지중no: 'J40', 공사명: '공사40', 천원: 70, 날짜들: ['2026-01-12'], 구분들: ['기성'], ids: [40] },
      ])
  })
})
