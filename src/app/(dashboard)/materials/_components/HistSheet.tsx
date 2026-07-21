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
  const [deleting, setDeleting] = useState<number | null>(null) // 삭제 진행 중인 드럼id
  const [confirm, setConfirm] = useState<number | null>(null) // 2단계 확인 중인 드럼id
  const [error, setError] = useState<string | null>(null)

  const 대상 = 드럼들.filter((d) => 드럼ids.includes(d.id))
  const 코드of = new Map(선종들.map((s) => [s.id, s.코드]))
  const 단일 = 대상.length === 1 // 하이브리드: 1개면 헤더 우상단, 여러 개면 드럼별 버튼
  // 출고기록이 하나라도 있는 드럼 = 이미 현장에 나간 실이력 → 삭제 금지(오입력 취소만 허용).
  // cascade가 그 출고기록까지 지워 이력이 증발하는 걸 막는다. 출고된 드럼은 출고 기록 쪽에서 다룬다.
  const 기록있는드럼 = new Set(기록들.map((r) => r.드럼_id))
  const 삭제가능 = (id: number) => !기록있는드럼.has(id)

  // 드럼 하드 삭제. FK on delete cascade가 그 드럼의 출고기록을 DB에서 원자적으로 함께 지운다.
  async function 삭제드럼(id: number, wasLast: boolean) {
    if (deleting !== null) return // 동시 삭제 차단(saving과 동일 패턴)
    setError(null)
    setDeleting(id)
    try {
      const supabase = createClient()
      // .select()로 실제 삭제된 행을 돌려받아 0행(RLS 차단/이미 삭제)을 fail-loud로 잡는다
      const { data, error: err } = await supabase.from('자재_드럼').delete().eq('id', id).select('id')
      if (err) { setError(`삭제 실패: ${err.message}`); setDeleting(null); return }
      if (!data || data.length === 0) { setError('삭제할 수 없습니다 (권한이 없거나 이미 삭제됨)'); setDeleting(null); return }
      router.refresh() // 새 props가 내려오면 삭제된 드럼이 시트·목록에서 사라진다
      if (wasLast) onClose() // 마지막 한 개를 지웠으면 빈 시트를 남기지 않고 닫는다
      else { setDeleting(null); setConfirm(null) }
    } catch (e) {
      setError(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`)
      setDeleting(null)
    }
  }

  // 삭제 컨트롤: 첫 클릭은 확인 대기로만 바꾸고(되돌릴 수 없으니 네이티브 confirm 대신 인라인 2단계), 두 번째로 실제 삭제
  const 삭제컨트롤 = (id: number, wasLast: boolean) =>
    confirm === id ? (
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <span className="text-[12px] font-semibold text-red-600">정말 삭제하시겠습니까?</span>
        <button
          onClick={() => 삭제드럼(id, wasLast)}
          disabled={deleting !== null}
          className="rounded-full px-2.5 py-1 text-[11.5px] font-bold bg-red-600 text-white disabled:opacity-60"
        >
          {deleting === id ? '삭제 중…' : '삭제'}
        </button>
        <button
          onClick={() => setConfirm(null)}
          disabled={deleting !== null}
          className="rounded-full px-2.5 py-1 text-[11.5px] font-bold border border-slate-200 bg-white disabled:opacity-60"
        >
          취소
        </button>
      </span>
    ) : (
      <button
        onClick={() => setConfirm(id)}
        disabled={deleting !== null}
        className="rounded-full px-2.5 py-1 text-[11.5px] font-bold border border-red-200 text-red-600 bg-white shrink-0 disabled:opacity-60"
      >
        삭제
      </button>
    )

  async function 복귀기록(기록id: number, max: number) {
    if (saving !== null) return // 저장 상태가 스칼라라, 두 번째 저장이 첫 저장의 버튼 잠금을 덮어쓴다 — 동시 저장 자체를 차단
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
    // 저장/삭제 중 배경클릭·ESC로 닫히면 실패가 조용히 삼켜진다 — 진행 중엔 닫기 무시
    <MSheet
      title="드럼 이력"
      sub="드럼 하나가 겪는 모든 일이 한 줄로 이어집니다"
      onClose={() => { if (saving === null && deleting === null) onClose() }}
      // 단일 드럼이면 스크린샷대로 헤더 우상단에 삭제. 여러 개면 드럼별로 내려 오삭제를 막는다.
      headerRight={단일 && 삭제가능(대상[0].id) ? 삭제컨트롤(대상[0].id, true) : undefined}
    >
      {대상.map((d) => {
        const 코드 = 코드of.get(d.선종_id) ?? ''
        const tl = build타임라인(d, 기록들)
        return (
          <div key={d.id} className="mb-5 last:mb-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-bold">
                {코드} · {d.초기길이.toLocaleString('ko-KR')}m 드럼 #{d.id}
                {d.제조표기 && <span className="text-slate-500 font-semibold"> — {d.제조표기}</span>}
                <span className="ml-2 text-[11px] font-bold rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">
                  {d.상태 === '재고' ? `잔량 ${d.잔량.toLocaleString('ko-KR')}m` : d.상태}
                </span>
              </p>
              {!단일 && 삭제가능(d.id) && 삭제컨트롤(d.id, false)}
            </div>
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
