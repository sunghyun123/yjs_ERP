import { createClient } from '@/lib/supabase/server'
import type { 이력카드_머리글자Row, 거래처Row } from '@/types/database'
import { PrefixesClient } from './_components/PrefixesClient'

export const metadata = { title: '이력카드 머리글자 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const [{ data: 규칙, error: 규칙오류 }, { data: 거래처, error: 거래처오류 }] = await Promise.all([
    supabase.from('이력카드_머리글자').select().order('정렬').order('id'),
    supabase.from('거래처').select().order('거래처명'),
  ])
  if (규칙오류 || 거래처오류) {
    return <p className="p-4 md:p-6 text-sm text-red-600">머리글자 규칙을 읽지 못했습니다. 새로고침하거나 관리자에게 알려 주세요.</p>
  }
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">이력카드 머리글자 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">카드 번호 머리글자와, 새 공사의 영전사금액 요율을 가져올 거래처 · 끝난 규칙은 지우지 말고 사용을 끕니다</p>
      </div>
      <PrefixesClient
        initialRows={(규칙 ?? []) as 이력카드_머리글자Row[]}
        거래처목록={(거래처 ?? []) as Pick<거래처Row, 'id' | '거래처명' | '보험료제외율' | '하도전용율'>[]}
      />
    </div>
  )
}
