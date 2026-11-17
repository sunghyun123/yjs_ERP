import { createClient } from '@/lib/supabase/server'
import type { 수주목록항목 } from './_types'
import { ProgressInputForm } from './_components/ProgressInputForm'
import { ProgressHistoryTable } from './_components/ProgressHistoryTable'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { 미입력목록 } from './_components/미입력목록'
import { build미입력목록, load미입력재료 } from './_lib/미입력'

export const metadata = { title: '공사이력 | 영전사 ERP' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date_from?: string; date_to?: string; 수주_id?: string; 날짜?: string }>
}) {
  const params = await searchParams
  const tab = params.tab ?? 'input'
  // 모르는 tab 값은 입력 탭으로 본다(기존 동작과 같음)
  const 활성탭 = tab === 'history' || tab === 'missing' ? tab : 'input'

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

  // 준공 공사도 포함한다: 실무 피드백상 준공된 공사의 이력도 입력탭에서 확인·입력해야 함.
  // (과거엔 준공여부=false로 걸렀으나, 끝난 공사 이력 조회 요구가 들어와 필터 제거)
  const [수주결과, 공무담당자결과] = await Promise.all([
    supabase
      .from('수주')
      .select('id, 지중no, 공사명, 수주금액_공급가, 보험료율, 하도전용율, 준공여부')
      .order('지중no', { ascending: true }),
    supabase
      .from('공무담당자')
      .select('id, 이름')
      .order('이름'),
  ])
  const 수주목록 = (수주결과.data ?? []) as unknown as 수주목록항목[]
  const 공무담당자목록 = (공무담당자결과.data ?? []) as unknown as { id: number; 이름: string }[]

  // 담당자 목록이 비면 수정 시트가 담당이 지정된 모든 행을 "삭제된 담당자 #id"로 표시한다(저장값은 맞지만 문구가 틀림).
  // RLS에 막혀도 에러 없이 빈 배열이 오므로 0명도 실패로 본다. 입력은 막지 않고 경고만 띄운다.
  const 담당자조회실패 = !!공무담당자결과.error || 공무담당자목록.length === 0
  if (담당자조회실패) console.error('[progress] 공무담당자 조회 실패 또는 0명', 공무담당자결과.error)

  const historyHref = `/progress?tab=history&date_from=${date_from}&date_to=${date_to}`

  // 미입력 탭에서만 수주·공사이력·기성 전체를 읽는다(다른 탭 진입 비용을 늘리지 않으려고)
  let 미입력: ReturnType<typeof build미입력목록> | null = null
  if (활성탭 === 'missing') {
    const 재료 = await load미입력재료(supabase)
    미입력 = build미입력목록(재료.수주, 재료.이력, 재료.기성)
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공사이력</h1>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'input', href: '/progress', label: '입력' },
          { key: 'history', href: historyHref, label: '현황' },
          { key: 'missing', href: '/progress?tab=missing', label: '미입력' },
        ].map(t => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              활성탭 === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {담당자조회실패 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
          공무 담당자 목록을 불러오지 못했습니다. 담당 공무 표시가 틀릴 수 있으니 새로고침해 주세요.
        </div>
      )}

      {활성탭 === 'missing' && 미입력 ? (
        <미입력목록 data={미입력} />
      ) : 활성탭 === 'history' ? (
        <ProgressHistoryTable date_from={date_from} date_to={date_to} 공무담당자목록={공무담당자목록} />
      ) : (
        <ProgressInputForm
          수주목록={수주목록}
          공무담당자목록={공무담당자목록}
          default수주Id={params.수주_id && Number.isFinite(Number(params.수주_id)) ? Number(params.수주_id) : null}
          default날짜={params.날짜 && dateRe.test(params.날짜) ? params.날짜 : null}
        />
      )}
    </div>
  )
}
