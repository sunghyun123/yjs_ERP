import { createClient } from '@/lib/supabase/server'
import type { 수주목록항목 } from './_types'
import { ProgressInputForm } from './_components/ProgressInputForm'
import { ProgressHistoryTable } from './_components/ProgressHistoryTable'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = { title: '공사이력 | 영전사 ERP' }

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
  const defaultTo   = `${y}-${mm}-${lastDay}`

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const date_from = dateRe.test(params.date_from ?? '') ? params.date_from! : defaultFrom
  const date_to   = dateRe.test(params.date_to ?? '')   ? params.date_to!   : defaultTo

  const supabase = await createClient()

  const { data: 수주raw } = await supabase
    .from('수주')
    .select('id, 지중no, 공사명, 수주금액_공급가, 보험료율, 하도전용율')
    .order('지중no', { ascending: true })
  const 수주목록 = (수주raw ?? []) as 수주목록항목[]

  const historyHref = `/progress?tab=history&date_from=${date_from}&date_to=${date_to}`

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공사이력</h1>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <Link
          href="/progress"
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab !== 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          입력
        </Link>
        <Link
          href={historyHref}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          현황
        </Link>
      </div>

      {tab === 'history' ? (
        <ProgressHistoryTable date_from={date_from} date_to={date_to} />
      ) : (
        <ProgressInputForm
          수주목록={수주목록}
          default수주Id={params.수주_id && Number.isFinite(Number(params.수주_id)) ? Number(params.수주_id) : null}
          default날짜={params.날짜 && dateRe.test(params.날짜) ? params.날짜 : null}
        />
      )}
    </div>
  )
}
