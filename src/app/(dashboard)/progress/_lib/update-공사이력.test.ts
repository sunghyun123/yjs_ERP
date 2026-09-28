// src/app/(dashboard)/progress/_lib/update-공사이력.test.ts
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { delete공사이력, update공사이력, 저장실패메시지 } from './update-공사이력'

type 호출기록 = { table?: string; update?: unknown; delete?: boolean; eq?: [string, unknown]; select?: string }

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: 호출기록 = {}
  const chain = {
    update(p: unknown) { calls.update = p; return chain },
    delete() { calls.delete = true; return chain },
    eq(c: string, v: unknown) { calls.eq = [c, v]; return chain },
    select(s: string) { calls.select = s; return Promise.resolve(result) },
  }
  const client = { from(t: string) { calls.table = t; return chain } } as unknown as SupabaseClient<Database>
  return { client, calls }
}

describe('update공사이력', () => {
  it('1행이 돌아오면 성공, 넘긴 칸만 보낸다(부분 업데이트)', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 5 }], error: null })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: true })
    expect(calls).toEqual({ table: '공사이력', update: { 담당공무_id: 7 }, eq: ['id', 5], select: 'id' })
  })
  it('0행이면 not-updated — RLS에 막히거나 이미 삭제된 행은 에러 없이 0행으로 온다', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('data가 null이어도 not-updated', async () => {
    const { client } = fakeClient({ data: null, error: null })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('에러면 error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: false, reason: 'error' })
  })
})

describe('delete공사이력', () => {
  it('1행이면 성공', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 5 }], error: null })
    await expect(delete공사이력(client, 5)).resolves.toEqual({ ok: true })
    expect(calls).toEqual({ table: '공사이력', delete: true, eq: ['id', 5], select: 'id' })
  })
  it('0행이면 not-updated', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(delete공사이력(client, 5)).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
})

describe('저장실패메시지', () => {
  it('사유별 문구', () => {
    expect(저장실패메시지('error')).toBe('저장에 실패했습니다.')
    expect(저장실패메시지('not-updated')).toBe('저장되지 않았습니다 (권한이 없거나 이미 삭제된 이력).')
  })
})
