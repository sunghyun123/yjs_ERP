// src/app/(dashboard)/materials/_components/InSheet.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayKST } from '@/lib/kst'
import type { 자재_선종Row, 자재_드럼Insert } from '@/types/database'
import { MSheet } from './MSheet'
import { ComboInput } from './ComboInput'

const MAX_드럼 = 10 // QA 확정: 오입력(수만 개) 폭주 방지 상한

interface Props {
  onClose: () => void
  선종들: 자재_선종Row[]
  초기전압: '고압' | '저압'
  공사명목록: string[]
}

export function InSheet({ onClose, 선종들, 초기전압, 공사명목록 }: Props) {
  const router = useRouter()
  const [사용처, set사용처] = useState('')
  const [입고일, set입고일] = useState(todayKST())
  const [전압, set전압] = useState(초기전압) // 시트는 열릴 때 마운트되므로 초기값으로 충분
  const [선종id, set선종id] = useState<number | null>(null)
  const [미터수, set미터수] = useState('')
  const [드럼수, set드럼수] = useState('3')
  const [제조표기, set제조표기] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const 표시선종 = 선종들.filter((s) => s.전압 === 전압)
  const n = parseInt(드럼수, 10)

  async function submit() {
    const m = Number(미터수)
    if (!선종id) return setError('선종을 선택하세요')
    if (!Number.isFinite(m) || m <= 0) return setError('드럼당 미터수를 입력하세요')
    if (!Number.isInteger(n) || n < 1 || n > MAX_드럼) return setError(`드럼 수는 1~${MAX_드럼}개`)
    setError(null)
    setSaving(true)
    const 묶음 = crypto.randomUUID()
    const rows: 자재_드럼Insert[] = Array.from({ length: n }, () => ({
      선종_id: 선종id,
      초기길이: m,
      입고일,
      사용처공사: 사용처.trim() || null,
      제조표기: 제조표기.trim() || null,
      입고묶음: 묶음,
    }))
    const supabase = createClient()
    const { error: err } = await supabase.from('자재_드럼').insert(rows)
    if (err) {
      setError(`저장 실패: ${err.message}`)
      setSaving(false)
      return
    }
    router.refresh()
    onClose()
  }

  const lb = 'block text-[12.5px] font-bold text-slate-500 mb-1.5'
  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] bg-white'
  const step = 'text-xs font-bold tracking-[.08em] text-[#3d5af1] mt-4 mb-2 first:mt-0'

  return (
    <MSheet title="입고 기록" sub="거래처에서 케이블이 도착했을 때" onClose={onClose}>
      <p className={step}>1 · 공사 · 일자</p>
      <div className="mb-3">
        <label className={lb}>사용처 공사 <em className="not-italic font-medium">— 목록에서 고르거나 직접 입력</em></label>
        <ComboInput value={사용처} onChange={set사용처} options={공사명목록} placeholder="공사명 검색 또는 직접 입력" />
      </div>
      <div className="mb-3">
        <label className={lb}>입고 일자</label>
        <input type="date" className={inp} value={입고일} onChange={(e) => set입고일(e.target.value)} />
      </div>

      <p className={step}>2 · 케이블 선택</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(['고압', '저압'] as const).map((v) => (
          <button key={v} onClick={() => { set전압(v); set선종id(null) }}
            className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-bold border ${전압 === v ? 'bg-[#3d5af1] border-[#3d5af1] text-white' : 'bg-slate-50 border-slate-200'}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {표시선종.map((s) => (
          <button key={s.id} onClick={() => set선종id(s.id)}
            className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-bold border ${선종id === s.id ? 'bg-[#3d5af1] border-[#3d5af1] text-white' : 'bg-slate-50 border-slate-200'}`}>
            {s.코드}
          </button>
        ))}
      </div>

      <p className={step}>3 · 수량</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lb}>드럼당 미터수</label>
          <input type="number" inputMode="numeric" className={inp} value={미터수} onChange={(e) => set미터수(e.target.value)} />
        </div>
        <div>
          <label className={lb}>드럼 수</label>
          <input type="number" inputMode="numeric" min={1} max={MAX_드럼} className={inp} value={드럼수} onChange={(e) => set드럼수(e.target.value)} />
        </div>
      </div>

      <p className={step}>4 · 드럼 표기 <span className="font-semibold tracking-normal text-slate-500">— 선택 입력</span></p>
      <div className="mb-3">
        <label className={lb}>제조사 · 제조년월 <em className="not-italic font-medium">— 비워둬도 됩니다</em></label>
        <input type="text" className={inp} placeholder="예: 대일 26.02" value={제조표기} onChange={(e) => set제조표기(e.target.value)} />
      </div>

      <div className="bg-slate-50 rounded-[10px] px-3 py-2.5 text-[12.5px] text-slate-500 my-3">
        <b className="text-slate-900">6드럼이 와도 3+3으로 나눠 적을 필요 없습니다.</b> 드럼마다 따로 등록되어 각자 이력을 가집니다.
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button onClick={submit} disabled={saving}
        className="w-full rounded-[10px] py-3.5 bg-[#3d5af1] text-white text-[15px] font-bold disabled:opacity-60">
        {saving ? '저장 중…' : `입고 ${Number.isInteger(n) && n > 0 ? n : 0}드럼 등록`}
      </button>
    </MSheet>
  )
}
