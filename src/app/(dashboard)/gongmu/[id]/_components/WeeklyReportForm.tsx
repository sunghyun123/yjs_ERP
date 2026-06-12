'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { save주간보고, upsert월간계획 } from '../../_lib/actions'
import { exportWeeklyReport } from '../../_lib/excel'
import { getWeeksInMonth } from '@/lib/week'
import { formatEok } from '@/lib/format'
import type { 공무_주간보고Row, 공무_월간계획Row } from '@/types/database'

type 수주항목 = { id: number; 지중no: string; 공사명: string }
type 보고행 = {
  id?: number
  지중no: string
  공사명: string
  금주작업: string
  차주작업: string
  금주계획: number
  금주실적: number
  차주계획: number
  구분: '공사' | '공무'
  비고: string
  erp_공사이력_id?: number | null
  erp_기성_id?: number | null
}

type Props = {
  공무_id: number
  calYear: number
  year: number
  week_no: number
  savedRows: 공무_주간보고Row[]
  수주목록: 수주항목[]
  공무담당자목록: { id: number; 이름: string }[]
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  month: number
  이름: string
  weekLabel: string
  allRows?: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적' | '구분'>[]
}

function cellCls(extra = '') {
  const base = 'w-full rounded-md border border-blue-100 bg-blue-50/60 px-2 py-1 text-sm text-[#1e2d5a] outline-none focus:border-blue-400 focus:bg-blue-50'
  return extra ? `${base} ${extra}` : base
}

function useMoneyInput(value: number, setValue: (n: number) => void) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  return {
    type: 'text' as const,
    inputMode: 'numeric' as const,
    value: editing ? raw : (value === 0 ? '' : value.toLocaleString('ko-KR')),
    placeholder: '0',
    onFocus: () => { setRaw(value === 0 ? '' : String(value)); setEditing(true) },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const d = e.target.value.replace(/[^0-9]/g, '')
      setRaw(d)
      setValue(Number(d) || 0)
    },
    onBlur: () => setEditing(false),
  }
}

function NumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const props = useMoneyInput(value, onChange)
  return <input className={cellCls('text-right')} {...props} />
}

function TextCell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      className={cellCls()}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TextAreaCell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      className={cellCls('resize-vertical min-h-[66px] leading-relaxed font-sans py-1.5')}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function 공사통합Cell({ 지중no, 공사명, onChange, 수주목록 }: {
  지중no: string
  공사명: string
  onChange: (지중no: string, 공사명: string) => void
  수주목록: 수주항목[]
}) {
  const [query, setQuery] = useState(공사명)
  const [open, setOpen] = useState(false)
  const [dropRect, setDropRect] = useState<DOMRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setQuery(공사명) }, [공사명])

  const q = query.toLowerCase()
  const filtered = query
    ? 수주목록.filter((s) => s.공사명.toLowerCase().includes(q) || s.지중no.toLowerCase().includes(q)).slice(0, 10)
    : 수주목록.slice(0, 20)

  const 지중no서브 = 지중no && 지중no !== 공사명 ? 지중no : null

  const handleFocus = () => {
    setDropRect(inputRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  const openUpward = dropRect ? window.innerHeight - dropRect.bottom < 220 : false
  const dropdown = open && filtered.length > 0 && dropRect && createPortal(
    <div
      style={{
        position: 'fixed',
        ...(openUpward
          ? { bottom: window.innerHeight - dropRect.top + 2 }
          : { top: dropRect.bottom + 2 }),
        left: dropRect.left,
        width: Math.max(dropRect.width, 288),
        zIndex: 9999,
      }}
      className="bg-white border border-gray-200 rounded shadow-lg max-h-64 overflow-y-auto"
    >
      {filtered.map((s) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onChange(s.지중no, s.공사명); setQuery(s.공사명); setOpen(false) }}
          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0"
        >
          <div className="font-medium text-gray-800 truncate">{s.공사명}</div>
          <div className="font-mono text-gray-400 mt-0.5">{s.지중no}</div>
        </button>
      ))}
      {query && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onChange(query, query); setOpen(false) }}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t"
        >
          &quot;{query}&quot; 직접 입력
        </button>
      )}
    </div>,
    document.body,
  )

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        className={cellCls('pr-6')}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        value={query}
        placeholder="공사명 또는 지중No..."
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value, e.target.value); setOpen(true) }}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {지중no서브 && (
        <span className="block text-[10px] text-gray-400 truncate mt-0.5 px-1">{지중no서브}</span>
      )}
      {dropdown}
    </div>
  )
}

export function WeeklyReportForm({
  공무_id, calYear, year, week_no, savedRows,
  수주목록, 공무담당자목록: _공무담당자목록,
  plans, month, 이름, weekLabel, allRows = [],
}: Props) {
  const [pending, startTransition] = useTransition()
  const [공사계획금액, set공사계획금액] = useState(plans.find((p) => p.구분 === '공사')?.월간계획금액 ?? 0)
  const [공무계획금액, set공무계획금액] = useState(plans.find((p) => p.구분 === '공무')?.월간계획금액 ?? 0)
  const 공사계획Props = useMoneyInput(공사계획금액, set공사계획금액)
  const 공무계획Props = useMoneyInput(공무계획금액, set공무계획금액)

  const validMonthPairs = new Set(getWeeksInMonth(calYear, month).map((w) => `${w.isoYear}-${w.week}`))
  const 월간rows = allRows.filter((r) => validMonthPairs.has(`${r.year}-${r.week_no}`))
  const 공사누계 = 월간rows.filter((r) => r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 공무누계 = 월간rows.filter((r) => r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)
  const 금주공사 = allRows.filter((r) => r.week_no === week_no && r.year === year && r.구분 === '공사').reduce((s, r) => s + r.금주실적, 0)
  const 금주공무 = allRows.filter((r) => r.week_no === week_no && r.year === year && r.구분 === '공무').reduce((s, r) => s + r.금주실적, 0)
  const 공사달성 = 공사계획금액 > 0 ? Math.round((공사누계 / 공사계획금액) * 100 * 10) / 10 : null
  const 공무달성 = 공무계획금액 > 0 ? Math.round((공무누계 / 공무계획금액) * 100 * 10) / 10 : null

  function pctColor(pct: number) {
    return pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
  }

  const weekShort = weekLabel.match(/^\d+주차/)?.[0] ?? weekLabel

  const [rows, setRows] = useState<보고행[]>(() =>
    savedRows.map((r) => ({
      id: r.id,
      지중no: r.지중no ?? '',
      공사명: r.공사명,
      금주작업: r.금주작업 ?? '',
      차주작업: r.차주작업 ?? '',
      금주계획: r.금주계획,
      금주실적: r.금주실적,
      차주계획: r.차주계획,
      구분: r.구분,
      비고: r.비고 ?? '',
      erp_공사이력_id: r.erp_공사이력_id,
      erp_기성_id: r.erp_기성_id,
    }))
  )

  const update = (i: number, patch: Partial<보고행>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = (구분: '공사' | '공무') =>
    setRows((prev) => [...prev, { 지중no: '', 공사명: '', 금주작업: '', 차주작업: '', 금주계획: 0, 금주실적: 0, 차주계획: 0, 구분, 비고: '' }])
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    startTransition(async () => {
      await upsert월간계획(공무_id, calYear, month, '공사', 공사계획금액)
      await upsert월간계획(공무_id, calYear, month, '공무', 공무계획금액)
      await save주간보고(
        공무_id, year, week_no,
        rows.map((r, i) => ({
          공무_id, year, week_no,
          항목순서: i,
          지중no: r.지중no || null,
          공사명: r.공사명,
          금주작업: r.금주작업 || null,
          차주작업: r.차주작업 || null,
          금주계획: r.금주계획,
          금주실적: r.금주실적,
          차주계획: r.차주계획,
          구분: r.구분,
          비고: r.비고 || null,
          erp_공사이력_id: r.erp_공사이력_id ?? null,
          erp_기성_id: r.erp_기성_id ?? null,
        })),
      )
    })
  }

  const th = 'text-[10px] font-semibold text-gray-500 px-2 py-2.5 bg-gray-50 text-left whitespace-nowrap'
  const thR = 'text-[10px] font-semibold text-gray-500 px-2 py-2.5 bg-gray-50 text-right whitespace-nowrap'

  const renderTable = (구분: '공사' | '공무') => {
    const tableRows = rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.구분 === 구분)
    const sumLabel = tableRows.reduce((s, r) => s + r.금주실적, 0).toLocaleString()

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-[#1e2d5a] text-white text-sm font-semibold px-4 py-2.5 flex justify-between items-center">
          <span>{구분 === '공사' ? '공사 파트' : '공무 파트'}</span>
          <span className="text-blue-300 font-normal text-xs">금주 실적: {sumLabel}원</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 860 }}>
            <colgroup>
              <col style={{ width: 240 }} />
              <col style={{ width: '22%', minWidth: 140 }} />
              <col style={{ width: '22%', minWidth: 140 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 28 }} />
            </colgroup>
            <thead>
              <tr>
                <th className={th}>지중No / 공사명</th>
                <th className={th}>금주 작업</th>
                <th className={th}>차주 작업</th>
                <th className={thR}>금주계획</th>
                <th className={thR}>금주실적</th>
                <th className={thR}>차주계획</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.idx}>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-top">
                    <공사통합Cell
                      지중no={r.지중no}
                      공사명={r.공사명}
                      onChange={(지중no, 공사명) => update(r.idx, { 지중no, 공사명 })}
                      수주목록={수주목록}
                    />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-top">
                    <TextAreaCell
                      value={r.금주작업}
                      onChange={(v) => update(r.idx, { 금주작업: v })}
                      placeholder="작업 내용..."
                    />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-top">
                    <TextAreaCell
                      value={r.차주작업}
                      onChange={(v) => update(r.idx, { 차주작업: v })}
                      placeholder="차주 계획..."
                    />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    <NumberCell value={r.금주계획} onChange={(v) => update(r.idx, { 금주계획: v })} />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    <NumberCell value={r.금주실적} onChange={(v) => update(r.idx, { 금주실적: v })} />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle">
                    <NumberCell value={r.차주계획} onChange={(v) => update(r.idx, { 차주계획: v })} />
                  </td>
                  <td className="px-1.5 py-1.5 border-b border-gray-50 align-middle text-center">
                    <button type="button" onClick={() => removeRow(r.idx)} className="text-gray-300 hover:text-red-400 px-1 text-base leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => addRow(구분)}
          className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-600 border-t border-dashed border-gray-200 hover:bg-gray-50 transition-colors"
        >
          + {구분 === '공사' ? '공사' : '공무'} 행 추가
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* 월간 현황 통합 카드 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">
            {calYear}년 {month}월 월간 현황
          </span>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-3 py-1">
            계획 수정 가능
          </span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {/* 공사 */}
          <div>
            <span className="inline-block text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded mb-2">공사</span>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-gray-400 w-7 shrink-0">계획</span>
              <input
                className="flex-1 h-7 border border-gray-200 rounded-md px-2 text-xs text-right font-semibold text-[#1e2d5a] bg-blue-50/60 outline-none focus:border-blue-400 min-w-0"
                {...공사계획Props}
              />
              <span className="text-[10px] text-gray-400 shrink-0">원</span>
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-bold text-[#1e2d5a]">{formatEok(공사누계)}</span>
              <span className="text-xs font-bold" style={{ color: 공사달성 !== null ? pctColor(공사달성) : '#d1d5db' }}>
                {공사달성 !== null ? `${공사달성}%` : '—'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(공사달성 ?? 0, 100)}%` }} />
            </div>
          </div>
          {/* 공무 */}
          <div>
            <span className="inline-block text-[11px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded mb-2">공무</span>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] text-gray-400 w-7 shrink-0">계획</span>
              <input
                className="flex-1 h-7 border border-gray-200 rounded-md px-2 text-xs text-right font-semibold text-[#1e2d5a] bg-blue-50/60 outline-none focus:border-blue-400 min-w-0"
                {...공무계획Props}
              />
              <span className="text-[10px] text-gray-400 shrink-0">원</span>
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-bold text-[#1e2d5a]">{formatEok(공무누계)}</span>
              <span className="text-xs font-bold" style={{ color: 공무달성 !== null ? pctColor(공무달성) : '#d1d5db' }}>
                {공무달성 !== null ? `${공무달성}%` : '—'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(공무달성 ?? 0, 100)}%` }} />
            </div>
          </div>
          {/* 금주 실적 패널 */}
          <div className="border-l border-gray-100 pl-5">
            <p className="text-[11px] font-bold text-gray-400 tracking-wide mb-1">
              금주 실적 ({month}월 {weekShort})
            </p>
            <p className="text-2xl font-extrabold text-[#1e2d5a] mt-2 mb-1">
              {formatEok(금주공사 + 금주공무)}
            </p>
            <p className="text-[11px] text-gray-400">
              공사 {formatEok(금주공사)} + 공무 {formatEok(금주공무)}
            </p>
          </div>
        </div>
      </div>

      {renderTable('공사')}
      {renderTable('공무')}

      <div className="flex justify-end items-center mt-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-blue-400 text-blue-600"
          onClick={() =>
            exportWeeklyReport(이름, year, week_no, weekLabel, rows.map((r) => ({
              지중no: r.지중no || null,
              공사명: r.공사명,
              금주작업: r.금주작업 || null,
              차주작업: r.차주작업 || null,
              금주계획: r.금주계획,
              금주실적: r.금주실적,
              차주계획: r.차주계획,
              구분: r.구분,
              비고: r.비고 || null,
            })))
          }
        >
          ↓ 엑셀 내보내기
        </Button>
        <Button
          size="sm"
          className="bg-[#1e2d5a] hover:bg-[#2d45a8] text-white"
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
