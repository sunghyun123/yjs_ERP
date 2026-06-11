// src/app/(dashboard)/_components/KpiCards.tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CircleDollarSign, TrendingUp, Wallet, ArrowUpDown } from 'lucide-react'
import type { 투입실적Row, 공사단가Row } from '@/types/database'
import { formatEok } from '@/lib/format'
import { calc합계 } from '../_lib/calc'

export async function KpiCards() {
  const supabase = await createClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')

  const monthStart = `${year}-${mm}-01`
  const monthEnd = new Date(year, month, 1).toISOString().slice(0, 10)

  // 전월 동기간: 같은 날짜 범위, 한 달 전
  const firstOfPrevMonth = new Date(year, month - 2, 1)
  const prevYear = firstOfPrevMonth.getFullYear()
  const prevMm = String(firstOfPrevMonth.getMonth() + 1).padStart(2, '0')
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
  const prevDay = Math.min(day, prevMonthLastDay)
  const prevMonthStart = `${prevYear}-${prevMm}-01`
  const prevMonthEnd = `${prevYear}-${prevMm}-${String(prevDay).padStart(2, '0')}`

  const [투입실적결과, 단가결과, 공사이력결과, 전월공사이력결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', monthStart).lt('투입일', monthEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase.from('공사이력').select('성과금액').gte('작업일자', monthStart).lte('작업일자', `${year}-${mm}-${dd}`),
    supabase.from('공사이력').select('성과금액').gte('작업일자', prevMonthStart).lte('작업일자', prevMonthEnd),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]

  const 이번달투입금액 = 투입실적목록.reduce((sum, row) => sum + calc합계(row, 단가목록), 0)

  const 이번달성과금액 = ((공사이력결과.data ?? []) as { 성과금액: number }[]).reduce(
    (sum, r) => sum + (r.성과금액 ?? 0),
    0,
  )
  const 전월성과금액 = ((전월공사이력결과.data ?? []) as { 성과금액: number }[]).reduce(
    (sum, r) => sum + (r.성과금액 ?? 0),
    0,
  )
  const 전월대비성과금액 = 이번달성과금액 - 전월성과금액
  const 이번달손익금액 = 이번달성과금액 - 이번달투입금액

  const 월표시 = `${month}월`

  const cards = [
    {
      title: `${월표시} 성과금액`,
      value: formatEok(이번달성과금액),
      sub: null,
      icon: CircleDollarSign,
      color: '#3d5af1',
    },
    {
      title: `전월대비 성과`,
      value: (전월대비성과금액 >= 0 ? '+' : '') + formatEok(전월대비성과금액),
      sub: `전월 동기간 대비`,
      icon: ArrowUpDown,
      color: 전월대비성과금액 >= 0 ? '#22c55e' : '#ef4444',
    },
    {
      title: `${월표시} 투입금액`,
      value: formatEok(이번달투입금액),
      sub: null,
      icon: Wallet,
      color: '#f59e0b',
    },
    {
      title: `${월표시} 손익금액`,
      value: formatEok(이번달손익금액),
      sub: null,
      icon: TrendingUp,
      color: 이번달손익금액 >= 0 ? '#22c55e' : '#ef4444',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ title, value, sub, icon: Icon, color }) => (
        <Card key={title} className="bg-white shadow-sm border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
            <div className="p-2 rounded-lg" style={{ backgroundColor: color + '18' }}>
              <Icon className="size-4" style={{ color }} />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-white shadow-sm border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
