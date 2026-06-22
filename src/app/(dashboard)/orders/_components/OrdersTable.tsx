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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import type { 수주행, 거래처목록항목, 공무담당자목록항목 } from '../_types'
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

// ── 금액 계산 헬퍼 (컬럼 · 합계에서 공용) ──────────────────────────────────
function 하도적용수주금액(row: 수주행): number {
  const 공급가 = row.수주금액_공급가 ?? 0
  const 보험료율 = row.보험료율 ?? null
  const 하도전용율 = row.하도전용율 ?? null
  if (보험료율 === null && 하도전용율 === null) return 공급가
  const 보험료제외 = 보험료율 !== null ? 공급가 * (1 - 보험료율) : 공급가
  return 하도전용율 !== null ? 보험료제외 * 하도전용율 : 보험료제외
}

function 누적기성액(row: 수주행): number {
  return row.기성.reduce((s, g) => s + (g.기성액_공급가 ?? 0), 0)
}

// ── 컬럼 정의 ─────────────────────────────────────────────────────────────
const ch = createColumnHelper<수주행>()

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
  공무담당자목록,
}: {
  data: 수주행[]
  거래처목록: 거래처목록항목[]
  공무담당자목록: 공무담당자목록항목[]
}) {
  const [준공필터, set준공필터] = useState<준공필터타입>('all')
  const [공사구분필터, set공사구분필터] = useState('전체')
  const [검색어, set검색어] = useState('')
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
      (row) => 하도적용수주금액(row),
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
      (row) => 누적기성액(row),
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
  const 수주금액합계 = useMemo(
    () => filteredData.reduce((s, row) => s + 하도적용수주금액(row), 0),
    [filteredData],
  )
  const 누적기성액합계 = useMemo(
    () => filteredData.reduce((s, row) => s + 누적기성액(row), 0),
    [filteredData],
  )
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
            placeholder="지중No 또는 공사명으로 검색..."
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
                  onClick={() => setFormState({ mode: 'edit', row: row.original })}
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
          {total > 0 && (
            <TableFooter>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-t border-gray-200">
                <TableCell colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-600">
                  합계 ({total.toLocaleString('ko-KR')}건)
                  {검색어.trim() && data.length !== total && (
                    <span className="font-normal text-gray-400 ml-1">/ 전체 {data.length.toLocaleString('ko-KR')}건</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right font-bold text-[#1e2d5a] tabular-nums">
                  {formatKRW(수주금액합계)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right font-bold text-[#1e2d5a] tabular-nums">
                  {formatKRW(누적기성액합계)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
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
              공무담당자목록={공무담당자목록}
              onSuccess={() => setFormState(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
