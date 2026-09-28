// src/app/(dashboard)/gongmu/_components/GongmuActualsView.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { 다음달, 이전달, type 선택상태 } from '../_lib/주차'
import type { 담당자, 담당자별실적 } from '../_lib/erp-실적'
import { ActualsSheet } from './ActualsSheet'

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`

export function GongmuActualsView({
  선택, 실적, 설명, 담당자목록,
}: {
  선택: 선택상태
  실적: 담당자별실적
  설명: string
  담당자목록: 담당자[]
}) {
  // 열린 패널은 key만 기억하고 묶음은 매 렌더 props에서 찾는다 —
  // 담당 지정 후 router.refresh()로 새 집계가 오면 패널 내용도 따라 바뀐다.
  const [열린key, set열린key] = useState<string | null>(null)
  const 열린묶음 = 실적.묶음.find((g) => g.key === 열린key) ?? null

  const [yy, mm] = 선택.월.split('-').map(Number)
  const 월숫자 = (ym: string) => Number(ym.slice(5, 7))
  const navCls = 'border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50'
  const navOff = 'border border-gray-100 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-300 cursor-not-allowed'

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 헤더 · 월 이동 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">공무</h1>
          <p className="text-sm text-gray-500 mt-0.5">{yy}년 {mm}월 · ERP 공사 진행 실적</p>
        </div>
        <div className="flex gap-2">
          {선택.이전가능
            ? <Link href={`/gongmu?month=${이전달(선택.월)}`} className={navCls}>◀ {월숫자(이전달(선택.월))}월</Link>
            : <span className={navOff}>◀ {월숫자(이전달(선택.월))}월</span>}
          <span className="border border-[#1e2d5a] bg-[#1e2d5a] text-white rounded-lg px-3 py-1.5 text-sm font-semibold">{mm}월</span>
          {선택.다음가능
            ? <Link href={`/gongmu?month=${다음달(선택.월)}`} className={navCls}>{월숫자(다음달(선택.월))}월 ▶</Link>
            : <span className={navOff}>{월숫자(다음달(선택.월))}월 ▶</span>}
        </div>
      </div>

      {/* 주 칩 */}
      <div className="flex flex-wrap gap-2 mb-5">
        {선택.주목록.map((w) => (
          <Link
            key={w.월요일}
            href={`/gongmu?month=${선택.월}&week=${w.월요일}`}
            className={cn(
              'rounded-full px-3 py-1 text-xs border',
              w.월요일 === 선택.선택주.월요일
                ? 'bg-[#1e2d5a] border-[#1e2d5a] text-white font-semibold'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {w.label}{w.월요일 === 선택.금주월요일 && ' · 금주'}
          </Link>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">{선택.선택주.label} 실적</p>
            <p className="text-2xl font-bold text-[#1e2d5a] tabular-nums">{천원표기(실적.선택주합천원)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">{mm}월 누적</p>
            <p className="text-2xl font-bold text-[#1e2d5a] tabular-nums">{천원표기(실적.월누적합천원)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">{설명}</p>
      </div>

      {/* 담당자 카드 */}
      <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">
        담당자별 실적 · 누르면 이력 목록
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {실적.묶음.map((g) => {
          const 미지정 = g.종류 === '미지정'
          const 경고 = g.종류 !== '담당' && g.건수 > 0
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => set열린key(g.key)}
              className={cn(
                'text-left rounded-2xl p-5 shadow-sm border-[1.5px] transition-all hover:shadow-md',
                경고 ? 'bg-amber-50 border-amber-300 hover:border-amber-400' : 'bg-white border-transparent hover:border-blue-400',
              )}
            >
              <p className={cn('font-bold mb-2', 경고 ? 'text-amber-800' : 'text-[#1e2d5a]')}>{g.이름}</p>
              {미지정 && g.건수 === 0 ? (
                <p className="text-sm text-green-600 font-semibold">미지정 없음 ✓</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{선택.선택주.주차}주차</p>
                  <p className="text-xl font-bold text-[#1e2d5a] tabular-nums mb-2">{천원표기(g.선택주천원)}</p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    월 누적 {천원표기(g.월누적천원)} · {g.건수}건
                  </p>
                </>
              )}
            </button>
          )
        })}
      </div>

      <ActualsSheet
        묶음={열린묶음}
        주목록={선택.주목록}
        선택월요일={선택.선택주.월요일}
        월={선택.월}
        담당자목록={담당자목록}
        onClose={() => set열린key(null)}
      />
    </div>
  )
}
