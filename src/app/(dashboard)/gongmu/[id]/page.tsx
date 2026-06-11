// src/app/(dashboard)/gongmu/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import type { 공무담당자Row, 공무_주간보고Row } from '@/types/database'
import { MonthlySummary } from './_components/MonthlySummary'
import { WeeklyReportForm } from './_components/WeeklyReportForm'

export default async function GongmuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; week?: string; month?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const 공무_id = Number(id)

  const supabase = await createClient()
  const { data: 공무raw } = await supabase.from('공무담당자').select('id, 이름').eq('id', 공무_id).single()
  const 공무 = 공무raw as Pick<공무담당자Row, 'id' | '이름'> | null
  if (!공무) notFound()

  const now = new Date()
  const { year: curYear, week: curWeek } = getCurrentWeek()
  const selectedYear = sp.year ? Number(sp.year) : curYear
  const selectedWeek = sp.week ? Number(sp.week) : curWeek
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1
  const weekOptions = getWeeksInMonth(selectedYear, month)

  const [planResult, allRowsResult, weekRowsResult, 수주Result, 공무담당자Result] = await Promise.all([
    supabase.from('공무_월간계획').select('구분, 월간계획금액').eq('공무_id', 공무_id).eq('year', selectedYear).eq('month', month),
    supabase.from('공무_주간보고').select('week_no, year, 금주실적, 구분').eq('공무_id', 공무_id).eq('year', selectedYear),
    supabase.from('공무_주간보고').select('*').eq('공무_id', 공무_id).eq('year', selectedYear).eq('week_no', selectedWeek).order('항목순서'),
    supabase.from('수주').select('id, 지중no, 공사명').eq('준공여부', false).order('지중no'),
    supabase.from('공무담당자').select('id, 이름').order('이름'),
  ])

  // ERP 초안: 해당 주차에 담당공무가 현재 공무인 공사이력·기성 중 아직 저장 안 된 것
  const weekRows = (weekRowsResult.data ?? []) as 공무_주간보고Row[]
  const savedErp이력Ids = new Set(weekRows.map((r) => r.erp_공사이력_id).filter(Boolean))
  const savedErp기성Ids = new Set(weekRows.map((r) => r.erp_기성_id).filter(Boolean))

  const weekStart = weekOptions.find((w) => w.week === selectedWeek)
  const weekDates = weekStart ? { start: weekStart.label.match(/\((.+)~/)![1], end: weekStart.label.match(/~(.+)\)/)![1] } : null

  const [이력초안Result, 기성초안Result] = weekDates
    ? await Promise.all([
        supabase.from('공사이력')
          .select('id, 수주_id, 작업일자, 성과금액, 작업내용')
          .eq('담당공무_id', 공무_id)
          .gte('작업일자', `${selectedYear}-${weekDates.start}`)
          .lte('작업일자', `${selectedYear}-${weekDates.end}`),
        supabase.from('기성')
          .select('id, 수주_id, 기성일, 기성액_공급가, 작업내용')
          .eq('담당공무_id', 공무_id)
          .gte('기성일', `${selectedYear}-${weekDates.start}`)
          .lte('기성일', `${selectedYear}-${weekDates.end}`),
      ])
    : [{ data: [] }, { data: [] }]

  const 이력초안 = ((이력초안Result.data ?? []) as { id: number; 수주_id: number | null; 작업일자: string; 성과금액: number | null; 작업내용: string | null }[])
    .filter((r) => !savedErp이력Ids.has(r.id))
  const 기성초안 = ((기성초안Result.data ?? []) as { id: number; 수주_id: number | null; 기성일: string | null; 기성액_공급가: number | null; 작업내용: string | null }[])
    .filter((r) => !savedErp기성Ids.has(r.id))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-sm">
            {공무.이름.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{공무.이름}</h1>
            <p className="text-sm text-gray-400">{selectedYear}년 {month}월 주간업무보고</p>
          </div>
        </div>
        <Link href="/gongmu" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          ← 목록
        </Link>
      </div>

      <MonthlySummary
        plans={planResult.data ?? []}
        allRows={allRowsResult.data ?? []}
        currentWeek={selectedWeek}
        currentYear={selectedYear}
      />

      {/* 주차 탭 */}
      <div className="flex gap-2 flex-wrap">
        {weekOptions.map((w) => (
          <Link
            key={`${w.isoYear}-${w.week}`}
            href={`/gongmu/${공무_id}?year=${w.isoYear}&week=${w.week}&month=${month}`}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              w.week === selectedWeek && w.isoYear === selectedYear
                ? 'bg-[#1e2d5a] text-white border-[#1e2d5a]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {w.label}
            {w.week === curWeek && w.isoYear === curYear && ' ✦'}
          </Link>
        ))}
      </div>

      <WeeklyReportForm
        공무_id={공무_id}
        year={selectedYear}
        week_no={selectedWeek}
        savedRows={weekRows}
        이력초안={이력초안}
        기성초안={기성초안}
        수주목록={수주Result.data ?? []}
        공무담당자목록={공무담당자Result.data ?? []}
        plans={planResult.data ?? []}
        month={month}
      />
    </div>
  )
}
