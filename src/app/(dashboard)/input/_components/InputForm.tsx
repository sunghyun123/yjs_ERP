'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Search, RefreshCw, Save, Loader2,
  CheckCircle2, AlertCircle, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import { todayKST } from '@/lib/kst'
import {
  calc투입금액상세,
  get동적투입구분목록,
  legacyRowTo상세,
  merge상세목록,
  상세목록ToLegacyUpdate,
  type 투입상세수량,
} from '@/app/(dashboard)/_lib/calc'
import type { 공사단가Row, 투입실적Row, 투입실적Insert, 투입실적Update } from '@/types/database'

const qty = z.number().min(0).max(99)
const amt = z.number().min(0)
const numOpts = { setValueAs: (v: unknown) => (v === '' || v == null) ? 0 : Number(v) || 0 }

const schema = z.object({
  수주_id: z.number().int().min(1, { error: '공사를 선택하세요' }),
  투입일: z.string().min(1, { error: '날짜를 입력하세요' }),
  외주1: amt,
  외주2: amt,
})

type FormValues = z.infer<typeof schema>
type 수주검색결과 = { id: number; 지중no: string; 공사명: string }
type 상세Map = Record<string, { 주간수량: number; 야간수량: number }>
type 투입실적조회Row = 투입실적Row & { 투입실적상세?: 투입상세수량[] | null }

function today() {
  return todayKST()
}

function n(v: unknown): number {
  const num = Number(v)
  return Number.isFinite(num) ? num : 0
}

function to상세Map(rows: 투입상세수량[]): 상세Map {
  return Object.fromEntries(rows.map((row) => [
    row.투입구분,
    { 주간수량: n(row.주간수량), 야간수량: n(row.야간수량) },
  ]))
}

function to상세목록(map: 상세Map): 투입상세수량[] {
  return Object.entries(map).map(([투입구분, value]) => ({
    투입구분,
    주간수량: n(value.주간수량),
    야간수량: n(value.야간수량),
  }))
}

type InputFormProps = {
  단가목록: 공사단가Row[]
  default수주Id?: number | null
  default날짜?: string | null
}

export function InputForm({ 단가목록, default수주Id, default날짜 }: InputFormProps) {
  const 투입구분목록 = useMemo(() => get동적투입구분목록(단가목록), [단가목록])
  const 기본상세 = useMemo(() => to상세Map(merge상세목록(투입구분목록, [])), [투입구분목록])

  const [선택수주, set선택수주] = useState<수주검색결과 | null>(null)
  const [검색어, set검색어] = useState('')
  const [검색결과, set검색결과] = useState<수주검색결과[]>([])
  const [드롭다운, set드롭다운] = useState(false)
  const [실적로딩, set실적로딩] = useState(false)
  const [기존Id, set기존Id] = useState<number | null>(null)
  const [최근투입일, set최근투입일] = useState<string | null>(null)
  const [최근투입로딩, set최근투입로딩] = useState(false)
  const [상세, set상세] = useState<상세Map>(기본상세)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const 검색타이머 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const 토스트타이머 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const 드롭다운Ref = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { 수주_id: 0, 투입일: default날짜 ?? today(), 외주1: 0, 외주2: 0 },
  })

  const values = watch()
  const 투입일 = values.투입일
  const 수주id = values.수주_id
  const 상세목록 = useMemo(() => to상세목록(상세), [상세])

  const 투입금액 = calc투입금액상세(
    { 투입일: 투입일 || today(), 외주1: n(values.외주1), 외주2: n(values.외주2) },
    상세목록,
    단가목록,
  )
  const 일반관리비 = Math.round(투입금액 * 0.06)
  const 합계 = 투입금액 + 일반관리비

  useEffect(() => {
    set상세((prev) => to상세Map(merge상세목록(투입구분목록, to상세목록(prev))))
  }, [투입구분목록])

  const fillRow = useCallback((row: 투입실적조회Row) => {
    const rows = row.투입실적상세?.length ? row.투입실적상세 : legacyRowTo상세(row)
    set상세(to상세Map(merge상세목록(투입구분목록, rows)))
    setValue('외주1', row.외주1)
    setValue('외주2', row.외주2)
  }, [setValue, 투입구분목록])

  useEffect(() => {
    if (!수주id || 수주id < 1 || !투입일) return
    set실적로딩(true)
    const supabase = createClient()
    supabase
      .from('투입실적')
      .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
      .eq('수주_id', 수주id)
      .eq('투입일', 투입일)
      .maybeSingle()
      .then(({ data: raw }) => {
        if (raw) {
          const row = raw as 투입실적조회Row
          set기존Id(row.id)
          fillRow(row)
        } else {
          set기존Id(null)
          reset({ 수주_id: 수주id, 투입일, 외주1: 0, 외주2: 0 })
          set상세(기본상세)
        }
        set실적로딩(false)
      })
  }, [수주id, 투입일, fillRow, reset, 기본상세])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!드롭다운Ref.current?.contains(e.target as Node)) set드롭다운(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function showToast(ok: boolean, msg: string) {
    if (토스트타이머.current) clearTimeout(토스트타이머.current)
    setToast({ ok, msg })
    토스트타이머.current = setTimeout(() => setToast(null), 3500)
  }

  function handleSearch(q: string) {
    set검색어(q)
    if (검색타이머.current) clearTimeout(검색타이머.current)
    if (!q.trim()) { set검색결과([]); set드롭다운(false); return }
    검색타이머.current = setTimeout(async () => {
      const supabase = createClient()
      // PostgREST or() 필터는 값에 , . () 같은 예약문자가 들어가면 파싱이 깨진다.
      // 값을 큰따옴표로 감싸고 백슬래시·큰따옴표만 이스케이프해 안전하게 전달한다.
      const safe = q.replace(/[\\"]/g, (m) => `\\${m}`)
      const { data: raw } = await supabase
        .from('수주')
        .select('id, 지중no, 공사명')
        .or(`지중no.ilike."%${safe}%",공사명.ilike."%${safe}%"`)
        .order('지중no', { ascending: false })
        .limit(10)
      const results = (raw ?? []) as 수주검색결과[]
      set검색결과(results)
      set드롭다운(results.length > 0)
    }, 250)
  }

  async function handleSelect(order: 수주검색결과) {
    set선택수주(order)
    set검색어(`${order.지중no}  ${order.공사명}`)
    setValue('수주_id', order.id)
    set드롭다운(false)
    set최근투입일(null)
    set최근투입로딩(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('투입실적')
      .select('투입일')
      .eq('수주_id', order.id)
      .order('투입일', { ascending: false })
      .limit(1)
      .maybeSingle()
    set최근투입로딩(false)
    set최근투입일((data as { 투입일: string } | null)?.투입일 ?? null)
  }

  useEffect(() => {
    if (default수주Id == null) return
    const supabase = createClient()
    supabase
      .from('수주')
      .select('id, 지중no, 공사명')
      .eq('id', default수주Id)
      .single()
      .then(({ data: raw }) => {
        if (raw) handleSelect(raw as 수주검색결과)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function 초기화() {
    reset({ 수주_id: 수주id, 투입일, 외주1: 0, 외주2: 0 })
    set상세(기본상세)
    set기존Id(null)
  }

  function set상세값(투입구분: string, key: '주간수량' | '야간수량', value: number) {
    set상세((prev) => ({
      ...prev,
      [투입구분]: {
        주간수량: n(prev[투입구분]?.주간수량),
        야간수량: n(prev[투입구분]?.야간수량),
        [key]: n(value),
      },
    }))
  }

  async function replaceDetails(투입실적Id: number, rows: 투입상세수량[]) {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from('투입실적상세') as any).delete().eq('투입실적_id', 투입실적Id)
    if (deleteError) throw deleteError

    const payload = rows.map((row) => ({
      투입실적_id: 투입실적Id,
      투입구분: row.투입구분,
      주간수량: n(row.주간수량),
      야간수량: n(row.야간수량),
    }))
    if (payload.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('투입실적상세') as any).insert(payload)
    if (insertError) throw insertError
  }

  async function onSubmit(data: FormValues) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    const rows = merge상세목록(투입구분목록, 상세목록)
    const legacyPayload = 상세목록ToLegacyUpdate(rows)

    try {
      let 투입실적Id = 기존Id
      if (기존Id !== null) {
        const payload: 투입실적Update = {
          ...legacyPayload,
          외주1: data.외주1,
          외주2: data.외주2,
          수정자: uid,
          수정일: new Date().toISOString(),
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('투입실적') as any).update(payload).eq('id', 기존Id)
        if (error) throw error
      } else {
        const payload: 투입실적Insert = {
          수주_id: data.수주_id,
          투입일: data.투입일,
          ...legacyPayload,
          외주1: data.외주1,
          외주2: data.외주2,
          생성자: uid,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ins, error } = await (supabase.from('투입실적') as any)
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        투입실적Id = (ins as { id: number }).id
        set기존Id(투입실적Id)
      }

      if (투입실적Id == null) throw new Error('투입실적 ID를 확인할 수 없습니다.')
      await replaceDetails(투입실적Id, rows)
      showToast(true, '저장되었습니다')
    } catch (error) {
      showToast(false, '저장 실패: ' + (error as { message: string }).message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

      <div className="flex flex-col lg:flex-row lg:items-start gap-5 max-w-4xl">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>공사 선택</Label>
              <div ref={드롭다운Ref} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={검색어}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => 검색결과.length > 0 && set드롭다운(true)}
                    placeholder="지중No 또는 공사명으로 검색..."
                    className={cn(
                      'w-full pl-9 pr-9 h-10 rounded-lg border text-sm outline-none transition-colors',
                      'border-gray-200 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/20',
                      errors.수주_id && 'border-red-400',
                    )}
                  />
                  {실적로딩 && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 animate-spin" />
                  )}
                </div>
                {드롭다운 && 검색결과.length > 0 && (
                  <div className="absolute top-full mt-1 w-full z-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    {검색결과.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelect(order) }}
                        className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-baseline gap-2"
                      >
                        <span className="font-mono text-xs text-gray-400 shrink-0">{order.지중no}</span>
                        <span className="text-sm text-gray-800 truncate">{order.공사명}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {선택수주 && (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-[#3d5af1] font-medium truncate">
                    ✓ {선택수주.지중no} — {선택수주.공사명}
                  </p>
                  <p className="text-xs text-gray-500 shrink-0 ml-3">
                    {최근투입로딩
                      ? '...'
                      : 최근투입일
                        ? <span>마지막 투입 <span className="font-semibold text-gray-700">{최근투입일}</span></span>
                        : '투입 기록 없음'}
                  </p>
                </div>
              )}
              {errors.수주_id && (
                <p className="text-xs text-red-500">{errors.수주_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="투입일">투입일</Label>
              <Input
                id="투입일"
                type="date"
                className="w-44 h-10"
                {...register('투입일')}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">투입구분별 수량</p>
              <p className="text-xs text-gray-400 mt-0.5">공사단가 관리의 투입구분을 자동 반영합니다</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-32">투입구분</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600 w-28">주간</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-indigo-600 w-28">야간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {투입구분목록.map((투입구분) => {
                    const row = 상세[투입구분] ?? { 주간수량: 0, 야간수량: 0 }
                    const isEmpty = n(row.주간수량) === 0 && n(row.야간수량) === 0
                    return (
                      <tr
                        key={투입구분}
                        className={cn(
                          'even:bg-blue-50/40 hover:bg-blue-100/50 transition-colors',
                          isEmpty && 'opacity-35',
                        )}
                      >
                        <td className="px-4 py-2 font-medium text-gray-700 text-sm">{투입구분}</td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="99"
                            value={row.주간수량 === 0 ? '' : row.주간수량}
                            onChange={(e) => set상세값(투입구분, '주간수량', Number(e.target.value))}
                            className={cn(
                              'w-[68px] h-10 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
                              'border-gray-400 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/40',
                              row.주간수량 > 0 && 'border-blue-300 bg-blue-50/60 font-semibold text-blue-700',
                            )}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="99"
                            value={row.야간수량 === 0 ? '' : row.야간수량}
                            onChange={(e) => set상세값(투입구분, '야간수량', Number(e.target.value))}
                            className={cn(
                              'w-[68px] h-10 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
                              'border-gray-400 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/40',
                              row.야간수량 > 0 && 'border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-700',
                            )}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">외주 금액</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="외주1" className="text-xs text-gray-600">외주1 (원)</Label>
                <Input id="외주1" type="number" inputMode="numeric" min="0" step="1000" className="h-10 text-right tabular-nums" {...register('외주1', numOpts)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="외주2" className="text-xs text-gray-600">외주2 (원)</Label>
                <Input id="외주2" type="number" inputMode="numeric" min="0" step="1000" className="h-10 text-right tabular-nums" {...register('외주2', numOpts)} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-6 space-y-3 pb-6">
          <div className="rounded-xl p-5 text-white" style={{ backgroundColor: '#1e2d5a' }}>
            <p className="text-xs font-medium mb-4" style={{ color: '#a8b8e0' }}>
              실시간 계산
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] mb-0.5" style={{ color: '#a8b8e0' }}>투입금액</p>
                <p className="text-sm font-bold tabular-nums">{formatKRW(투입금액)}</p>
              </div>
              <div>
                <p className="text-[11px] mb-0.5" style={{ color: '#a8b8e0' }}>일반관리비 (6%)</p>
                <p className="text-sm font-bold tabular-nums">{formatKRW(일반관리비)}</p>
              </div>
              <div className="pt-3 border-t border-white/20">
                <p className="text-[11px] mb-1 text-white/70">합계</p>
                <p className="text-2xl font-bold tabular-nums leading-tight">{formatKRW(합계)}</p>
              </div>
            </div>
            <p className="text-[10px] mt-4" style={{ color: '#6b80b8' }}>{투입일} 기준 단가</p>
          </div>

          {기존Id !== null && (
            <p className="text-xs text-amber-600 font-medium text-center px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              기존 실적 수정 중
            </p>
          )}

          <div className="space-y-2">
            <Button type="submit" disabled={isSubmitting} className="w-full gap-2 text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#1e2d5a' }}>
              {isSubmitting
                ? <><Loader2 className="size-4 animate-spin" />저장 중...</>
                : <><Save className="size-4" />{기존Id !== null ? '수정 저장' : '저장'}</>}
            </Button>
            <Button type="button" variant="outline" onClick={초기화} className="w-full gap-2">
              <RefreshCw className="size-4" />
              초기화
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
