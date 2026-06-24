'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoryGroup, PreparedEntry } from '../_lib/types'

const GROUPS: CategoryGroup[] = ['수주', '준공완료', '기성', '공사이력', '투입실적', '마스터']

const OP_BADGE: Record<PreparedEntry['operation'], string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

interface Props {
  entries: PreparedEntry[]
  from: string
  to: string
}

export function UpdatesClient({ entries, from, to }: Props) {
  const router = useRouter()
  const [fromLocal, setFromLocal] = useState(from)
  const [toLocal, setToLocal] = useState(to)
  // 기본: 전체 그룹 선택
  const [selected, setSelected] = useState<Set<CategoryGroup>>(new Set(GROUPS))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function applyRange() {
    router.push(`/admin/updates?from=${fromLocal}&to=${toLocal}`)
  }

  function toggleGroup(g: CategoryGroup) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visible = useMemo(
    () => entries.filter((e) => selected.has(e.category.group)),
    [entries, selected],
  )

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">변경내역</h1>
        <p className="text-sm text-gray-500">
          신규 ERP에 입력된 변경을 기간·분류별로 조회 (레거시 ERP 이중입력용)
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="flex items-end gap-2">
        <label className="text-sm text-gray-600">
          시작
          <input
            type="date"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            className="block border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600">
          종료
          <input
            type="date"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            className="block border rounded px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={applyRange}
          className="px-3 py-1.5 rounded bg-[#2d45a8] text-white text-sm"
        >
          조회
        </button>
      </div>

      {/* 분류 필터 */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggleGroup(g)}
            className={
              'px-2.5 py-1 rounded-full text-xs border ' +
              (selected.has(g)
                ? 'bg-[#2d45a8] text-white border-[#2d45a8]'
                : 'bg-white text-gray-500 border-gray-300')
            }
          >
            {g}
          </button>
        ))}
      </div>

      {/* 결과 */}
      <p className="text-xs text-gray-400">{visible.length}건 (최대 500건)</p>
      <div className="border rounded-lg divide-y">
        {visible.length === 0 && (
          <p className="p-4 text-sm text-gray-400">해당 기간·분류의 변경내역이 없습니다.</p>
        )}
        {visible.map((e) => (
          <div key={e.id}>
            <button
              type="button"
              onClick={() => toggleExpand(e.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-xs text-gray-400 w-32 shrink-0">
                {new Date(e.changed_at).toLocaleString('ko-KR')}
              </span>
              <span
                className={'text-[11px] px-1.5 py-0.5 rounded shrink-0 ' + OP_BADGE[e.operation]}
              >
                {e.category.label}
              </span>
              <span className="text-sm text-gray-700 flex-1 truncate">{e.summary}</span>
              <span className="text-xs text-gray-300 shrink-0">#{e.row_id}</span>
            </button>
            {expanded.has(e.id) && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-3 bg-gray-50/50">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">변경 전 (old)</p>
                  <pre className="text-[11px] bg-white border rounded p-2 overflow-x-auto">
                    {e.old_data ? JSON.stringify(e.old_data, null, 2) : '—'}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">변경 후 (new)</p>
                  <pre className="text-[11px] bg-white border rounded p-2 overflow-x-auto">
                    {e.new_data ? JSON.stringify(e.new_data, null, 2) : '—'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
