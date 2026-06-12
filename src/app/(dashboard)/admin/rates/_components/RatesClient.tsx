'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 공사단가Row } from '@/types/database'

type EditValues = { 주간단가: string; 야간단가: string; 적용시작일: string }
type AddValues  = { 투입구분: string; 주간단가: string; 야간단가: string; 적용시작일: string }

function today() { return new Date().toISOString().slice(0, 10) }

export function RatesClient({ initialRows }: { initialRows: 공사단가Row[] }) {
  const [rows, setRows]           = useState(initialRows)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<EditValues>({ 주간단가: '', 야간단가: '', 적용시작일: '' })
  const [adding, setAdding]       = useState(false)
  const [addValues, setAddValues] = useState<AddValues>({
    투입구분: '', 주간단가: '', 야간단가: '', 적용시작일: today(),
  })
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase                  = useMemo(() => createClient(), [])

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  const showToast = (ok: boolean, msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ ok, msg })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  const startEdit = (row: 공사단가Row) => {
    setEditingId(row.id)
    setEditValues({
      주간단가:  String(row.주간단가),
      야간단가:  row.야간단가 != null ? String(row.야간단가) : '',
      적용시작일: row.적용시작일,
    })
    setAdding(false)
  }

  const handleSaveEdit = async (row: 공사단가Row) => {
    setSaving(true)
    const { data, error } = await (supabase.from('공사단가') as any)
      .update({
        주간단가:   parseInt(editValues.주간단가.replace(/,/g, ''), 10) || 0,
        야간단가:   editValues.야간단가 !== '' ? parseInt(editValues.야간단가.replace(/,/g, ''), 10) : null,
        적용시작일: editValues.적용시작일,
      })
      .eq('id', row.id)
      .select()
      .single()
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    setRows(prev => prev.map(r => r.id === row.id ? (data as 공사단가Row) : r))
    setEditingId(null)
    showToast(true, '수정되었습니다.')
  }

  const handleDelete = async (row: 공사단가Row) => {
    const { error } = await (supabase.from('공사단가') as any).delete().eq('id', row.id)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    setRows(prev => prev.filter(r => r.id !== row.id))
    showToast(true, '삭제되었습니다.')
  }

  const handleAdd = async () => {
    if (!addValues.투입구분.trim()) { showToast(false, '투입구분을 입력하세요.'); return }
    setSaving(true)
    const { data, error } = await (supabase.from('공사단가') as any)
      .insert({
        투입구분:   addValues.투입구분.trim(),
        주간단가:   parseInt(addValues.주간단가.replace(/,/g, ''), 10) || 0,
        야간단가:   addValues.야간단가 !== '' ? parseInt(addValues.야간단가.replace(/,/g, ''), 10) : null,
        적용시작일: addValues.적용시작일,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    setRows(prev => [...prev, data as 공사단가Row])
    setAdding(false)
    setAddValues({ 투입구분: '', 주간단가: '', 야간단가: '', 적용시작일: today() })
    showToast(true, '추가되었습니다.')
  }

  const busy = editingId !== null || adding

  return (
    <>
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
          toast.ok ? 'bg-green-500' : 'bg-red-500',
        )}>
          {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-center mb-4">
        <Button
          size="sm"
          onClick={() => { setAdding(true); setEditingId(null) }}
          disabled={adding}
        >
          + 항목 추가
        </Button>
        <span className="text-xs text-gray-400">수정 버튼 클릭 → 인라인 편집</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-3xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">투입구분</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">주간단가</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">야간단가</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">적용시작일</th>
              <th className="py-2.5 px-4" colSpan={2} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) =>
              editingId === row.id ? (
                <tr key={row.id} className="bg-blue-50/60 border-b border-blue-100">
                  <td className="py-2 px-4">
                    <span className="inline-block bg-gray-100 text-gray-600 rounded-md px-2.5 py-0.5 text-sm font-medium">
                      {row.투입구분}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      className="h-8 text-sm text-right w-32 ml-auto"
                      value={editValues.주간단가}
                      onChange={e => setEditValues(v => ({ ...v, 주간단가: e.target.value }))}
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      className="h-8 text-sm text-right w-32 ml-auto"
                      value={editValues.야간단가}
                      onChange={e => setEditValues(v => ({ ...v, 야간단가: e.target.value }))}
                      inputMode="numeric"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      type="date"
                      className="h-8 text-sm w-36"
                      value={editValues.적용시작일}
                      onChange={e => setEditValues(v => ({ ...v, 적용시작일: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 px-4" colSpan={2}>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => handleSaveEdit(row)}>
                        {saving ? '...' : '저장'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                        취소
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className={cn('border-b border-gray-50 hover:bg-blue-50/40', i % 2 === 1 && 'bg-gray-50/50')}>
                  <td className="py-2.5 px-4">
                    <span className="inline-block bg-gray-100 text-gray-600 rounded-md px-2.5 py-0.5 text-sm font-medium">
                      {row.투입구분}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                    {row.주간단가.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-gray-500">
                    {row.야간단가 != null ? row.야간단가.toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{row.적용시작일}</td>
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      disabled={busy}
                      className="text-xs border border-gray-200 rounded-md px-2.5 py-1 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      수정
                    </button>
                  </td>
                  <td className="py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              )
            )}

            {adding && (
              <tr className="bg-green-50/50 border-b border-green-100">
                <td className="py-2 px-4">
                  <Input
                    className="h-8 text-sm w-28"
                    placeholder="투입구분"
                    value={addValues.투입구분}
                    onChange={e => setAddValues(v => ({ ...v, 투입구분: e.target.value }))}
                  />
                </td>
                <td className="py-2 px-4">
                  <Input
                    className="h-8 text-sm text-right w-32 ml-auto"
                    placeholder="0"
                    value={addValues.주간단가}
                    onChange={e => setAddValues(v => ({ ...v, 주간단가: e.target.value }))}
                    inputMode="numeric"
                  />
                </td>
                <td className="py-2 px-4">
                  <Input
                    className="h-8 text-sm text-right w-32 ml-auto"
                    placeholder="—"
                    value={addValues.야간단가}
                    onChange={e => setAddValues(v => ({ ...v, 야간단가: e.target.value }))}
                    inputMode="numeric"
                  />
                </td>
                <td className="py-2 px-4">
                  <Input
                    type="date"
                    className="h-8 text-sm w-36"
                    value={addValues.적용시작일}
                    onChange={e => setAddValues(v => ({ ...v, 적용시작일: e.target.value }))}
                  />
                </td>
                <td className="py-2 px-4" colSpan={2}>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={handleAdd}>
                      {saving ? '...' : '추가'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>
                      취소
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {rows.length === 0 && !adding && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  등록된 단가가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        투입구분별 현행 단가 (최신 레코드 기준) · 수정 시 해당 레코드 직접 UPDATE
      </p>
    </>
  )
}
