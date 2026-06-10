'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Trash2, CheckCircle2, AlertCircle, Search, X } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')

  const [editRow, setEditRow]       = useState<공사이력행 | null>(null)
  const [editDate, setEditDate]     = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
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

  const filteredRows = searchQuery.trim()
    ? rows.filter((r) => {
        const q = searchQuery.trim().toLowerCase()
        return (
          r.수주?.지중no?.toLowerCase().includes(q) ||
          r.수주?.공사명?.toLowerCase().includes(q)
        )
      })
    : rows

  const total = filteredRows.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0)

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

  return (
    <>
      {/* 토스트 */}
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

      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-sm text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : '조회'}
        </Button>

        <div className="relative min-w-44 max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="공사명, 지중No 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <span className="ml-auto text-sm text-gray-500 tabular-nums shrink-0">
          {filteredRows.length.toLocaleString('ko-KR')}건
        </span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">공사명</th>
              <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium w-28">작업일자</th>
              <th className="px-4 py-2.5 text-right text-xs text-gray-700 font-semibold w-36">성과금액</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {loading
                    ? '불러오는 중...'
                    : searchQuery
                      ? `"${searchQuery}"에 해당하는 이력이 없습니다.`
                      : '조회 결과가 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 border-b border-gray-100 last:border-b-0 transition-colors cursor-pointer" onClick={() => openEdit(row)}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-sm text-gray-800">{row.수주?.공사명}</p>
                    <p className="font-mono text-xs text-gray-400">{row.수주?.지중no}</p>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 tabular-nums">{row.작업일자}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800 tabular-nums">
                    {formatKRW(row.성과금액 ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      className="text-[#3d5af1] text-xs hover:underline"
                      onClick={(e) => { e.stopPropagation(); openEdit(row) }}
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50/80 border-t border-gray-200">
                <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-600">
                  합계 ({filteredRows.length}건){searchQuery.trim() && rows.length !== filteredRows.length && <span className="font-normal text-gray-400 ml-1">/ 전체 {rows.length}건</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[#1e2d5a] tabular-nums">
                  {formatKRW(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 수정 Sheet */}
      <Sheet open={editRow != null} onOpenChange={(open) => { if (!open) setEditRow(null) }}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-start gap-2 pr-8">
              <span className="font-mono text-xs text-gray-400 mt-0.5 shrink-0">{editRow?.수주?.지중no}</span>
              <SheetTitle className="text-base font-semibold text-left leading-snug">{editRow?.수주?.공사명}</SheetTitle>
            </div>
            <SheetDescription className="text-left">공사이력 수정</SheetDescription>
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
    </>
  )
}
