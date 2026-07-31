// src/app/(dashboard)/materials/_components/OutSheet.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayKST } from '@/lib/kst'
import type { 자재_드럼기록Insert, 자재_선종Row } from '@/types/database'
import { group칩, type Derived드럼, type 드럼칩 } from '../_lib/derive'
import { MSheet } from './MSheet'
import { ComboInput } from './ComboInput'

const MAX_드럼 = 10

interface Sel {
  개수: number
  균등사용: string      // '' = 미기입(출고 중)
  드럼별: boolean
  각사용: string[]      // 드럼별 입력 모드의 각 드럼 사용량
}

interface Props {
  onClose: () => void
  선종들: 자재_선종Row[]
  드럼들: Derived드럼[]
  초기전압: '고압' | '저압'
  공사명목록: string[]
}

export function OutSheet({ onClose, 선종들, 드럼들, 초기전압, 공사명목록 }: Props) {
  const router = useRouter()
  const [공사명, set공사명] = useState('')
  const [출고일, set출고일] = useState(todayKST())
  const [전압, set전압] = useState(초기전압)
  const [선종id, set선종id] = useState<number | null>(null)
  const [sels, setSels] = useState<Record<string, Sel>>({}) // 칩key → 선택 상태
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const 표시선종 = 선종들.filter((s) => s.전압 === 전압)
  const 선종 = 선종들.find((s) => s.id === 선종id)
  // 출고 가능한 것은 '재고' 드럼만 (출고중·소진 제외)
  const 칩들 = 선종id ? group칩(드럼들.filter((d) => d.선종_id === 선종id && d.상태 === '재고')) : []

  function toggle(c: 드럼칩) {
    setSels((prev) => {
      if (prev[c.key]) {
        const next = { ...prev }
        delete next[c.key]
        return next
      }
      return { ...prev, [c.key]: { 개수: 1, 균등사용: '', 드럼별: false, 각사용: [''] } }
    })
  }

  function updateSel(key: string, patch: Partial<Sel>) {
    setSels((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const 선택드럼수 = Object.values(sels).reduce((s, x) => s + x.개수, 0)

  async function submit() {
    if (!공사명.trim()) return setError('출고 공사명을 입력하세요')
    if (!출고일) return setError('출고 일자를 입력하세요')
    if (선택드럼수 === 0) return setError('나갈 드럼을 선택하세요')
    const rows: 자재_드럼기록Insert[] = []
    const 묶음 = crypto.randomUUID()
    for (const [key, sel] of Object.entries(sels)) {
      const chip = 칩들.find((c) => c.key === key)
      if (!chip) continue
      const ids = chip.드럼ids.slice(0, sel.개수)
      for (let i = 0; i < ids.length; i++) {
        const raw = (sel.드럼별 ? sel.각사용[i] ?? '' : sel.균등사용).trim()
        let 사용량: number | null = null
        if (raw !== '') {
          사용량 = Number(raw)
          if (!Number.isFinite(사용량) || 사용량 < 0) return setError('사용량은 0 이상의 숫자여야 합니다')
          if (사용량 > chip.잔량) return setError(`사용량(${사용량}m)이 드럼 잔량(${chip.잔량}m)을 넘습니다`)
        }
        rows.push({
          드럼_id: ids[i],
          출고일,
          공사명: 공사명.trim(),
          사용량,
          복귀일: 사용량 === null ? null : 출고일, // 출고 때 바로 기입 = 당일 복귀 처리
          출고묶음: 묶음,
        })
      }
    }
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('자재_드럼기록').insert(rows)
      if (err) {
        setError(`저장 실패: ${err.message}`)
        setSaving(false)
        return
      }
      router.refresh()
      onClose()
    } catch (e) {
      // 네트워크 예외 등 reject 경로에서도 버튼이 영구 잠기지 않게
      setError(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  const lb = 'block text-[12.5px] font-bold text-slate-500 mb-1.5'
  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] bg-white'
  const step = 'text-xs font-bold tracking-[.08em] text-[#3d5af1] mt-4 mb-2 first:mt-0'
  const numInp = 'border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-right bg-white tabular-nums'
  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    // 저장 중 배경클릭·ESC로 닫히면 실패가 조용히 삼켜진다 — 저장 중엔 닫기 무시
    <MSheet title="출고 기록" sub="공사 나가면서 케이블을 실을 때" onClose={() => { if (!saving) onClose() }}>
      <p className={step}>1 · 공사 · 일자</p>
      <div className="mb-3">
        <label className={lb}>출고 공사명 <em className="not-italic font-medium">— 사용처와 달라도 됩니다, 목록에 없으면 직접 입력</em></label>
        <ComboInput value={공사명} onChange={set공사명} options={공사명목록} placeholder="공사명 검색 또는 직접 입력" />
      </div>
      <div className="mb-3">
        <label className={lb}>출고 일자</label>
        <input type="date" className={inp} value={출고일} onChange={(e) => set출고일(e.target.value)} />
      </div>

      <p className={step}>2 · 케이블 선택</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(['고압', '저압'] as const).map((v) => (
          <button key={v} onClick={() => { set전압(v); set선종id(null); setSels({}) }}
            className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-bold border ${전압 === v ? 'bg-[#3d5af1] border-[#3d5af1] text-white' : 'bg-slate-50 border-slate-200'}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {표시선종.map((s) => (
          <button key={s.id} onClick={() => { set선종id(s.id); setSels({}) }}
            className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-bold border ${선종id === s.id ? 'bg-[#3d5af1] border-[#3d5af1] text-white' : 'bg-slate-50 border-slate-200'}`}>
            {s.코드}
          </button>
        ))}
      </div>

      <p className={step}>
        3 · 드럼 선택 · 수량{' '}
        <span className="font-semibold tracking-normal text-slate-500">
          {선종 ? `— ${선종.코드} 보유 드럼·잔재 자동 조회` : '— 먼저 선종을 고르세요'}
        </span>
      </p>
      {선종 && 칩들.length === 0 && <p className="text-sm text-slate-400 mb-2">{선종.코드} 재고 드럼이 없습니다.</p>}
      {칩들.map((c) => {
        const sel = sels[c.key]
        const 선택가능개수 = Math.min(c.개수, MAX_드럼)
        const 균등 = sel?.균등사용.trim() ?? ''
        const 균등잔량 = 균등 === '' ? null : Math.max(0, c.잔량 - Number(균등))
        return (
          <div key={c.key} className={`border rounded-[10px] mb-1.5 ${sel ? 'border-[#3d5af1]' : 'border-slate-200'} bg-slate-50`}>
            <button className="flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm" onClick={() => toggle(c)}>
              <span className={`w-[19px] h-[19px] rounded-md border-[1.5px] flex-none ${sel ? 'bg-[#3d5af1] border-[#3d5af1]' : 'bg-white border-slate-200'}`} />
              <b className="tabular-nums">{fmt(c.잔량)}m ×{c.개수}</b>
              {c.잔재 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5">잔재</span>}
              {c.제조표기 && <span className="text-[12.5px] text-slate-500 ml-auto">{c.제조표기}</span>}
            </button>
            {sel && (
              <div className="px-3 pb-2.5 pl-10 text-[13.5px] text-slate-500">
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <label htmlFor={`out-count-${c.key}`} className="font-bold text-slate-700">나간 드럼 수</label>
                  <select id={`out-count-${c.key}`}
                    className={`${numInp} w-[64px] appearance-auto text-left`} value={sel.개수}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      updateSel(c.key, { 개수: v, 각사용: Array.from({ length: v }, (_, i) => sel.각사용[i] ?? sel.균등사용) })
                    }}>
                    {Array.from({ length: 선택가능개수 }, (_, i) => i + 1).map((개수) => (
                      <option key={개수} value={개수}>{개수}개</option>
                    ))}
                  </select>
                  <span className="text-[12px]">/ 보유 {c.개수}개</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!sel.드럼별 && (
                    <>
                      드럼마다 같은 사용 길이
                      <input type="number" inputMode="numeric" className={`${numInp} w-[76px]`} value={sel.균등사용}
                        placeholder="비우면 출고 중"
                        onChange={(e) => updateSel(c.key, { 균등사용: e.target.value })} />
                      m
                      {균등잔량 !== null && <>→ 잔량 <b className="text-slate-900 tabular-nums">{fmt(균등잔량)}</b> m</>}
                      {균등잔량 === 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5">소진</span>}
                    </>
                  )}
                  <div className="ml-auto flex flex-none rounded-full border border-slate-200 bg-white p-0.5" role="group" aria-label="사용 길이 입력 방식">
                    {([
                      { 드럼별: false, label: '모두 같게' },
                      { 드럼별: true, label: '각각 다르게' },
                    ] as const).map((mode) => (
                      <button key={mode.label} type="button" aria-pressed={sel.드럼별 === mode.드럼별}
                        className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                          sel.드럼별 === mode.드럼별 ? 'bg-[#3d5af1] text-white' : 'text-slate-500'
                        }`}
                        onClick={() => updateSel(c.key, {
                          드럼별: mode.드럼별,
                          각사용: Array.from({ length: sel.개수 }, (_, i) => sel.각사용[i] ?? sel.균등사용),
                        })}>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                {sel.드럼별 && (
                  <div className="mt-1.5 space-y-1.5">
                    {Array.from({ length: sel.개수 }, (_, i) => {
                      const raw = (sel.각사용[i] ?? '').trim()
                      const 잔 = raw === '' ? null : Math.max(0, c.잔량 - Number(raw))
                      return (
                        <div key={i} className="flex items-center gap-1.5 flex-wrap">
                          드럼 {i + 1} · 사용
                          <input type="number" inputMode="numeric" className={`${numInp} w-[64px]`} value={sel.각사용[i] ?? ''}
                            onChange={(e) => {
                              const 각 = [...sel.각사용]
                              각[i] = e.target.value
                              updateSel(c.key, { 각사용: 각 })
                            }} />
                          m
                          {잔 !== null && <>→ 잔량 <b className="text-slate-900 tabular-nums">{fmt(잔)}</b> m</>}
                          {잔 === 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5">소진</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="bg-slate-50 rounded-[10px] px-3 py-2.5 text-[12.5px] text-slate-500 my-3">
        <b className="text-slate-900">여러 묶음에서 섞어 나가도 한 번에 기록됩니다.</b> 보통은 드럼당 같은 양을 쓰니 숫자
        하나만 넣으면 되고, 드럼마다 다르면 <b className="text-slate-900">각각 다르게</b>를 누르세요. 사용량은 복귀 후
        채워도 됩니다(비워두면 &ldquo;출고 중&rdquo;).
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button onClick={submit} disabled={saving}
        className="w-full rounded-[10px] py-3.5 bg-[#3d5af1] text-white text-[15px] font-bold disabled:opacity-60">
        {saving ? '저장 중…' : `${선택드럼수}드럼 출고 기록`}
      </button>
    </MSheet>
  )
}
