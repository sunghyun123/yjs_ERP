import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, 공사단가Row } from '@/types/database'
import { partsKST } from '@/lib/kst'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { 투입실적With상세 } from './calc'

export type 투입원가재료 = {
  year: number
  투입실적: 투입실적With상세[]
  단가: 공사단가Row[]
}

export type 투입헤더 = {
  수주_id: number
  투입일: string
}

export type 미입력공사 = {
  id: number
  지중no: string
  공사명: string
  진행날짜: string
}

export async function load연간투입원가재료(
  supabase: SupabaseClient<Database>,
  now = new Date(),
): Promise<투입원가재료> {
  const year = partsKST(now).year
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const [투입실적, 단가결과] = await Promise.all([
    fetchAllRows('투입실적', (from, to) =>
      supabase
        .from('투입실적')
        .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
        .gte('투입일', yearStart)
        .lt('투입일', yearEnd)
        .order('id')
        .range(from, to),
    ),
    supabase.from('공사단가').select('*').order('적용시작일'),
  ])

  if (단가결과.error) {
    throw new Error(`공사단가 조회 실패: ${단가결과.error.message}`)
  }

  return {
    year,
    투입실적: 투입실적 as unknown as 투입실적With상세[],
    단가: (단가결과.data ?? []) as 공사단가Row[],
  }
}

export async function load투입헤더(
  supabase: SupabaseClient<Database>,
): Promise<투입헤더[]> {
  const rows = await fetchAllRows('투입실적 헤더', (from, to) =>
    supabase
      .from('투입실적')
      .select('수주_id, 투입일')
      .order('id')
      .range(from, to),
  )
  return rows as unknown as 투입헤더[]
}

export async function load미입력공사(
  supabase: SupabaseClient<Database>,
): Promise<미입력공사[]> {
  const rows = await fetchAllRows('미입력 공사', (from, to) =>
    supabase
      .from('dashboard_공사')
      .select('id, 지중no, 공사명, 진행날짜')
      .eq('삭제됨', false)
      .order('진행날짜')
      .order('id')
      .range(from, to),
  )
  return rows as unknown as 미입력공사[]
}
