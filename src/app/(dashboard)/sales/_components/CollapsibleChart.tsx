'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SalesChart, type SalesChartRow } from './SalesChart'

export function CollapsibleChart({ data, year }: { data: SalesChartRow[]; year: number }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader
        className="px-5 py-4 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">
            {year}년 월별 매출손익
          </span>
          {open ? (
            <ChevronDown className="size-4 text-gray-400" />
          ) : (
            <ChevronRight className="size-4 text-gray-400" />
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
