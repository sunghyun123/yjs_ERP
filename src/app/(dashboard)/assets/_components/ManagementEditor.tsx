'use client'
import { useRef, useState } from 'react'
import type { ManagementInfo } from '@/lib/equipment/types'
import { getManagementInfo, saveItem } from '../actions'
import { EquipmentDialog } from './EquipmentDialog'
import { buttonClass, fieldClass } from './ItemEditor'

export function ManagementEditor({ assetId }: { assetId: string }) {
  const [info, setInfo] = useState<ManagementInfo | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function load() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { setInfo(await getManagementInfo(assetId)); setOpen(true) }
    catch { setError('관리정보 조회에 실패했습니다.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function submit(form: FormData) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await saveItem('management', { id: info?.id ?? null, version: info?.version ?? null, asset_id: assetId, spec_grade: String(form.get('grade') ?? '') || null, replacement_priority: String(form.get('priority') ?? '') || null })
      if (result.error) setError(result.error)
      else setOpen(false)
    } catch { setError('저장 결과를 확인하지 못했습니다. 다시 열어 최신 내용을 확인해 주세요.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    <button disabled={busy} className={`${buttonClass} mt-3 ml-2`} onClick={() => void load()}>관리정보</button>
    {error && !open && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {open && <EquipmentDialog title="관리자 전용 관리정보" busy={busy} onClose={() => setOpen(false)}>
      <form className="space-y-4 p-6" onSubmit={e => { e.preventDefault(); void submit(new FormData(e.currentTarget)) }}>
        <h2 className="text-lg font-semibold">관리자 전용 관리정보</h2>
        <fieldset disabled={busy} className="space-y-3">
          <label className="block text-sm">스펙 등급<input name="grade" maxLength={100} defaultValue={info?.spec_grade ?? ''} className={fieldClass}/></label>
          <label className="block text-sm">교체 우선순위<input name="priority" maxLength={100} defaultValue={info?.replacement_priority ?? ''} className={fieldClass}/></label>
          {info && <details className="text-xs"><summary>원본 평가 정보</summary><dl className="mt-2 space-y-1">{Object.entries(info.source).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v === null ? '미등록' : String(v)}</dd></div>)}</dl></details>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2"><button disabled={busy} className={buttonClass}>저장</button><button type="button" disabled={busy} className={buttonClass} onClick={() => setOpen(false)}>취소</button></div>
      </form>
    </EquipmentDialog>}
  </>
}
