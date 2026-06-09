import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarCheck, CircleDollarSign, TrendingUp, Wallet } from 'lucide-react'
import type { 투입실적Row, 공사단가Row, 계획금액Row } from '@/types/database'
import { formatEok } from '@/lib/format'
import { calc투입금액 } from '../_lib/calc'

export async function KpiCards() {
  const supabase = await createClient()

  const now = new Date()
  const 월표시 = `${now.getMonth() + 1}월`
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const 년월키 = `${year}-${month}`
  const monthStart = `${year}-${month}-01`
  const monthEnd = new Date(year, now.getMonth() + 1, 1).toISOString().slice(0, 10)

  type 기성공급가Row = { 기성액_공급가: number | null }
  type 준공Row = { 준공액_공급가: number | null }

  const [투입실적결과, 단가결과, 이번달기성결과, 이번달준공결과, 계획금액결과] = await Promise.all([
    supabase.from('투입실적').select('*').gte('투입일', monthStart).lt('투입일', monthEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
    supabase.from('기성').select('기성액_공급가').gte('기성일', monthStart).lt('기성일', monthEnd),
    supabase
      .from('수주')
      .select('준공액_공급가')
      .gte('준공일', monthStart)
      .lt('준공일', monthEnd)
      .not('준공액_공급가', 'is', null),
    supabase.from('계획금액').select('금액').eq('년월', 년월키).maybeSingle(),
  ])

  const 단가목록 = (단가결과.data ?? []) as 공사단가Row[]
  const 투입실적목록 = (투입실적결과.data ?? []) as 투입실적Row[]

  const 이번달투입금액 = 투입실적목록.reduce(
    (sum, row) => sum + calc투입금액(row, 단가목록),
    0,
  )

  const 이번달기성합계 = ((이번달기성결과.data ?? []) as 기성공급가Row[]).reduce(
    (sum, r) => sum + (r.기성액_공급가 ?? 0),
    0,
  )

  const 이번달준공합계 = ((이번달준공결과.data ?? []) as 준공Row[]).reduce(
    (sum, r) => sum + (r.준공액_공급가 ?? 0),
    0,
  )

  const 계획금액 = (계획금액결과.data as Pick<계획금액Row, '금액'> | null)?.금액 ?? null

  const 이번달성과금액 = 이번달기성합계 + 이번달준공합계
  const 이번달손익금액 = 이번달성과금액 - 이번달투입금액

  const cards = [
    {
      title: `${월표시} 계획금액`,
      value: 계획금액 !== null ? formatEok(계획금액) : '—',
      sub: 계획금액 === null ? '미등록' : null,
      icon: CalendarCheck,
      color: '#6366f1',
    },
    {
      title: `${월표시} 성과금액`,
      value: formatEok(이번달성과금액),
      sub: null,
      icon: CircleDollarSign,
      color: '#3d5af1',
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
            <p
              className="text-2xl font-bold"
              style={{ color: sub ? '#94a3b8' : '#0f172a' }}
            >
              {value}
            </p>
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
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
