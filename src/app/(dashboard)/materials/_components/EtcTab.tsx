// src/app/(dashboard)/materials/_components/EtcTab.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayKST } from '@/lib/kst'
import type { Derived품목 } from '../_lib/derive'

interface Props {
  품목들: Derived품목[]
}

export function EtcTab({ 품목들 }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<number | null>(null) // 직접 입력 중인 품목id
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const 분류들 = [...new Set(품목들.map((p) => p.분류))]

  async function apply(품목id: number, delta: number) {
    if (delta === 0) return
    if (saving !== null) return setError('다른 항목 저장 중입니다 — 잠시 후 다시 시도하세요') // 저장 상태가 스칼라라 동시 저장을 차단하되, 조용히 삼키지 않고 알린다 (직접입력 blur 경로 커버)
    setError(null)
    setSaving(품목id)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('자재_품목기록')
        .insert({ 품목_id: 품목id, 변화량: delta, 일자: todayKST() })
      if (err) setError(`저장 실패: ${err.message}`)
      else router.refresh()
    } catch (e) {
      // 네트워크 예외 등 reject 경로에서도 버튼이 영구 잠기지 않게
      setError(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(null)
    }
  }

  function commitEdit(p: Derived품목) {
    setEditing(null)
    const raw = editVal.trim()
    if (raw === '') return // Number('')는 0 — 빈칸인 채 blur가 수량 0으로 반영되는 사고 방지
    const v = Number(raw) // parseInt는 '3.9'를 3으로 절삭 — 정수가 아니면 반영하지 않는다
    if (!Number.isInteger(v) || v < 0 || v === p.수량) return
    void apply(p.id, v - p.수량)
  }

  return (
    <div>
      {분류들.map((분류) => (
        <div key={분류} className="bg-white rounded-[14px] shadow-sm px-3.5 py-1.5 mb-2.5">
          <h3 className="text-sm font-bold my-2.5">{분류}</h3>
          {품목들.filter((p) => p.분류 === 분류).map((p, i) => (
            <div key={p.id} className={`flex items-center gap-2.5 py-2 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <span className="flex-1 text-sm">{p.품명}</span>
              {editing === p.id ? (
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  className="w-16 border-[1.5px] border-[#3d5af1] rounded-lg px-1.5 py-0.5 font-bold text-right bg-slate-50"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={() => commitEdit(p)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              ) : (
                <button
                  className="min-w-[44px] text-right text-[15px] font-bold tabular-nums rounded-lg px-1 py-0.5 hover:bg-slate-50"
                  title="숫자를 눌러 직접 입력"
                  onClick={() => { setEditing(p.id); setEditVal(String(p.수량)) }}
                >
                  {p.수량}<small className="text-[11.5px] font-semibold text-slate-500"> {p.단위}</small>
                </button>
              )}
              <span className="flex gap-1.5">
                {/* 잠금은 전역(스칼라 saving)이므로 비활성도 전역으로 — 행 단위로만 막으면 다른 행 탭이 조용히 무시된다 */}
                <button
                  disabled={saving !== null || p.수량 === 0}
                  onClick={() => apply(p.id, -1)}
                  className="w-[30px] h-[30px] rounded-lg border border-slate-200 bg-slate-50 text-base font-bold leading-none disabled:opacity-40"
                >−</button>
                <button
                  disabled={saving !== null}
                  onClick={() => apply(p.id, 1)}
                  className="w-[30px] h-[30px] rounded-lg border border-slate-200 bg-slate-50 text-base font-bold leading-none disabled:opacity-40"
                >＋</button>
              </span>
            </div>
          ))}
        </div>
      ))}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-slate-500 mt-2.5 mx-0.5">
        한두 개는 ＋/−로, 수백 개 입고 같은 큰 변화는 <b>숫자를 눌러 직접 입력</b>합니다. 누가 언제 바꿨는지는 자동으로
        기록됩니다.
      </p>
    </div>
  )
}
