// src/app/(dashboard)/_components/KpiCards.tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CircleDollarSign, TrendingUp, Wallet, ArrowUpDown } from 'lucide-react'
import { getMonthlyKpiData } from '../_lib/monthly-kpi'
import type { load성과재료 } from '../_lib/junggong-seonggwa'

export async function KpiCards({
  성과재료Promise,
}: {
  성과재료Promise: ReturnType<typeof load성과재료>
}) {
  const supabase = await createClient()
  const kpi = await getMonthlyKpiData(supabase, new Date(), 성과재료Promise)
  const { label: 월표시, amounts, formatted } = kpi

  const cards = [
    {
      title: `${월표시} 성과금액`,
      value: formatted.monthlyRevenue,
      sub: null,
      icon: CircleDollarSign,
      color: '#3d5af1',
    },
    {
      title: `전월대비 성과`,
      value: formatted.revenueDelta,
      sub: `전월 대비`,
      icon: ArrowUpDown,
      color: amounts.revenueDelta >= 0 ? '#22c55e' : '#ef4444',
    },
    {
      title: `${월표시} 투입금액`,
      value: formatted.monthlyInput,
      sub: null,
      icon: Wallet,
      color: '#f59e0b',
    },
    {
      title: `${월표시} 손익금액`,
      value: formatted.monthlyProfit,
      sub: null,
      icon: TrendingUp,
      color: amounts.monthlyProfit >= 0 ? '#22c55e' : '#ef4444',
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
