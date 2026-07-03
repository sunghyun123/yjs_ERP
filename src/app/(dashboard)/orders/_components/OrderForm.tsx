'use client'

import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { useRef, useState, useEffect, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Save, Loader2, Trash2, CheckCircle2, AlertCircle, AlertTriangle,
  Search, ChevronDown, X as XIcon, Plus,
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
import { useComboboxKeyboard } from '@/hooks/useComboboxKeyboard'
import type { 수주행, 거래처목록항목, 기성항목, 공무담당자목록항목 } from '../_types'
import { calc준공정산delta, calc달성율, calc하도적용금액 } from '../_lib/completion'

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
  공무담당자_id:   z.number().int().nullable().optional(),
  포장여부:        z.boolean().optional(),
  자재청구여부:    z.boolean().optional(),
  참고사항:        z.string().optional(),
  착공일:          z.string().nullable().optional(),
  시공상태:        z.string().nullable().optional(),
  정산상태:        z.string().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  mode: 'new' | 'edit'
  row?: 수주행
  거래처목록: 거래처목록항목[]
  공무담당자목록: 공무담당자목록항목[]
  공사현장목록: string[]
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
  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = options.find((o) => o.id === value)
  const deferredQuery = useDeferredValue(query)
  const filtered = deferredQuery
    ? options.filter((o) => o.거래처명.toLowerCase().includes(deferredQuery.toLowerCase()))
    : options

  // 위치 계산만 분리 — onFocus(query 초기화)와 onChange(query 보존) 양쪽에서 재사용
  const positionDrop = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const openDrop = () => {
    positionDrop()
    setOpen(true)
    setQuery('')
  }

  // 키보드 ↑↓/Enter/Esc 선택 — 항목은 index로만 다루므로 filtered에서 꺼내 호출부가 선택한다
  const { activeIndex, setActiveIndex, onKeyDown } = useComboboxKeyboard({
    open,
    itemCount: filtered.length,
    onSelect: (i) => { onChange(filtered[i].id); setOpen(false) },
    onClose: () => setOpen(false),
    onOpen: openDrop,
    listRef: dropRef,
  })

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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected?.거래처명 ?? '')}
          onChange={(e) => {
            setQuery(e.target.value)
            // 선택 직후엔 포커스가 남은 채 open=false라 onFocus가 다시 안 터진다.
            // 타이핑이 곧 "편집 시작"이므로 닫혀 있으면 드롭다운을 되살린다(query는 보존).
            if (!open) { positionDrop(); setOpen(true) }
          }}
          onKeyDown={onKeyDown}
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
          <DismissableLayerBranch>
            <div
              ref={dropRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, pointerEvents: 'auto' }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
              ) : (
                filtered.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    data-combobox-item
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)} // 마우스와 키보드 하이라이트를 한 상태로 동기화
                    onClick={() => { onChange(o.id); setOpen(false) }}
                    className={cn(
                      'w-full px-3 py-1.5 text-sm text-left transition-colors',
                      i === activeIndex && 'bg-blue-50',                       // 키보드 커서
                      o.id === value && 'bg-blue-50 text-blue-700 font-medium', // 현재 선택값
                    )}
                  >
                    {o.거래처명}
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
  // display는 value의 파생(항상 계산 가능) — state+effect 동기화가 만들던 틀린 프레임·낭비 렌더 제거.
  // 진실의 원천은 부모 value 하나: 입력 → onChange → 부모 갱신 → 다음 렌더에 포맷되어 표시
  const display = value != null ? value.toLocaleString('ko-KR') : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    onChange(raw === '' ? null : parseInt(raw, 10))
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
      <span className={cn('text-[11px] text-gray-500 shrink-0 mr-1 whitespace-nowrap', strong && 'font-semibold text-gray-700')}>
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
        {required && <span className="text-orange-400 ml-0.5">*</span>}
      </Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export function OrderForm({ mode, row, 거래처목록, 공무담당자목록, 공사현장목록, onSuccess }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'info' | '기성' | '준공'>('info')

  // 준공 탭 전용 로컬 상태 (useForm에서 분리)
  const [준공여부Local, set준공여부Local] = useState(mode === 'edit' ? (row?.준공여부 ?? false) : false)
  const [준공일Local, set준공일Local] = useState(mode === 'edit' ? (row?.준공일 ?? '') : '')
  const [준공액Local, set준공액Local] = useState<number | null>(mode === 'edit' ? (row?.준공액_공급가 ?? null) : null)
  const [준공저장중, set준공저장중] = useState(false)

  // 기성 탭 상태
  const [기성목록, set기성목록] = useState<기성항목[]>(
    (row?.기성 ?? []).slice().sort((a, b) => a.차수 - b.차수)
  )
  const [기성폼모드, set기성폼모드] = useState<'none' | 'add' | number>('none')
  const [기성폼값, set기성폼값] = useState<{ 기성일: string; 기성액_공급가: number | null; 작업내용: string; 담당공무_id: number | null }>({
    기성일: '', 기성액_공급가: null, 작업내용: '', 담당공무_id: null,
  })
  const [기성처리중, set기성처리중] = useState(false)

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

  const [공정누계, set공정누계] = useState<number>(0)

  useEffect(() => {
    if (mode !== 'edit' || !row) return
    const supabase = createClient()
    ;supabase.from('공사이력')
      .select('성과금액')
      .eq('수주_id', row.id)
      .then(({ data }) => {
        // 한국어 컬럼 select 문자열은 postgrest-js 타입 파서가 못 읽어 unknown 경유 캐스트
        const rows = (data ?? []) as unknown as { 성과금액: number | null }[]
        const sum = rows.reduce((s, r) => s + (r.성과금액 ?? 0), 0)
        set공정누계(sum)
      })
  }, [mode, row?.id])

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
          공무담당자_id:   row.공무담당자_id ?? null,
          포장여부:        row.포장여부,
          자재청구여부:    row.자재청구여부,
          참고사항:        row.참고사항 ?? '',
          착공일:          row.착공일 ?? '',
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
      공무담당자_id:   values.공무담당자_id ?? null,
      포장여부:        values.포장여부 ?? false,
      자재청구여부:    values.자재청구여부 ?? false,
      참고사항:        values.참고사항?.trim() || null,
      착공일:          values.착공일?.trim() || null,
      ...(mode === 'edit' ? {
        시공상태:      values.시공상태 || null,
        정산상태:      values.정산상태 || null,
      } : {}),
    }

    let error: { message?: string } | null = null
    if (mode === 'new') {
      ;({ error } = await supabase.from('수주').insert(payload))
    } else {
      ;({ error } = await supabase.from('수주').update(payload).eq('id', row!.id))
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

  // 준공 저장/해제 핸들러
  // - 완료: 수주.달성율=100 세팅 + 준공정산 행(준공정산=true) upsert (성과=준공액공급가−기존누계)
  // - 해제: 자동 준공정산 행만 삭제(사용자 공사이력 보존) + 달성율 재계산
  const handleJunGongSave = async () => {
    if (!row) return
    const supabase = createClient()

    // ── 준공 완료 ──────────────────────────────────────────────
    if (준공여부Local) {
      if (!준공일Local || 준공액Local == null) {
        showToast(false, '준공일과 준공액을 모두 입력하세요.')
        return
      }
      set준공저장중(true)

      // 기존 성과 누계(준공정산 행 제외) + 기존 정산행 식별
      const { data: 이력, error: 조회err } = await supabase.from('공사이력')
        .select('id, 성과금액, 준공정산')
        .eq('수주_id', row.id)
      if (조회err) { set준공저장중(false); showToast(false, '공사이력 조회에 실패했습니다.'); return }

      const 이력목록 = (이력 ?? []) as unknown as { id: number; 성과금액: number | null; 준공정산: boolean }[]
      const 기존누계 = 이력목록
        .filter((r) => !r.준공정산)
        .reduce((s, r) => s + (r.성과금액 ?? 0), 0)
      const 기존정산행 = 이력목록.find((r) => r.준공정산) ?? null

      const delta = calc준공정산delta(준공액Local, 기존누계)

      // 하향 정산(기존 누계 > 준공액) 경고
      if (delta < 0 && !window.confirm(
        `기존 성과 누계(${formatKRW(기존누계)})가 준공액(${formatKRW(준공액Local)})보다 큽니다.\n` +
        `성과가 ${formatKRW(delta)}원 하향 조정됩니다. 계속할까요?`
      )) { set준공저장중(false); return }

      // 1) 수주 업데이트 — 달성율 100 플래그
      const { error: 수주err } = await supabase.from('수주')
        .update({ 준공여부: true, 준공일: 준공일Local, 준공액_공급가: 준공액Local, 달성율: 100 })
        .eq('id', row.id)
      if (수주err) { set준공저장중(false); showToast(false, '준공 저장에 실패했습니다.'); return }

      // 2) 준공정산 행 upsert (작업일자=준공일)
      let 정산err: { message?: string } | null = null
      if (기존정산행) {
        ;({ error: 정산err } = await supabase.from('공사이력')
          .update({ 작업일자: 준공일Local, 성과금액: delta })
          .eq('id', 기존정산행.id))
      } else {
        ;({ error: 정산err } = await supabase.from('공사이력')
          .insert({
            수주_id: row.id,
            작업일자: 준공일Local,
            성과금액: delta,
            작업내용: '준공정산(자동)',
            준공정산: true,
            담당공무_id: row.공무담당자_id ?? null,
          }))
      }
      set준공저장중(false)
      if (정산err) { showToast(false, '준공정산 적재에 실패했습니다.'); return }

      showToast(true, '준공 처리 완료 — 달성률 100%·매출손익 반영됨.')
      router.refresh()
      return
    }

    // ── 준공 해제 ──────────────────────────────────────────────
    if (row.준공여부) {
      if (!window.confirm(
        '준공을 해제하면 자동 생성된 준공정산 성과 1건이 제거되고 달성률이 재계산됩니다.\n' +
        '직접 입력하신 공사이력은 그대로 보존됩니다. 계속할까요?'
      )) return
    }
    set준공저장중(true)

    // 1) 자동 준공정산 행만 삭제 (eq 준공정산=true 보장 → 사용자 데이터 손실 경로 없음)
    const { error: 삭제err } = await supabase.from('공사이력')
      .delete().eq('수주_id', row.id).eq('준공정산', true)
    if (삭제err) { set준공저장중(false); showToast(false, '준공 해제에 실패했습니다.'); return }

    // 2) 남은 성과 누계로 달성율 재계산
    const { data: 남은이력 } = await supabase.from('공사이력')
      .select('성과금액').eq('수주_id', row.id)
    const 남은누계 = ((남은이력 ?? []) as unknown as { 성과금액: number | null }[])
      .reduce((s, r) => s + (r.성과금액 ?? 0), 0)
    const 하도적용 = calc하도적용금액(row.수주금액_공급가, row.보험료율, row.하도전용율)
    const 재계산달성율 = calc달성율(남은누계, 하도적용)

    const { error: 수주err } = await supabase.from('수주')
      .update({ 준공여부: false, 준공일: null, 준공액_공급가: null, 달성율: 재계산달성율 })
      .eq('id', row.id)
    set준공저장중(false)
    if (수주err) { showToast(false, '준공 해제에 실패했습니다.'); return }

    showToast(true, '준공이 해제되었습니다.')
    router.refresh()
  }

  const 기성누계공급가 = 기성목록.reduce((sum, g) => sum + (g.기성액_공급가 ?? 0), 0)
  const 다음차수 = 기성목록.length > 0 ? Math.max(...기성목록.map((g) => g.차수)) + 1 : 1

  // 달성률 표시값. 준공이면 공정·기성 모두 100% 고정(준공=완료 확정, 기준금액=준공액).
  // 미준공은 하도적용(수주금액 기준) 대비 실측. 분모 없으면 null → 패널 숨김.
  const 공정달성률표시 = 준공여부Local
    ? '100.00'
    : 하도적용 != null && 하도적용 > 0 ? ((공정누계 / 하도적용) * 100).toFixed(2) : null
  const 기성달성률표시 = 준공여부Local
    ? '100.00'
    : 하도적용 != null && 하도적용 > 0 ? ((기성누계공급가 / 하도적용) * 100).toFixed(2) : null

  const handle기성추가시작 = () => {
    set기성폼모드('add')
    set기성폼값({ 기성일: '', 기성액_공급가: null, 작업내용: '', 담당공무_id: null })
  }

  const handle기성수정시작 = (g: 기성항목) => {
    set기성폼모드(g.id)
    set기성폼값({ 기성일: g.기성일 ?? '', 기성액_공급가: g.기성액_공급가, 작업내용: g.작업내용 ?? '', 담당공무_id: g.담당공무_id ?? null })
  }

  const handle기성저장 = async () => {
    if (!row) return
    set기성처리중(true)
    const supabase = createClient()

    if (기성폼모드 === 'add') {
      const { data, error } = await supabase.from('기성')
        .insert({
          수주_id: row.id,
          차수: 다음차수,
          기성일: 기성폼값.기성일 || null,
          기성액_공급가: 기성폼값.기성액_공급가 ?? null,
          작업내용: 기성폼값.작업내용 || null,
          담당공무_id: 기성폼값.담당공무_id ?? null,
        })
        .select('id, 차수, 기성일, 기성액_공급가, 작업내용, 담당공무_id')
        .single()
      set기성처리중(false)
      if (error) { showToast(false, '저장에 실패했습니다.'); return }
      set기성목록((prev) => [...prev, data as unknown as 기성항목].sort((a, b) => a.차수 - b.차수))
    } else {
      const editId = 기성폼모드 as number
      const { error } = await supabase.from('기성')
        .update({
          기성일: 기성폼값.기성일 || null,
          기성액_공급가: 기성폼값.기성액_공급가 ?? null,
          작업내용: 기성폼값.작업내용 || null,
          담당공무_id: 기성폼값.담당공무_id ?? null,
        })
        .eq('id', editId)
      set기성처리중(false)
      if (error) { showToast(false, '저장에 실패했습니다.'); return }
      set기성목록((prev) =>
        prev.map((g) =>
          g.id === editId
            ? { ...g, 기성일: 기성폼값.기성일 || null, 기성액_공급가: 기성폼값.기성액_공급가, 작업내용: 기성폼값.작업내용 || null, 담당공무_id: 기성폼값.담당공무_id ?? null }
            : g
        )
      )
    }
    set기성폼모드('none')
    showToast(true, 기성폼모드 === 'add' ? '기성이 등록되었습니다.' : '수정되었습니다.')
    router.refresh()
  }

  const handle기성삭제 = async (id: number) => {
    if (!window.confirm('이 기성 항목을 삭제하시겠습니까?')) return
    set기성처리중(true)
    const supabase = createClient()
    const { error } = await supabase.from('기성').delete().eq('id', id)
    set기성처리중(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    set기성목록((prev) => prev.filter((g) => g.id !== id))
    showToast(true, '삭제되었습니다.')
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
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          {/* 좌측: 스크롤 폼 */}
          <form
            id="order-form"
            onSubmit={handleSubmit(onSubmit)}
            className="flex-1 lg:overflow-y-auto px-6 py-5 space-y-5 min-w-0"
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
              <Field label="수주금액(공급가)" required>
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
                  <Controller
                    name="공사현장"
                    control={control}
                    render={({ field }) => {
                      // edit 모드에서 과거 자유입력 값이 목록에 없으면 임시 옵션으로 노출
                      const opts = field.value && !공사현장목록.includes(field.value)
                        ? [field.value, ...공사현장목록]
                        : 공사현장목록
                      return (
                        <Select
                          value={field.value || '__none__'}
                          onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                        >
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {opts.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )
                    }}
                  />
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
              <div className="grid grid-cols-3 gap-3">
                <Field label="공사담당">
                  <Input className="h-9 text-sm" {...register('공사담당')} />
                </Field>
                <Field label="감독자">
                  <Input className="h-9 text-sm" {...register('감독자')} />
                </Field>
                <Field label="담당 공무">
                  <Controller
                    name="공무담당자_id"
                    control={control}
                    render={({ field }) => (
                      <select
                        className="h-9 w-full rounded-lg border border-input bg-background text-sm px-3 outline-none"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">선택 안함</option>
                        {공무담당자목록.map((g) => (
                          <option key={g.id} value={g.id}>{g.이름}</option>
                        ))}
                      </select>
                    )}
                  />
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
              <Field label="착공일">
                <Input type="date" className="h-9 text-sm" {...register('착공일')} />
              </Field>
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

            <div className="h-2" />
          </form>

          {/* 우측: 실시간 계산 + 버튼 */}
          <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col bg-gray-50/40">
            <div className="flex-1 lg:overflow-y-auto px-4 py-5 space-y-4">

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
                    <div className="bg-[#1e2d5a] rounded-xl px-3 py-2.5 mt-1">
                      <p className="text-[10px] text-blue-300 mb-1 whitespace-nowrap">
                        하도적용 ({하도전용율pct?.toFixed(1)}%)
                      </p>
                      <p className="text-[18px] font-bold text-white leading-tight whitespace-nowrap">
                        {formatKRW(하도적용)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {mode === 'edit' && 공정달성률표시 != null && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">달성률</p>
                  <div className="rounded-lg px-3 py-2 bg-amber-50 border border-amber-100">
                    <p className="text-[10px] text-gray-400">공정 달성률</p>
                    <p className="text-lg font-bold text-amber-600">
                      {공정달성률표시}%
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {준공여부Local ? '준공 확정 · 준공액 기준' : '공사이력 누계'}
                    </p>
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-blue-50 border border-blue-100">
                    <p className="text-[10px] text-gray-400">기성 달성률</p>
                    <p className="text-lg font-bold text-[#1e2d5a]">
                      {기성달성률표시}%
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {준공여부Local ? '준공 확정 · 준공액 기준' : '기성 청구 누계'}
                    </p>
                  </div>
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
              {deleteConfirm ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    정말 삭제하시겠습니까?
                  </p>
                  <p className="text-[11px] text-red-600">연결된 투입실적·공사이력이 없는 경우에만 삭제됩니다.</p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button" size="sm" variant="destructive"
                      onClick={handleDelete} disabled={deleting} className="h-7 text-xs flex-1"
                    >
                      {deleting ? <Loader2 className="size-3 animate-spin" /> : '삭제 확인'}
                    </Button>
                    <Button
                      type="button" size="sm" variant="outline"
                      onClick={() => setDeleteConfirm(false)} className="h-7 text-xs flex-1"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <>
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
                  {mode === 'edit' && (
                    <Button
                      type="button" size="sm" variant="outline"
                      className="w-full h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      <Trash2 className="size-3.5 mr-1.5" />
                      삭제
                    </Button>
                  )}
                </>
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

      {/* 기성 탭 */}
      {mode === 'edit' && activeTab === '기성' && (
        <div className="flex-1 overflow-y-auto p-6">
          {기성목록.length > 0 ? (
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left border border-gray-200 text-gray-500 font-medium w-14">차수</th>
                  <th className="px-3 py-2 text-left border border-gray-200 text-gray-500 font-medium">기성일</th>
                  <th className="px-3 py-2 text-left border border-gray-200 text-gray-500 font-medium">작업내용</th>
                  <th className="px-3 py-2 text-left border border-gray-200 text-gray-500 font-medium">담당공무</th>
                  <th className="px-3 py-2 text-right border border-gray-200 text-gray-500 font-medium">공급가</th>
                  <th className="px-3 py-2 text-right border border-gray-200 text-gray-500 font-medium">부가세</th>
                  <th className="px-3 py-2 text-right border border-gray-200 text-[#1e2d5a] font-semibold">합계</th>
                  <th className="px-3 py-2 border border-gray-200 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {기성목록.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2 border border-gray-200 font-medium text-gray-500">{g.차수}차</td>
                    <td className="px-3 py-2 border border-gray-200">{g.기성일 ?? '—'}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{g.작업내용 ?? '—'}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">
                      {g.담당공무_id != null
                        ? (공무담당자목록.find((x) => x.id === g.담당공무_id)?.이름 ?? '—')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right border border-gray-200">{formatKRW(g.기성액_공급가 ?? 0)}</td>
                    <td className="px-3 py-2 text-right border border-gray-200 text-gray-400">
                      {formatKRW((g.기성액_공급가 ?? 0) * 0.1)}
                    </td>
                    <td className="px-3 py-2 text-right border border-gray-200 font-semibold text-[#1e2d5a]">
                      {formatKRW((g.기성액_공급가 ?? 0) * 1.1)}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center space-x-2">
                      <button
                        type="button"
                        className="text-[#3d5af1] text-xs hover:underline"
                        onClick={() => handle기성수정시작(g)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="text-red-500 text-xs hover:underline"
                        onClick={() => handle기성삭제(g.id)}
                        disabled={기성처리중}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50">
                  <td colSpan={4} className="px-3 py-2 border border-blue-200 font-bold text-[#1e2d5a]">
                    누계
                  </td>
                  <td className="px-3 py-2 text-right border border-blue-200 font-bold">
                    {formatKRW(기성누계공급가)}
                  </td>
                  <td className="px-3 py-2 text-right border border-blue-200 font-bold text-gray-500">
                    {formatKRW(기성누계공급가 * 0.1)}
                  </td>
                  <td className="px-3 py-2 text-right border border-blue-200 font-bold text-[#1e2d5a]">
                    {formatKRW(기성누계공급가 * 1.1)}
                  </td>
                  <td className="border border-blue-200" />
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 mb-4">등록된 기성이 없습니다.</p>
          )}

          {기성폼모드 !== 'none' ? (
            <div className="border border-blue-200 rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-semibold text-[#1e2d5a] mb-3">
                {기성폼모드 === 'add'
                  ? `${다음차수}차 기성 추가`
                  : `${기성목록.find((g) => g.id === 기성폼모드)?.차수}차 기성 수정`}
              </p>
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">기성일</label>
                  <Input
                    type="date"
                    className="h-9 text-sm w-36"
                    value={기성폼값.기성일}
                    onChange={(e) => set기성폼값((v) => ({ ...v, 기성일: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">기성액 (공급가)</label>
                  <MoneyInput
                    value={기성폼값.기성액_공급가}
                    onChange={(v) => set기성폼값((prev) => ({ ...prev, 기성액_공급가: v }))}
                    className="h-9 text-sm w-44"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">작업내용</label>
                  <Input
                    className="h-9 text-sm w-44"
                    value={기성폼값.작업내용}
                    onChange={(e) => set기성폼값((v) => ({ ...v, 작업내용: e.target.value }))}
                    placeholder="작업내용 입력"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">담당 공무</label>
                  <select
                    className="h-9 rounded-lg border border-input bg-background text-sm px-3 outline-none w-32"
                    value={기성폼값.담당공무_id ?? ''}
                    onChange={(e) => set기성폼값((v) => ({ ...v, 담당공무_id: e.target.value ? Number(e.target.value) : null }))}
                  >
                    <option value="">선택 안함</option>
                    {공무담당자목록.map((g) => (
                      <option key={g.id} value={g.id}>{g.이름}</option>
                    ))}
                  </select>
                </div>
                {기성폼값.기성액_공급가 != null && (
                  <>
                    <div className="bg-blue-100 rounded-lg px-3 py-2 text-sm">
                      <div className="text-[10px] text-gray-500 mb-0.5">부가세</div>
                      <div className="font-semibold text-[#1e2d5a]">{formatKRW(기성폼값.기성액_공급가 * 0.1)}</div>
                    </div>
                    <div className="bg-[#1e2d5a] rounded-lg px-3 py-2 text-sm">
                      <div className="text-[10px] text-blue-300 mb-0.5">합계</div>
                      <div className="font-bold text-white">{formatKRW(기성폼값.기성액_공급가 * 1.1)}</div>
                    </div>
                  </>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-[#3d5af1] hover:bg-[#2d45a8]"
                    onClick={handle기성저장}
                    disabled={기성처리중}
                  >
                    {기성처리중 ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
                    저장
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => set기성폼모드('none')}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#3d5af1] text-[#3d5af1] hover:bg-blue-50"
              onClick={handle기성추가시작}
            >
              <Plus className="size-4 mr-1.5" />
              기성 추가
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
