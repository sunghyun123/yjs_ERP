'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Loader2, Pencil, Trash2, X, Save,
  CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import { calc투입금액, calc합계 } from '@/app/(dashboard)/_lib/calc'
import { createClient } from '@/lib/supabase/client'
import type { 공사단가Row, 투입실적Row, 투입실적Update } from '@/types/database'
import type { 투입실적행 } from '../_types'

// ── 직종 목록 ─────────────────────────────────────────────────────────────────
const 직종행 = [
  { label: '상용직',        주: '상용직_주',    야: '상용직_야'    },
  { label: '일용직',        주: '일용직_주',    야: '일용직_야'    },
  { label: '모범신호수 (h)', 주: '모범신호수_주', 야: '모범신호수_야' },
  { label: '6W',            주: 'w6_주',        야: 'w6_야'        },
  { label: '3W',            주: 'w3_주',        야: 'w3_야'        },
  { label: '덤프15T',       주: '덤프15t_주',   야: '덤프15t_야'   },
  { label: '크레인',        주: '크레인_주',    야: '크레인_야'    },
  { label: '물청소차',      주: '물청소차_주',  야: '물청소차_야'  },
  { label: 'MCM',           주: 'mcm_주',       야: 'mcm_야'       },
  { label: '재료비/인',     주: '재료비인_주',  야: '재료비인_야'  },
  { label: '접속',          주: '접속_주',      야: '접속_야'      },
] as const

type 직종주키 = typeof 직종행[number]['주']
type 직종야키 = typeof 직종행[number]['야']
type 인원키 = 직종주키 | 직종야키

type 편집값 = { [K in 인원키]: number } & { 외주1: number; 외주2: number }

function 초기편집값(row: 투입실적Row): 편집값 {
  return {
    상용직_주: row.상용직_주, 상용직_야: row.상용직_야,
    일용직_주: row.일용직_주, 일용직_야: row.일용직_야,
    모범신호수_주: row.모범신호수_주, 모범신호수_야: row.모범신호수_야,
    w6_주: row.w6_주, w6_야: row.w6_야,
    w3_주: row.w3_주, w3_야: row.w3_야,
    덤프15t_주: row.덤프15t_주, 덤프15t_야: row.덤프15t_야,
    크레인_주: row.크레인_주, 크레인_야: row.크레인_야,
    물청소차_주: row.물청소차_주, 물청소차_야: row.물청소차_야,
    mcm_주: row.mcm_주, mcm_야: row.mcm_야,
    재료비인_주: row.재료비인_주, 재료비인_야: row.재료비인_야,
    접속_주: row.접속_주, 접속_야: row.접속_야,
    외주1: row.외주1, 외주2: row.외주2,
  }
}

const ch = createColumnHelper<투입실적행>()

// ── 정렬 아이콘 헬퍼 ─────────────────────────────────────────────────────────
function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="size-3 shrink-0" />
  if (sorted === 'desc') return <ChevronDown className="size-3 shrink-0" />
  return <ChevronsUpDown className="size-3 shrink-0 opacity-40" />
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function HistoryTable({
  data: initialData,
  단가목록,
  date_from,
  date_to,
}: {
  data: 투입실적행[]
  단가목록: 공사단가Row[]
  date_from: string
  date_to: string
}) {
  const router = useRouter()

  const [data, setData] = useState<투입실적행[]>(initialData)
  const [검색어, set검색어] = useState('')
  const [selectedRow, setSelectedRow] = useState<투입실적행 | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [편집, set편집] = useState<편집값 | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: '투입일', desc: true }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })

  // 날짜 범위가 바뀔 때 서버에서 내려온 새 데이터를 동기화
  // (key 리마운트 대신 useEffect 방식 → 검색어 상태 유지됨)
  useEffect(() => {
    setData(initialData)
    setSelectedRow(null)
    setEditMode(false)
    setDeleteConfirm(false)
    set편집(null)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [initialData])

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function openSheet(row: 투입실적행) {
    setSelectedRow(row)
    setEditMode(false)
    setDeleteConfirm(false)
    set편집(null)
  }

  function closeSheet() {
    setSelectedRow(null)
    setEditMode(false)
    setDeleteConfirm(false)
    set편집(null)
  }

  function navigate(df: string, dt: string) {
    const safe_dt = dt < df ? df : dt
    router.push(`/input?tab=history&date_from=${df}&date_to=${safe_dt}`)
  }

  function prevMonth() {
    const d = new Date(date_from + 'T12:00:00')
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
    const y = d.getFullYear()
    const mo = d.getMonth() + 1
    const df = `${y}-${String(mo).padStart(2, '0')}-01`
    const dt = `${y}-${String(mo).padStart(2, '0')}-${new Date(y, mo, 0).getDate()}`
    navigate(df, dt)
  }

  function nextMonth() {
    const d = new Date(date_from + 'T12:00:00')
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    const y = d.getFullYear()
    const mo = d.getMonth() + 1
    const df = `${y}-${String(mo).padStart(2, '0')}-01`
    const dt = `${y}-${String(mo).padStart(2, '0')}-${new Date(y, mo, 0).getDate()}`
    navigate(df, dt)
  }

  // 검색 필터 (클라이언트 사이드)
  const filteredData = useMemo(() => {
    if (!검색어.trim()) return data
    const q = 검색어.toLowerCase()
    return data.filter((row) =>
      (row.수주?.공사명 ?? '').toLowerCase().includes(q) ||
      (row.수주?.지중no ?? '').toLowerCase().includes(q),
    )
  }, [data, 검색어])

  // 실시간 금액 계산 (수정 모드면 편집값, 조회 모드면 원본)
  const 금액계산Row: 투입실적Row | null = useMemo(() => {
    if (!selectedRow) return null
    if (editMode && 편집) return { ...selectedRow, ...편집 }
    return selectedRow
  }, [selectedRow, editMode, 편집])

  const 현재투입금액 = 금액계산Row ? calc투입금액(금액계산Row, 단가목록) : 0
  const 현재합계 = 금액계산Row ? calc합계(금액계산Row, 단가목록) : 0

  const columns = useMemo(() => [
    ch.accessor('투입일', {
      header: ({ column }) => (
        <button
          type="button"
          className="flex items-center gap-1 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          날짜
          <SortIcon sorted={column.getIsSorted()} />
        </button>
      ),
      enableSorting: true,
      size: 100,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-slate-600 whitespace-nowrap">{getValue()}</span>
      ),
    }),
    ch.accessor(
      (row) => row.수주?.공사명 ?? '—',
      {
        id: '공사명',
        header: '공사',
        enableSorting: false,
        cell: ({ row: r }) => (
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-800">
              {r.original.수주?.공사명 ?? '—'}
            </p>
            <p className="font-mono text-xs text-gray-400">{r.original.수주?.지중no}</p>
          </div>
        ),
      },
    ),
    ch.accessor(
      (row) => calc투입금액(row as 투입실적Row, 단가목록),
      {
        id: '투입금액',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center justify-end gap-1 font-medium w-full"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            투입금액
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        enableSorting: true,
        size: 130,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums text-sm">{formatKRW(getValue())}</div>
        ),
      },
    ),
    ch.accessor(
      (row) => calc합계(row as 투입실적Row, 단가목록),
      {
        id: '합계',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center justify-end gap-1 font-medium w-full"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            합계
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        enableSorting: true,
        size: 130,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums text-sm font-medium">{formatKRW(getValue())}</div>
        ),
      },
    ),
  ], [단가목록])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  // ── 저장 ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedRow || !편집) return
    setIsSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload: 투입실적Update = {
      ...편집,
      수정자: user?.id ?? null,
      수정일: new Date().toISOString(),
    }
    // 한글 테이블명 타입 never 이슈 → as any (PROGRESS.md 참고)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('투입실적') as any).update(payload).eq('id', selectedRow.id)
    setIsSaving(false)
    if (error) {
      showToast(false, '저장 실패: ' + (error as { message: string }).message)
      return
    }
    const updated: 투입실적행 = { ...selectedRow, ...편집, 수정일: new Date().toISOString() }
    setData((prev) => prev.map((r) => r.id === selectedRow.id ? updated : r))
    setSelectedRow(updated)
    setEditMode(false)
    set편집(null)
    showToast(true, '저장되었습니다')
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selectedRow) return
    setIsDeleting(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('투입실적') as any).delete().eq('id', selectedRow.id)
    setIsDeleting(false)
    if (error) {
      showToast(false, '삭제 실패: ' + (error as { message: string }).message)
      setDeleteConfirm(false)
      return
    }
    setData((prev) => prev.filter((r) => r.id !== selectedRow.id))
    closeSheet()
    showToast(true, '삭제되었습니다')
  }

  const { pageIndex, pageSize } = pagination
  const total = filteredData.length
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <>
      {/* 토스트 */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
          toast.ok ? 'bg-green-500' : 'bg-red-500',
        )}>
          {toast.ok
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center gap-3">
        {/* 이전달 */}
        <Button variant="outline" size="icon-sm" onClick={prevMonth} title="이전달">
          <ChevronLeft className="size-4" />
          <span className="sr-only">이전달</span>
        </Button>

        {/* 날짜 범위 */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={date_from}
            onChange={(e) => { if (e.target.value) navigate(e.target.value, date_to) }}
            className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-sm text-gray-400">~</span>
          <input
            type="date"
            value={date_to}
            onChange={(e) => { if (e.target.value) navigate(date_from, e.target.value) }}
            className="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* 다음달 */}
        <Button variant="outline" size="icon-sm" onClick={nextMonth} title="다음달">
          <ChevronRight className="size-4" />
          <span className="sr-only">다음달</span>
        </Button>

        {/* 검색 */}
        <div className="relative min-w-44 max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="지중No 또는 공사명으로 검색..."
            value={검색어}
            onChange={(e) => {
              set검색어(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
          />
        </div>

        <span className="ml-auto text-sm text-gray-500 tabular-nums shrink-0">
          {total.toLocaleString('ko-KR')}건
        </span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-200">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 px-3 text-xs">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-gray-400">
                  {검색어
                    ? `"${검색어}"에 해당하는 실적이 없습니다.`
                    : `${date_from === date_to ? date_from : `${date_from} ~ ${date_to}`} 투입실적이 없습니다.`}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-blue-50/50 border-b border-gray-100 transition-colors"
                  onClick={() => openSheet(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 페이지네이션 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-sm text-gray-500 tabular-nums">
            {total === 0
              ? '결과 없음'
              : `${rangeStart}–${rangeEnd} / 총 ${total.toLocaleString('ko-KR')}건`}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="size-4" />
              <span className="sr-only">이전</span>
            </Button>
            <span className="min-w-[4rem] text-center text-sm text-gray-600 tabular-nums">
              {pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="size-4" />
              <span className="sr-only">다음</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 상세 Sheet */}
      <Sheet open={selectedRow !== null} onOpenChange={(open) => { if (!open) closeSheet() }}>
        <SheetContent side="right" className="flex flex-col p-0 sm:max-w-[520px]">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-start gap-2 pr-8">
              <span className="font-mono text-xs text-gray-400 mt-0.5 shrink-0">
                {selectedRow?.수주?.지중no}
              </span>
              <SheetTitle className="text-base font-semibold text-left leading-snug">
                {selectedRow?.수주?.공사명}
              </SheetTitle>
            </div>
            <SheetDescription className="text-left">
              투입일: {selectedRow?.투입일}
              {editMode && (
                <span className="ml-2 text-amber-600 font-medium text-xs">수정 중</span>
              )}
            </SheetDescription>
          </SheetHeader>

          {/* Sheet 본문 */}
          <div className="flex-1 overflow-y-auto">
            {selectedRow && (
              <div className="px-5 py-4 space-y-5">

                {/* 직종별 인원 */}
                <section>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-1.5 text-left text-xs font-medium text-gray-500 w-32">직종</th>
                        <th className="pb-1.5 text-center text-xs font-semibold text-blue-600">주간</th>
                        <th className="pb-1.5 text-center text-xs font-semibold text-indigo-600">야간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {직종행.map(({ label, 주, 야 }) => {
                        const 주키 = 주 as 인원키
                        const 야키 = 야 as 인원키
                        const 주값 = editMode && 편집
                          ? 편집[주키]
                          : (selectedRow[주 as keyof 투입실적Row] as number)
                        const 야값 = editMode && 편집
                          ? 편집[야키]
                          : (selectedRow[야 as keyof 투입실적Row] as number)
                        const isEmpty = 주값 === 0 && 야값 === 0

                        return (
                          <tr key={label} className={cn('border-b border-gray-50', isEmpty && !editMode && 'opacity-35')}>
                            <td className="py-1.5 text-gray-700 font-medium text-xs">{label}</td>
                            <td className="py-1.5 text-center">
                              {editMode && 편집 ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="99"
                                  value={편집[주키]}
                                  onChange={(e) =>
                                    set편집((prev) => prev ? { ...prev, [주키]: Number(e.target.value) || 0 } : prev)
                                  }
                                  className="w-20 h-8 text-center rounded border border-gray-200 text-sm focus:border-blue-400 focus:outline-none"
                                />
                              ) : (
                                <span className={cn('tabular-nums text-sm', 주값 > 0 && 'font-semibold text-blue-700')}>
                                  {주값 || '—'}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 text-center">
                              {editMode && 편집 ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="99"
                                  value={편집[야키]}
                                  onChange={(e) =>
                                    set편집((prev) => prev ? { ...prev, [야키]: Number(e.target.value) || 0 } : prev)
                                  }
                                  className="w-20 h-8 text-center rounded border border-gray-200 text-sm focus:border-indigo-400 focus:outline-none"
                                />
                              ) : (
                                <span className={cn('tabular-nums text-sm', 야값 > 0 && 'font-semibold text-indigo-700')}>
                                  {야값 || '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* 외주 */}
                  {(selectedRow.외주1 > 0 || selectedRow.외주2 > 0 || editMode) && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 font-medium mb-1.5">외주 금액</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['외주1', '외주2'] as const).map((key) => (
                          <div key={key}>
                            <p className="text-xs text-gray-500 mb-0.5">{key}</p>
                            {editMode && 편집 ? (
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={편집[key]}
                                onChange={(e) =>
                                  set편집((prev) => prev ? { ...prev, [key]: Number(e.target.value) || 0 } : prev)
                                }
                                className="w-full h-8 px-2 rounded border border-gray-200 text-sm text-right focus:border-blue-400 focus:outline-none"
                              />
                            ) : (
                              <p className="text-sm tabular-nums">{formatKRW(selectedRow[key])}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                <Separator />

                {/* 금액 요약 */}
                <section>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    금액 요약{editMode && ' (실시간)'}
                  </p>
                  <div className="rounded-xl p-4 text-white" style={{ backgroundColor: '#1e2d5a' }}>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg p-3 bg-white/10">
                        <p className="text-[10px] mb-1" style={{ color: '#a8b8e0' }}>투입금액</p>
                        <p className="text-xs font-bold tabular-nums">{formatKRW(현재투입금액)}</p>
                      </div>
                      <div className="rounded-lg p-3 bg-white/10">
                        <p className="text-[10px] mb-1" style={{ color: '#a8b8e0' }}>일반관리비 (6%)</p>
                        <p className="text-xs font-bold tabular-nums">{formatKRW(Math.round(현재투입금액 * 0.06))}</p>
                      </div>
                      <div className="rounded-lg p-3 border border-white/25 bg-white/15">
                        <p className="text-[10px] mb-1 text-white/80">합계</p>
                        <p className="text-xs font-bold tabular-nums">{formatKRW(현재합계)}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 기록 */}
                {!editMode && (
                  <section>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                      기록
                    </p>
                    <dl className="space-y-1 text-sm">
                      <div className="flex gap-3">
                        <dt className="w-14 shrink-0 text-gray-400">생성일</dt>
                        <dd className="text-gray-700">{selectedRow.생성일?.slice(0, 10) ?? '—'}</dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="w-14 shrink-0 text-gray-400">수정일</dt>
                        <dd className="text-gray-700">{selectedRow.수정일?.slice(0, 10) ?? '—'}</dd>
                      </div>
                    </dl>
                  </section>
                )}

                {/* 삭제 확인 인라인 UI */}
                {deleteConfirm && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-red-700">정말 삭제하시겠습니까?</p>
                    <p className="text-xs text-red-600">
                      {selectedRow.투입일} — {selectedRow.수주?.공사명}
                      <br />
                      삭제된 데이터는 복구할 수 없습니다.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
                        삭제 확인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirm(false)}
                        disabled={isDeleting}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sheet 하단 버튼 */}
          {!deleteConfirm && (
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              {editMode ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 gap-2 text-white"
                    style={{ backgroundColor: '#1e2d5a' }}
                  >
                    {isSaving
                      ? <><Loader2 className="size-4 animate-spin" />저장 중...</>
                      : <><Save className="size-4" />저장</>}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditMode(false); set편집(null) }} className="gap-2">
                    <X className="size-4" />
                    취소
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      if (selectedRow) {
                        set편집(초기편집값(selectedRow))
                        setEditMode(true)
                      }
                    }}
                  >
                    <Pencil className="size-4" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="size-4" />
                    삭제
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
