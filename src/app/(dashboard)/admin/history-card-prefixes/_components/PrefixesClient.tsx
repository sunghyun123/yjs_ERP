'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { 이력카드_머리글자Row, 거래처Row } from '@/types/database'

type 거래처요약 = Pick<거래처Row, 'id' | '거래처명' | '보험료제외율' | '하도전용율'>
type FormState = { 머리글자: string; 이름: string; 거래처_id: string; 사용: boolean; 정렬: string }

const emptyForm: FormState = { 머리글자: '', 이름: '', 거래처_id: '', 사용: true, 정렬: '0' }

const 요율표시 = (c: 거래처요약 | undefined) =>
  !c ? '없음 (카드에 확인 필요)'
    : `${c.거래처명} · 보험료 ${c.보험료제외율 != null ? c.보험료제외율 * 100 : '-'}% · 하도 ${c.하도전용율 != null ? c.하도전용율 * 100 : '-'}%`

export function PrefixesClient({ initialRows, 거래처목록 }: { initialRows: 이력카드_머리글자Row[]; 거래처목록: 거래처요약[] }) {
  const [rows, setRows] = useState(initialRows)
  const [editRow, setEditRow] = useState<이력카드_머리글자Row | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const 거래처by = useMemo(() => new Map(거래처목록.map(c => [c.id, c])), [거래처목록])

  function openEdit(row: 이력카드_머리글자Row | null) {
    setEditRow(row)
    setForm(row
      ? { 머리글자: row.머리글자, 이름: row.이름, 거래처_id: row.거래처_id != null ? String(row.거래처_id) : '', 사용: row.사용, 정렬: String(row.정렬) }
      : emptyForm)
    setMsg(null)
    setOpen(true)
  }

  async function save() {
    const 머리글자 = form.머리글자.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(머리글자)) { setMsg('머리글자는 영문 대문자 2글자입니다.'); return }
    if (!form.이름.trim()) { setMsg('이름을 입력하세요.'); return }
    const 정렬 = parseInt(form.정렬, 10)
    if (Number.isNaN(정렬)) { setMsg('정렬은 숫자입니다.'); return }
    // 화면에서 칸을 없애지 않았으므로 모든 키를 보낸다. 거래처 비움 = 명시적 null(요율 없음)
    const payload = { 머리글자, 이름: form.이름.trim(), 거래처_id: form.거래처_id ? Number(form.거래처_id) : null, 사용: form.사용, 정렬 }
    setSaving(true)
    const q = editRow
      ? supabase.from('이력카드_머리글자').update(payload).eq('id', editRow.id).select().single()
      : supabase.from('이력카드_머리글자').insert(payload).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) { setMsg(error.code === '23505' ? '이미 있는 머리글자입니다.' : '저장에 실패했습니다.'); return }
    const saved = data as 이력카드_머리글자Row
    setRows(prev => (editRow ? prev.map(r => (r.id === saved.id ? saved : r)) : [...prev, saved]).sort((a, b) => a.정렬 - b.정렬 || a.id - b.id))
    setOpen(false)
  }

  return (
    <>
      <div className="mb-3"><Button onClick={() => openEdit(null)}>규칙 추가</Button></div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr><th className="p-2 text-left">머리글자</th><th className="p-2 text-left">이름</th><th className="p-2 text-left">요율 거래처</th><th className="p-2">사용</th><th className="p-2">정렬</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => openEdit(r)} className="border-t cursor-pointer hover:bg-gray-50">
                <td className="p-2 font-mono font-semibold">{r.머리글자}</td>
                <td className="p-2">{r.이름}</td>
                <td className="p-2 text-gray-600">{요율표시(r.거래처_id != null ? 거래처by.get(r.거래처_id) : undefined)}</td>
                <td className="p-2 text-center">{r.사용 ? '사용' : <span className="text-gray-400">끔</span>}</td>
                <td className="p-2 text-center">{r.정렬}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editRow ? '규칙 수정' : '규칙 추가'}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4">
            <div><Label>머리글자</Label><Input value={form.머리글자} maxLength={2} onChange={e => setForm({ ...form, 머리글자: e.target.value })} /></div>
            <div><Label>이름</Label><Input value={form.이름} onChange={e => setForm({ ...form, 이름: e.target.value })} /></div>
            <div>
              <Label>요율 거래처 (새 공사의 영전사금액 계산용)</Label>
              <select className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm" value={form.거래처_id}
                onChange={e => setForm({ ...form, 거래처_id: e.target.value })}>
                <option value="">없음 — 카드에 &apos;확인 필요&apos;</option>
                {거래처목록.map(c => <option key={c.id} value={c.id}>{c.거래처명}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{요율표시(form.거래처_id ? 거래처by.get(Number(form.거래처_id)) : undefined)}</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.사용} onChange={e => setForm({ ...form, 사용: e.target.checked })} />생성 화면에 보이기</label>
            <div><Label>정렬</Label><Input inputMode="numeric" value={form.정렬} onChange={e => setForm({ ...form, 정렬: e.target.value })} /></div>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
          </div>
          <SheetFooter><Button onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
