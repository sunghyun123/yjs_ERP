'use client'

import { useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertCircle, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 공사현장Row } from '@/types/database'

export function SitesClient({ initialRows }: { initialRows: 공사현장Row[] }) {
  const [rows, setRows] = useState(initialRows)
  const [현장명, set현장명] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const showToast = (ok: boolean, msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ ok, msg })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  const handleAdd = async () => {
    const name = 현장명.trim()
    if (!name) { showToast(false, '현장명을 입력하세요.'); return }
    if (rows.some((r) => r.현장명 === name)) { showToast(false, '이미 등록된 현장입니다.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('공사현장')
      .insert({ 현장명: name }).select().single()
    setSaving(false)
    if (error) { showToast(false, '추가에 실패했습니다.'); return }
    setRows((prev) => [...prev, data as 공사현장Row])  // 생성순: 새 현장은 맨 뒤
    set현장명('')
    showToast(true, '추가되었습니다.')
  }

  const handleDelete = async (row: 공사현장Row) => {
    if (!window.confirm(`'${row.현장명}' 현장을 삭제하시겠습니까?\n기존 수주 데이터에는 영향이 없습니다.`)) return
    setDeletingId(row.id)
    const { error } = await supabase.from('공사현장').delete().eq('id', row.id)
    setDeletingId(null)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    showToast(true, '삭제되었습니다.')
  }

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

      <div className="flex gap-2 mb-4 max-w-md">
        <Input
          className="h-9 text-sm"
          placeholder="현장명 입력 (예: 광명)"
          value={현장명}
          onChange={(e) => set현장명(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button size="sm" onClick={handleAdd} disabled={saving} className="shrink-0">
          <Plus className="size-3.5 mr-1" />
          {saving ? '추가 중...' : '추가'}
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-md">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-12">No</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">현장명</th>
              <th className="py-2.5 px-4 bg-gray-50" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className={cn('border-b border-gray-50 hover:bg-blue-50/40', i % 2 === 1 && 'bg-gray-50/50')}>
                <td className="py-2.5 px-4 text-gray-400 tabular-nums text-xs">{i + 1}</td>
                <td className="py-2.5 px-4 font-medium">{row.현장명}</td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={deletingId === row.id}
                    className="text-xs border border-gray-200 rounded-md px-2.5 py-1 text-red-500 hover:border-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === row.id ? '삭제 중...' : '삭제'}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-sm text-gray-400">등록된 공사현장이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">총 {rows.length}개</p>
    </>
  )
}
