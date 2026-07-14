// src/app/(dashboard)/materials/_components/ComboInput.tsx
'use client'

import { useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}

// 목록에서 골라도 되고, 목록에 없는 값을 그대로 타이핑해도 인정된다 (목업 콤보 패턴)
export function ComboInput({ value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const q = value.trim()
  const filtered = q ? options.filter((o) => o.includes(q)) : options

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] bg-white"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 bg-white border border-slate-200 rounded-[10px] shadow-lg max-h-[180px] overflow-y-auto p-1">
          {filtered.slice(0, 30).map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(o); setOpen(false) }}
              className="block w-full text-left px-2.5 py-2 rounded-[7px] text-sm hover:bg-slate-50"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
