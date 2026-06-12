'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertCircle, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 공무담당자Row } from '@/types/database'

export function GongmuClient({ initialRows }: { initialRows: 공무담당자Row[] }) {
  const [rows, setRows] = useState(initialRows)
  const [query, setQuery] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editRow, setEditRow] = useState<공무담당자Row | null>(null)
  const [이름, set이름] = useState('')
  const [등록일, set등록일] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const showToast = (ok: boolean, msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ ok, msg })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  const today = () => new Date().toISOString().slice(0, 10)

  const openNew = () => {
    setEditRow(null)
    set이름('')
    set등록일(today())
    setSheetOpen(true)
  }

  const openEdit = (row: 공무담당자Row) => {
    setEditRow(row)
    set이름(row.이름)
    set등록일(row.생성일.slice(0, 10))
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setEditRow(null)
    set이름('')
    set등록일('')
  }

  const handleSave = async () => {
    if (!이름.trim()) { showToast(false, '이름을 입력하세요.'); return }
    if (!등록일) { showToast(false, '등록일을 입력하세요.'); return }
    setSaving(true)
    const payload = { 이름: 이름.trim(), 생성일: 등록일 }

    if (editRow) {
      const { data, error } = await (supabase.from('공무담당자') as any)
        .update(payload)
        .eq('id', editRow.id)
        .select()
        .single()
      setSaving(false)
      if (error) { showToast(false, '저장에 실패했습니다.'); return }
      setRows(prev => prev.map(r => r.id === editRow.id ? (data as 공무담당자Row) : r))
      showToast(true, '수정되었습니다.')
      closeSheet()
    } else {
      const { data, error } = await (supabase.from('공무담당자') as any)
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (error) { showToast(false, '저장에 실패했습니다.'); return }
      setRows(prev => [...prev, data as 공무담당자Row])
      showToast(true, '등록되었습니다.')
      closeSheet()
    }
  }

  const handleDelete = async () => {
    if (!editRow) return
    setDeleting(true)
    const { error } = await (supabase.from('공무담당자') as any).delete().eq('id', editRow.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    setRows(prev => prev.filter(r => r.id !== editRow.id))
    showToast(true, '삭제되었습니다.')
    closeSheet()
  }

  const filtered = query.trim()
    ? rows.filter(r => r.이름.toLowerCase().includes(query.toLowerCase()))
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
            placeholder="이름 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={openNew}>+ 새 담당자</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-12">No</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">이름</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">등록일</th>
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
                <td className="py-2.5 px-4 text-gray-400 tabular-nums text-xs">{i + 1}</td>
                <td className="py-2.5 px-4 font-medium">{row.이름}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs tabular-nums">
                  {new Date(row.생성일).toLocaleDateString('ko-KR')}
                </td>
                <td className="py-2.5 px-4 text-right">
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
                <td colSpan={4} className="py-10 text-center text-sm text-gray-400">
                  {query.trim() ? '검색 결과가 없습니다.' : '등록된 공무담당자가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {query.trim() ? `${filtered.length}개 검색결과 (전체 ${rows.length}개)` : `총 ${rows.length}명`}
      </p>

      <Sheet open={sheetOpen} onOpenChange={open => { if (!open && !saving && !deleting) closeSheet() }}>
        <SheetContent className="w-[360px] sm:max-w-[360px] flex flex-col p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{editRow ? '담당자 수정' : '새 담당자'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={이름}
                onChange={e => set이름(e.target.value)}
                placeholder="홍길동"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                등록일 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={등록일}
                onChange={e => set등록일(e.target.value)}
              />
              <p className="text-xs text-gray-400">이 날짜 이전 달 보고서에는 카드가 표시되지 않습니다.</p>
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
