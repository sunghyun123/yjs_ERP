'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Copy, Check, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { 이력카드_머리글자Row } from '@/types/database'
import type { 카드결과 } from '../_lib/card'

// 서버(pdf.ts)와 같은 값. 서버 proxy의 10MB 상한보다 작게 — 올리기 전에 막아 시간을 아낀다
const 최대바이트 = 9 * 1024 * 1024

export function HistoryCardClient({ 규칙목록 }: { 규칙목록: 이력카드_머리글자Row[] }) {
  const [규칙Id, set규칙Id] = useState<number | null>(null)
  const [처리중, set처리중] = useState(false)
  const [오류, set오류] = useState<string | null>(null)
  const [결과, set결과] = useState<카드결과 | null>(null)
  // 카드 텍스트는 사용자가 복사 전에 고칠 수 있는 초안 = 원본 state (결과에서 매번 파생하지 않는다)
  const [본문, set본문] = useState('')
  const [복사됨, set복사됨] = useState(false)
  const [끌어옴, set끌어옴] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const 올리기가능 = 규칙Id !== null && !처리중

  async function 보내기(file: File) {
    if (!올리기가능) return
    set처리중(true); set오류(null); set결과(null); set본문(''); set복사됨(false)
    try {
      if (file.size > 최대바이트) { set오류('PDF가 9MB를 넘습니다.'); return }
      const fd = new FormData()
      fd.append('prefixId', String(규칙Id))
      fd.append('file', file)
      const res = await fetch('/api/history-card', { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)
      if (!res.ok) { set오류(json?.error ?? `요청 실패 (${res.status})`); return }
      if (!json || typeof json.text !== 'string') { set오류('서버 응답을 읽지 못했습니다.'); return }
      set결과(json as 카드결과)
      set본문((json as 카드결과).text)
    } catch {
      set오류('서버에 연결하지 못했습니다.')
    } finally {
      set처리중(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function 복사() {
    try {
      await navigator.clipboard.writeText(본문) // 탭 문자 그대로
      set복사됨(true)
      set오류(null)
    } catch {
      set복사됨(false)
      set오류('복사하지 못했습니다. 글을 직접 선택해 복사하세요.')
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="bg-white rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-medium text-gray-700 px-1">머리글자</legend>
        {규칙목록.length === 0 ? (
          <p className="text-sm text-gray-400">사용 중인 머리글자가 없습니다. 관리자에게 알려 주세요.</p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {규칙목록.map(r => (
              <label key={r.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="prefix" checked={규칙Id === r.id} onChange={() => set규칙Id(r.id)} />
                <span className="font-mono font-semibold">{r.머리글자}</span>
                <span className="text-gray-500">{r.이름}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={!올리기가능}
        onClick={() => 올리기가능 && inputRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && 올리기가능) inputRef.current?.click() }}
        onDragOver={e => { e.preventDefault(); if (올리기가능) set끌어옴(true) }}
        onDragLeave={() => set끌어옴(false)}
        onDrop={e => {
          e.preventDefault(); set끌어옴(false)
          const f = e.dataTransfer.files[0]
          if (f) void 보내기(f)
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-10 text-center text-sm transition-colors',
          올리기가능 ? 'cursor-pointer border-gray-300 text-gray-600 hover:border-[#2d45a8]' : 'cursor-not-allowed border-gray-200 text-gray-300',
          끌어옴 && 'border-[#2d45a8] bg-blue-50',
        )}
      >
        {처리중 ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />통보서 읽는 중 (수십 초 걸릴 수 있습니다)</span>
        ) : (
          <span className="inline-flex items-center gap-2"><Upload className="size-4" />
            {규칙Id === null ? '먼저 머리글자를 고르세요' : '시공통보서 PDF를 끌어다 놓거나 클릭'}
          </span>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void 보내기(f) }} />
      </div>

      {오류 && <p className="text-sm text-red-600">{오류}</p>}

      {결과 && (
        <div className="space-y-2">
          {결과.warnings.length > 0 && (
            <ul className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-1">
              {결과.warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5"><AlertTriangle className="size-4 shrink-0 mt-0.5" />{w}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">금액은 통보서와 대조하세요. AI가 셋을 같이 잘못 읽으면 검산으로 못 잡습니다.</p>
          <textarea
            value={본문}
            onChange={e => { set본문(e.target.value); set복사됨(false) }}
            rows={16}
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm [tab-size:4]"
          />
          <div className="flex items-center gap-3">
            <Button type="button" onClick={복사}>
              {복사됨 ? <Check className="size-4" /> : <Copy className="size-4" />}{복사됨 ? '복사됨' : '복사'}
            </Button>
            <span className="text-sm text-gray-500">
              번호: {결과.번호상태 === '기존' ? 'ERP 등록된 공사' : 결과.번호상태 === '제안' ? '제안 (수주 등록 시 확정)' : '확인 필요'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
