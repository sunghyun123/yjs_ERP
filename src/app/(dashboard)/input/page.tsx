import { createClient } from '@/lib/supabase/server'
import type { 공사단가Row } from '@/types/database'
import { InputForm } from './_components/InputForm'

export const metadata = { title: '투입실적 입력 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data: raw } = await supabase
    .from('공사단가')
    .select()
    .order('적용시작일', { ascending: false })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">투입실적 입력</h1>
        <p className="text-sm text-gray-500 mt-0.5">공사별 일별 투입 인원을 입력합니다.</p>
      </div>
      <InputForm 단가목록={(raw ?? []) as 공사단가Row[]} />
    </div>
  )
}
