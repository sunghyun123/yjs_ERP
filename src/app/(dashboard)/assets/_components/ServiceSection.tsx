'use client'
import { useState } from 'react'
import type { Asset, Service } from '@/lib/equipment/types'
import { renewalLabel, sortByRenewal } from '@/lib/equipment/derive'
import { buttonClass } from './ItemEditor'
import { ServiceEditor } from './ServiceEditor'

export function ServiceSection({ services, assets, isAdmin, onSaved }: { services: Service[]; assets: Asset[]; isAdmin: boolean; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  return <>
    <details className="rounded-xl border bg-white">
      <summary className="cursor-pointer px-5 py-4 font-semibold">서비스 · 구독 {services.length}건 <span className="ml-2 text-sm font-normal text-slate-500">층 구분 없음 · 상태 미측정</span></summary>
      {isAdmin && <button className={`${buttonClass} ml-4`} onClick={() => setEditing('new')}>서비스 등록</button>}
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {sortByRenewal(services).map(s => <article key={s.id} className="rounded-lg border p-4">
          <div className="flex justify-between gap-2"><h3 className="font-semibold">{s.name}</h3><span className="text-xs text-slate-500">미측정</span></div>
          <p className="mt-1 text-sm text-slate-600">{s.purpose}</p>
          <p className="mt-3 text-sm">{s.amount === null ? '금액 미등록' : `${s.currency === 'USD' ? '$' : s.currency === 'KRW' ? '₩' : '통화 미확인 '}${s.amount.toLocaleString('ko-KR')} / ${s.billing_unit ?? '단위 미등록'} · ${s.cycle ?? '주기 미등록'}`}{s.users ? ` · ${s.users}명` : ''}</p>
          <p className="mt-1 text-sm text-blue-700">{renewalLabel(s.renewal_date)}{s.renewal_date ? ` (${s.renewal_date})` : ''}</p>
          {s.needs_review && <p className="mt-2 text-xs text-amber-800">결제주기·연 환산액 원본 확인 필요</p>}
          {s.note && <p className="mt-2 text-xs text-slate-600">{s.note}</p>}
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-slate-500">업체·계정 소유·원본 상세</summary>
            <p className="my-2">{s.vendor} · {s.account_owner}</p>
            <dl className="space-y-2 break-words">{Object.entries(s.source).map(([k, v]) => <div key={k}><dt className="text-slate-500">원본 {k}</dt><dd>{v === null ? '미등록' : String(v)}</dd></div>)}</dl>
          </details>
          {isAdmin && <button className={`${buttonClass} mt-3`} onClick={() => setEditing(s)}>서비스 수정</button>}
        </article>)}
      </div>
    </details>
    {editing && <ServiceEditor service={editing === 'new' ? undefined : editing} assets={assets} onSaved={onSaved} onClose={() => setEditing(null)} />}
  </>
}
