// src/app/(dashboard)/gongmu/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'

export const metadata = { title: '공무 보고서 | 영전사 ERP' }

export default async function GongmuPage() {
  const supabase = await createClient()
  const { year } = getCurrentWeek()
  const now = new Date()

  const { data: 공무들raw } = await supabase.from('공무담당자').select('id, 이름').order('이름')
  const 공무들 = (공무들raw ?? []) as { id: number; 이름: string }[]

  // 각 공무의 이번달 달성률 미리 계산
  const month = now.getMonth() + 1
  const weeks = getWeeksInMonth(year, month).map((w) => w.week)
  const weekData = 공무들.length > 0
    ? await supabase
        .from('공무_주간보고')
        .select('공무_id, 금주실적')
        .in('공무_id', 공무들.map((g) => g.id))
        .eq('year', year)
        .in('week_no', weeks)
    : { data: [] }

  const 실적Map = new Map<number, number>()
  for (const row of (weekData.data ?? []) as { 공무_id: number; 금주실적: number }[]) {
    실적Map.set(row.공무_id, (실적Map.get(row.공무_id) ?? 0) + row.금주실적)
  }

  const planData = 공무들.length > 0
    ? await supabase
        .from('공무_월간계획')
        .select('공무_id, 월간계획금액')
        .in('공무_id', 공무들.map((g) => g.id))
        .eq('year', year)
        .eq('month', month)
    : { data: [] }

  const 계획Map = new Map<number, number>()
  for (const row of (planData.data ?? []) as { 공무_id: number; 월간계획금액: number }[]) {
    계획Map.set(row.공무_id, (계획Map.get(row.공무_id) ?? 0) + row.월간계획금액)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">공무 보고서</h1>
        <p className="text-sm text-gray-500 mt-0.5">{year}년 {month}월</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 종합 현황 카드 */}
        <Link href="/gongmu/total" className="block">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 hover:border-indigo-400 transition-colors">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm mb-3">Σ</div>
            <p className="font-semibold text-indigo-900">종합 현황</p>
            <p className="text-xs text-indigo-400 mt-0.5">전체 공무 합산</p>
          </div>
        </Link>

        {/* 공무별 카드 */}
        {공무들.map((g) => {
          const 누계 = 실적Map.get(g.id) ?? 0
          const 계획 = 계획Map.get(g.id) ?? 0
          const 달성률 = 계획 > 0 ? Math.round((누계 / 계획) * 100) : null
          return (
            <Link key={g.id} href={`/gongmu/${g.id}`} className="block">
              <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 transition-colors">
                <div className="w-10 h-10 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-sm mb-3">
                  {g.이름.slice(0, 1)}
                </div>
                <p className="font-semibold text-gray-900">{g.이름}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {달성률 !== null ? `이번달 달성률 ${달성률}%` : '계획 미설정'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
