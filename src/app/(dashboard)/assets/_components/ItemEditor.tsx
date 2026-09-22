'use client'

import { useRef, useState } from 'react'
import { assetCategories, stockCategories, useStatuses, type Asset, type Block, type Json, type Person, type Stock } from '@/lib/equipment/types'
import { saveItem } from '../actions'
import { EquipmentDialog } from './EquipmentDialog'

export const fieldClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'
export const buttonClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40'

export function ItemEditor({ kind, item, blockId, blocks, onSaved, onClose }: {
  kind: 'asset' | 'stock' | 'person'; item?: Asset | Stock | Person; blockId: string | null; blocks: Block[]; onSaved: () => Promise<void>; onClose: () => void
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [newId] = useState(() => crypto.randomUUID())
  const asset = item && 'asset_no' in item ? item : undefined
  const stock = item && 'quantity' in item ? item : undefined
  const person = item && 'active' in item ? item : undefined
  async function submit(form: FormData, remove = false) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const text = (key: string) => String(form.get(key) ?? '').trim() || null
      const base = { id: item?.id ?? newId, version: item?.version ?? null, name: text('name'), remove }
      let payload: Json
      if (kind === 'person') payload = { ...base, title: text('title') ?? '', department: text('department'), email: text('email'), active: form.get('active') === 'on', ...(text('phone') ? { phone: text('phone') } : {}) }
      else if (kind === 'asset') payload = { ...base, category: asset?.category ?? text('category'), block_id: text('block_id'), model: text('model'), serial: text('serial'), os: text('os'), status: text('status'), identity_status: text('identity_status'), last_checked: text('last_checked'), note: text('note'), specs: { ...(asset?.specs ?? {}), CPU: text('cpu'), 'RAM(GB)': text('ram'), 저장장치: text('storage') } }
      else payload = { ...base, category: text('category'), block_id: text('block_id'), specification: text('specification'), status: text('status'), quantity: text('quantity') === null ? null : Number(text('quantity')), last_checked: null, note: text('note') }
      const result = await saveItem(kind, payload)
      if (result.error) setError(result.error)
      else { await onSaved(); onClose() }
    } catch { setError('처리 결과를 확인하지 못했습니다. 최신 데이터를 확인한 뒤 다시 시도하세요.') }
    finally { lock.current = false; setBusy(false) }
  }
  const label = (title: string, children: React.ReactNode) => <label className="block space-y-1 text-sm text-slate-600">{title}{children}</label>
  return <EquipmentDialog title={`${kind === 'person' ? '인원' : '장비'} ${item ? '수정' : '등록'}`} busy={busy} onClose={onClose}>
    <form className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onSubmit={e => { e.preventDefault(); void submit(new FormData(e.currentTarget)) }}>
      <h2 className="text-lg font-semibold">{kind === 'person' ? '인원' : kind === 'asset' ? '개별 장비' : '수량품'} {item ? '수정' : '등록'}</h2>
      <fieldset disabled={busy} className="space-y-3">
        {label('이름', <input autoFocus required maxLength={100} name="name" defaultValue={item?.name} className={fieldClass} />)}
        {kind === 'person' ? <>
          {label('직급', <input name="title" defaultValue={person?.title} className={fieldClass} />)}
          {label('부서', <input name="department" defaultValue={person?.department ?? ''} className={fieldClass} />)}
          {label('이메일', <input type="email" name="email" defaultValue={person?.email ?? ''} className={fieldClass} />)}
          {label('휴대폰 (입력한 경우에만 변경)', <input type="tel" name="phone" autoComplete="off" className={fieldClass} />)}
          <label className="flex gap-2"><input type="checkbox" name="active" defaultChecked={person?.active ?? true} />재직 중</label>
          <p className="text-xs text-slate-500">퇴사 처리 시 자리 배정을 해제하며 장비는 보존합니다.</p>
        </> : <>
          <div className="grid grid-cols-2 gap-3">
            {label('분류', <select name="category" disabled={!!asset} defaultValue={asset?.category ?? stock?.category} className={fieldClass}>{(kind === 'asset' ? assetCategories : stockCategories).map(c => <option key={c}>{c}</option>)}</select>)}
            {label('사용 상태', <select name="status" defaultValue={asset?.status ?? stock?.status ?? (kind === 'stock' ? '재고' : '사용중')} className={fieldClass}>{useStatuses.map(s => <option key={s}>{s}</option>)}</select>)}
          </div>
          {label('위치', <select name="block_id" defaultValue={item && 'block_id' in item ? item.block_id ?? '' : blockId ?? ''} className={fieldClass}><option value="">미배치</option>{blocks.map(b => <option key={b.id} value={b.id}>{b.floor_id}층 · {b.name}</option>)}</select>)}
          {kind === 'asset' ? <>
            {label('모델', <input name="model" defaultValue={asset?.model ?? ''} className={fieldClass} />)}
            {label('시리얼', <input name="serial" defaultValue={asset?.serial ?? ''} className={fieldClass} />)}
            {label('운영체제', <input name="os" defaultValue={asset?.os ?? ''} className={fieldClass} />)}
            {label('CPU', <input name="cpu" defaultValue={String(asset?.specs.CPU ?? '')} className={fieldClass} />)}
            <div className="grid grid-cols-2 gap-3">{label('RAM (GB)', <input name="ram" defaultValue={String(asset?.specs['RAM(GB)'] ?? '')} className={fieldClass} />)}{label('저장장치', <input name="storage" defaultValue={String(asset?.specs.저장장치 ?? '')} className={fieldClass} />)}</div>
            {label('실물 중복 확인', <select name="identity_status" defaultValue={asset?.identity_status ?? '확정'} className={fieldClass}><option>확정</option><option>중복미확정</option></select>)}
            {label('최종 실사 확인일', <input type="date" name="last_checked" defaultValue={asset?.last_checked ?? ''} className={fieldClass} />)}
          </> : <>
            {label('규격', <input name="specification" defaultValue={stock?.specification ?? ''} className={fieldClass} />)}
            {!item && label('확인된 수량 (모르면 비워두세요)', <input name="quantity" type="number" min="0" step="1" className={fieldClass} />)}
            {item && <p className="text-sm">수량 변경과 실사 확인은 상세의 수량 버튼을 이용하세요.</p>}
          </>}
          {label('메모', <textarea name="note" maxLength={4000} defaultValue={asset?.note ?? stock?.note ?? ''} className={fieldClass} />)}
        </>}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={buttonClass}>{busy ? '저장 중…' : '저장'}</button>
        <button type="button" disabled={busy} className={buttonClass} onClick={onClose}>취소</button>
        {item && kind !== 'person' && <button type="button" disabled={busy} className={`${buttonClass} ml-auto text-red-700`} onClick={e => { if (confirm('이 장비 기록을 삭제하시겠습니까?')) void submit(new FormData(e.currentTarget.form!), true) }}>삭제</button>}
      </div>
    </form>
  </EquipmentDialog>
}
