'use client'

import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'

type Params = {
  open: boolean                       // 드롭다운 열림 여부 (닫혀 있으면 ↓로 다시 여는 것만 처리)
  itemCount: number                   // 현재 보이는 항목 개수 — activeIndex를 이 범위로 가둔다
  onSelect: (index: number) => void   // Enter 시 그 index 항목을 고르는 콜백 (항목 모양은 호출부가 안다)
  onClose: () => void                 // Escape 시
  onOpen: () => void                  // 닫힌 채 ↓ 눌렀을 때 다시 열기
  listRef?: RefObject<HTMLElement | null> // 스크롤 컨테이너 — 하이라이트 항목을 보이게 끌어온다
}

/**
 * 직접 만든 검색형 콤보박스(SearchableSelect 류)에 키보드 ↑↓/Enter/Esc 선택을 입힌다.
 * 핵심: 훅은 항목의 "모양"을 모르고 오직 index로만 다뤄, 로컬배열·비동기검색 어느 구조든 재사용된다.
 */
export function useComboboxKeyboard({ open, itemCount, onSelect, onClose, onOpen, listRef }: Params) {
  // 하이라이트된 항목 번째 (-1 = 없음)
  const [activeIndex, setActiveIndex] = useState(-1)

  // 열림/목록 길이가 바뀌면 하이라이트를 첫 항목으로 리셋(결정 #2), 닫히면 해제.
  // effect가 아니라 "렌더 중 직전값 비교"로 처리 — React 권장 패턴(setState-in-effect의 추가 렌더 회피).
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevCount, setPrevCount] = useState(itemCount)
  if (open !== prevOpen || itemCount !== prevCount) {
    setPrevOpen(open)
    setPrevCount(itemCount)
    setActiveIndex(open && itemCount > 0 ? 0 : -1)
  }

  // 하이라이트 항목이 스크롤 영역 밖이면 보이게 끌어온다.
  // data-combobox-item으로 탐색해 래퍼 div 구조에 무관하게 동작.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    const items = listRef?.current?.querySelectorAll<HTMLElement>('[data-combobox-item]')
    items?.[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, listRef])

  function onKeyDown(e: KeyboardEvent) {
    // 닫힌 채 포커스만 남은 상태(선택 직후)에서 ↓ → 재탐색을 위해 다시 연다(결정 #3).
    if (!open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); onOpen() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()                                   // 캐럿 끝 이동(기본 동작) 차단
      setActiveIndex((i) => Math.min(i + 1, itemCount - 1)) // 끝에서 멈춤(결정 #1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))             // 처음에서 멈춤
    } else if (e.key === 'Enter') {
      if (activeIndex < 0) return                          // 고른 게 없으면 기본 동작(submit)에 맡김
      e.preventDefault()                                   // 폼 submit 차단 → 항목 선택으로
      onSelect(activeIndex)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return { activeIndex, setActiveIndex, onKeyDown }
}
