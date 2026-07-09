'use client'

// 유형(공사구분)×상태(시공상태)별 이중 도넛 — 안쪽 링=유형(색), 바깥 링=유형×상태(진하기).
// 데이터는 서버(TypeStatusDonutSection)가 집계해 props로 내려준다. 이 파일은 렌더만 담당.
// 금액 = 하도적용수주금액(수주대장과 같은 관대 로직, _lib/type-status.ts) → 합계가 수주대장과 일치.
// 사장님 피드백(2026-07-09): ①관급은 민수에 합산(집계 단계) ②우상단 유형별 요약란 ③안쪽 링 글자 밑 비율(%).

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DonutRow, 상태 } from '../_lib/type-status'

// 표시 순서·색은 유형에 고정 배정 — 목록에 없는 유형이 와도 버리지 않고 뒤에 회색으로 그린다.
const 유형순서 = ['단가', '총가', '민수', '미분류']
const 상태순서: 상태[] = ['완료', '진행중', '미진행', '미분류']
const 유형색: Record<string, string> = { 단가: '#22c55e', 총가: '#f59e0b', 민수: '#3b82f6', 미분류: '#94a3b8' }
const 기본색 = '#94a3b8'
// 미분류 상태는 투명도 대신 명시적 회색 — "안 보이는 것"과 "분류 안 된 것"은 다른 메시지.
const 미분류색 = '#cbd5e1'
const 상태투명도: Record<상태, number> = { 완료: 1, 진행중: 0.6, 미진행: 0.3, 미분류: 1 }

const fmt = (n: number) => n.toLocaleString('ko-KR')
// DB 금액은 원 단위 — 차트는 만원으로 표시(비율 계산은 원 단위 원본으로)
const 만원 = (n: number) => fmt(Math.round(n / 10000))
const RADIAN = Math.PI / 180

type Geom = {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  payload: { 유형: string; 상태?: 상태; 금액: number; 건수: number }
}

export function TypeStatusDonut({ rows }: { rows: DonutRow[] }) {
  // 유형 정렬: 고정 순서 우선, 모르는 유형은 뒤에
  const 순서 = new Map(유형순서.map((t, i) => [t, i]))
  const 유형들 = [...new Set(rows.map((r) => r.유형))].sort(
    (a, b) => (순서.get(a) ?? 99) - (순서.get(b) ?? 99),
  )

  // 유형별 합계 — 요약란·범례용은 금액 0이어도 유지, 도넛 조각은 금액>0만
  const 유형요약 = 유형들.map((t) => {
    const 해당 = rows.filter((r) => r.유형 === t)
    return { 유형: t, 금액: 해당.reduce((s, r) => s + r.금액, 0), 건수: 해당.reduce((s, r) => s + r.건수, 0) }
  })
  const inner = 유형요약.filter((d) => d.금액 > 0)

  // 바깥 링: 유형→상태 순으로 정렬해 안쪽 링과 각도(웨지)가 정렬되게 한다.
  const outer = 유형들
    .flatMap((t) =>
      상태순서
        .map((s) => rows.find((r) => r.유형 === t && r.상태 === s))
        .filter((r): r is DonutRow => !!r),
    )
    .filter((r) => r.금액 > 0)

  // 총계는 조각 필터와 무관하게 전체 rows 기준(금액 0짜리 건수도 포함)
  const 총금액 = rows.reduce((s, r) => s + r.금액, 0)
  const 총건수 = rows.reduce((s, r) => s + r.건수, 0)

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="text-sm font-medium text-gray-600">
          유형별 프로젝트 현황 (금액 및 수량)
          <span className="ml-2 text-xs font-normal text-gray-400">(단위: 만원 · 하도수주금액)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-2 pb-5">
        <div className="relative">
          {/* 사장님 피드백 ②: 우상단 유형별 총 금액·건수 요약란 */}
          <div className="absolute right-0 top-0 z-10 rounded-lg border border-gray-100 bg-white/90 px-3 py-2 shadow-sm">
            {유형요약.map((d) => (
              <div key={d.유형} className="flex items-center gap-1.5 py-0.5 text-xs">
                <span className="inline-block size-2 rounded-sm" style={{ background: 유형색[d.유형] ?? 기본색 }} />
                <span className="w-7 font-medium text-gray-600">{d.유형}</span>
                <span className="tabular-nums text-gray-500">
                  {만원(d.금액)}만원 · {fmt(d.건수)}건
                </span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <PieChart>
              <Tooltip
                isAnimationActive={false}
                wrapperStyle={{ transition: 'none' }}
                content={(props) => {
                  const p = props as unknown as { active?: boolean; payload?: { payload: Geom['payload'] }[] }
                  if (!p.active || !p.payload?.length) return null
                  const d = p.payload[0].payload
                  const 비율 = 총금액 > 0 ? Math.round((d.금액 / 총금액) * 1000) / 10 : 0
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                      <div className="font-medium text-gray-700">
                        {d.유형}
                        {d.상태 ? ` · ${d.상태}` : ''}
                      </div>
                      <div className="mt-0.5 text-gray-500">{만원(d.금액)}만원 · {fmt(d.건수)}건 · {비율}%</div>
                    </div>
                  )
                }}
              />

              {/* 안쪽 링: 유형 */}
              <Pie
                data={inner}
                dataKey="금액"
                nameKey="유형"
                isAnimationActive={false} // 화면 밖에서 마운트되면 애니메이션이 중간 프레임에 얼어붙는 버그 회피
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={58}
                outerRadius={96}
                stroke="#fff"
                strokeWidth={2}
                labelLine={false}
                label={(props) => {
                  const g = props as unknown as Geom
                  // 2% 미만 조각은 두 줄 라벨이 넘쳐서 생략 → 상세는 툴팁·요약란으로.
                  if (총금액 > 0 && g.payload.금액 / 총금액 < 0.02) return <g />
                  const r = (g.innerRadius + g.outerRadius) / 2
                  const x = g.cx + r * Math.cos(-g.midAngle * RADIAN)
                  const y = g.cy + r * Math.sin(-g.midAngle * RADIAN)
                  // 사장님 피드백 ③: 유형 글자 밑에 총계 대비 비율(%)을 두 줄로 표시
                  const 비율 = 총금액 > 0 ? Math.round((g.payload.금액 / 총금액) * 1000) / 10 : 0
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#fff">
                      <tspan x={x} dy={-6} fontSize={12} fontWeight={700}>{g.payload.유형}</tspan>
                      <tspan x={x} dy={13} fontSize={10} fontWeight={600}>{비율}%</tspan>
                    </text>
                  )
                }}
              >
                {inner.map((d) => (
                  <Cell key={d.유형} fill={유형색[d.유형] ?? 기본색} />
                ))}
              </Pie>

              {/* 바깥 링: 유형 × 상태 */}
              <Pie
                data={outer}
                dataKey="금액"
                nameKey="상태"
                isAnimationActive={false} // 위와 동일 — 얼어붙은 중간 프레임 방지
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={108}
                outerRadius={140}
                stroke="#fff"
                strokeWidth={2}
                labelLine
                label={(props) => {
                  const g = props as unknown as Geom
                  // 2% 미만 초소형 조각은 라벨 생략(세로로 겹침) → 상세는 툴팁으로.
                  if (총금액 > 0 && g.payload.금액 / 총금액 < 0.02) return <g />
                  const r = g.outerRadius + 20
                  const x = g.cx + r * Math.cos(-g.midAngle * RADIAN)
                  const y = g.cy + r * Math.sin(-g.midAngle * RADIAN)
                  const anchor = x >= g.cx ? 'start' : 'end'
                  return (
                    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={11}>
                      <tspan fontWeight={600} fill="#475569">{만원(g.payload.금액)}만원</tspan>
                      <tspan fill="#94a3b8"> ({fmt(g.payload.건수)}건)</tspan>
                    </text>
                  )
                }}
              >
                {outer.map((r) => (
                  <Cell
                    key={`${r.유형}-${r.상태}`}
                    fill={r.상태 === '미분류' ? 미분류색 : (유형색[r.유형] ?? 기본색)}
                    fillOpacity={상태투명도[r.상태]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* 가운데 총계 오버레이 */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-gray-400">총계</span>
            <span className="text-lg font-bold text-gray-800">{만원(총금액)}만원</span>
            <span className="text-[11px] text-gray-400">({fmt(총건수)}건)</span>
          </div>
        </div>

        {/* 범례: 색 = 유형, 진하기 = 상태 (실데이터에 있는 항목만) */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {유형들.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: 유형색[t] ?? 기본색 }} />
                {t}
              </span>
            ))}
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-3">
            {상태순서
              .filter((s) => rows.some((r) => r.상태 === s))
              .map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-sm"
                    style={s === '미분류' ? { background: 미분류색 } : { background: '#64748b', opacity: 상태투명도[s] }}
                  />
                  {s}
                </span>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
