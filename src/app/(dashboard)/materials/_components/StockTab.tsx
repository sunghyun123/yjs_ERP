// src/app/(dashboard)/materials/_components/StockTab.tsx
'use client'

import type { 자재_선종Row } from '@/types/database'
import { calc스탯, group칩, type Derived드럼 } from '../_lib/derive'

interface Props {
  선종들: 자재_선종Row[]
  드럼들: Derived드럼[]
  전압: '고압' | '저압'
  set전압: (v: '고압' | '저압') => void
  openIn: () => void
  openOut: () => void
  openHist: (드럼ids: number[]) => void
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

export function StockTab({ 선종들, 드럼들, 전압, set전압, openIn, openOut, openHist }: Props) {
  const 스탯 = calc스탯(드럼들, 선종들)
  const 표시선종 = 선종들.filter((s) => s.전압 === 전압)
  const barColor = 전압 === '고압' ? '#3d5af1' : '#22c55e'

  return (
    <div>
      {/* 요약 타일 */}
      <div className="grid grid-cols-3 gap-2 mb-3.5 md:max-w-[560px]">
        {([
          ['고압 재고', 스탯.고압재고, 'm'],
          ['저압 재고', 스탯.저압재고, 'm'],
          ['잔재 드럼', 스탯.잔재드럼수, '개'],
        ] as const).map(([lb, v, unit]) => (
          <div key={lb} className="bg-white rounded-[14px] shadow-sm px-3 py-2.5">
            <p className="text-[11.5px] text-slate-500">{lb}</p>
            <p className="text-[19px] font-bold tabular-nums tracking-tight">
              {fmt(v)}<small className="text-xs font-semibold text-slate-500 ml-0.5">{unit}</small>
            </p>
          </div>
        ))}
      </div>

      {/* 빠른 기록 */}
      <div className="grid grid-cols-2 gap-2 mb-3.5 md:max-w-[420px]">
        <button onClick={openIn} className="rounded-[10px] py-3 text-[15px] font-bold bg-[#3d5af1] text-white">＋ 입고 기록</button>
        <button onClick={openOut} className="rounded-[10px] py-3 text-[15px] font-bold bg-white border border-slate-200 shadow-sm">− 출고 기록</button>
      </div>

      {/* 고압/저압 세그먼트 */}
      <div className="grid grid-cols-2 gap-1 bg-slate-50 rounded-xl p-1 mb-3 md:max-w-[420px]" role="tablist">
        {(['고압', '저압'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={전압 === v}
            onClick={() => set전압(v)}
            className={`rounded-[9px] py-2 text-sm font-bold ${전압 === v ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* 케이블 카드 */}
      <div className="grid gap-2.5 md:grid-cols-2">
        {표시선종.map((s) => {
          const 소속 = 드럼들.filter((d) => d.선종_id === s.id && d.상태 !== '소진')
          const 재고분 = 소속.filter((d) => d.상태 === '재고')
          const 칩들 = group칩(소속)
          const 총잔량 = 재고분.reduce((sum, d) => sum + d.잔량, 0)
          const 잔재만 = 재고분.length > 0 && 재고분.every((d) => d.잔재)
          return (
            <article key={s.id} className="bg-white rounded-[14px] shadow-sm px-3.5 pt-3.5 pb-3">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xl font-bold tracking-tight">{s.코드}</span>
                {잔재만 && <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">잔재만 남음</span>}
                <div className="ml-auto text-right">
                  <p className="text-[19px] font-bold tabular-nums tracking-tight">
                    {fmt(총잔량)}<small className="text-xs font-semibold text-slate-500"> m</small>
                  </p>
                  <p className="text-[11.5px] text-slate-500">드럼 {재고분.length}개</p>
                </div>
              </div>
              {재고분.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">재고 없음</p>
              ) : (
                <div className="flex gap-0.5 h-[9px] my-2">
                  {[...재고분].sort((a, b) => b.잔량 - a.잔량).map((d) => (
                    <span
                      key={d.id}
                      className="rounded-[3px] min-w-[5px]"
                      style={{ flexGrow: d.잔량, backgroundColor: barColor, opacity: d.잔재 ? 0.4 : 1 }}
                    />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {칩들.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => openHist(c.드럼ids)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] bg-slate-50 border border-slate-200 ${c.잔재 || c.출고중 ? 'border-dashed' : ''}`}
                  >
                    <b className="tabular-nums">{fmt(c.잔량)}m ×{c.개수}</b>
                    {c.제조표기 && <span className="text-slate-500">{c.제조표기}</span>}
                    {c.잔재 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5">잔재</span>}
                    {c.출고중 && <span className="text-[10px] font-bold text-blue-700 bg-blue-100 rounded-full px-1.5">출고 중</span>}
                  </button>
                ))}
              </div>
            </article>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-2.5 mx-0.5">
        막대는 드럼 하나씩, 길이는 남은 미터수 비율입니다. 흐린 막대·점선 칩은 잔재 드럼. 드럼을 누르면 이력이 열립니다.
      </p>
    </div>
  )
}
