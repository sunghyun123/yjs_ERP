'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { EquipmentData } from '@/lib/equipment/types'
import { refreshEquipment } from '../actions'
import { StockControl } from './StockControl'

export function StockClient({ initialData, isAdmin }: { initialData: EquipmentData; isAdmin: boolean }) {
  const [data, setData] = useState(initialData)
  async function refresh() { setData((await refreshEquipment()).data) }
  const locations = data.blocks.filter(b => b.kind === '서랍' || b.kind === '보관' || data.stocks.some(s => s.block_id === b.id))
  return <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8"><div><Link href="/assets" className="text-sm text-blue-700">← 영전사 전산 현황</Link><h1 className="mt-3 text-2xl font-semibold">장비 재고</h1><p className="mt-1 text-sm text-slate-500">장소별 수량품 · 미확인 수량은 실사 후 입력해 주세요.</p></div>
    {[...locations.map(b => ({ id: b.id as string | null, name: `${b.floor_id}층 · ${b.name}`, note: b.note })), { id: null, name: '미배치 수량품', note: null }].map(b => <section key={b.id ?? 'none'} className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{b.name}</h2>{b.note && <p className="mt-2 text-sm text-amber-800">{b.note}</p>}<div className="divide-y">{data.stocks.filter(s=>s.block_id===b.id).map(s=><div key={s.id} className="space-y-2 py-4"><h3 className="text-sm font-medium">{s.name}{s.specification ? ` · ${s.specification}` : ''}</h3><StockControl item={s} isAdmin={isAdmin} onSaved={refresh}/>{s.note && <p className="text-xs text-slate-500">{s.note}</p>}</div>)}</div>{!data.stocks.some(s=>s.block_id===b.id) && <p className="mt-3 text-sm text-slate-500">등록된 수량품 없음 · 실제 재고 없음으로 확인된 것은 아닙니다.</p>}</section>)}
  </div>
}
