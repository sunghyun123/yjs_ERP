'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 공사이력행 } from '../_types'

function MoneyInput({
  value, onChange, className,
}: { value: number | null; onChange: (v: number | null) => void; className?: string }) {
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('ko-KR') : '')
  useEffect(() => { setDisplay(value != null ? value.toLocaleString('ko-KR') : '') }, [value])
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') { setDisplay(''); onChange(null) }
    else { const n = parseInt(raw, 10); setDisplay(n.toLocaleString('ko-KR')); onChange(n) }
  }
  return <Input value={display} onChange={handleChange} inputMode="numeric" className={className} />
}

type Props = { date_from: string; date_to: string }

export function ProgressHistoryTable({ date_from: initFrom, date_to: initTo }: Props) {
  const [dateFrom, setDateFrom] = useState(initFrom)
  const [dateTo, setDateTo]     = useState(initTo)
  const [rows, setRows]         = useState<공사이력행[]>([])
  const [loading, setLoading]   = useState(false)

  const [editRow, setEditRow]       = useState<공사이력행 | null>(null)
  const [editDate, setEditDate]     = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액, 수주_id, 수주!수주_id(지중no, 공사명)')
      .gte('작업일자', dateFrom)
      .lte('작업일자', dateTo)
      .order('작업일자', { ascending: false }) as { data: 공사이력행[] | null }
    setRows(data ?? [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const openEdit = (row: 공사이력행) => {
    setEditRow(row)
    setEditDate(row.작업일자)
    setEditAmount(row.성과금액)
  }

  const handleSave = async () => {
    if (!editRow) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any)
      .update({ 작업일자: editDate, 성과금액: editAmount })
      .eq('id', editRow.id)
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    showToast(true, '수정되었습니다.')
    setEditRow(null)
    fetchData()
  }

  const handleDelete = async () => {
    if (!editRow) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any).delete().eq('id', editRow.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    showToast(true, '삭제되었습니다.')
    setEditRow(null)
    fetchData()
  }

  const total = rows.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0)

  return (
    <div>
      {toast && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border mb-4 w-fit',
          toast.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200',
        )}>
          {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="flex gap-3 mb-4 items-end">
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">시작일</Label>
          <Input type="date" className="h-9 text-sm w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">종료일</Label>
          <Input type="date" className="h-9 text-sm w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="h-9" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : '조회'}
        </Button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2.5 text-left text-gray-500 font-medium border-b border-gray-200">공사명</th>
              <th className="px-4 py-2.5 text-left text-gray-500 font-medium border-b border-gray-200 w-28">작업일자</th>
              <th className="px-4 py-2.5 text-right text-gray-700 font-semibold border-b border-gray-200 w-36">성과금액</th>
              <th className="px-4 py-2.5 border-b border-gray-200 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {loading ? '불러오는 중...' : '조회 결과가 없습니다.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-400 mr-2">{row.수주?.지중no}</span>
                    <span className="text-gray-800">{row.수주?.공사명}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{row.작업일자}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                    {formatKRW(row.성과금액 ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      className="text-[#3d5af1] text-xs hover:underline"
                      onClick={() => openEdit(row)}
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-600">
                  합계 ({rows.length}건)
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[#1e2d5a]">
                  {formatKRW(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Sheet open={editRow != null} onOpenChange={(open) => { if (!open) setEditRow(null) }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>공사이력 수정</SheetTitle>
            <SheetDescription>{editRow?.수주?.공사명}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
              <Input type="date" className="h-9 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">성과금액</Label>
              <MoneyInput value={editAmount} onChange={setEditAmount} className="h-9 text-sm" />
            </div>
            <Button className="w-full bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              저장
            </Button>
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              삭제
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
