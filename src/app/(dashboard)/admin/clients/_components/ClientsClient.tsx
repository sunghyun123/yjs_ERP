'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, AlertCircle, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 거래처Row } from '@/types/database'

type FormState = {
  거래처코드: string
  거래처명: string
  법인: string
  보험료제외율: string
  하도전용율: string
  비고: string
}

const emptyForm: FormState = {
  거래처코드: '', 거래처명: '', 법인: '', 보험료제외율: '', 하도전용율: '', 비고: '',
}

function rowToForm(row: 거래처Row): FormState {
  return {
    거래처코드: row.거래처코드,
    거래처명: row.거래처명,
    법인: row.법인 ?? '',
    보험료제외율: row.보험료제외율 != null ? String(row.보험료제외율 * 100) : '',
    하도전용율: row.하도전용율 != null ? String(row.하도전용율 * 100) : '',
    비고: row.비고 ?? '',
  }
}

export function ClientsClient({ initialRows }: { initialRows: 거래처Row[] }) {
  const [rows, setRows] = useState(initialRows)
  const [query, setQuery] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editRow, setEditRow] = useState<거래처Row | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const openNew = () => {
    setEditRow(null)
    setForm(emptyForm)
    setSheetOpen(true)
  }

  const openEdit = (row: 거래처Row) => {
    setEditRow(row)
    setForm(rowToForm(row))
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setEditRow(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.거래처코드.trim()) { showToast(false, '거래처코드를 입력하세요.'); return }
    if (!form.거래처명.trim()) { showToast(false, '거래처명을 입력하세요.'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      거래처코드: form.거래처코드.trim(),
      거래처명: form.거래처명.trim(),
      법인: form.법인.trim() || null,
      보험료제외율: form.보험료제외율 !== '' ? parseFloat(form.보험료제외율) / 100 : null,
      하도전용율: form.하도전용율 !== '' ? parseFloat(form.하도전용율) / 100 : null,
      비고: form.비고.trim() || null,
    }

    if (editRow) {
      const { data, error } = await (supabase.from('거래처') as any)
        .update(payload)
        .eq('id', editRow.id)
        .select()
        .single()
      setSaving(false)
      if (error) { showToast(false, '저장에 실패했습니다.'); return }
      setRows(prev => prev.map(r => r.id === editRow.id ? (data as 거래처Row) : r))
      showToast(true, '수정되었습니다.')
      closeSheet()
    } else {
      const { data, error } = await (supabase.from('거래처') as any)
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (error) {
        const msg = error.message?.includes('거래처코드') ? '이미 등록된 코드입니다.' : '저장에 실패했습니다.'
        showToast(false, msg)
        return
      }
      setRows(prev =>
        [...prev, data as 거래처Row].sort((a, b) => a.거래처명.localeCompare(b.거래처명, 'ko'))
      )
      showToast(true, '등록되었습니다.')
      closeSheet()
    }
  }

  const handleDelete = async () => {
    if (!editRow) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase.from('거래처') as any).delete().eq('id', editRow.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    setRows(prev => prev.filter(r => r.id !== editRow.id))
    showToast(true, '삭제되었습니다.')
    closeSheet()
  }

  const filtered = query.trim()
    ? rows.filter(r =>
        r.거래처명.toLowerCase().includes(query.toLowerCase()) ||
        r.거래처코드.toLowerCase().includes(query.toLowerCase())
      )
    : rows

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

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="거래처명 또는 코드 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={openNew}>+ 새 거래처</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">거래처코드</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">거래처명</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">법인</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">보험료제외율</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">하도전용율</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">비고</th>
              <th className="py-2.5 px-4 bg-gray-50" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-gray-50 hover:bg-blue-50/40',
                  i % 2 === 1 && 'bg-gray-50/50',
                )}
              >
                <td className="py-2.5 px-4">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.거래처코드}</code>
                </td>
                <td className="py-2.5 px-4 font-medium">{row.거래처명}</td>
                <td className="py-2.5 px-4 text-gray-500">{row.법인 ?? '—'}</td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {row.보험료제외율 != null ? `${(row.보험료제외율 * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {row.하도전용율 != null ? `${(row.하도전용율 * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{row.비고 ?? ''}</td>
                <td className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-xs border border-gray-200 rounded-md px-2.5 py-1 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    수정
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-gray-400">
                  거래처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">총 {rows.length}개 거래처</p>

      <Sheet open={sheetOpen} onOpenChange={open => { if (!open) closeSheet() }}>
        <SheetContent className="w-[380px] sm:max-w-[380px] flex flex-col p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{editRow ? '거래처 수정' : '새 거래처'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                거래처코드 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.거래처코드}
                onChange={e => setForm(f => ({ ...f, 거래처코드: e.target.value }))}
                disabled={!!editRow}
                className={cn(!!editRow && 'bg-gray-50 text-gray-400')}
              />
              {editRow && <p className="text-xs text-gray-400">등록 후 변경 불가</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                거래처명 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.거래처명}
                onChange={e => setForm(f => ({ ...f, 거래처명: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">법인</Label>
              <Input
                value={form.법인}
                onChange={e => setForm(f => ({ ...f, 법인: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  보험료제외율 (%)
                </Label>
                <Input
                  value={form.보험료제외율}
                  onChange={e => setForm(f => ({ ...f, 보험료제외율: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  하도전용율 (%)
                </Label>
                <Input
                  value={form.하도전용율}
                  onChange={e => setForm(f => ({ ...f, 하도전용율: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">비고</Label>
              <Textarea
                value={form.비고}
                onChange={e => setForm(f => ({ ...f, 비고: e.target.value }))}
                className="resize-none h-20"
              />
            </div>
          </div>
          <SheetFooter className="border-t px-6 py-4">
            <div className="flex w-full gap-2">
              {editRow && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={closeSheet}>
                  취소
                </Button>
                <Button size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
