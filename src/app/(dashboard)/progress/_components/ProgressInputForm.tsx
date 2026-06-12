'use client'

import { useState, useRef, useEffect, useDeferredValue } from 'react'
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Search, ChevronDown, X as XIcon, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 수주목록항목 } from '../_types'
import type { 공사이력Row } from '@/types/database'

type Props = {
  수주목록: 수주목록항목[]
  공무담당자목록: { id: number; 이름: string }[]
  default수주Id?: number | null
  default날짜?: string | null
}

function 공사SearchableSelect({
  options,
  value,
  onChange,
}: {
  options: 수주목록항목[]
  value: number | null
  onChange: (id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = options.find((o) => o.id === value)
  const deferredQuery = useDeferredValue(query)
  const filtered = deferredQuery
    ? options.filter(
        (o) =>
          o.지중no.toLowerCase().includes(deferredQuery.toLowerCase()) ||
          o.공사명.toLowerCase().includes(deferredQuery.toLowerCase()),
      )
    : options

  const openDrop = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    setOpen(true)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('scroll', close, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [open])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected ? `${selected.지중no} · ${selected.공사명}` : '')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openDrop}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="지중No 또는 공사명으로 검색..."
          autoComplete="off"
          className={cn(
            'h-10 w-full rounded-lg border border-input bg-background text-sm pl-9 pr-8 outline-none',
            'focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors',
            open && 'border-ring ring-3 ring-ring/50',
          )}
        />
        {value != null ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); inputRef.current?.focus() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <XIcon className="size-4" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <DismissableLayerBranch>
            <div
              ref={dropRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, pointerEvents: 'auto' }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(o.id); setOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors',
                      o.id === value && 'bg-blue-50 text-blue-700 font-medium',
                    )}
                  >
                    <span className="font-mono text-xs text-gray-400 mr-2">{o.지중no}</span>
                    {o.공사명}
                  </button>
                ))
              )}
            </div>
          </DismissableLayerBranch>,
          document.body,
        )}
    </div>
  )
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('ko-KR') : '')
  useEffect(() => {
    setDisplay(value != null ? value.toLocaleString('ko-KR') : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') { setDisplay(''); onChange(null) }
    else {
      const num = parseInt(raw, 10)
      setDisplay(num.toLocaleString('ko-KR'))
      onChange(num)
    }
  }

  return (
    <Input
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      className={className}
    />
  )
}

export function ProgressInputForm({ 수주목록, 공무담당자목록, default수주Id, default날짜 }: Props) {
  const [선택수주Id, set선택수주Id] = useState<number | null>(default수주Id ?? null)
  const [작업일자, set작업일자] = useState(() => default날짜 ?? new Date().toISOString().slice(0, 10))
  const [성과금액, set성과금액] = useState<number | null>(null)
  const [누계성과금액, set누계성과금액] = useState<number>(0)
  const [최근작업일자, set최근작업일자] = useState<string | null>(null)
  const [작업내용, set작업내용] = useState('')
  const [담당공무Id, set담당공무Id] = useState<number | null>(null)
  const [로딩중, set로딩중] = useState(false)
  const [저장중, set저장중] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ ok, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const 선택수주 = 수주목록.find((s) => s.id === 선택수주Id) ?? null

  const 하도적용금액 = (() => {
    if (!선택수주) return null
    const { 수주금액_공급가: 공급가, 보험료율, 하도전용율 } = 선택수주
    if (공급가 == null || 보험료율 == null || 하도전용율 == null) return null
    return 공급가 * (1 - 보험료율) * 하도전용율
  })()

  const handle공사선택 = async (id: number | null) => {
    set선택수주Id(id)
    set성과금액(null)
    set누계성과금액(0)
    set최근작업일자(null)
    if (id == null) return

    set로딩중(true)
    const supabase = createClient()
    const [이력결과, 수주결과] = await Promise.all([
      (supabase.from('공사이력') as any)
        .select('id, 작업일자, 성과금액')
        .eq('수주_id', id)
        .order('작업일자', { ascending: false }) as Promise<{ data: Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[] | null }>,
      supabase.from('수주').select('공무담당자_id').eq('id', id).single(),
    ])
    set로딩중(false)

    const records = 이력결과.data ?? []
    const 누계 = records.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0)
    set누계성과금액(누계)
    if (records.length > 0) set최근작업일자(records[0].작업일자)
    const 수주data = (수주결과 as any).data as { 공무담당자_id: number | null } | null
    if (수주data?.공무담당자_id) set담당공무Id(수주data.공무담당자_id)
  }

  useEffect(() => {
    if (default수주Id != null) {
      handle공사선택(default수주Id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const delta달성율 = (성과금액 != null && 하도적용금액 != null && 하도적용금액 > 0)
    ? (성과금액 / 하도적용금액) * 100
    : null
  const 저장후누계 = 누계성과금액 + (성과금액 ?? 0)
  const 저장후달성율 = (하도적용금액 != null && 하도적용금액 > 0)
    ? (저장후누계 / 하도적용금액) * 100
    : null
  const 현재달성율 = (하도적용금액 != null && 하도적용금액 > 0)
    ? (누계성과금액 / 하도적용금액) * 100
    : null

  const handleSave = async () => {
    if (!선택수주Id || !작업일자 || 성과금액 == null) {
      showToast(false, '공사, 작업일자, 성과금액을 모두 입력해주세요.')
      return
    }
    set저장중(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any).insert({
      수주_id: 선택수주Id,
      작업일자,
      성과금액,
      작업내용: 작업내용 || null,
      담당공무_id: 담당공무Id,
    })
    set저장중(false)
    if (error) {
      const msg = error.message?.includes('unique') ? '해당 날짜에 이미 등록된 이력이 있습니다.' : '저장에 실패했습니다.'
      showToast(false, msg)
      return
    }
    showToast(true, '저장되었습니다.')
    set누계성과금액((prev) => prev + (성과금액 ?? 0))
    set최근작업일자(작업일자)
    set성과금액(null)
    set작업일자(new Date().toISOString().slice(0, 10))
    set작업내용('')
    set담당공무Id(null)
  }

  return (
    <div className="flex gap-0 max-w-4xl">
      <div className="flex-1 space-y-5 pr-6">
        {toast && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border',
            toast.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200',
          )}>
            {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div>
          <Label className="text-xs text-gray-600 mb-1.5 block">공사 선택 (지중No / 공사명)</Label>
          <공사SearchableSelect
            options={수주목록}
            value={선택수주Id}
            onChange={handle공사선택}
          />
        </div>

        {선택수주Id != null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
              {로딩중 ? '불러오는 중...' : '마지막 등록 기록'}
            </p>
            {!로딩중 && (
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-400 text-xs block">작업일자</span>
                  <span className="font-semibold text-gray-800">{최근작업일자 ?? '없음'}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">누계 성과금액</span>
                  <span className="font-semibold text-green-700">{formatKRW(누계성과금액)}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">현재 공정 달성률</span>
                  <span className="font-semibold text-amber-600">
                    {현재달성율 != null ? `${현재달성율.toFixed(2)}%` : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
            <Input
              type="date"
              className="h-10 text-sm"
              value={작업일자}
              onChange={(e) => set작업일자(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">성과금액 (이번 증분)</Label>
            <MoneyInput
              value={성과금액}
              onChange={set성과금액}
              className="h-10 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1.5 block">
            작업내용 <span className="text-gray-400">(선택)</span>
          </Label>
          <Input
            type="text"
            className="h-10 text-sm"
            placeholder="이번 작업 내용을 간략히 입력..."
            value={작업내용}
            onChange={(e) => set작업내용(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-1.5 block">
            담당 공무 <span className="text-gray-400">(선택)</span>
          </Label>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background text-sm px-3 outline-none focus:border-ring"
            value={담당공무Id ?? ''}
            onChange={(e) => set담당공무Id(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">선택 안함</option>
            {공무담당자목록.map((g) => (
              <option key={g.id} value={g.id}>{g.이름}</option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          className="w-full h-10 text-sm bg-[#f59e0b] hover:bg-[#d97706] text-white"
          onClick={handleSave}
          disabled={저장중 || !선택수주Id || 성과금액 == null}
        >
          {저장중 ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
          저장
        </Button>
      </div>

      <div className="w-60 shrink-0 border-l border-gray-100 pl-6 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">자동 계산</p>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 mb-1">Δ공정 달성률</p>
          <p className="text-2xl font-bold text-amber-500">
            {delta달성율 != null ? `+${delta달성율.toFixed(2)}%` : '—'}
          </p>
          {delta달성율 != null && 하도적용금액 != null && (
            <p className="text-[10px] text-gray-400 mt-1">
              {formatKRW(성과금액!)} ÷ {formatKRW(하도적용금액)} × 100
            </p>
          )}
        </div>

        <div className="bg-[#1e2d5a] rounded-xl p-4">
          <p className="text-[10px] text-blue-300 mb-3">저장 후 누계</p>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-blue-200">성과금액</span>
            <span className="text-white font-semibold">{formatKRW(저장후누계)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-200 text-sm">공정 달성률</span>
            <span className="text-amber-300 font-bold text-xl">
              {저장후달성율 != null ? `${저장후달성율.toFixed(2)}%` : '—'}
            </span>
          </div>
        </div>

        {하도적용금액 != null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-gray-500">
              <span>하도적용금액</span>
              <span className="font-medium">{formatKRW(하도적용금액)}</span>
            </div>
            {선택수주?.수주금액_공급가 && (
              <div className="flex justify-between text-gray-400">
                <span>수주금액</span>
                <span>{formatKRW(선택수주.수주금액_공급가)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
