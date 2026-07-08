'use client'

import { useState, useRef, useEffect, useDeferredValue, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Search, ChevronDown, X as XIcon, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import { todayKST } from '@/lib/kst'
import { useComboboxKeyboard } from '@/hooks/useComboboxKeyboard'
import type { 수주목록항목, 공사이력행 } from '../_types'
import type { 공사이력Row } from '@/types/database'
import { PerformanceInput } from './성과Input'
import { 준공Badge } from './준공Badge'
import { HistoryEditSheet, type 이력레코드 } from './이력수정Sheet'
import { SelectedHistoryList } from './선택공사이력목록'
import { useWorkspaceSlice } from '../../_components/WorkspaceProvider'

type Props = {
  수주목록: 수주목록항목[]
  공무담당자목록: { id: number; 이름: string }[]
  default수주Id?: number | null
  default날짜?: string | null
}

type ProgressWorkspace = { 선택수주Id: number | null; 작업일자: string }

// 공사 검색 셀렉트 (컴포넌트 함수명은 ASCII 대문자 시작 — react-hooks 린트가 훅 검사를 하는 조건)
function ProjectSearchableSelect({
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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected ? `${selected.지중no} · ${selected.공사명}` : '')}
          onChange={(e) => {
            setQuery(e.target.value)
            // 선택 직후엔 포커스가 남은 채 open=false라 onFocus가 다시 안 터진다.
            // 타이핑이 곧 "편집 시작"이므로 닫혀 있으면 드롭다운을 되살린다(query는 보존).
            if (!open) { positionDrop(); setOpen(true) }
          }}
          onKeyDown={onKeyDown}
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
                filtered.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    data-combobox-item
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)} // 마우스와 키보드 하이라이트를 한 상태로 동기화
                    onClick={() => { onChange(o.id); setOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left transition-colors',
                      i === activeIndex && 'bg-blue-50',                       // 키보드 커서
                      o.id === value && 'bg-blue-50 text-blue-700 font-medium', // 현재 선택값
                    )}
                  >
                    <span className="font-mono text-xs text-gray-400 mr-2">{o.지중no}</span>
                    {o.공사명}
                    {o.준공여부 && <준공Badge className="ml-2" />}
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

export function ProgressInputForm({ 수주목록, 공무담당자목록, default수주Id, default날짜 }: Props) {
  const [선택수주Id, set선택수주Id] = useState<number | null>(default수주Id ?? null)
  const [작업일자, set작업일자] = useState(() => default날짜 ?? todayKST())
  const [성과금액, set성과금액] = useState<number | null>(null)
  const [editRow, setEditRow] = useState<공사이력행 | null>(null)
  const [이력목록, set이력목록] = useState<Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[]>([])
  // 지금 화면의 이력목록이 어느 수주 것인지 꼬리표 — 로딩중을 state 저장 없이 렌더 중 파생하기 위함
  const [조회된수주Id, set조회된수주Id] = useState<number | null>(null)

  // 이력목록 단일 소스에서 파생 — 누계·최근일·직전누계 동기화 버그를 구조적으로 제거.
  const 누계성과금액 = useMemo(
    () => 이력목록.reduce((s, r) => s + (r.성과금액 ?? 0), 0),
    [이력목록],
  )
  const 최근작업일자 = useMemo(
    () => 이력목록.reduce<string | null>((max, r) => (max == null || r.작업일자 > max ? r.작업일자 : max), null),
    [이력목록],
  )
  const [작업내용, set작업내용] = useState('')
  const [담당공무Id, set담당공무Id] = useState<number | null>(null)
  // 선택은 됐는데 그 수주의 데이터가 아직 안 왔다 = 로딩 중. state 저장 대신 매 렌더 파생(④와 같은 꼬리표 패턴)
  const 로딩중 = 선택수주Id != null && 조회된수주Id !== 선택수주Id
  const [저장중, set저장중] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { value: wsValue, save: wsSave, hydrated: wsHydrated } = useWorkspaceSlice<ProgressWorkspace>('progressForm')
  const wsRestored = useRef(false)

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

  // 수정/삭제 후 이력만 다시 가져온다. handle공사선택은 담당공무까지 리셋하므로 재사용하지 않고 분리.
  const reload이력목록 = async () => {
    if (선택수주Id == null) return
    const supabase = createClient()
    const { data } = await supabase.from('공사이력')
      .select('id, 작업일자, 성과금액')
      .eq('수주_id', 선택수주Id)
      .order('작업일자', { ascending: false }) as { data: Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[] | null }
    set이력목록(data ?? [])
  }

  // 목록 행 클릭 → 선택수주 원자료로 공사이력행을 구성해 수정 Sheet를 연다.
  const openRow = (rec: 이력레코드) => {
    if (선택수주Id == null || 선택수주 == null) return
    setEditRow({
      id: rec.id,
      작업일자: rec.작업일자,
      성과금액: rec.성과금액,
      수주_id: 선택수주Id,
      수주: {
        지중no: 선택수주.지중no,
        공사명: 선택수주.공사명,
        수주금액_공급가: 선택수주.수주금액_공급가,
        보험료율: 선택수주.보험료율,
        하도전용율: 선택수주.하도전용율,
        준공여부: 선택수주.준공여부,
      },
    })
  }

  // fetch 전용. setState가 전부 .then 콜백(응답 도착 후)이라 마운트 effect에서 불러도 동기 setState가 없다.
  const load수주데이터 = (id: number) => {
    const supabase = createClient()
    return Promise.all([
      supabase.from('공사이력')
        .select('id, 작업일자, 성과금액')
        .eq('수주_id', id)
        .order('작업일자', { ascending: false }) as unknown as Promise<{ data: Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[] | null }>,
      supabase.from('수주').select('공무담당자_id').eq('id', id).single(),
    ]).then(([이력결과, 수주결과]) => {
      set이력목록(이력결과.data ?? [])
      // 한국어 컬럼 select 문자열은 postgrest-js 타입 파서가 못 읽어 unknown 경유 캐스트
      const 수주data = 수주결과.data as unknown as { 공무담당자_id: number | null } | null
      if (수주data?.공무담당자_id) set담당공무Id(수주data.공무담당자_id)
      set조회된수주Id(id) // 꼬리표 부착 → 파생 로딩중이 꺼진다
    })
  }

  // 이벤트 전용(콤보박스 선택·워크스페이스 복원) — 동기 리셋은 이벤트 핸들러에서만 정당.
  const handle공사선택 = (id: number | null) => {
    set선택수주Id(id)
    set성과금액(null)
    set이력목록([])
    set조회된수주Id(null) // 같은 수주 재선택이어도 꼬리표를 떼서 로딩중이 켜지게
    if (id == null) return
    load수주데이터(id)
  }

  // 선택수주Id·성과금액·이력목록은 useState 초기값이 이미 마운트 상태와 같아 동기 리셋 불필요 — fetch만 한다.
  // 로딩중은 파생이라 첫 렌더부터 켜진다(꼬리표 null ≠ default수주Id).
  useEffect(() => {
    if (default수주Id != null) {
      load수주데이터(default수주Id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 네비게이션 복귀 시 신원 복원: hydrated 이후 1회. URL 딥링크가 있으면 그쪽이 우선.
  useEffect(() => {
    if (!wsHydrated || wsRestored.current) return
    wsRestored.current = true
    if (default수주Id != null) return
    const saved = wsValue
    if (saved?.선택수주Id != null) {
      // 1회성 복원 로드(set상태 후 fetch). 반복 cascade가 아니므로 set-state-in-effect 규칙 부적용.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handle공사선택(saved.선택수주Id)     // 누계·하도적용금액·담당공무 재조회
      if (saved.작업일자) set작업일자(saved.작업일자)
    }
  }, [wsHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  // 신원이 바뀔 때마다 저장 (hydrated 전 기본값으로 저장본 덮어쓰기 방지)
  useEffect(() => {
    if (!wsHydrated) return
    wsSave({ 선택수주Id, 작업일자 })
  }, [wsHydrated, wsSave, 선택수주Id, 작업일자])

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

  // 차단이 아닌 "마찰 한 번": 초과/음수만 시각적으로 경고하고 저장은 허용한다(현실 수용 결정).
  const 저장후경고 =
    성과금액 != null && 저장후달성율 != null
      ? 저장후달성율 > 100
        ? '저장 후 누계가 100%를 넘습니다 (초과 달성으로 저장됩니다).'
        : 저장후달성율 < 0
          ? '저장 후 누계가 음수가 됩니다 — 입력값을 확인하세요.'
          : null
      : null

  const handleSave = async () => {
    if (!선택수주Id || !작업일자 || 성과금액 == null) {
      showToast(false, '공사, 작업일자, 성과금액을 모두 입력해주세요.')
      return
    }
    set저장중(true)
    const supabase = createClient()
    // 성과금액은 증분(원) 정본. % 모드의 하향 정정은 음수로 들어오며, 매출손익은 증분을 월별 합산하므로
    // 정정이 일어난 달의 매출이 그만큼 차감된다(총 누계는 정확). 의도된 동작.
    const { data: inserted, error } = await supabase.from('공사이력').insert({
      수주_id: 선택수주Id,
      작업일자,
      성과금액,
      작업내용: 작업내용 || null,
      담당공무_id: 담당공무Id,
    }).select('id, 작업일자, 성과금액').single()
    set저장중(false)
    if (error) {
      const msg = error.message?.includes('unique') ? '해당 날짜에 이미 등록된 이력이 있습니다.' : '저장에 실패했습니다.'
      showToast(false, msg)
      return
    }
    showToast(true, '저장되었습니다.')
    // 반환행을 이력목록에 추가 → 누계·최근·직전 자동 재파생(백필 시 최근일 덮어쓰기 버그 없음).
    if (inserted) set이력목록((prev) => [...prev, inserted as unknown as Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>])
    set성과금액(null)
    set작업일자(todayKST())
    set작업내용('')
    set담당공무Id(null)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 max-w-4xl">
      <div className="flex-1 space-y-5 lg:pr-6">
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
          <ProjectSearchableSelect
            options={수주목록}
            value={선택수주Id}
            onChange={handle공사선택}
          />
        </div>

        {선택수주Id != null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
              {로딩중 ? '불러오는 중...' : '마지막 등록 기록'}
              {선택수주?.준공여부 && <준공Badge className="ml-2" />}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
            <Input
              type="date"
              className="h-10 text-sm"
              value={작업일자}
              onChange={(e) => set작업일자(e.target.value)}
            />
          </div>
          <PerformanceInput
            value={성과금액}
            onChange={set성과금액}
            하도적용금액={하도적용금액}
            직전누계={누계성과금액}
          />
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

        {저장후경고 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border bg-amber-50 text-amber-800 border-amber-200">
            <AlertCircle className="size-4 shrink-0" />
            {저장후경고}
          </div>
        )}

        <Button
          type="button"
          className="w-full h-10 text-sm bg-[#f59e0b] hover:bg-[#d97706] text-white"
          onClick={handleSave}
          disabled={저장중 || !선택수주Id || 성과금액 == null}
        >
          {저장중 ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
          저장
        </Button>

        {선택수주Id != null && (
          <SelectedHistoryList key={선택수주Id} records={이력목록} onRowClick={openRow} />
        )}
      </div>

      <div className="w-full lg:w-60 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 pt-5 lg:pt-0 lg:pl-6 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">자동 계산</p>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 mb-1">Δ공정 달성률</p>
          <p className="text-2xl font-bold text-amber-500">
            {/* %는 toFixed가 음수면 '-'를 직접 붙이므로, 양수일 때만 '+'를 수동으로 더한다(하향 정정 시 +- 중복 방지). */}
            {delta달성율 != null ? `${delta달성율 >= 0 ? '+' : ''}${delta달성율.toFixed(2)}%` : '—'}
          </p>
          {/* 이번 증분 금액: % 입력 시 보고서에 복붙할 환산 금액을 또렷이 노출(원·% 모드 공통) */}
          {성과금액 != null && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 mb-0.5">이번 증분 금액</p>
              <p className="text-base font-semibold text-gray-800">{formatKRW(성과금액)}</p>
            </div>
          )}
        </div>

        <div className="bg-[#1e2d5a] rounded-xl p-4">
          <p className="text-[10px] text-blue-300 mb-3">저장 후 전체 누계</p>
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

      <HistoryEditSheet
        open={editRow != null}
        onOpenChange={(open) => { if (!open) setEditRow(null) }}
        row={editRow}
        records={이력목록}
        loading={false}
        onSaved={() => { setEditRow(null); reload이력목록() }}
        onDeleted={() => { setEditRow(null); reload이력목록() }}
        showToast={showToast}
      />
    </div>
  )
}
