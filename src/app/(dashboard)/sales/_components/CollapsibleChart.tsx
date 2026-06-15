'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SalesChart, type SalesChartRow } from './SalesChart'
import { formatEok } from '@/lib/format'

type Props = {
  data: SalesChartRow[]
  year: number
  총성과: number
  총투입: number
  총손익: number
}

export function CollapsibleChart({ data, year, 총성과, 총투입, 총손익 }: Props) {
  const [open, setOpen] = useState(false)

  const 손익컬러 =
    총손익 >= 5_000_000 ? '#16a34a' : 총손익 <= -5_000_000 ? '#dc2626' : '#374151'

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader
        className="px-5 py-4 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-gray-600 shrink-0">
            {year}년 월별 매출손익
          </span>
          <div className="flex items-center gap-4 ml-2 flex-1">
            <span className="text-xs text-gray-500">
              성과{' '}
              <span className="font-semibold text-blue-600">{formatEok(총성과)}</span>
            </span>
            <span className="text-xs text-gray-500">
              투입{' '}
              <span className="font-semibold text-amber-500">{formatEok(총투입)}</span>
            </span>
            <span className="text-xs text-gray-500">
              손익{' '}
              <span className="font-semibold" style={{ color: 손익컬러 }}>
                {formatEok(총손익)}
              </span>
            </span>
          </div>
          {open ? (
            <ChevronDown className="size-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-gray-400 shrink-0" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-5 pb-5">
          <SalesChart data={data} />
        </CardContent>
      )}
    </Card>
  )
}
