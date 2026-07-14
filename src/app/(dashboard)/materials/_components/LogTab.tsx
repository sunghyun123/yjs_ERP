// src/app/(dashboard)/materials/_components/LogTab.tsx
'use client'

import { useState } from 'react'
import type { FeedItem } from '../_lib/derive'

interface Props {
  feed: FeedItem[]
  openIn: () => void
  openOut: () => void
}

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: '입고', label: '입고' },
  { id: '출고', label: '출고' },
  { id: '복귀', label: '잔재 복귀' },
] as const

const TAG_STYLE: Record<FeedItem['type'], string> = {
  입고: 'bg-green-100 text-green-700',
  출고: 'bg-indigo-100 text-indigo-700',
  복귀: 'bg-amber-100 text-amber-700',
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function LogTab({ feed, openIn, openOut }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const shown = filter === 'all' ? feed : feed.filter((f) => f.type === filter)

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3.5 md:max-w-[420px]">
        <button onClick={openIn} className="rounded-[10px] py-3 text-[15px] font-bold bg-[#3d5af1] text-white">＋ 입고 기록</button>
        <button onClick={openOut} className="rounded-[10px] py-3 text-[15px] font-bold bg-white border border-slate-200 shadow-sm">− 출고 기록</button>
      </div>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold border ${
              filter === f.id ? 'bg-[#3d5af1] border-[#3d5af1] text-white' : 'bg-white border-slate-200 text-slate-500'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          {/* 필터로 0건이 된 것과 진짜 빈 피드를 구분 — 입고 기록이 있는데 "입고부터 시작하라"고 안내하면 오해 */}
          {feed.length === 0 ? '기록이 없습니다. 입고 기록부터 시작해 보세요.' : '이 필터에 해당하는 기록이 없습니다.'}
        </p>
      ) : (
        <div className="grid gap-2">
          {shown.map((f) => (
            <div key={f.key} className="bg-white rounded-[14px] shadow-sm px-3 py-2.5 flex gap-2.5 items-start">
              <span className={`text-[11px] font-bold rounded-[7px] px-2 py-0.5 mt-0.5 whitespace-nowrap ${TAG_STYLE[f.type]}`}>
                {f.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{f.line1}</p>
                <p className="text-[12.5px] text-slate-500">{f.line2}</p>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">{shortDate(f.일자)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 mt-2.5 mx-0.5">
        케이블과 기타 자재(접속재·개폐기·변압기)의 기록이 모두 여기에 남습니다.
      </p>
    </div>
  )
}
