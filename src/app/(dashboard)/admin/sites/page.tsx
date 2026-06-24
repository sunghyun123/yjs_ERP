import { createClient } from '@/lib/supabase/server'
import type { 공사현장Row } from '@/types/database'
import { SitesClient } from './_components/SitesClient'

export const metadata = { title: '공사현장 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('공사현장').select().order('현장명')
  const rows = (data ?? []) as 공사현장Row[]
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공사현장 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">수주 등록 시 선택할 공사현장 목록 · 추가/삭제</p>
      </div>
      <SitesClient initialRows={rows} />
    </div>
  )
}
