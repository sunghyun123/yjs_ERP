import { createClient } from '@/lib/supabase/server'
import type { 거래처Row } from '@/types/database'
import { ClientsClient } from './_components/ClientsClient'

export const metadata = { title: '거래처 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('거래처').select().order('거래처명')
  const rows = (data ?? []) as 거래처Row[]
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">거래처 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">거래처 등록 · 수정 · 삭제</p>
      </div>
      <ClientsClient initialRows={rows} />
    </div>
  )
}
