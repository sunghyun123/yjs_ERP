// src/app/(dashboard)/gongmu/total/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import { Card, CardContent } from '@/components/ui/card'
import { calc달성률, calc금주실적합산 } from '../_lib/calc'
import { formatEok } from '@/lib/format'

export const metadata = { title: '공무 종합 현황 | 영전사 ERP' }

export default async function GongmuTotalPage() {
  const supabase = await createClient()
  const { year, week } = getCurrentWeek()
  const now = new Date()
  const month = now.getMonth() + 1
  const weeks = getWeeksInMonth(year, month).map((w) => w.week)

  const { data: 공무들raw } = await supabase.from('공무담당자').select('id, 이름').order('이름')
  const 공무들 = (공무들raw ?? []) as { id: number; 이름: string }[]
  if (공무들.length === 0) {
    return <div className="p-6 text-gray-500">등록된 공무담당자가 없습니다.</div>
  }

  const ids = 공무들.map((g) => g.id)

  const [rowsResult, plansResult] = await Promise.all([
    supabase.from('공무_주간보고').select('공무_id, week_no, year, 금주실적, 구분').in('공무_id', ids).eq('year', year),
    supabase.from('공무_월간계획').select('공무_id, 구분, 월간계획금액').in('공무_id', ids).eq('year', year).eq('month', month),
  ])

  const allRows = (rowsResult.data ?? []) as any[]
  const allPlans = (plansResult.data ?? []) as any[]

  const 총계획 = allPlans.reduce((s: number, p: any) => s + p.월간계획금액, 0)
  const 총금주 = calc금주실적합산(allRows, week, year)
  const 총누계 = allRows.filter((r: any) => r.year === year && weeks.includes(r.week_no)).reduce((s: number, r: any) => s + r.금주실적, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">종합 현황</h1>
          <p className="text-sm text-gray-400">{year}년 {month}월</p>
        </div>
        <Link href="/gongmu" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">← 목록</Link>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '총 월간계획', value: formatEok(총계획) },
          { label: '총 누적실적', value: formatEok(총누계) },
          { label: '이번주 금주실적', value: formatEok(총금주) },
          { label: '전체 달성률', value: 총계획 > 0 ? `${calc달성률(총누계, 총계획)}%` : '—' },
        ].map(({ label, value }) => (
          <Card key={label} className="bg-white shadow-sm border-0">
            <CardContent className="px-5 py-4">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 공무별 달성률 */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-600 mb-4">공무별 달성률</p>
          <div className="space-y-3">
            {공무들.map((g) => {
              const 계획 = allPlans.filter((p: any) => p.공무_id === g.id).reduce((s: number, p: any) => s + p.월간계획금액, 0)
              const 누계 = allRows.filter((r: any) => r.공무_id === g.id && weeks.includes(r.week_no)).reduce((s: number, r: any) => s + r.금주실적, 0)
              const pct = calc달성률(누계, 계획) ?? 0
              const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
              return (
                <Link key={g.id} href={`/gongmu/${g.id}`} className="flex items-center gap-3 hover:bg-gray-50 rounded p-1 -m-1 transition-colors">
                  <span className="w-16 text-sm font-medium text-gray-800 shrink-0">{g.이름}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold" style={{ color }}>
                    {계획 > 0 ? `${pct}%` : '—'}
                  </span>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
