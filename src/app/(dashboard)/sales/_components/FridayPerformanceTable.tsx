// src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx
'use client'

import { useState } from 'react'
// ⚠️ type 으로만 — 값 import 하면 supabase 조회 코드가 브라우저 번들로 끌려온다
import type { 금요일월성과 } from '../../_lib/금요일성과'
// 주차.ts 는 import 가 없는 순수 날짜 규칙이라 값으로 가져와도 번들에 조회 코드가 따라오지 않는다
import { 최소월 } from '../../gongmu/_lib/주차'
import { FridayDetailDialog, type 줄키, type 표시월 } from './FridayDetailDialog'

/**
 * 금요일 기준 월별 성과 — 시공 기록 / 준공 반영 / 성과 세 줄.
 * 숫자를 누르면 그 달 그 줄의 공사별 목록 팝업(PR-4, 설계 §7-8). 열린 팝업을 state 로 들어야 해서 클라이언트 컴포넌트다.
 * 숫자는 받은 그대로 그리고 여기서 다시 계산하지 않는다 — 표 숫자 = 목록의 합은 _lib 이 보장한다.
 */

const 줄: { 키: 줄키; key: '시공기록천원' | '준공반영천원' | '성과천원'; label: string; hint: string }[] = [
  { 키: '시공', key: '시공기록천원', label: '시공 기록', hint: '공무 화면 월 누적과 같은 숫자' },
  { 키: '반영', key: '준공반영천원', label: '준공 반영', hint: '준공액 − 시공 누계. 시공 기록에 없던 몫' },
  { 키: '성과', key: '성과천원', label: '성과', hint: '시공 기록 + 준공 반영' },
]

function 칸(v: number): string {
  // 0도 숫자로 보인다 — 표시 달의 0은 '기록 없음'이 아니라 '정말 0'이다('—'는 표시 안 하는 달 전용)
  return v.toLocaleString('ko-KR')
}

export function FridayPerformanceTable({ rows }: { rows: 금요일월성과[] }) {
  const [열림, set열림] = useState<{ 월: string; 줄: 줄키 } | null>(null)
  // rows 가 바뀌어(연도 이동) 그 달이 사라지면 자연히 null — 팝업이 닫힌다
  const 열린월 =
    (열림 && rows.find((r): r is 표시월 => r.표시 && r.월 === 열림.월)) || null

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500">
            <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">구분</th>
            {rows.map((r) => (
              <th key={r.월} className="py-2 px-2 text-right font-medium">
                {Number(r.월.slice(5, 7))}월
                {r.표시 && (
                  <div className="text-[10px] font-normal text-gray-400">
                    {Number(r.from.slice(5, 7))}/{Number(r.from.slice(8, 10))}~
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {줄.map(({ 키, key, label, hint }) => (
            <tr
              key={key}
              className={key === '성과천원' ? 'border-t border-gray-200 font-semibold' : 'border-b border-gray-50'}
            >
              <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium text-gray-700" title={hint}>
                {label}
              </th>
              {rows.map((r) => (
                <td key={r.월} className="py-1 px-1 text-right">
                  {r.표시 ? (
                    <button
                      type="button"
                      onClick={() => set열림({ 월: r.월, 줄: 키 })}
                      aria-label={`${Number(r.월.slice(5, 7))}월 ${label} 공사별 상세`}
                      className="rounded px-1.5 py-1 underline decoration-gray-300 decoration-dotted underline-offset-4 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
                      style={{ color: r[key] < 0 ? '#dc2626' : '#374151' }}
                    >
                      {칸(r[key])}
                    </button>
                  ) : (
                    <span className="px-1.5" style={{ color: '#d1d5db' }}>—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-400">
        단위 천원 · 한 주(월~일)는 금요일이 속한 달로 센다(해가 바뀌는 주는 1/1에서 나눈다)
        · {최소월.slice(0, 4)}년 {Number(최소월.slice(5))}월 앞 달과 아직 오지 않은 달은 &apos;—&apos;
        · 숫자를 누르면 공사별 상세 · 정산(청구 금액)은 성과가 아니라 공무 화면·대시보드에서 본다
      </p>
      <FridayDetailDialog
        월={열린월}
        줄={열린월 ? 열림!.줄 : null}
        onClose={() => set열림(null)}
      />
    </div>
  )
}
