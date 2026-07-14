// src/app/(dashboard)/materials/page.tsx
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from './_lib/fetch-all'
import { derive드럼, derive품목, buildFeed } from './_lib/derive'
import { MaterialsView } from './_components/MaterialsView'
import type { 자재_드럼Row, 자재_드럼기록Row, 자재_선종Row, 자재_품목Row, 자재_품목기록Row } from '@/types/database'

export const metadata = { title: '자재관리 | 영전사 ERP' }

export default async function MaterialsPage() {
  const supabase = await createClient()

  const [선종res, 품목res, 수주res] = await Promise.all([
    supabase.from('자재_선종').select('*').order('전압').order('정렬'),
    supabase.from('자재_품목').select('*').order('분류').order('정렬'),
    // 공사명 콤보 옵션: 최근 수주부터 (자유 입력도 허용되므로 완전할 필요 없음)
    supabase.from('수주').select('공사명').order('id', { ascending: false }).limit(300),
  ])
  const [드럼raw, 드럼기록raw, 품목기록raw] = await Promise.all([
    fetchAll<자재_드럼Row>((f, t) => supabase.from('자재_드럼').select('*').order('id').range(f, t) as never),
    fetchAll<자재_드럼기록Row>((f, t) => supabase.from('자재_드럼기록').select('*').order('id').range(f, t) as never),
    fetchAll<자재_품목기록Row>((f, t) => supabase.from('자재_품목기록').select('*').order('id').range(f, t) as never),
  ])

  const 선종들 = (선종res.data ?? []) as unknown as 자재_선종Row[]
  const 품목들raw = (품목res.data ?? []) as unknown as 자재_품목Row[]
  const 드럼들 = derive드럼(드럼raw, 드럼기록raw)
  const 품목들 = derive품목(품목들raw, 품목기록raw)
  const feed = buildFeed(드럼들, 드럼기록raw, 선종들, 품목들raw, 품목기록raw)
  const 공사명목록 = [...new Set(
    ((수주res.data ?? []) as unknown as { 공사명: string | null }[])
      .map((r) => r.공사명?.trim())
      .filter((s): s is string => !!s),
  )]

  return (
    <MaterialsView
      선종들={선종들}
      드럼들={드럼들}
      드럼기록들={드럼기록raw}
      품목들={품목들}
      feed={feed}
      공사명목록={공사명목록}
    />
  )
}
