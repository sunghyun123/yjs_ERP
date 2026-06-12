import { createClient } from '@/lib/supabase/server'
import type { 공무담당자Row } from '@/types/database'
import { GongmuClient } from './_components/GongmuClient'

export const metadata = { title: '공무담당자 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('공무담당자').select().order('이름')
  const rows = (data ?? []) as 공무담당자Row[]
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공무담당자 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">공무담당자 등록 · 수정 · 삭제</p>
      </div>
      <GongmuClient initialRows={rows} />
    </div>
  )
}
