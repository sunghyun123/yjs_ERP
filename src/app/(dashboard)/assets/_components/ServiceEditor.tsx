'use client'
import { useRef, useState } from 'react'
import type { Asset, Json, Service } from '@/lib/equipment/types'
import { saveItem } from '../actions'
import { buttonClass, fieldClass } from './ItemEditor'
import { EquipmentDialog } from './EquipmentDialog'

export function ServiceEditor({ service, assets, onSaved, onClose }: { service?: Service; assets: Asset[]; onSaved: () => Promise<void>; onClose: () => void }) {
  const [newId] = useState(()=>crypto.randomUUID())
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const lock = useRef(false)
  async function submit(form: FormData, remove = false) {
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try {
      const payload: Record<string,Json>={id:service?.id??newId,version:service?.version??null,remove}
      for(const k of ['name','purpose','vendor','account_owner','currency','cycle','billing_unit','renewal_date','asset_id','note'])payload[k]=String(form.get(k)??'').trim()||null
      for(const k of ['amount','users'])payload[k]=String(form.get(k)??'').trim()?Number(form.get(k)):null
      payload.needs_review=form.get('needs_review')==='on'
      const result=await saveItem('service',payload)
      if(result.error)setError(result.error)
      else{await onSaved();onClose()}
    }catch{setError('처리 결과를 확인하지 못했습니다. 최신 현황을 확인해 주세요.')}
    finally{lock.current=false;setBusy(false)}
  }
  const label=(title:string,children:React.ReactNode)=><label className="block space-y-1 text-sm text-slate-600">{title}{children}</label>
  return <EquipmentDialog title="서비스 편집" busy={busy} onClose={onClose}><form className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6" onSubmit={e=>{e.preventDefault();void submit(new FormData(e.currentTarget))}}><h2 className="text-lg font-semibold">서비스 {service?'수정':'등록'}</h2><p className="text-xs text-slate-500">비밀번호와 인증키는 입력하지 마세요. 원본 기록은 별도로 보존됩니다.</p><fieldset disabled={busy} className="space-y-3">
    {(['name','purpose','vendor','account_owner'] as const).map(k=><label key={k} className="block text-sm">{{name:'서비스명',purpose:'업무 용도',vendor:'공급업체',account_owner:'계정 소유'}[k]}<input autoFocus={k==='name'} required={k==='name'} name={k} defaultValue={service?.[k]??''} maxLength={150} className={fieldClass}/></label>)}
    <div className="grid grid-cols-2 gap-3">{label('금액',<input type="number" name="amount" min="0" step="0.01" defaultValue={service?.amount??''} className={fieldClass}/>)}{label('통화',<select name="currency" defaultValue={service?.currency??''} className={fieldClass}><option value="">미확인</option><option>KRW</option><option>USD</option></select>)}</div>
    <div className="grid grid-cols-2 gap-3">{label('결제주기',<input name="cycle" defaultValue={service?.cycle??''} placeholder="월 / 연 / 2년 / 무료" className={fieldClass}/>)}{label('과금 단위',<select name="billing_unit" defaultValue={service?.billing_unit??''} className={fieldClass}><option value="">미확인</option><option>전체</option><option>1인</option></select>)}</div>
    {label('사용 인원',<input name="users" type="number" min="1" step="1" defaultValue={service?.users??''} className={fieldClass}/>)}
    {label('갱신·만료일',<input name="renewal_date" type="date" defaultValue={service?.renewal_date??''} className={fieldClass}/>)}
    {label('물리 자산 연결',<select name="asset_id" defaultValue={service?.asset_id??''} className={fieldClass}><option value="">없음</option>{assets.map(a=><option key={a.id} value={a.id}>{a.asset_no} · {a.name}</option>)}</select>)}
    <label className="flex gap-2 text-sm"><input name="needs_review" type="checkbox" defaultChecked={service?.needs_review??false}/>과금 조건 확인 필요</label>
    {label('메모',<textarea name="note" defaultValue={service?.note??''} maxLength={4000} className={fieldClass}/>)}
  </fieldset>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex gap-2"><button disabled={busy} className={buttonClass}>저장</button><button disabled={busy} className={buttonClass} type="button" onClick={onClose}>취소</button>{service&&<button disabled={busy} className={`${buttonClass} ml-auto text-red-700`} type="button" onClick={e=>{if(confirm('서비스 기록을 삭제하시겠습니까?'))void submit(new FormData(e.currentTarget.form!),true)}}>삭제</button>}</div></form></EquipmentDialog>
}
