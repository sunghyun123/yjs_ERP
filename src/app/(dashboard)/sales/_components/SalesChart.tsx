'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatKRW } from '@/lib/format'

export type SalesChartRow = {
  month: string
  성과금액: number
  투입금액: number
  손익금액: number
}

export function SalesChart({ data }: { data: SalesChartRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickFormatter={(v: number) => {
            const abs = Math.abs(v)
            if (abs >= 100_000_000) return (v / 100_000_000).toFixed(1).replace(/\.0$/, '') + '억'
            if (abs >= 10_000) return Math.round(v / 10_000) + '만'
            return v.toLocaleString('ko-KR')
          }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            formatKRW(value as number),
            name as string,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Legend
          content={() => (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, paddingTop: 12 }}>
              {([
                { label: '성과금액', color: '#3d5af1' },
                { label: '투입금액', color: '#f59e0b' },
                { label: '손익금액', color: '#22c55e' },
              ] as const).map(({ label, color }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: color, borderRadius: 2 }} />
                  {label}
                </span>
              ))}
            </div>
          )}
        />
        <Bar dataKey="성과금액" name="성과금액" fill="#3d5af1" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="투입금액" name="투입금액" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="손익금액" name="손익금액" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={24}>
          {data.map((row, i) => (
            <Cell key={i} fill={row.손익금액 >= 0 ? '#22c55e' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
