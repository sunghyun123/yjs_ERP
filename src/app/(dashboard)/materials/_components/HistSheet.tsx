// src/app/(dashboard)/materials/_components/HistSheet.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayKST } from '@/lib/kst'
import type { 자재_드럼기록Row, 자재_선종Row } from '@/types/database'
import { build타임라인, type Derived드럼 } from '../_lib/derive'
import { MSheet } from './MSheet'

interface Props {
  onClose: () => void
  드럼ids: number[]
  드럼들: Derived드럼[]
  기록들: 자재_드럼기록Row[]
  선종들: 자재_선종Row[]
}

export function HistSheet({ onClose, 드럼ids, 드럼들, 기록들, 선종들 }: Props) {
  const router = useRouter()
  const [사용입력, set사용입력] = useState<Record<number, string>>({}) // 기록id → 입력값
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const 대상 = 드럼들.filter((d) => 드럼ids.includes(d.id))
  const 코드of = new Map(선종들.map((s) => [s.id, s.코드]))

  async function 복귀기록(기록id: number, max: number) {
    const raw = (사용입력[기록id] ?? '').trim()
    if (raw === '') return setError('사용량을 입력하세요') // Number('')는 0 — 빈칸인 채 클릭이 0m 복귀로 기록되는 사고 방지
    const v = Number(raw)
    if (!Number.isFinite(v) || v < 0) return setError('사용량을 숫자로 입력하세요')
    if (v > max) return setError(`사용량(${v}m)이 잔량(${max}m)을 넘습니다`)
    setError(null)
    setSaving(기록id)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('자재_드럼기록')
        .update({ 사용량: v, 복귀일: todayKST() })
        .eq('id', 기록id)
      if (err) {
        setError(`저장 실패: ${err.message}`)
        setSaving(null)
        return
      }
      router.refresh() // 새 props가 내려오면 타임라인이 파생값으로 다시 그려진다
      setSaving(null)
    } catch (e) {
      // 네트워크 예외 등 reject 경로에서도 버튼이 영구 잠기지 않게
      setError(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(null)
    }
  }

  const dot = (종류: string) =>
    `absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-white border-[3px] ${종류 === '복귀' ? 'border-amber-600' : 'border-[#3d5af1]'}`

  return (
    // 저장 중 배경클릭·ESC로 닫히면 실패가 조용히 삼켜진다 — 저장 중엔 닫기 무시
    <MSheet title="드럼 이력" sub="드럼 하나가 겪는 모든 일이 한 줄로 이어집니다" onClose={() => { if (saving === null) onClose() }}>
      {대상.map((d) => {
        const 코드 = 코드of.get(d.선종_id) ?? ''
        const tl = build타임라인(d, 기록들)
        return (
          <div key={d.id} className="mb-5 last:mb-0">
            <p className="text-sm font-bold mb-1">
              {코드} · {d.초기길이.toLocaleString('ko-KR')}m 드럼 #{d.id}
              {d.제조표기 && <span className="text-slate-500 font-semibold"> — {d.제조표기}</span>}
              <span className="ml-2 text-[11px] font-bold rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">
                {d.상태 === '재고' ? `잔량 ${d.잔량.toLocaleString('ko-KR')}m` : d.상태}
              </span>
            </p>
            <ul className="relative pl-5 before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-3.5 before:w-0.5 before:bg-slate-200">
              {tl.map((t, i) => (
                <li key={i} className="relative pb-4">
                  <span className={dot(t.종류)} />
                  <p className="text-xs text-slate-500 tabular-nums">{t.일자}</p>
                  <p className="text-[14.5px] font-bold">{t.제목}</p>
                  {t.상세 && <p className="text-[13px] text-slate-500">{t.상세}</p>}
                  {t.미복귀 && t.기록id !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1 text-[13px] text-slate-500 flex-wrap">
                      사용
                      <input
                        type="number" inputMode="numeric"
                        className="w-[76px] border border-slate-200 rounded-lg px-2 py-1 font-bold text-right bg-white"
                        value={사용입력[t.기록id] ?? ''}
                        onChange={(e) => set사용입력((p) => ({ ...p, [t.기록id!]: e.target.value }))}
                      />
                      m
                      <button
                        onClick={() => 복귀기록(t.기록id!, t.최대사용가능 ?? d.초기길이)}
                        disabled={saving === t.기록id}
                        className="border border-slate-200 bg-white rounded-full px-2.5 py-1 text-[11.5px] font-bold disabled:opacity-60"
                      >
                        {saving === t.기록id ? '저장 중…' : '복귀 기록'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </MSheet>
  )
}
