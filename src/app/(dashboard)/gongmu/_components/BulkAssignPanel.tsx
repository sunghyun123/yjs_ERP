// src/app/(dashboard)/gongmu/_components/BulkAssignPanel.tsx
'use client'

/**
 * 미지정 공사를 체크해 담당 한 명을 한 번에 지정 (PR-1.5). 시공·정산 공용 — 쓰기 함수만 바꿔 꽂는다.
 * 판정·쓰기는 _lib/일괄지정.ts가 지고, 이 컴포넌트는 그것을 부르는 얇은 층이다.
 * ⚠️ 부모에서 이 패널의 key를 항목에 따라 바꾸지 말 것 — state가 사라져 [되돌리기] 바도 사라진다.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 일괄결과메시지, type 일괄결과, type 지정항목 } from '../_lib/일괄지정'
import type { 담당자 } from '../_lib/erp-실적'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type 쓰기 = (sb: SupabaseClient<Database>, ids: number[], 담당id: number) => Promise<일괄결과>

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

export function BulkAssignPanel({
  제목, 안내, 항목들, 담당자목록, 지정, 되돌리기, 단위,
}: {
  제목: string
  /** 정산: "이 공사의 모든 달 정산에 적용" 같은 범위 설명 */
  안내?: string
  항목들: 지정항목[]
  담당자목록: 담당자[]
  지정: 쓰기
  되돌리기: 쓰기
  /** 버튼 문구의 행 단위 — 시공 '행', 정산은 공사 단위라 표시 안 함 */
  단위: '행' | null
}) {
  const router = useRouter()
  const [선택, set선택] = useState<Set<number>>(new Set())
  const [담당id, set담당id] = useState<number | null>(null)
  const [저장중, set저장중] = useState(false)
  const [에러, set에러] = useState<string | null>(null)
  // 방금 지정한 것 — 새로고침으로 목록에서 사라져도 되돌릴 수 있게 id와 값을 들고 있는다(Q5)
  const [직전, set직전] = useState<{ ids: number[]; 담당id: number; 공사수: number } | null>(null)

  // 새로고침 뒤 목록에서 사라진 공사는 선택에서도 뺀다 — 숨은 선택이 다음 저장에 섞이지 않게(파생)
  const 보이는선택 = 항목들.filter((h) => 선택.has(h.수주_id))
  const 보낼ids = 보이는선택.flatMap((h) => h.ids)
  const 이름 = (id: number) => 담당자목록.find((d) => d.id === id)?.이름 ?? `#${id}`

  const 토글 = (수주_id: number) => set선택((s) => {
    const n = new Set(s)
    if (n.has(수주_id)) n.delete(수주_id)
    else n.add(수주_id)
    return n
  })
  const 전체토글 = () => set선택(보이는선택.length === 항목들.length ? new Set() : new Set(항목들.map((h) => h.수주_id)))

  const 실행 = async (작업: () => Promise<일괄결과>, 종류: '지정' | '되돌리기', 결과처리: (r: 일괄결과) => void) => {
    set저장중(true)
    set에러(null)
    try {
      const r = await 작업()
      if (!r.ok) set에러(일괄결과메시지(r, 종류))
      결과처리(r)
    } catch (e) {
      console.error('[gongmu] 일괄 지정 실패', e)
      set에러(일괄결과메시지({ ok: false, reason: 'error' }, 종류))
    } finally {
      set저장중(false)
      // 성공·부분·실패 모두 새로 읽는다 — 부분 반영이면 화면이 DB와 다르다
      router.refresh()
    }
  }

  const save = () => {
    if (담당id == null || 보낼ids.length === 0) return
    const 값 = 담당id
    const 공사수 = 보이는선택.length
    return 실행(() => 지정(createClient(), 보낼ids, 값), '지정', (r) => {
      // partial도 커밋된 행이 있으므로 되돌리기 대상으로 남긴다
      if (r.ok || r.reason === 'partial') { set직전({ ids: r.ids, 담당id: 값, 공사수 }); set선택(new Set()) }
    })
  }

  const undo = () => {
    if (!직전) return
    const d = 직전
    // 되돌리기 대상 = 지정 때 '돌아온' id — 요청했지만 안 바뀐 행(남이 지정한 행)은 건드리지 않는다
    return 실행(() => 되돌리기(createClient(), d.ids, d.담당id), '되돌리기', (r) => {
      // 일부만 되돌려졌어도 비운다 — 남은 행은 그 사이 담당이 바뀐 것이라 다시 눌러도 또 partial만 난다
      if (r.ok || r.reason === 'partial') set직전(null)
    })
  }

  if (항목들.length === 0 && !직전) return null

  return (
    <section className="space-y-2">
      <div className="flex justify-between items-baseline border-b border-gray-200 pb-1">
        <h3 className="text-sm font-semibold text-[#1e2d5a]">{제목}</h3>
        {항목들.length > 0 && (
          <button type="button" className="text-xs text-blue-600" onClick={전체토글}>
            {보이는선택.length === 항목들.length ? '전체 해제' : '전체 선택'}
          </button>
        )}
      </div>
      {안내 && <p className="text-xs text-amber-700">{안내}</p>}

      {항목들.length > 0 && (
        <div className="flex gap-2 sticky top-0 bg-background py-1">
          <select
            className="h-8 flex-1 rounded-lg border border-input bg-background text-xs px-2 outline-none focus:border-ring"
            value={담당id ?? ''}
            onChange={(e) => set담당id(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">담당 선택</option>
            {담당자목록.map((g) => <option key={g.id} value={g.id}>{g.이름}</option>)}
          </select>
          <Button size="sm" className="h-8 bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={save}
            disabled={담당id == null || 보낼ids.length === 0 || 저장중}>
            {저장중 ? <Loader2 className="size-3.5 animate-spin" />
              : `${보이는선택.length}개 공사${단위 ? ` · ${보낼ids.length}${단위}` : ''} 지정`}
          </Button>
        </div>
      )}

      {직전 && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
          <span>{이름(직전.담당id)}에게 {직전.공사수}개 공사{단위 ? ` · ${직전.ids.length}${단위}` : ''} 지정됨</span>
          <Button size="sm" variant="outline" className="h-7" onClick={undo} disabled={저장중}>되돌리기</Button>
        </div>
      )}
      {에러 && <p className="text-xs text-red-600">{에러}</p>}

      <ul className="space-y-1.5">
        {항목들.map((h) => (
          <li key={h.수주_id}>
            <label className={cn('flex gap-2 items-start rounded-lg px-2 py-1.5 text-sm cursor-pointer',
              선택.has(h.수주_id) && 'bg-blue-50')}>
              <input type="checkbox" className="mt-1" checked={선택.has(h.수주_id)} onChange={() => 토글(h.수주_id)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 truncate">{h.공사명}</p>
                <p className="text-xs text-gray-400">
                  <span className="font-mono">{h.지중no}</span>
                  {h.구분들 && <> · {h.구분들.join(', ')}</>} · {h.날짜들.map(md).join(', ')}
                  {단위 && <> · {h.ids.length}{단위}</>}
                </p>
              </div>
              <span className={cn('shrink-0 font-semibold tabular-nums', h.천원 < 0 ? 'text-red-600' : 'text-gray-800')}>
                {천원표기(h.천원)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
