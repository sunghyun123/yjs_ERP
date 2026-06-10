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
        <Bar dataKey="성과금액" name="성과금액" fill="#3d5af1" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="투입금액" name="투입금액" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="손익금액" name="손익금액" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
