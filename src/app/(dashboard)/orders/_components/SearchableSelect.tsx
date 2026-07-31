'use client'

import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { useRef, useState, useEffect, useDeferredValue } from 'react'
import { Search, ChevronDown, X as XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useComboboxKeyboard } from '@/hooks/useComboboxKeyboard'

// 이름으로 검색해 하나 고르는 선택 컨트롤. 수주 폼(발주자·원청사)과
// 수주대장 필터(원청사)가 공용한다.
// 옵션 타입은 { id, 거래처명 }까지만 요구한다 — 거래처목록항목도 그대로 들어맞고,
// 필터가 파생시킨 { id, 거래처명 } 목록도 태울 수 있다.
export type 검색옵션 = { id: number; 거래처명: string }

// 핵심: 각 아이템 onMouseDown에서 e.preventDefault() → input blur 차단
// 그 다음 onClick에서 실제 선택 처리 (mousedown → mouseup → click 순서)
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '거래처명으로 검색...',
}: {
  options: 검색옵션[]
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
