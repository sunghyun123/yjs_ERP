import { createClient } from '@/lib/supabase/server'
import type { 공사단가Row } from '@/types/database'
import { RatesClient } from './_components/RatesClient'

export const metadata = { title: '공사단가 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data: ratesRaw } = await supabase
    .from('공사단가')
    .select()
    .order('적용시작일', { ascending: false })

  const seen = new Set<string>()
  const currentRates = ((ratesRaw ?? []) as 공사단가Row[]).filter(r => {
    if (seen.has(r.투입구분)) return false
    seen.add(r.투입구분)
    return true
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공사단가 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">투입구분별 현행 단가 · 수정 시 해당 레코드 직접 UPDATE</p>
      </div>
      <RatesClient initialRows={currentRates} />
    </div>
  )
}
