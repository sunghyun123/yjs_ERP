// src/app/(dashboard)/gongmu/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import { formatEok } from '@/lib/format'
import { calc달성률 } from './_lib/calc'

export const metadata = { title: '공무 보고서 | 영전사 ERP' }

function shiftMonth(yyyy: number, mm: number, delta: number): string {
  const d = new Date(yyyy, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function pctColor(pct: number) {
  return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
}

export default async function GongmuPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const monthStr = sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [calYearStr, calMonthStr] = monthStr.split('-')
  const calYear = Number(calYearStr)
  const calMonth = Number(calMonthStr)

  const { year: curYear, week: curWeek } = getCurrentWeek()
  const weekNos = getWeeksInMonth(calYear, calMonth).map((w) => w.week)

  // 금주 실적 KPI 카드 타이틀용 레이블 (현재 주차 기준)
  const curMonthWeeks = getWeeksInMonth(curYear, now.getMonth() + 1)
  const curWeekEntry = curMonthWeeks.find((w) => w.week === curWeek)
  const curWeekLabel = curWeekEntry
    ? `${now.getMonth() + 1}월 ${curWeekEntry.label.match(/^\d+주차/)?.[0] ?? `${curWeek}주차`}`
    : `${curWeek}주차`

  const supabase = await createClient()
  const { data: 공무들raw } = await supabase.from('공무담당자').select('id, 이름').order('이름')
  const 공무들 = (공무들raw ?? []) as { id: number; 이름: string }[]

  if (공무들.length === 0) {
    return (
      <div className="p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <p className="text-sm text-gray-500">등록된 공무담당자가 없습니다.</p>
      </div>
    )
  }

  const ids = 공무들.map((g) => g.id)

  const [plansResult, monthRowsResult, weekRowsResult] = await Promise.all([
    supabase
      .from('공무_월간계획')
      .select('공무_id, 구분, 월간계획금액')
      .in('공무_id', ids)
      .eq('year', calYear)
      .eq('month', calMonth),
    supabase
      .from('공무_주간보고')
      .select('공무_id, 구분, 금주실적')
      .in('공무_id', ids)
      .eq('year', calYear)
      .in('week_no', weekNos),
    supabase
      .from('공무_주간보고')
      .select('공무_id, 구분, 금주실적')
      .in('공무_id', ids)
      .eq('year', curYear)
      .eq('week_no', curWeek),
  ])

  const plans = (plansResult.data ?? []) as { 공무_id: number; 구분: string; 월간계획금액: number }[]
  const monthRows = (monthRowsResult.data ?? []) as { 공무_id: number; 구분: string; 금주실적: number }[]
  const weekRows = (weekRowsResult.data ?? []) as { 공무_id: number; 구분: string; 금주실적: number }[]

  // 전체 KPI
  const 총계획공사 = plans.filter((p) => p.구분 === '공사').reduce((s, p) => s + p.월간계획금액, 0)
  const 총계획공무 = plans.filter((p) => p.구분 === '공무').reduce((s, p) => s + p.월간계획금액, 0)
  const 총누계공사 = monthRows.filter((r) => r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 총누계공무 = monthRows.filter((r) => r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)
  const 총금주공사 = weekRows.filter((r) => r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 총금주공무 = weekRows.filter((r) => r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)

  // 담당자별 집계
  const personData = 공무들.map((g) => ({
    ...g,
    계획공사: plans.filter((p) => p.공무_id === g.id && p.구분 === '공사').reduce((s, p) => s + p.월간계획금액, 0),
    계획공무: plans.filter((p) => p.공무_id === g.id && p.구분 === '공무').reduce((s, p) => s + p.월간계획금액, 0),
    누계공사: monthRows.filter((r) => r.공무_id === g.id && r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0),
    누계공무: monthRows.filter((r) => r.공무_id === g.id && r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0),
    금주: weekRows.filter((r) => r.공무_id === g.id).reduce((s, r) => s + r.금주실적, 0),
  }))

  const 시그마금주 = weekRows.reduce((s, r) => s + r.금주실적, 0)
  const 공사달성 = calc달성률(총누계공사, 총계획공사) ?? 0
  const 공무달성 = calc달성률(총누계공무, 총계획공무) ?? 0

  return (
    <div className="p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">공무 보고서</h1>
          <p className="text-sm text-gray-500 mt-0.5">{calYear}년 {calMonth}월</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/gongmu?month=${shiftMonth(calYear, calMonth, -1)}`}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            ◀ {new Date(calYear, calMonth - 2, 1).getMonth() + 1}월
          </Link>
          <span className="border border-[#1e2d5a] bg-[#1e2d5a] text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
            {calMonth}월
          </span>
          <Link
            href={`/gongmu?month=${shiftMonth(calYear, calMonth, 1)}`}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {new Date(calYear, calMonth, 1).getMonth() + 1}월 ▶
          </Link>
        </div>
      </div>

      {/* KPI 3카드 */}
      <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">전체 종합 현황</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([
          {
            title: '총 월간계획',
            rows: [
              { tag: '공사', tagCls: 'bg-blue-100 text-blue-800', amount: formatEok(총계획공사) },
              { tag: '공무', tagCls: 'bg-green-100 text-green-800', amount: formatEok(총계획공무) },
            ],
          },
          {
            title: '총 월간실적 (누적)',
            rows: [
              { tag: '공사', tagCls: 'bg-blue-100 text-blue-800', amount: formatEok(총누계공사) },
              { tag: '공무', tagCls: 'bg-green-100 text-green-800', amount: formatEok(총누계공무) },
            ],
          },
          {
            title: `금주 실적 (${curWeekLabel})`,
            rows: [
              { tag: '공사', tagCls: 'bg-blue-100 text-blue-800', amount: formatEok(총금주공사) },
              { tag: '공무', tagCls: 'bg-green-100 text-green-800', amount: formatEok(총금주공무) },
            ],
          },
        ] as const).map(({ title, rows }) => (
          <div key={title} className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 mb-3">{title}</p>
            {rows.map(({ tag, tagCls, amount }) => (
              <div key={tag} className="flex justify-between items-center mb-2 last:mb-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${tagCls}`}>{tag}</span>
                <span className="text-base font-bold text-[#1e2d5a]">{amount}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 담당자 그리드 */}
      <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">
        담당자별 현황 · 클릭하면 상세 보고서로 이동
      </p>
      <div className="grid grid-cols-4 gap-3">
        {/* Σ 전체 합산 카드 */}
        <div className="bg-gradient-to-br from-[#1e2d5a] to-[#2d45a8] rounded-2xl p-5">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base mb-3">
            Σ
          </div>
          <p className="font-bold text-white mb-0.5">월간 전체 합산</p>
          <p className="text-xs text-white/60 mb-3">
            금주 실적 <strong className="text-white">{formatEok(시그마금주)}</strong>
          </p>
          {([
            { label: '공사 달성률 (월간)', pct: 공사달성, 실적: 총누계공사, 계획: 총계획공사 },
            { label: '공무 달성률 (월간)', pct: 공무달성, 실적: 총누계공무, 계획: 총계획공무 },
          ] as const).map(({ label, pct, 실적, 계획 }) => (
            <div key={label} className="mb-3 last:mb-0">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] text-white/60 font-semibold">{label}</span>
                <span className="text-xs font-bold text-white">{계획 > 0 ? `${pct}%` : '—'}</span>
              </div>
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-300" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-[10px] text-white/50 mt-0.5 text-right">
                {formatEok(실적)} / {formatEok(계획)}
              </p>
            </div>
          ))}
        </div>

        {/* 개인 카드 */}
        {personData.map((g) => {
          const 공사달성률 = calc달성률(g.누계공사, g.계획공사) ?? 0
          const 공무달성률 = calc달성률(g.누계공무, g.계획공무) ?? 0
          return (
            <Link key={g.id} href={`/gongmu/${g.id}?month=${monthStr}`} className="block">
              <div className="bg-white rounded-2xl p-5 shadow-sm border-[1.5px] border-transparent hover:border-blue-400 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-base mb-3">
                  {g.이름.slice(0, 1)}
                </div>
                <p className="font-bold text-[#1e2d5a] mb-0.5">{g.이름}</p>
                <p className="text-xs text-gray-400 mb-3">
                  금주 실적 <strong className="text-[#1e2d5a]">{formatEok(g.금주)}</strong>
                </p>
                {([
                  { label: '공사 달성률 (월간)', pct: 공사달성률, 실적: g.누계공사, 계획: g.계획공사 },
                  { label: '공무 달성률 (월간)', pct: 공무달성률, 실적: g.누계공무, 계획: g.계획공무 },
                ] as const).map(({ label, pct, 실적, 계획 }) => (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] text-gray-400 font-semibold">{label}</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: 계획 > 0 ? pctColor(pct) : '#d1d5db' }}
                      >
                        {계획 > 0 ? `${pct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: 계획 > 0 ? pctColor(pct) : '#e5e7eb',
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                      {formatEok(실적)} / {formatEok(계획)}
                    </p>
                  </div>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
