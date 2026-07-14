// src/app/(dashboard)/materials/_components/MaterialsView.tsx
'use client'

import { useState } from 'react'
import type { 자재_드럼기록Row, 자재_선종Row } from '@/types/database'
import type { Derived드럼, Derived품목, FeedItem } from '../_lib/derive'
import { StockTab } from './StockTab'
import { EtcTab } from './EtcTab'
import { LogTab } from './LogTab'
import { InSheet } from './InSheet'
import { OutSheet } from './OutSheet'
import { HistSheet } from './HistSheet'

export type SheetState =
  | { type: 'in' }
  | { type: 'out' }
  | { type: 'hist'; 드럼ids: number[] }
  | null

const TABS = [
  { id: 'stock', label: '재고', title: '케이블 재고' },
  { id: 'etc', label: '기타 자재', title: '기타 자재' },
  { id: 'log', label: '입·출고 기록', title: '입·출고 기록' },
] as const
type TabId = (typeof TABS)[number]['id']

interface Props {
  선종들: 자재_선종Row[]
  드럼들: Derived드럼[]
  드럼기록들: 자재_드럼기록Row[]
  품목들: Derived품목[]
  feed: FeedItem[]
  공사명목록: string[]
}

export function MaterialsView({ 선종들, 드럼들, 드럼기록들, 품목들, feed, 공사명목록 }: Props) {
  const [tab, setTab] = useState<TabId>('stock')
  const [전압, set전압] = useState<'고압' | '저압'>('고압')
  const [sheet, setSheet] = useState<SheetState>(null)

  const active = TABS.find((t) => t.id === tab)!

  return (
    <div className="max-w-[880px] mx-auto">
      {/* 헤더 */}
      <header className="px-4 pt-4 md:px-6 md:pt-6">
        <p className="text-[11px] font-bold tracking-[.12em] text-[#3d5af1] uppercase">자재관리</p>
        <h1 className="text-xl font-semibold text-gray-900">{active.title}</h1>
      </header>

      {/* PC: 헤더 아래 언더라인 탭 */}
      <nav className="hidden md:flex gap-0.5 border-b-2 border-slate-200 px-6 mt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 -mb-0.5 text-[13.5px] font-bold border-b-2 transition-colors ${
              tab === t.id ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 모바일: 하단 플로팅 pill (MobileTabBar 위) */}
      <nav className="md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex gap-1 bg-white border border-slate-200 rounded-full p-1 shadow-[0_8px_24px_rgba(15,23,42,.14)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }) }}
            className={`px-[18px] py-[9px] rounded-full text-[13.5px] font-bold whitespace-nowrap ${
              tab === t.id ? 'bg-[#3d5af1] text-white' : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="px-4 py-4 md:px-6 md:py-5 pb-32 md:pb-10">
        {tab === 'stock' && (
          <StockTab
            선종들={선종들} 드럼들={드럼들} 전압={전압} set전압={set전압}
            openIn={() => setSheet({ type: 'in' })}
            openOut={() => setSheet({ type: 'out' })}
            openHist={(드럼ids) => setSheet({ type: 'hist', 드럼ids })}
          />
        )}
        {tab === 'etc' && <EtcTab 품목들={품목들} />}
        {tab === 'log' && (
          <LogTab feed={feed} openIn={() => setSheet({ type: 'in' })} openOut={() => setSheet({ type: 'out' })} />
        )}
      </main>

      {/* 시트는 열릴 때만 마운트 — 초기 전압/선종이 열 때마다 새로 잡히도록(state 초기값) */}
      {sheet?.type === 'in' && (
        <InSheet onClose={() => setSheet(null)} 선종들={선종들} 초기전압={전압} 공사명목록={공사명목록} />
      )}
      {sheet?.type === 'out' && (
        <OutSheet onClose={() => setSheet(null)} 선종들={선종들} 드럼들={드럼들} 초기전압={전압} 공사명목록={공사명목록} />
      )}
      {sheet?.type === 'hist' && (
        <HistSheet onClose={() => setSheet(null)} 드럼ids={sheet.드럼ids} 드럼들={드럼들} 기록들={드럼기록들} 선종들={선종들} />
      )}
    </div>
  )
}
