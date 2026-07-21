// src/app/(dashboard)/materials/_components/MSheet.tsx
'use client'

import { useEffect } from 'react'

interface Props {
  title: string
  sub?: string
  onClose: () => void
  headerRight?: React.ReactNode // 우상단 액션(예: 드럼 삭제). 안 넘기면 제목만 — 기존 시트들은 그대로.
  children: React.ReactNode
}

// 목업의 .sheet/.panel 패턴: 모바일=아래서 올라오는 시트, md 이상=중앙 모달
export function MSheet({ title, sub, onClose, headerRight, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60]">
      <button aria-label="닫기" className="absolute inset-0 w-full h-full bg-slate-900/45" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[640px] max-h-[86%] overflow-y-auto bg-white rounded-t-[20px] px-[18px] pt-4 pb-7
                   md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-[20px] md:max-w-[520px] md:max-h-[80vh]"
      >
        <div className="w-10 h-1 rounded-sm bg-slate-200 mx-auto mb-3 md:hidden" />
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[17px] font-bold">{title}</h2>
          {headerRight}
        </div>
        {sub && <p className="text-[12.5px] text-slate-500 mb-3.5">{sub}</p>}
        {children}
      </div>
    </div>
  )
}
