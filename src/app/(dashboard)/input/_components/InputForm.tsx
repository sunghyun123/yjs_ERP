'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { calc투입금액 } from '@/app/(dashboard)/_lib/calc'
import type { 공사단가Row, 투입실적Row, 투입실적Insert, 투입실적Update } from '@/types/database'

// ── 직종 행 정의 ─────────────────────────────────────────────────────────────
const 직종행 = [
  { label: '상용직',    주: '상용직_주',    야: '상용직_야'    },
  { label: '일용직',    주: '일용직_주',    야: '일용직_야'    },
  { label: '모범신호수 (h)', 주: '모범신호수_주', 야: '모범신호수_야' },
  { label: '6W',        주: 'w6_주',        야: 'w6_야'        },
  { label: '3W',        주: 'w3_주',        야: 'w3_야'        },
  { label: '덤프15T',   주: '덤프15t_주',   야: '덤프15t_야'   },
  { label: '크레인',    주: '크레인_주',    야: '크레인_야'    },
  { label: '물청소차',  주: '물청소차_주',  야: '물청소차_야'  },
  { label: 'MCM',       주: 'mcm_주',       야: 'mcm_야'       },
  { label: '재료비/인', 주: '재료비인_주',  야: '재료비인_야'  },
  { label: '접속',      주: '접속_주',      야: '접속_야'      },
] as const

// ── Zod 스키마 ────────────────────────────────────────────────────────────────
// z.coerce는 Zod v4에서 타입 추론이 unknown으로 깨짐 → z.number() + setValueAs 사용
const w = z.number().min(0).max(99)
const amt = z.number().min(0)

// register 옵션: 빈 문자열 → 0, 기타 → Number 변환
const numOpts = { setValueAs: (v: unknown) => (v === '' || v == null) ? 0 : Number(v) || 0 }

const schema = z.object({
  수주_id:       z.number().int().min(1, { error: '공사를 선택하세요' }),
  투입일:        z.string().min(1, { error: '날짜를 입력하세요' }),
  상용직_주:     w, 상용직_야:     w,
  일용직_주:     w, 일용직_야:     w,
  모범신호수_주: w, 모범신호수_야: w,
  w6_주:         w, w6_야:         w,
  w3_주:         w, w3_야:         w,
  덤프15t_주:    w, 덤프15t_야:    w,
  크레인_주:     w, 크레인_야:     w,
  물청소차_주:   w, 물청소차_야:   w,
  mcm_주:        w, mcm_야:        w,
  재료비인_주:   w, 재료비인_야:   w,
  접속_주:       w, 접속_야:       w,
  외주1: amt, 외주2: amt,
})

type FormValues = z.infer<typeof schema>

const 인원기본값 = {
  상용직_주: 0, 상용직_야: 0,
  일용직_주: 0, 일용직_야: 0,
  모범신호수_주: 0, 모범신호수_야: 0,
  w6_주: 0, w6_야: 0,
  w3_주: 0, w3_야: 0,
  덤프15t_주: 0, 덤프15t_야: 0,
  크레인_주: 0, 크레인_야: 0,
  물청소차_주: 0, 물청소차_야: 0,
  mcm_주: 0, mcm_야: 0,
  재료비인_주: 0, 재료비인_야: 0,
  접속_주: 0, 접속_야: 0,
  외주1: 0, 외주2: 0,
} satisfies Omit<FormValues, '수주_id' | '투입일'>

function today() {
  return new Date().toISOString().slice(0, 10)
}

function n(v: unknown): number {
  const num = Number(v)
  return isNaN(num) ? 0 : num
}

type 수주검색결과 = { id: number; 지중no: string; 공사명: string }

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function InputForm({ 단가목록 }: { 단가목록: 공사단가Row[] }) {
  const [선택수주, set선택수주] = useState<수주검색결과 | null>(null)
  const [검색어, set검색어] = useState('')
  const [검색결과, set검색결과] = useState<수주검색결과[]>([])
  const [드롭다운, set드롭다운] = useState(false)
  const [실적로딩, set실적로딩] = useState(false)
  const [기존Id, set기존Id] = useState<number | null>(null)
  const [최근투입일, set최근투입일] = useState<string | null>(null)
  const [최근투입로딩, set최근투입로딩] = useState(false)
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
    defaultValues: { 수주_id: 0, 투입일: today(), ...인원기본값 },
  })

  const values = watch()
  const 투입일 = values.투입일
  const 수주id = values.수주_id

  // ── 실시간 합계 ───────────────────────────────────────────────────────────
  const fakeRow: 투입실적Row = {
    id: 0,
    수주_id:      n(수주id),
    투입일:       투입일 || today(),
    상용직_주:    n(values.상용직_주),    상용직_야:    n(values.상용직_야),
    일용직_주:    n(values.일용직_주),    일용직_야:    n(values.일용직_야),
    모범신호수_주: n(values.모범신호수_주), 모범신호수_야: n(values.모범신호수_야),
    w6_주:        n(values.w6_주),        w6_야:        n(values.w6_야),
    w3_주:        n(values.w3_주),        w3_야:        n(values.w3_야),
    덤프15t_주:   n(values.덤프15t_주),   덤프15t_야:   n(values.덤프15t_야),
    크레인_주:    n(values.크레인_주),    크레인_야:    n(values.크레인_야),
    물청소차_주:  n(values.물청소차_주),  물청소차_야:  n(values.물청소차_야),
    mcm_주:       n(values.mcm_주),       mcm_야:       n(values.mcm_야),
    재료비인_주:  n(values.재료비인_주),  재료비인_야:  n(values.재료비인_야),
    접속_주:      n(values.접속_주),      접속_야:      n(values.접속_야),
    외주1: n(values.외주1), 외주2: n(values.외주2),
    생성자: null, 생성일: '', 수정자: null, 수정일: null,
  }
  const 투입금액 = calc투입금액(fakeRow, 단가목록)
  const 일반관리비 = Math.round(투입금액 * 0.06)
  const 합계 = 투입금액 + 일반관리비

  // ── row → form 채우기 헬퍼 ───────────────────────────────────────────────
  const fillRow = useCallback((row: 투입실적Row) => {
    setValue('상용직_주', row.상용직_주);    setValue('상용직_야', row.상용직_야)
    setValue('일용직_주', row.일용직_주);    setValue('일용직_야', row.일용직_야)
    setValue('모범신호수_주', row.모범신호수_주); setValue('모범신호수_야', row.모범신호수_야)
    setValue('w6_주', row.w6_주);            setValue('w6_야', row.w6_야)
    setValue('w3_주', row.w3_주);            setValue('w3_야', row.w3_야)
    setValue('덤프15t_주', row.덤프15t_주);  setValue('덤프15t_야', row.덤프15t_야)
    setValue('크레인_주', row.크레인_주);    setValue('크레인_야', row.크레인_야)
    setValue('물청소차_주', row.물청소차_주); setValue('물청소차_야', row.물청소차_야)
    setValue('mcm_주', row.mcm_주);          setValue('mcm_야', row.mcm_야)
    setValue('재료비인_주', row.재료비인_주); setValue('재료비인_야', row.재료비인_야)
    setValue('접속_주', row.접속_주);        setValue('접속_야', row.접속_야)
    setValue('외주1', row.외주1);            setValue('외주2', row.외주2)
  }, [setValue])

  // ── 수주+날짜 변경 시 기존 실적 로드 ────────────────────────────────────
  useEffect(() => {
    if (!수주id || 수주id < 1 || !투입일) return
    set실적로딩(true)
    const supabase = createClient()
    supabase
      .from('투입실적')
      .select()
      .eq('수주_id', 수주id)
      .eq('투입일', 투입일)
      .single()
      .then(({ data: raw }) => {
        if (raw) {
          const row = raw as 투입실적Row
          set기존Id(row.id)
          fillRow(row)
        } else {
          set기존Id(null)
          reset({ 수주_id: 수주id, 투입일, ...인원기본값 })
        }
        set실적로딩(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [수주id, 투입일])

  // ── 드롭다운 외부 클릭 닫기 ──────────────────────────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!드롭다운Ref.current?.contains(e.target as Node)) set드롭다운(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // ── 토스트 ───────────────────────────────────────────────────────────────
  function showToast(ok: boolean, msg: string) {
    if (토스트타이머.current) clearTimeout(토스트타이머.current)
    setToast({ ok, msg })
    토스트타이머.current = setTimeout(() => setToast(null), 3500)
  }

  // ── 공사 검색 ─────────────────────────────────────────────────────────────
  function handleSearch(q: string) {
    set검색어(q)
    if (검색타이머.current) clearTimeout(검색타이머.current)
    if (!q.trim()) { set검색결과([]); set드롭다운(false); return }
    검색타이머.current = setTimeout(async () => {
      const supabase = createClient()
      const { data: raw } = await supabase
        .from('수주')
        .select('id, 지중no, 공사명')
        .or(`지중no.ilike.%${q}%,공사명.ilike.%${q}%`)
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
      .single()
    set최근투입로딩(false)
    set최근투입일((data as { 투입일: string } | null)?.투입일 ?? null)
  }

  // ── 초기화 ───────────────────────────────────────────────────────────────
  function 초기화() {
    reset({ 수주_id: 수주id, 투입일, ...인원기본값 })
    set기존Id(null)
  }

  // ── 저장 ─────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormValues) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null

    if (기존Id !== null) {
      const payload: 투입실적Update = {
        상용직_주: data.상용직_주,    상용직_야: data.상용직_야,
        일용직_주: data.일용직_주,    일용직_야: data.일용직_야,
        모범신호수_주: data.모범신호수_주, 모범신호수_야: data.모범신호수_야,
        w6_주: data.w6_주, w6_야: data.w6_야,
        w3_주: data.w3_주, w3_야: data.w3_야,
        덤프15t_주: data.덤프15t_주,  덤프15t_야: data.덤프15t_야,
        크레인_주: data.크레인_주,    크레인_야: data.크레인_야,
        물청소차_주: data.물청소차_주, 물청소차_야: data.물청소차_야,
        mcm_주: data.mcm_주, mcm_야: data.mcm_야,
        재료비인_주: data.재료비인_주, 재료비인_야: data.재료비인_야,
        접속_주: data.접속_주,        접속_야: data.접속_야,
        외주1: data.외주1, 외주2: data.외주2,
        수정자: uid, 수정일: new Date().toISOString(),
      }
      // 한글 테이블명 타입 추론 이슈 → as any (PROGRESS.md 참고)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('투입실적') as any).update(payload).eq('id', 기존Id)
      if (error) { showToast(false, '저장 실패: ' + (error as { message: string }).message); return }
    } else {
      const payload: 투입실적Insert = { ...data, 생성자: uid }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins, error } = await (supabase.from('투입실적') as any)
        .insert(payload).select('id').single()
      if (error) { showToast(false, '저장 실패: ' + (error as { message: string }).message); return }
      if (ins) set기존Id((ins as { id: number }).id)
    }
    showToast(true, '저장되었습니다')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

      {/* 2단 레이아웃: lg 이상에서 좌(입력) / 우(계산+버튼) 분리 */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-5 max-w-2xl mx-auto w-full">

        {/* ── 좌측: 입력 영역 ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 공사 선택 + 날짜 */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">

            {/* 공사 자동완성 */}
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

            {/* 투입일 */}
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

          {/* 직종별 입력 그리드 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">직종별 투입 인원</p>
              <p className="text-xs text-gray-400 mt-0.5">Tab 키로 주간→야간→다음 직종 순서로 이동</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-32">직종</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600 w-28">주간</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-indigo-600 w-28">야간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {직종행.map(({ label, 주, 야 }) => {
                    const 주값 = n(values[주 as keyof FormValues])
                    const 야값 = n(values[야 as keyof FormValues])
                    const isEmpty = 주값 === 0 && 야값 === 0
                    return (
                      <tr
                        key={label}
                        className={cn(
                          'hover:bg-slate-50/60 transition-colors',
                          isEmpty && 'opacity-35',
                        )}
                      >
                        <td className="px-4 py-2 font-medium text-gray-700 text-sm">{label}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="99"
                            className={cn(
                              'w-20 h-9 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
                              'border-gray-200 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/20',
                              주값 > 0 && 'border-blue-300 bg-blue-50/60 font-semibold text-blue-700',
                            )}
                            {...register(주 as keyof FormValues, numOpts)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="99"
                            className={cn(
                              'w-20 h-9 text-center rounded-md border text-sm tabular-nums outline-none transition-colors',
                              'border-gray-200 bg-white focus:border-[#3d5af1] focus:ring-2 focus:ring-[#3d5af1]/20',
                              야값 > 0 && 'border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-700',
                            )}
                            {...register(야 as keyof FormValues, numOpts)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 외주 금액 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">외주 금액</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="외주1" className="text-xs text-gray-600">외주1 (원)</Label>
                <Input
                  id="외주1"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1000"
                  className="h-10 text-right tabular-nums"
                  {...register('외주1', numOpts)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="외주2" className="text-xs text-gray-600">외주2 (원)</Label>
                <Input
                  id="외주2"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1000"
                  className="h-10 text-right tabular-nums"
                  {...register('외주2', numOpts)}
                />
              </div>
            </div>
          </div>

        </div>

        {/* ── 우측: 실시간 계산 + 버튼 (lg 이상에서 sticky) ── */}
        <div className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-6 space-y-3 pb-6">

          {/* 실시간 계산 패널 */}
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

          {/* 기존 실적 수정 중 표시 */}
          {기존Id !== null && (
            <p className="text-xs text-amber-600 font-medium text-center px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
              기존 실적 수정 중
            </p>
          )}

          {/* 저장 / 초기화 버튼 */}
          <div className="space-y-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gap-2 text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#1e2d5a' }}
            >
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
