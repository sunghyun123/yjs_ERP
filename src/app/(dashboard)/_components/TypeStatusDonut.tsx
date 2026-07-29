'use client'

// 유형(공사구분)×상태별 이중 도넛 — 안쪽 링=유형(색), 바깥 링=유형×상태(진하기).
// 데이터는 서버(TypeStatusDonutSection)가 공사 1건=1행(공사도넛행)으로 내려주고,
// 도넛 조각 합계와 클릭 팝업의 공사 목록은 전부 그 원본에서 렌더 중 파생한다 —
// 같은 원본 하나에서 나오므로 도넛 숫자와 목록이 어긋날 수 없다.
// 금액 = 하도적용수주금액(수주대장과 같은 관대 로직, _lib/type-status.ts) → 합계가 수주대장과 일치.
// 사장님 피드백(2026-07-09): ①관급은 민수에 합산(집계 단계) ②우상단 유형별 요약란 ③안쪽 링 글자 밑 비율(%).

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  연도필터,
  유형상태집계,
  type DonutRow,
  type 공사도넛행,
} from '../_lib/type-status'
import {
  연도목록,
  연도미상,
  연도파싱,
  type 연도선택,
  type 상태,
} from '../_lib/수주분류'

// 표시 순서·색은 유형에 고정 배정 — 목록에 없는 유형이 와도 버리지 않고 뒤에 회색으로 그린다.
const 유형순서 = ['단가', '총가', '민수', '미분류']
const 상태순서: 상태[] = ['완료', '진행중', '미진행']
// 유형 미분류(공사구분 NULL)는 남는다 — 상태 축의 미분류는 소멸(이력 없음 = 미진행 디폴트).
const 유형색: Record<string, string> = { 단가: '#22c55e', 총가: '#f59e0b', 민수: '#3b82f6', 미분류: '#94a3b8' }
const 기본색 = '#94a3b8'
const 상태투명도: Record<상태, number> = { 완료: 1, 진행중: 0.6, 미진행: 0.3 }

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

export function TypeStatusDonut({
  rows: 공사행들,
  초기연도,
}: {
  rows: 공사도넛행[]
  초기연도: 연도선택
}) {
  // state는 사용자 선택 둘뿐 — 연도와 클릭한 조각. 둘 다 계산해 낼 수 없는 원본이다.
  const [선택연도, set선택연도] = useState<연도선택>(초기연도)
  const [선택조각, set선택조각] = useState<{ 유형: string; 상태: 상태 } | null>(null)

  // 도넛이 그리는 값은 전부 (공사행들 + 선택연도)에서 계산되는 파생값 — 렌더 중 계산하고
  // 따로 저장하지 않는다. 저장하면 선택연도와 어긋난 프레임이 생긴다.
  const 연도들 = 연도목록(공사행들)
  const 필터행 = 연도필터(공사행들, 선택연도)
  const rows = 유형상태집계(필터행)

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

  // 팝업 목록도 필터행에서 파생 — 도넛 조각의 건수와 이 목록 길이는 같은 필터를 지나므로 항상 일치.
  const 팝업목록 = 선택조각
    ? 필터행
        .filter((r) => r.유형 === 선택조각.유형 && r.상태 === 선택조각.상태)
        .sort((a, b) => a.지중no.localeCompare(b.지중no))
    : []

  const 연도라벨 =
    선택연도 === '전체' ? '전체 연도' : 선택연도 === 연도미상 ? 연도미상 : `${선택연도}년 수주`

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            유형별 프로젝트 현황 (금액 및 수량)
            <span className="ml-2 text-xs font-normal text-gray-400">
              (단위: 만원 · 하도수주금액 · 조각 클릭 시 공사 목록)
            </span>
          </CardTitle>
          <select
            value={선택연도}
            onChange={(e) => set선택연도(연도파싱(e.target.value))}
            aria-label="수주 연도 선택"
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
          >
            <option value="전체">전체</option>
            {연도들.map((y) => (
              <option key={y} value={y}>
                {y === 연도미상 ? 연도미상 : `${y}년 수주`}
              </option>
            ))}
          </select>
        </div>
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

              {/* 바깥 링: 유형 × 상태 — 조각 클릭이 공사 목록 팝업의 진입점 */}
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
                onClick={(d) => {
                  // recharts는 클릭된 조각의 원본 datum을 payload로 실어준다.
                  const p = (d as { payload?: DonutRow }).payload ?? (d as unknown as DonutRow)
                  if (p?.유형 && p?.상태) set선택조각({ 유형: p.유형, 상태: p.상태 })
                }}
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
                    cursor="pointer"
                    fill={유형색[r.유형] ?? 기본색}
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
                    style={{ background: '#64748b', opacity: 상태투명도[s] }}
                  />
                  {s}
                </span>
              ))}
          </div>
        </div>
      </CardContent>

      {/* 조각 클릭 팝업: 우측 시트에 해당 유형×상태의 공사 목록(지중no·공사명) */}
      <Sheet open={선택조각 !== null} onOpenChange={(open) => { if (!open) set선택조각(null) }}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {선택조각?.유형} · {선택조각?.상태}
            </SheetTitle>
            <SheetDescription>
              {연도라벨} · {fmt(팝업목록.length)}건 · 금액 단위: 만원(하도수주금액)
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {팝업목록.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">해당하는 공사가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {팝업목록.map((r, i) => (
                  <li key={r.지중no} className="flex items-baseline gap-3 py-2 text-sm">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-300">{i + 1}</span>
                    <span className="shrink-0 font-mono text-xs font-medium text-gray-500">{r.지중no}</span>
                    <span className="min-w-0 flex-1 break-keep text-gray-800">{r.공사명}</span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500">{만원(r.금액)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
