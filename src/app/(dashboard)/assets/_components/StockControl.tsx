'use client'

import { useRef, useState } from 'react'
import type { Stock } from '@/lib/equipment/types'
import { adjustStock } from '../actions'
import { buttonClass, fieldClass } from './ItemEditor'

export function StockControl({ item, isAdmin, onSaved }: { item: Stock; isAdmin: boolean; onSaved: () => Promise<void> }) {
  const [count, setCount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function update(delta: number | null) {
    if (lock.current) return
    const counted = delta === null ? Number(count) : null
    if (delta === null && (!count.trim() || !Number.isSafeInteger(counted) || counted! < 0)) { setError('0 이상의 실사 수량을 입력하세요.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await adjustStock(item.id, item.version, delta, counted, memo.trim() || null)
      if (result.error) setError(result.error)
      else { await onSaved(); setCount(''); setMemo('') }
    } catch { setError('처리 결과를 확인하지 못했습니다. 새로고침 후 수량을 확인해 주세요.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="space-y-2">
    <div className="flex items-center gap-3"><strong className={item.quantity === null ? 'text-amber-700' : 'text-slate-900'}>{item.quantity === null ? '수량 미확인' : `${item.quantity}개`}</strong><span className="text-xs text-slate-500">{item.status}</span>
      {isAdmin && item.quantity !== null && <><button aria-label={`${item.name} 1개 감소`} className={buttonClass} disabled={busy || item.quantity === 0} onClick={() => void update(-1)}>−</button><button aria-label={`${item.name} 1개 증가`} className={buttonClass} disabled={busy} onClick={() => void update(1)}>+</button></>}
    </div>
    <p className="text-xs text-slate-500">실사 확인: {item.last_checked ?? '미등록'} · 수정: {item.updated_at.slice(0,10)}</p>
    {isAdmin && <details><summary className="cursor-pointer text-sm text-blue-700">실사 수량 입력 / 변동 메모</summary><div className="mt-2 space-y-2"><input aria-label="실사 수량" type="number" min="0" step="1" value={count} onChange={e=>setCount(e.target.value)} placeholder="확인한 수량 (0 포함)" className={fieldClass}/><input aria-label="변동 메모" value={memo} onChange={e=>setMemo(e.target.value)} maxLength={1000} placeholder="변동 메모 (선택)" className={fieldClass}/><button disabled={busy} className={buttonClass} onClick={()=>void update(null)}>실사 완료로 저장</button></div></details>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>
}
