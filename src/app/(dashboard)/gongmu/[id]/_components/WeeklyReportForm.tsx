'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { save주간보고, upsert월간계획 } from '../../_lib/actions'
import { exportWeeklyReport } from '../../_lib/excel'
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
  isDraft?: boolean
  erp_공사이력_id?: number | null
  erp_기성_id?: number | null
}

type Props = {
  공무_id: number
  year: number
  week_no: number
  savedRows: 공무_주간보고Row[]
  이력초안: { id: number; 수주_id: number | null; 성과금액: number | null; 작업내용: string | null }[]
  기성초안: { id: number; 수주_id: number | null; 기성액_공급가: number | null; 작업내용: string | null }[]
  수주목록: 수주항목[]
  공무담당자목록: { id: number; 이름: string }[]
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  month: number
  이름: string
  weekLabel: string
}

function NumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className="w-full text-right text-xs border-0 bg-transparent outline-none focus:bg-blue-50 rounded px-1"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  )
}

function TextCell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      className="w-full text-xs border-0 bg-transparent outline-none focus:bg-blue-50 rounded px-1"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function 공사SearchCell({ value, onChange, 수주목록 }: { value: string; onChange: (지중no: string, 공사명: string) => void; 수주목록: 수주항목[] }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setQuery(value)
  }, [value])
  const filtered = query
    ? 수주목록.filter((s) => s.지중no.includes(query) || s.공사명.includes(query)).slice(0, 8)
    : []

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full text-xs border-0 bg-transparent outline-none focus:bg-blue-50 rounded px-1"
        value={query}
        placeholder="지중No 검색..."
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-48 max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s.지중no, s.공사명); setQuery(s.지중no); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
            >
              <span className="font-mono text-gray-400 mr-1">{s.지중no}</span>{s.공사명}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(query, query); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t"
          >
            &quot;{query}&quot; 직접 입력
          </button>
        </div>
      )}
    </div>
  )
}

export function WeeklyReportForm({ 공무_id, year, week_no, savedRows, 이력초안, 기성초안, 수주목록, 공무담당자목록: _공무담당자목록, plans, month, 이름, weekLabel }: Props) {
  const [pending, startTransition] = useTransition()
  const [공사계획금액, set공사계획금액] = useState(plans.find((p) => p.구분 === '공사')?.월간계획금액 ?? 0)
  const [공무계획금액, set공무계획금액] = useState(plans.find((p) => p.구분 === '공무')?.월간계획금액 ?? 0)

  const initRows = (): 보고행[] => {
    const saved: 보고행[] = savedRows.map((r) => ({
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
    const drafts공사: 보고행[] = 이력초안.map((d) => {
      const 수주 = 수주목록.find((s) => s.id === d.수주_id)
      return {
        지중no: 수주?.지중no ?? '',
        공사명: 수주?.공사명 ?? '',
        금주작업: d.작업내용 ?? '',
        차주작업: '',
        금주계획: 0,
        금주실적: d.성과금액 ?? 0,
        차주계획: 0,
        구분: '공사',
        비고: '',
        isDraft: true,
        erp_공사이력_id: d.id,
      }
    })
    const drafts공무: 보고행[] = 기성초안.map((d) => ({
      지중no: '',
      공사명: '',
      금주작업: d.작업내용 ?? '',
      차주작업: '',
      금주계획: 0,
      금주실적: d.기성액_공급가 ?? 0,
      차주계획: 0,
      구분: '공무',
      비고: '',
      isDraft: true,
      erp_기성_id: d.id,
    }))
    return [...saved, ...drafts공사, ...drafts공무]
  }

  const [rows, setRows] = useState<보고행[]>(initRows)

  const update = (i: number, patch: Partial<보고행>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addRow = (구분: '공사' | '공무') =>
    setRows((prev) => [...prev, { 지중no: '', 공사명: '', 금주작업: '', 차주작업: '', 금주계획: 0, 금주실적: 0, 차주계획: 0, 구분, 비고: '' }])

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    startTransition(async () => {
      await upsert월간계획(공무_id, year, month, '공사', 공사계획금액)
      await upsert월간계획(공무_id, year, month, '공무', 공무계획금액)
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

  const th = 'text-[10px] font-semibold text-gray-500 px-2 py-2 bg-gray-50 text-left'
  const td = (draft?: boolean) => `px-1 py-1.5 border-b border-gray-50 text-xs ${draft ? 'bg-blue-50/40' : ''}`

  const renderTable = (구분: '공사' | '공무') => {
    const tableRows = rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.구분 === 구분)
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-[#1e2d5a] text-white text-xs font-semibold px-4 py-2.5 flex justify-between">
          <span>{구분 === '공사' ? '공사 파트' : '공무 파트'}</span>
          <span className="text-blue-300 font-normal text-[11px]">
            금주실적 합계: {tableRows.reduce((s, r) => s + r.금주실적, 0).toLocaleString()}원
          </span>
        </div>
        <table className="w-full table-fixed text-xs">
          <colgroup>
            {구분 === '공사' && <col style={{ width: '90px' }} />}
            <col style={{ width: '30px' }} />
            <col />
            <col />
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '28px' }} />
          </colgroup>
          <thead>
            <tr>
              {구분 === '공사' && <th className={th}>지중No</th>}
              <th className={th}>{구분 === '공사' ? '공사명' : '#'}</th>
              <th className={th}>금주 작업</th>
              <th className={th}>차주 작업</th>
              <th className={`${th} text-right`}>금주계획</th>
              <th className={`${th} text-right`}>금주실적</th>
              <th className={`${th} text-right`}>차주계획</th>
              <th className={th}>비고</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, rowIdx) => (
              <tr key={r.idx} className={r.isDraft ? 'bg-blue-50/30' : ''}>
                {구분 === '공사' && (
                  <td className={td(r.isDraft)}>
                    <공사SearchCell
                      value={r.지중no}
                      onChange={(지중no, 공사명) => update(r.idx, { 지중no, 공사명 })}
                      수주목록={수주목록}
                    />
                  </td>
                )}
                <td className={td(r.isDraft)}>
                  {구분 === '공사'
                    ? <TextCell value={r.공사명} onChange={(v) => update(r.idx, { 공사명: v })} />
                    : <span className="text-gray-400 px-1">{rowIdx + 1}</span>
                  }
                </td>
                <td className={td(r.isDraft)}>
                  <TextCell value={r.금주작업} onChange={(v) => update(r.idx, { 금주작업: v })} placeholder="작업 내용..." />
                </td>
                <td className={td(r.isDraft)}>
                  <TextCell value={r.차주작업} onChange={(v) => update(r.idx, { 차주작업: v })} placeholder="차주 계획..." />
                </td>
                <td className={td(r.isDraft)}>
                  <NumberCell value={r.금주계획} onChange={(v) => update(r.idx, { 금주계획: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <NumberCell value={r.금주실적} onChange={(v) => update(r.idx, { 금주실적: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <NumberCell value={r.차주계획} onChange={(v) => update(r.idx, { 차주계획: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <TextCell value={r.비고} onChange={(v) => update(r.idx, { 비고: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <button type="button" onClick={() => removeRow(r.idx)} className="text-gray-300 hover:text-red-400 px-1">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => addRow(구분)}
          className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-dashed border-gray-200 hover:bg-gray-50 transition-colors"
        >
          + {구분 === '공사' ? '공사' : '공무'} 행 추가
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* 월간계획 입력 */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">월간계획 (공사)</span>
          <input
            type="number"
            className="h-8 text-sm border border-gray-200 rounded px-2 w-32"
            value={공사계획금액 || ''}
            placeholder="0"
            onChange={(e) => set공사계획금액(Number(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-400">원</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">월간계획 (공무)</span>
          <input
            type="number"
            className="h-8 text-sm border border-gray-200 rounded px-2 w-32"
            value={공무계획금액 || ''}
            placeholder="0"
            onChange={(e) => set공무계획금액(Number(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-400">원</span>
        </div>
      </div>

      {renderTable('공사')}
      {renderTable('공무')}

      <div className="flex justify-end gap-2 mt-2">
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

      {이력초안.length > 0 || 기성초안.length > 0 ? (
        <p className="text-xs text-blue-500 mt-2 text-right">
          ✦ 파란 배경 행은 ERP에서 불러온 초안입니다. 자유롭게 편집 후 저장하세요.
        </p>
      ) : null}
    </div>
  )
}
