'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type Column,
  type PaginationState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  X as XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 수주행, 거래처목록항목 } from '../_types'
import { OrderForm } from './OrderForm'

// ── 정렬 가능한 헤더 버튼 ──────────────────────────────────────────────────
function SortHeader({
  column,
  children,
  className,
}: {
  column: Column<수주행, unknown>
  children: React.ReactNode
  className?: string
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 font-medium text-foreground hover:text-foreground/70 transition-colors',
        className,
      )}
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {children}
      {sorted === 'asc' ? (
        <ChevronUp className="size-3 shrink-0" />
      ) : sorted === 'desc' ? (
        <ChevronDown className="size-3 shrink-0" />
      ) : (
        <ChevronsUpDown className="size-3 shrink-0 opacity-40" />
      )}
    </button>
  )
}

// ── 컬럼 정의 ─────────────────────────────────────────────────────────────
const ch = createColumnHelper<수주행>()

// ── 수주금액 계산 헬퍼 ─────────────────────────────────────────────────────
function calc수주금액(row: 수주행) {
  const 공급가 = row.수주금액_공급가 ?? 0
  const 부가세 = 공급가 * 0.1
  const 보험료율 = row.보험료율 ?? null
  const 하도전용율 = row.하도전용율 ?? null
  const 보험료제외 =
    보험료율 !== null ? 공급가 * (1 - 보험료율) : null
  const 하도적용 =
    보험료제외 !== null && 하도전용율 !== null
      ? 보험료제외 * 하도전용율
      : null
  return { 공급가, 부가세, 보험료율, 보험료제외, 하도전용율, 하도적용 }
}

// ── 상세 슬라이드오버 내용 ──────────────────────────────────────────────────
function OrderDetail({ row }: { row: 수주행 }) {
  const 금액 = calc수주금액(row)
  const 누적기성 = row.기성.reduce((s, g) => s + (g.기성액_공급가 ?? 0), 0)
  const 정렬기성 = [...row.기성].sort((a, b) => a.차수 - b.차수)

  const 기본정보행: [string, string][] = [
    ['원청사', row.원청사?.거래처명 ?? '—'],
    ['공사번호', row.공사번호 ?? '—'],
    ['공사구분', row.공사구분 ?? '—'],
    ['공사종류', row.공사종류 ?? '—'],
    ['공사현장', row.공사현장 ?? '—'],
    ['작업구분', row.작업구분 ?? '—'],
    ['시공상태', row.시공상태 ?? '—'],
    ['정산상태', row.정산상태 ?? '—'],
    ['공사담당', row.공사담당 ?? '—'],
    ['감독자', row.감독자 ?? '—'],
    ['착공일', row.착공일 ?? '—'],
    ['준공일', row.준공일 ?? '—'],
    ['준공여부', row.준공여부 ? '준공완료' : '진행중'],
    ['포장여부', row.포장여부 ? '포장' : '미포장'],
    ['자재청구', row.자재청구여부 ? '청구' : '미청구'],
    ['참고사항', row.참고사항 ?? '—'],
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-4 space-y-5">

        {/* 기본 정보 */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            기본 정보
          </p>
          <dl className="space-y-1.5">
            {기본정보행.map(([label, value]) => (
              <div key={label} className="flex gap-3 text-sm">
                <dt className="w-16 shrink-0 text-gray-400">{label}</dt>
                <dd className="text-gray-800 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Separator />

        {/* 수주금액 계산 */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            수주금액
          </p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-200 bg-blue-50/60">
                <td className="py-1.5 font-semibold text-gray-700">공급가</td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-gray-700">
                  {formatKRW(금액.공급가)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-400">부가세 (10%)</td>
                <td className="py-1.5 text-right tabular-nums text-gray-400">
                  {formatKRW(금액.부가세)}
                </td>
              </tr>
              {금액.보험료율 !== null && (
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-500">
                    보험료제외{' '}
                    <span className="text-xs text-gray-400">
                      ({(금액.보험료율 * 100).toFixed(1)}%)
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700">
                    {금액.보험료제외 !== null ? formatKRW(금액.보험료제외) : '—'}
                  </td>
                </tr>
              )}
              {금액.하도전용율 !== null && (
                <tr className="border-b border-gray-200 bg-blue-50/60">
                  <td className="py-1.5 font-semibold text-gray-700">
                    하도적용{' '}
                    <span className="text-xs font-normal text-gray-400">
                      ({(금액.하도전용율 * 100).toFixed(1)}%)
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-gray-700">
                    {금액.하도적용 !== null ? formatKRW(금액.하도적용) : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <Separator />

        {/* 기성 이력 */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            기성 이력
          </p>
          {정렬기성.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 기성이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-1.5 text-left text-xs font-medium text-gray-500">차수</th>
                  <th className="pb-1.5 text-left text-xs font-medium text-gray-500">기성일</th>
                  <th className="pb-1.5 text-right text-xs font-medium text-gray-500">기성액 (공급가)</th>
                </tr>
              </thead>
              <tbody>
                {정렬기성.map((g) => (
                  <tr key={g.차수} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-700">{g.차수}차</td>
                    <td className="py-1.5 text-gray-600">{g.기성일 ?? '—'}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {g.기성액_공급가 !== null ? formatKRW(g.기성액_공급가) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={2} className="pt-2 pb-1.5 font-semibold text-gray-700">
                    누적기성 합계
                  </td>
                  <td className="pt-2 pb-1.5 text-right tabular-nums font-semibold text-gray-700">
                    {formatKRW(누적기성)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

// ── 필터 타입 ─────────────────────────────────────────────────────────────
type 준공필터타입 = 'all' | 'active' | 'done'
const 준공필터옵션: { value: 준공필터타입; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행중' },
  { value: 'done', label: '준공완료' },
]
const 공사구분옵션 = ['전체', '단가', '민수']

// ── 폼 Sheet 상태 타입 ────────────────────────────────────────────────────
type FormState =
  | { mode: 'new' }
  | { mode: 'edit'; row: 수주행 }

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export function OrdersTable({
  data,
  거래처목록,
}: {
  data: 수주행[]
  거래처목록: 거래처목록항목[]
}) {
  const [준공필터, set준공필터] = useState<준공필터타입>('all')
  const [공사구분필터, set공사구분필터] = useState('전체')
  const [검색어, set검색어] = useState('')
  const [detailRow, setDetailRow] = useState<수주행 | null>(null)
  const [formState, setFormState] = useState<FormState | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }))

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (준공필터 === 'active' && row.준공여부) return false
      if (준공필터 === 'done' && !row.준공여부) return false
      if (공사구분필터 !== '전체' && row.공사구분 !== 공사구분필터) return false
      if (검색어) {
        const q = 검색어.toLowerCase()
        if (
          !row.공사명.toLowerCase().includes(q) &&
          !row.지중no.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [data, 준공필터, 공사구분필터, 검색어])

  const columns = useMemo(() => [
    ch.accessor('지중no', {
      header: ({ column }) => <SortHeader column={column}>지중No</SortHeader>,
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-slate-500">{getValue()}</span>
      ),
    }),
    ch.accessor('공사명', {
      header: ({ column }) => <SortHeader column={column}>공사명</SortHeader>,
      enableSorting: true,
      size: 280,
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue()}</span>
      ),
    }),
    ch.accessor((row) => row.발주자?.거래처명 ?? '—', {
      id: '발주자명',
      header: '발주자',
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-slate-500 text-sm">{getValue()}</span>
      ),
    }),
    ch.accessor(
      (row) => {
        const 공급가 = row.수주금액_공급가 ?? 0
        const 보험료율 = row.보험료율 ?? null
        const 하도전용율 = row.하도전용율 ?? null
        if (보험료율 === null && 하도전용율 === null) return 공급가
        const 보험료제외 = 보험료율 !== null ? 공급가 * (1 - 보험료율) : 공급가
        return 하도전용율 !== null ? 보험료제외 * 하도전용율 : 보험료제외
      },
      {
        id: '수주금액_하도적용',
        header: ({ column }) => (
          <SortHeader column={column} className="w-full justify-end">
            수주금액(하도적용)
          </SortHeader>
        ),
        enableSorting: true,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums font-medium">
            {formatKRW(getValue())}
          </div>
        ),
      },
    ),
    ch.accessor(
      (row) => row.기성.reduce((s, g) => s + (g.기성액_공급가 ?? 0), 0),
      {
        id: '누적기성액',
        header: ({ column }) => (
          <SortHeader column={column} className="w-full justify-end">
            누적기성액
          </SortHeader>
        ),
        enableSorting: true,
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums">{formatKRW(getValue())}</div>
        ),
      },
    ),
    ch.accessor('달성율', {
      header: ({ column }) => (
        <SortHeader column={column} className="w-full justify-end">
          달성율
        </SortHeader>
      ),
      enableSorting: true,
      cell: ({ getValue }) => {
        const v = getValue()
        return (
          <div className="text-right tabular-nums">
            {v !== null ? `${v.toFixed(1)}%` : '—'}
          </div>
        )
      },
    }),
    ch.accessor('준공여부', {
      header: '준공여부',
      enableSorting: false,
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="secondary">준공완료</Badge>
        ) : (
          <Badge variant="outline">진행중</Badge>
        ),
    }),
    ch.display({
      id: 'actions',
      size: 60,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setFormState({ mode: 'edit', row: row.original })
            }}
          >
            <Pencil className="size-3" />
            수정
          </button>
        </div>
      ),
    }),
  ], [setFormState])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  })

  const total = filteredData.length
  const { pageIndex, pageSize } = pagination
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <>
      {/* 필터 바 */}
      <div
        className="bg-white rounded-xl shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center gap-3"
        style={{ borderColor: '#e2e8f0' }}
      >
        {/* 준공여부 토글 */}
        <div className="flex items-center rounded-lg border border-gray-200 divide-x divide-gray-200 overflow-hidden">
          {준공필터옵션.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={cn(
                'px-3 h-8 text-sm transition-colors whitespace-nowrap',
                준공필터 === value
                  ? 'bg-[#1e2d5a] text-white font-medium'
                  : 'bg-white text-gray-600 hover:bg-gray-50',
              )}
              onClick={() => {
                set준공필터(value)
                resetPage()
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 공사구분 */}
        <Select
          value={공사구분필터}
          onValueChange={(v) => {
            set공사구분필터(v)
            resetPage()
          }}
        >
          <SelectTrigger className="h-8 w-24 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {공사구분옵션.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 검색어 */}
        <div className="relative flex-1 min-w-44 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="공사명, 지중No 검색..."
            value={검색어}
            onChange={(e) => {
              set검색어(e.target.value)
              resetPage()
            }}
          />
        </div>

        {/* 건수 */}
        <span className="text-sm text-gray-500 tabular-nums shrink-0">
          {total.toLocaleString('ko-KR')}건
        </span>

        {/* 새 수주 버튼 */}
        <Button
          size="sm"
          className="ml-auto h-8 bg-[#1e2d5a] hover:bg-[#2d45a8] shrink-0"
          onClick={() => setFormState({ mode: 'new' })}
        >
          <Plus className="size-3.5 mr-1" />
          새 수주
        </Button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow
                key={hg.id}
                className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-200"
              >
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 px-3 text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-gray-400"
                >
                  조건에 맞는 공사가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-blue-50/50 border-b border-gray-100 transition-colors"
                  onClick={() => setDetailRow(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
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
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">이전</span>
            </Button>
            <span className="min-w-[4rem] text-center text-sm text-gray-600 tabular-nums">
              {pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">다음</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 상세 조회 Sheet */}
      <Sheet
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null)
        }}
      >
        <SheetContent
          side="right"
          className="flex flex-col p-0 sm:max-w-[480px]"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-start justify-between gap-2 pr-8">
              <div className="flex items-start gap-2 min-w-0">
                <span className="font-mono text-xs text-gray-400 mt-0.5 shrink-0">
                  {detailRow?.지중no}
                </span>
                <SheetTitle className="text-base font-semibold text-left leading-snug">
                  {detailRow?.공사명}
                </SheetTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 h-7 text-xs px-2.5"
                onClick={() => {
                  const row = detailRow!
                  setDetailRow(null)
                  setFormState({ mode: 'edit', row })
                }}
              >
                <Pencil className="size-3 mr-1" />
                수정
              </Button>
            </div>
            <SheetDescription className="text-left">
              {detailRow?.발주자?.거래처명 ?? '발주자 미등록'}
            </SheetDescription>
          </SheetHeader>
          {detailRow && <OrderDetail row={detailRow} />}
        </SheetContent>
      </Sheet>

      {/* 등록 · 수정 폼 Dialog */}
      <Dialog open={formState !== null} onOpenChange={(open) => !open && setFormState(null)}>
        <DialogContent
          className="sm:max-w-[900px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
          showCloseButton={false}
        >
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">
                {formState?.mode === 'new' ? '새 수주 등록' : '수주 수정'}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {formState?.mode === 'new'
                  ? '새로운 수주 정보를 입력하세요'
                  : formState?.mode === 'edit'
                    ? `${formState.row.지중no} · ${formState.row.공사명}`
                    : ''}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0">
                <XIcon className="size-4" />
                <span className="sr-only">닫기</span>
              </Button>
            </DialogClose>
          </div>
          {formState && (
            <OrderForm
              mode={formState.mode}
              row={formState.mode === 'edit' ? formState.row : undefined}
              거래처목록={거래처목록}
              onSuccess={() => setFormState(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
