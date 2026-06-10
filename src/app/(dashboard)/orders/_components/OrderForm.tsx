'use client'

import { createPortal } from 'react-dom'
import { useRef, useState, useEffect, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Save, Loader2, Trash2, CheckCircle2, AlertCircle, AlertTriangle,
  Search, ChevronDown, X as XIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 수주행, 거래처목록항목 } from '../_types'

// ── 옵션 목록 ──────────────────────────────────────────────────────────────
const 공사구분옵션 = ['총가', '단가', '민수', '관급']
const 공사종류옵션 = ['지중', '가공', '혼합']
const 시공상태옵션 = ['미시공', '시공중', '완료']
const 정산상태옵션 = ['1차기성', '2차기성', '3차기성', '4차기성', '5차기성', '완료']

// ── Zod 스키마 ─────────────────────────────────────────────────────────────
const nullNum = { setValueAs: (v: unknown) => (v === '' || v == null ? null : Number(v)) }

const schema = z.object({
  지중no:          z.string().min(1, { error: '지중No를 입력하세요' }),
  공사명:          z.string().min(1, { error: '공사명을 입력하세요' }),
  공사번호:        z.string().optional(),
  공사구분:        z.string().optional(),
  공사종류:        z.string().optional(),
  공사현장:        z.string().optional(),
  발주자_id:       z.number().int().nullable().optional(),
  원청사_id:       z.number().int().nullable().optional(),
  수주금액_공급가: z.number().nullable().optional(),
  보험료율:        z.number().min(0).max(100).nullable().optional(),
  하도전용율:      z.number().min(0).max(100).nullable().optional(),
  공사담당:        z.string().optional(),
  감독자:          z.string().optional(),
  포장여부:        z.boolean().optional(),
  자재청구여부:    z.boolean().optional(),
  참고사항:        z.string().optional(),
  시공상태:        z.string().nullable().optional(),
  정산상태:        z.string().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'new' | 'edit'
  row?: 수주행
  거래처목록: 거래처목록항목[]
  onSuccess: () => void
}

// ── 검색형 거래처 선택 ────────────────────────────────────────────────────
// 핵심: 각 아이템 onMouseDown에서 e.preventDefault() → input blur 차단
// 그 다음 onClick에서 실제 선택 처리 (mousedown → mouseup → click 순서)
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '거래처명으로 검색...',
}: {
  options: 거래처목록항목[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = options.find((o) => o.id === value)
  const deferredQuery = useDeferredValue(query)
  const filtered = deferredQuery
    ? options.filter((o) => o.거래처명.toLowerCase().includes(deferredQuery.toLowerCase()))
    : options

  const openDrop = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    setOpen(true)
    setQuery('')
  }

  // 스크롤 시 닫기
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('scroll', close, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [open])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected?.거래처명 ?? '')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openDrop}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-background text-sm pl-8 pr-8 outline-none',
            'focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors',
            open && 'border-ring ring-3 ring-ring/50',
          )}
        />
        {value != null ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); inputRef.current?.focus() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(o.id); setOpen(false) }}
                  className={cn(
                    'w-full px-3 py-1.5 text-sm text-left hover:bg-blue-50 transition-colors',
                    o.id === value && 'bg-blue-50 text-blue-700 font-medium',
                  )}
                >
                  {o.거래처명}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

// ── 천단위 콤마 금액 입력 ─────────────────────────────────────────────────
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
  const [display, setDisplay] = useState(
    value != null ? value.toLocaleString('ko-KR') : '',
  )

  useEffect(() => {
    setDisplay(value != null ? value.toLocaleString('ko-KR') : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') {
      setDisplay('')
      onChange(null)
    } else {
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

// ── 계산값 표시 행 ─────────────────────────────────────────────────────────
function CalcRow({ label, value, strong, highlight }: {
  label: string; value: number; strong?: boolean; highlight?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between rounded px-2 py-1', highlight && 'bg-blue-50')}>
      <span className={cn('text-[11px] text-gray-500 shrink-0 mr-1', strong && 'font-semibold text-gray-700')}>
        {label}
      </span>
      <span className={cn(
        'text-[11px] tabular-nums text-right break-all',
        strong ? 'font-semibold text-gray-800' : 'text-gray-700',
        highlight && 'text-blue-700',
      )}>
        {formatKRW(value)}
      </span>
    </div>
  )
}

// ── 섹션 헤더 ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
      {children}
    </section>
  )
}

// ── 필드 래퍼 ──────────────────────────────────────────────────────────────
function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string
}) {
  return (
    <div>
      <Label className="text-xs text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export function OrderForm({ mode, row, 거래처목록, onSuccess }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'info' | '기성' | '준공'>('info')

  // 준공 탭 전용 로컬 상태 (useForm에서 분리)
  const [준공여부Local, set준공여부Local] = useState(mode === 'edit' ? (row?.준공여부 ?? false) : false)
  const [준공일Local, set준공일Local] = useState(mode === 'edit' ? (row?.준공일 ?? '') : '')
  const [준공액Local, set준공액Local] = useState<number | null>(mode === 'edit' ? (row?.준공액_공급가 ?? null) : null)
  const [준공저장중, set준공저장중] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ ok, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const defaultValues: FormValues =
    mode === 'edit' && row
      ? {
          지중no:          row.지중no,
          공사명:          row.공사명,
          공사번호:        row.공사번호 ?? '',
          공사구분:        row.공사구분 ?? '',
          공사종류:        row.공사종류 ?? '',
          공사현장:        row.공사현장 ?? '',
          발주자_id:       row.발주자_id ?? null,
          원청사_id:       row.원청사_id ?? null,
          수주금액_공급가: row.수주금액_공급가 ?? null,
          보험료율:        row.보험료율 != null ? row.보험료율 * 100 : null,
          하도전용율:      row.하도전용율 != null ? row.하도전용율 * 100 : null,
          공사담당:        row.공사담당 ?? '',
          감독자:          row.감독자 ?? '',
          포장여부:        row.포장여부,
          자재청구여부:    row.자재청구여부,
          참고사항:        row.참고사항 ?? '',
          시공상태:        row.시공상태 ?? '',
          정산상태:        row.정산상태 ?? '',
        }
      : {
          지중no: '', 공사명: '',
          포장여부: false, 자재청구여부: false,
        }

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues })

  // 실시간 계산
  const 공급가raw    = watch('수주금액_공급가')
  const 보험료율pct  = watch('보험료율') ?? null
  const 하도전용율pct = watch('하도전용율') ?? null

  const 공급가 = typeof 공급가raw === 'number' ? 공급가raw : 0
  const 부가세 = 공급가 * 0.1
  const 합계   = 공급가 + 부가세
  const 보험료율dec   = 보험료율pct !== null ? 보험료율pct / 100 : null
  const 하도전용율dec = 하도전용율pct !== null ? 하도전용율pct / 100 : null
  const 보험료제외 = 보험료율dec !== null ? 공급가 * (1 - 보험료율dec) : null
  const 하도적용   = 보험료제외 !== null && 하도전용율dec !== null
    ? 보험료제외 * 하도전용율dec : null

  // 원청사 선택 시 요율 자동 채우기
  const handleClientChange = (id: number | null) => {
    if (id === null) return
    const c = 거래처목록.find((x) => x.id === id)
    if (c?.보험료제외율 != null) setValue('보험료율', c.보험료제외율 * 100)
    if (c?.하도전용율 != null)  setValue('하도전용율', c.하도전용율 * 100)
  }

  // 저장
  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      지중no:          values.지중no.trim(),
      공사명:          values.공사명.trim(),
      공사번호:        values.공사번호?.trim() || null,
      공사구분:        values.공사구분 || null,
      공사종류:        values.공사종류 || null,
      공사현장:        values.공사현장?.trim() || null,
      발주자_id:       values.발주자_id ?? null,
      원청사_id:       values.원청사_id ?? null,
      수주금액_공급가: values.수주금액_공급가 ?? null,
      보험료율:        values.보험료율 != null ? values.보험료율 / 100 : null,
      하도전용율:      values.하도전용율 != null ? values.하도전용율 / 100 : null,
      공사담당:        values.공사담당?.trim() || null,
      감독자:          values.감독자?.trim() || null,
      포장여부:        values.포장여부 ?? false,
      자재청구여부:    values.자재청구여부 ?? false,
      참고사항:        values.참고사항?.trim() || null,
      ...(mode === 'edit' ? {
        시공상태:      values.시공상태 || null,
        정산상태:      values.정산상태 || null,
      } : {}),
    }

    let error: { message?: string } | null = null
    if (mode === 'new') {
      ;({ error } = await supabase.from('수주').insert(payload as any))
    } else {
      ;({ error } = await (supabase.from('수주') as any).update(payload).eq('id', row!.id))
    }

    setSaving(false)

    if (error) {
      let msg = '저장에 실패했습니다.'
      if (error.message?.includes('지중no')) msg = '이미 등록된 지중No입니다.'
      else if (error.message?.includes('공사명')) msg = '이미 등록된 공사명입니다.'
      showToast(false, msg)
      return
    }

    showToast(true, mode === 'new' ? '수주가 등록되었습니다.' : '수정되었습니다.')
    router.refresh()
    setTimeout(onSuccess, 1200)
  }

  // 준공 저장 핸들러
  const handleJunGongSave = async () => {
    if (!row) return
    set준공저장중(true)
    const supabase = createClient()
    const { error } = await (supabase.from('수주') as any)
      .update({
        준공여부: 준공여부Local,
        준공일: 준공여부Local ? 준공일Local || null : null,
        준공액_공급가: 준공여부Local ? 준공액Local : null,
      })
      .eq('id', row.id)
    set준공저장중(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    showToast(true, '준공 정보가 저장되었습니다.')
    router.refresh()
  }

  // 삭제
  const handleDelete = async () => {
    if (!row) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('수주').delete().eq('id', row.id)
    setDeleting(false)

    if (error) {
      showToast(false, '연결된 투입실적/공사이력이 있어 삭제할 수 없습니다.')
      setDeleteConfirm(false)
      return
    }

    showToast(true, '삭제되었습니다.')
    router.refresh()
    setTimeout(onSuccess, 800)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'absolute top-3 left-5 z-[10000] flex items-center gap-2 px-3 py-2 rounded-lg text-sm shadow-md border',
          toast.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200',
        )}>
          {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 탭 바 — 수정 모드에서만 */}
      {mode === 'edit' && (
        <div className="flex border-b border-gray-100 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'info' ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-gray-500 border-transparent hover:text-gray-700',
            )}
          >
            기본정보
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('기성')}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === '기성' ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-gray-500 border-transparent hover:text-gray-700',
            )}
          >
            기성{(row?.기성?.length ?? 0) > 0 && (
              <span className="ml-1.5 bg-[#3d5af1] text-white text-[10px] rounded-full px-1.5 py-0.5">
                {row?.기성?.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('준공')}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === '준공' ? 'text-[#22c55e] border-[#22c55e]' : 'text-gray-500 border-transparent hover:text-gray-700',
            )}
          >
            준공{준공여부Local && (
              <span className="ml-1.5 bg-[#22c55e] text-white text-[10px] rounded-full px-1.5 py-0.5">완료</span>
            )}
          </button>
        </div>
      )}

      {/* 기본정보 탭 */}
      {activeTab === 'info' && (
        <div className="flex flex-1 overflow-hidden">
          {/* 좌측: 스크롤 폼 */}
          <form
            id="order-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0"
          >
            {/* ── 필수 정보 ─────────────────────────────────────────────────── */}
            <Section title="필수 정보">
              <Field label="지중No" required error={errors.지중no?.message}>
                <Input
                  className={cn('h-9 text-sm font-mono', errors.지중no && 'border-red-400')}
                  placeholder="CG26-001"
                  {...register('지중no')}
                />
              </Field>
              <Field label="공사명" required error={errors.공사명?.message}>
                <Textarea
                  className={cn('text-sm min-h-[60px] resize-none', errors.공사명 && 'border-red-400')}
                  placeholder="5R구역 배수로공사 진성간12 지장이설"
                  {...register('공사명')}
                />
              </Field>
              <Field label="수주금액(공급가)">
                <Controller
                  name="수주금액_공급가"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      className="h-9 text-sm"
                      placeholder="0"
                    />
                  )}
                />
              </Field>
            </Section>

            <Separator />

            {/* ── 계약 정보 ─────────────────────────────────────────────────── */}
            <Section title="계약 정보">
              {/* 공사구분 · 공사종류 · 공사현장 — 3열 */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="공사구분">
                  <Controller
                    name="공사구분"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {공사구분옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="공사종류">
                  <Controller
                    name="공사종류"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {공사종류옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="공사현장">
                  <Input className="h-9 text-sm" placeholder="광명" {...register('공사현장')} />
                </Field>
              </div>

              <Field label="공사번호">
                <Input className="h-9 text-sm" placeholder="8474-2025-3315" {...register('공사번호')} />
              </Field>

              {/* 발주자 · 원청사 — 2열 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="발주자">
                  <Controller
                    name="발주자_id"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        options={거래처목록}
                        value={field.value ?? null}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>
                <Field label="원청사">
                  <Controller
                    name="원청사_id"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        options={거래처목록}
                        value={field.value ?? null}
                        onChange={(id) => { field.onChange(id); handleClientChange(id) }}
                        placeholder="선택 시 요율 자동 적용"
                      />
                    )}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="보험료율 (%)">
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    className="h-9 text-sm" placeholder="7.5"
                    {...register('보험료율', nullNum)}
                  />
                </Field>
                <Field label="하도전용율 (%)">
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    className="h-9 text-sm" placeholder="85"
                    {...register('하도전용율', nullNum)}
                  />
                </Field>
              </div>
            </Section>

            <Separator />

            {/* ── 담당자 ────────────────────────────────────────────────────── */}
            <Section title="담당자">
              <div className="grid grid-cols-2 gap-3">
                <Field label="공사담당">
                  <Input className="h-9 text-sm" {...register('공사담당')} />
                </Field>
                <Field label="감독자">
                  <Input className="h-9 text-sm" {...register('감독자')} />
                </Field>
              </div>
            </Section>

            <Separator />

            {/* ── 기타 ──────────────────────────────────────────────────────── */}
            <Section title="기타">
              <div className="flex items-center gap-6">
                <Controller
                  name="포장여부"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                      포장여부
                    </label>
                  )}
                />
                <Controller
                  name="자재청구여부"
                  control={control}
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                      자재청구여부
                    </label>
                  )}
                />
              </div>
              <Field label="참고사항">
                <Textarea className="text-sm min-h-[64px] resize-none" {...register('참고사항')} />
              </Field>
            </Section>

            {/* ── 진행 상태 (수정 모드만) ───────────────────────────────────── */}
            {mode === 'edit' && (
              <>
                <Separator />
                <Section title="진행 상태">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="시공상태">
                      <Controller
                        name="시공상태"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {시공상태옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="정산상태">
                      <Controller
                        name="정산상태"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {정산상태옵션.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </div>
                </Section>
              </>
            )}

            {/* 삭제 확인 */}
            {deleteConfirm && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                <p className="text-sm text-red-700 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="size-4" />
                  정말 삭제하시겠습니까?
                </p>
                <p className="text-xs text-red-600">연결된 투입실적·공사이력이 없는 경우에만 삭제됩니다.</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button" size="sm" variant="destructive"
                    onClick={handleDelete} disabled={deleting} className="h-7 text-xs"
                  >
                    {deleting ? <Loader2 className="size-3 animate-spin" /> : '삭제 확인'}
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => setDeleteConfirm(false)} className="h-7 text-xs"
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}

            <div className="h-2" />
          </form>

          {/* 우측: 실시간 계산 + 버튼 */}
          <div className="w-52 shrink-0 border-l border-gray-100 flex flex-col bg-gray-50/40">
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

              {/* 수주금액 계산 */}
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">수주금액 계산</p>
                <CalcRow label="공급가" value={공급가} strong />
                <CalcRow label="부가세 (10%)" value={부가세} />
                <CalcRow label="합계 (VAT포함)" value={합계} strong />
              </div>

              {(보험료율pct !== null || 하도전용율pct !== null) && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">적용금액</p>
                  {보험료제외 !== null && (
                    <CalcRow label={`보험료제외 (${보험료율pct?.toFixed(1)}%)`} value={보험료제외} />
                  )}
                  {하도적용 !== null && (
                    <CalcRow label={`하도적용 (${하도전용율pct?.toFixed(1)}%)`} value={하도적용} strong highlight />
                  )}
                </div>
              )}

              {공급가 === 0 && (
                <p className="text-[11px] text-gray-400 text-center pt-2">
                  수주금액을 입력하면<br />자동으로 계산됩니다
                </p>
              )}
            </div>

            {/* 버튼 */}
            <div className="px-4 pb-5 pt-3 space-y-2 shrink-0 border-t border-gray-100">
              <Button
                type="submit"
                form="order-form"
                size="sm"
                className="w-full h-9 text-sm bg-[#1e2d5a] hover:bg-[#2d45a8]"
                disabled={saving}
              >
                {saving
                  ? <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  : <Save className="size-3.5 mr-1.5" />}
                {mode === 'new' ? '등록' : '저장'}
              </Button>
              {mode === 'edit' && !deleteConfirm && (
                <Button
                  type="button" size="sm" variant="outline"
                  className="w-full h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  삭제
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 준공 탭 */}
      {mode === 'edit' && activeTab === '준공' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-sm space-y-4">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
              <Checkbox
                checked={준공여부Local}
                onCheckedChange={(v) => {
                  set준공여부Local(!!v)
                  if (!v) { set준공일Local(''); set준공액Local(null) }
                }}
              />
              <span className="font-medium">준공 완료</span>
            </label>

            {준공여부Local && (
              <>
                <Field label="준공일">
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={준공일Local}
                    onChange={(e) => set준공일Local(e.target.value)}
                  />
                </Field>
                <Field label="준공액 (공급가)">
                  <MoneyInput
                    value={준공액Local}
                    onChange={set준공액Local}
                    className="h-9 text-sm"
                  />
                </Field>
                {준공액Local != null && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>부가세 (10%)</span>
                      <span>{formatKRW(준공액Local * 0.1)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-green-700">
                      <span>준공 합계</span>
                      <span>{formatKRW(준공액Local * 1.1)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <Button
              type="button"
              size="sm"
              className="w-full h-9 text-sm bg-[#1e2d5a] hover:bg-[#2d45a8]"
              onClick={handleJunGongSave}
              disabled={준공저장중}
            >
              {준공저장중 ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
              준공 저장
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
