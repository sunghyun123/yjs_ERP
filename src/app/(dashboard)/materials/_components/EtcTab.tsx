// src/app/(dashboard)/materials/_components/EtcTab.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayKST } from '@/lib/kst'
import { group기타자재, 품목라벨, type Derived품목 } from '../_lib/derive'

interface Props {
  품목들: Derived품목[]
}

export function EtcTab({ 품목들 }: Props) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [열린분류, set열린분류] = useState<ReadonlySet<string>>(new Set())
  const [editing, setEditing] = useState<number | null>(null) // 직접 입력 중인 품목id
  const [editVal, setEditVal] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const 검색중 = q.trim() !== ''
  // 렌더 중 파생 — 검색어나 품목이 바뀌면 자동으로 다시 묶인다(별도 state로 저장하면 어긋남)
  const 그룹들 = group기타자재(품목들, q)

  // 검색 중엔 전부 펼친다. 결과가 접힌 카드 안에 숨으면 검색이 검색 노릇을 못 한다.
  // effect로 열린분류를 건드리지 않는 이유: 그러면 한 프레임은 접힌 채로 그려지고 렌더가 한 번 더 돈다.
  const 펼침 = (대분류: string) => 검색중 || 열린분류.has(대분류)

  function toggle(대분류: string) {
    set열린분류((prev) => {
      const next = new Set(prev)
      if (next.has(대분류)) next.delete(대분류)
      else next.add(대분류)
      return next // 새 Set — 같은 참조를 반환하면 React가 바뀐 걸 모른다
    })
  }

  function openEdit(p: Derived품목) {
    setError(null)
    setEditing(p.id)
    setEditVal(String(p.수량))
    setEditMemo('') // 최근비고를 미리 채우지 않는다 — 지난 입고처가 새 기록에 조용히 복사된다
  }

  function cancelEdit() {
    setEditing(null)
    setEditVal('')
    setEditMemo('')
  }

  /** 기록 한 건을 남긴다. 성공하면 true. */
  async function apply(품목id: number, delta: number, 비고 = ''): Promise<boolean> {
    if (delta === 0) return false
    if (saving !== null) {
      setError('다른 항목 저장 중입니다 — 잠시 후 다시 시도하세요') // 저장 상태가 스칼라라 동시 저장을 차단하되, 조용히 삼키지 않고 알린다
      return false
    }
    setError(null)
    setSaving(품목id)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('자재_품목기록')
        .insert({ 품목_id: 품목id, 변화량: delta, 일자: todayKST(), 비고: 비고.trim() || null })
      if (err) {
        setError(`저장 실패: ${err.message}`)
        return false
      }
      router.refresh()
      return true
    } catch (e) {
      // 네트워크 예외 등 reject 경로에서도 버튼이 영구 잠기지 않게
      setError(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      return false
    } finally {
      setSaving(null)
    }
  }

  async function commitEdit(p: Derived품목) {
    const raw = editVal.trim()
    const v = Number(raw) // parseInt는 '3.9'를 3으로 절삭 — 정수가 아니면 반영하지 않는다
    if (raw === '' || !Number.isInteger(v) || v < 0) {
      return setError('수량은 0 이상의 정수로 입력하세요')
    }
    const delta = v - p.수량
    if (delta === 0) {
      // 기록 테이블은 '변화량 <> 0' 제약이 있어 비고만 남길 수 없다.
      // 조용히 닫으면 저장 버튼이 먹통으로 보이므로 왜 안 되는지 말한다.
      return setError('수량이 그대로입니다 — 비고만 따로 남길 수는 없습니다')
    }
    if (await apply(p.id, delta, editMemo)) cancelEdit()
  }

  function 품목행(p: Derived품목, 구분선: boolean) {
    const 선 = 구분선 ? 'border-t border-slate-100' : ''

    if (editing === p.id) {
      return (
        <form
          key={p.id}
          onSubmit={(e) => { e.preventDefault(); void commitEdit(p) }}
          onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
          className={`py-2 ${선}`}
        >
          <p className="text-sm mb-1.5">{품목라벨(p)}</p>
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              aria-label="수량"
              className="w-[72px] shrink-0 border-[1.5px] border-[#3d5af1] rounded-lg px-1.5 py-1 font-bold text-right bg-slate-50"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
            />
            <input
              type="text"
              aria-label="비고"
              placeholder="비고 (입고처·공사명·지역 등)"
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1 text-sm"
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving !== null}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-bold bg-[#3d5af1] text-white disabled:opacity-40"
            >저장</button>
            <button
              type="button"
              onClick={cancelEdit}
              className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-bold text-slate-500"
            >취소</button>
          </div>
        </form>
      )
    }

    return (
      <div key={p.id} className={`flex items-center gap-2.5 py-2 ${선}`}>
        <span className="flex-1 min-w-0 text-sm text-slate-800">
          {품목라벨(p)}
          {p.최근비고 && (
            <span className="block text-[11px] text-slate-400 truncate" title={p.최근비고}>{p.최근비고}</span>
          )}
        </span>
        <button
          className={`min-w-[44px] shrink-0 text-right text-[15px] font-bold tabular-nums rounded-lg px-1 py-0.5 hover:bg-slate-50 ${p.수량 === 0 ? 'text-slate-400' : ''}`}
          title="숫자를 눌러 수량·비고 직접 입력"
          onClick={() => openEdit(p)}
        >
          {p.수량}<small className="text-[11.5px] font-semibold text-slate-500"> {p.단위}</small>
        </button>
        <span className="flex gap-1.5 shrink-0">
          {/* 잠금은 전역(스칼라 saving)이므로 비활성도 전역으로 — 행 단위로만 막으면 다른 행 탭이 조용히 무시된다 */}
          <button
            disabled={saving !== null || p.수량 === 0}
            onClick={() => void apply(p.id, -1)}
            className="w-[30px] h-[30px] rounded-lg border border-slate-200 bg-slate-50 text-base font-bold leading-none disabled:opacity-40"
          >−</button>
          <button
            disabled={saving !== null}
            onClick={() => void apply(p.id, 1)}
            className="w-[30px] h-[30px] rounded-lg border border-slate-200 bg-slate-50 text-base font-bold leading-none disabled:opacity-40"
          >＋</button>
        </span>
      </div>
    )
  }

  return (
    <div>
      {/* 검색: 품목이 72개라 접힌 카드를 하나씩 여는 것보다 이름으로 찍는 게 빠르다 */}
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-2 mb-1" style={{ backgroundColor: '#f1f4fb' }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="품목 검색 (예: 4DA, 직선용 325)"
          aria-label="품목 검색"
          className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-[#3d5af1]"
        />
      </div>

      {그룹들.length === 0 ? (
        <p className="text-sm text-slate-500 px-1 py-6 text-center">
          검색어에 맞는 품목이 없습니다.
        </p>
      ) : (
        그룹들.map((g) => (
          <section key={g.대분류} className="bg-white rounded-[14px] shadow-sm mb-2.5 overflow-hidden">
            {/* 검색 중엔 펼침이 강제라 토글을 막는다 — 안 그러면 눌러도 아무 일 없는 버튼이 된다 */}
            <button
              onClick={() => toggle(g.대분류)}
              disabled={검색중}
              aria-expanded={펼침(g.대분류)}
              className="w-full flex items-center gap-2 px-3.5 py-3 text-left disabled:cursor-default"
            >
              <span className={`text-[9px] text-slate-400 transition-transform ${펼침(g.대분류) ? 'rotate-90' : ''}`}>▶</span>
              <span className="text-[15px] font-bold text-slate-900 tracking-tight">{g.대분류}</span>
              <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-slate-400 tabular-nums">
                {g.재고수 > 0 && (
                  <b className="rounded-full bg-blue-50 px-1.5 py-px text-[#3d5af1]">재고 {g.재고수}</b>
                )}
                {g.총수}개
              </span>
            </button>

            {펼침(g.대분류) && (
              <div className="px-3.5 pb-2 border-t border-slate-100">
                {g.중분류들.map((m, mi) => (
                  <div key={m.중분류}>
                    {m.소제목 ? (
                      <>
                        {/* 중분류 = 카드 폭을 가로지르는 띠. 배경·왼쪽 색막대로 '행'이 아니라 '구획'으로 읽히게 */}
                        <div className="-mx-3.5 mt-1.5 border-l-[3px] border-[#3d5af1] bg-slate-50 px-3.5 py-1.5">
                          <h4 className="text-[11.5px] font-bold text-slate-600">{m.중분류}</h4>
                        </div>
                        {/* 소분류 = 들여쓰기 + 세로 가이드선으로 위 띠에 매달린 것처럼 */}
                        <div className="ml-1 border-l border-slate-200 pl-3">
                          {m.품목들.map((p, i) => 품목행(p, i > 0))}
                        </div>
                      </>
                    ) : (
                      // 소제목이 없는 그룹 = 중분류 자신이 품목. 띠도 들여쓰기도 없이 중분류 자리에 그대로 선다
                      m.품목들.map((p, i) => 품목행(p, mi > 0 || i > 0))
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-slate-500 mt-2.5 mx-0.5">
        분류를 눌러 펼치거나, 위에서 품목명을 검색하세요. 한두 개는 ＋/−로, 수백 개 입고처럼 큰 변화는{' '}
        <b>숫자를 눌러 수량과 비고를 함께</b> 적습니다. 비고에는 입고처·공사명·지역 등 무엇이든 적을 수 있고,
        품목 아래 회색 글씨는 마지막으로 적힌 비고입니다. 누가 언제 바꿨는지는 자동으로 기록됩니다.
      </p>
    </div>
  )
}
