'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export type ChartRow = {
  month: string
  성과금액: number
  투입금액: number
  손익금액: number
}

export function ProfitChart({ data }: { data: ChartRow[] }) {
  // @ts-ignore
  // @ts-ignore
  return (
    <ResponsiveContainer width="100%" height={280}>
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
          tickFormatter={(v: number) => `${v.toLocaleString('ko-KR')}백만`}
          axisLine={false}
          tickLine={false}
          width={76}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            `${(value as number).toLocaleString('ko-KR')}백만원`,
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
          payload={[
            { value: '성과금액', type: 'square', color: '#3d5af1', id: '성과금액' },
            { value: '투입금액', type: 'square', color: '#f59e0b', id: '투입금액' },
            { value: '손익금액', type: 'square', color: '#22c55e', id: '손익금액' },
          ]}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          iconType="square"
          iconSize={10}
        />
        <Bar dataKey="성과금액" name="성과금액" fill="#3d5af1" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="투입금액" name="투입금액" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="손익금액" name="손익금액" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
