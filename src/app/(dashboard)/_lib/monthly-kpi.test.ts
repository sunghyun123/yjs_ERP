import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { load투입원가재료 } from './monthly-kpi'

/**
 * 가짜 supabase — 투입실적은 전체 행 수(총행)를 갖고 .range(from, to)만큼 잘라 돌려준다(PostgREST 1000행 캡 흉내).
 * 체인에 붙은 호출을 기록해 정렬이 걸렸는지 본다.
 */
function 가짜(총행: number) {
  const 기록 = { order: [] as string[], range: [] as [number, number][] }
  const 행들 = Array.from({ length: 총행 }, (_, i) => ({ id: i + 1, 투입일: '2026-03-02', 투입실적상세: [] }))
  const supabase = {
    from(table: string) {
      if (table === '공사단가') {
        return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }
      }
      const q = {
        select: () => q,
        gte: () => q,
        lt: () => q,
        order: (col: string) => {
          기록.order.push(col)
          return q
        },
        range: (from: number, to: number) => {
          기록.range.push([from, to])
          return Promise.resolve({ data: 행들.slice(from, Math.min(to + 1, from + 1000)), error: null })
        },
      }
      return q
    },
  } as unknown as SupabaseClient<Database>
  return { supabase, 기록 }
}

const 기간 = { year: 2026, monthStart: '2026-01-01', monthEnd: '2026-11-30' }

describe('load투입원가재료 — 1000행 캡에서 조용히 잘리지 않는다 (연간 응답 ⑤a, 2026-11-12)', () => {
  it('1000행을 넘으면 다음 페이지까지 받아 전부 돌려준다', async () => {
    const { supabase, 기록 } = 가짜(1234)
    const r = await load투입원가재료(supabase, 기간)
    expect(r.투입실적).toHaveLength(1234)
    expect(기록.range).toEqual([[0, 999], [1000, 1999]])
  })

  it('페이지 경계에서 행이 중복·누락되지 않게 id 로 정렬한다', async () => {
    const { supabase, 기록 } = 가짜(10)
    await load투입원가재료(supabase, 기간)
    expect(기록.order).toEqual(['id'])
  })
})
