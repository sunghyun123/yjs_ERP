import { createClient } from '@/lib/supabase/server'
import type { 공사단가Row } from '@/types/database'
import { InputForm } from './_components/InputForm'
import { HistoryTable } from './_components/HistoryTable'
import type { 투입실적행 } from './_types'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = { title: '투입실적 | 영전사 ERP' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date_from?: string; date_to?: string; 수주_id?: string; 날짜?: string }>
}) {
  const params = await searchParams
  const tab = params.tab ?? 'input'

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const mm = String(m).padStart(2, '0')
  const lastDay = new Date(y, m, 0).getDate()
  const defaultFrom = `${y}-${mm}-01`
  const defaultTo = `${y}-${mm}-${lastDay}`

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const date_from = dateRe.test(params.date_from ?? '') ? params.date_from! : defaultFrom
  const date_to = dateRe.test(params.date_to ?? '') ? params.date_to! : defaultTo

  const supabase = await createClient()

  // 공사단가는 탭 무관하게 항상 fetch
  const { data: 단가raw } = await supabase
    .from('공사단가')
    .select()
    .order('적용시작일', { ascending: false })
  const 단가목록 = (단가raw ?? []) as 공사단가Row[]

  // 현황 탭: 선택 기간의 투입실적 fetch
  let 투입실적목록: 투입실적행[] = []
  if (tab === 'history') {
    const { data: histRaw } = await supabase
      .from('투입실적')
      .select(`
        id, 투입일, 수주_id,
        상용직_주, 상용직_야, 일용직_주, 일용직_야,
        모범신호수_주, 모범신호수_야,
        w6_주, w6_야, w3_주, w3_야,
        덤프15t_주, 덤프15t_야, 크레인_주, 크레인_야,
        물청소차_주, 물청소차_야, mcm_주, mcm_야,
        재료비인_주, 재료비인_야, 접속_주, 접속_야,
        외주1, 외주2,
        생성자, 생성일, 수정자, 수정일,
        수주!수주_id(지중no, 공사명)
      `)
      .gte('투입일', date_from)
      .lte('투입일', date_to)
      .order('투입일', { ascending: false })
    투입실적목록 = (histRaw ?? []) as 투입실적행[]
  }

  const historyHref = `/input?tab=history&date_from=${date_from}&date_to=${date_to}`

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">투입실적</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <Link
          href="/input"
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab !== 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          입력
        </Link>
        <Link
          href={historyHref}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          현황
        </Link>
      </div>

      {tab === 'history' ? (
        <HistoryTable
          data={투입실적목록}
          단가목록={단가목록}
          date_from={date_from}
          date_to={date_to}
        />
      ) : (
        <InputForm
          단가목록={단가목록}
          default수주Id={params.수주_id ? Number(params.수주_id) : null}
          default날짜={params.날짜 ?? null}
        />
      )}
    </div>
  )
}
