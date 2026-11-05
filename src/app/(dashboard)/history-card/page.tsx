import { createClient } from '@/lib/supabase/server'
import type { 이력카드_머리글자Row } from '@/types/database'
import { HistoryCardClient } from './_components/HistoryCardClient'

export const metadata = { title: '이력 카드 생성 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('이력카드_머리글자')
    .select()
    .eq('사용', true)
    .order('정렬')
    .order('id')

  if (error) {
    return <p className="p-4 md:p-6 text-sm text-red-600">머리글자 규칙을 읽지 못했습니다. 새로고침하거나 관리자에게 알려 주세요.</p>
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">이력 카드 생성</h1>
        <p className="text-sm text-gray-400 mt-0.5">시공통보서 PDF를 올리면 씽크와이즈에 붙여 넣을 공사이력카드를 만듭니다 · 저장되지 않습니다</p>
      </div>
      <HistoryCardClient 규칙목록={(data ?? []) as 이력카드_머리글자Row[]} />
    </div>
  )
}
