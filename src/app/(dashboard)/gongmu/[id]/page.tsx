// src/app/(dashboard)/gongmu/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import type { 공무담당자Row, 공무_주간보고Row } from '@/types/database'
import { WeeklyReportForm } from './_components/WeeklyReportForm'

function shiftMonth(yyyy: number, mm: number, delta: number): string {
  const d = new Date(yyyy, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
  if (isNaN(공무_id)) notFound()

  const supabase = await createClient()
  const { data: 공무raw } = await supabase.from('공무담당자').select('id, 이름').eq('id', 공무_id).single()
  const 공무 = 공무raw as Pick<공무담당자Row, 'id' | '이름'> | null
  if (!공무) notFound()

  // 월 파싱: YYYY-MM 형식 또는 구형 숫자 형식 모두 처리
  const now = new Date()
  let calYear: number
  let calMonth: number
  if (sp.month && sp.month.includes('-')) {
    const [y, m] = sp.month.split('-')
    calYear = Number(y)
    calMonth = Number(m)
  } else if (sp.month) {
    calYear = now.getFullYear()
    calMonth = Number(sp.month)
  } else {
    calYear = now.getFullYear()
    calMonth = now.getMonth() + 1
  }

  const { year: curYear, week: curWeek } = getCurrentWeek()
  const weekOptions = getWeeksInMonth(calYear, calMonth)
  const isoYearsInMonth = [...new Set(weekOptions.map((w) => w.isoYear))]

  // week/year 파라미터 없으면 해당 달의 첫 주차로 기본값 설정
  const selectedYear = sp.year ? Number(sp.year) : (weekOptions[0]?.isoYear ?? calYear)
  const selectedWeek = sp.week ? Number(sp.week) : (weekOptions[0]?.week ?? curWeek)

  const [planResult, allRowsResult, weekRowsResult, 수주Result, 공무담당자Result] = await Promise.all([
    supabase.from('공무_월간계획').select('구분, 월간계획금액').eq('공무_id', 공무_id).eq('year', calYear).eq('month', calMonth),
    supabase.from('공무_주간보고').select('week_no, year, 금주실적, 구분').eq('공무_id', 공무_id).in('year', isoYearsInMonth),
    supabase.from('공무_주간보고').select('*').eq('공무_id', 공무_id).eq('year', selectedYear).eq('week_no', selectedWeek).order('항목순서'),
    supabase.from('수주').select('id, 지중no, 공사명').eq('준공여부', false).order('지중no'),
    supabase.from('공무담당자').select('id, 이름').order('이름'),
  ])

  const weekRows = (weekRowsResult.data ?? []) as 공무_주간보고Row[]

  const weekStart = weekOptions.find((w) => w.week === selectedWeek)

  const monthStr = `${calYear}-${String(calMonth).padStart(2, '0')}`
  const prevMonth = shiftMonth(calYear, calMonth, -1)
  const nextMonth = shiftMonth(calYear, calMonth, 1)

  return (
    <div className="p-6" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-base shrink-0">
            {공무.이름.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{공무.이름}</h1>
            <p className="text-sm text-gray-400">주간업무보고</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 월 이동 */}
          <div className="flex gap-1.5">
            <Link
              href={`/gongmu/${공무_id}?month=${prevMonth}`}
              className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              ◀ {new Date(calYear, calMonth - 2, 1).getMonth() + 1}월
            </Link>
            <span className="border border-[#1e2d5a] bg-[#1e2d5a] text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
              {calMonth}월
            </span>
            <Link
              href={`/gongmu/${공무_id}?month=${nextMonth}`}
              className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {new Date(calYear, calMonth, 1).getMonth() + 1}월 ▶
            </Link>
          </div>
          <Link href={`/gongmu?month=${monthStr}`} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            ← 목록
          </Link>
        </div>
      </div>

      {/* 주차 탭 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {weekOptions.map((w) => (
          <Link
            key={`${w.isoYear}-${w.week}`}
            href={`/gongmu/${공무_id}?year=${w.isoYear}&week=${w.week}&month=${monthStr}`}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
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
        key={`${calYear}-${calMonth}-${selectedYear}-${selectedWeek}`}
        공무_id={공무_id}
        calYear={calYear}
        year={selectedYear}
        week_no={selectedWeek}
        savedRows={weekRows}
        수주목록={수주Result.data ?? []}
        공무담당자목록={공무담당자Result.data ?? []}
        plans={planResult.data ?? []}
        month={calMonth}
        이름={공무.이름}
        weekLabel={weekStart?.label ?? ''}
        allRows={allRowsResult.data ?? []}
      />
    </div>
  )
}
