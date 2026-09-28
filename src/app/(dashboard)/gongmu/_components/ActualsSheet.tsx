// src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { update공사이력, 저장실패메시지 } from '@/app/(dashboard)/progress/_lib/update-공사이력'
import type { 담당묶음, 담당자, 실적행 } from '../_lib/erp-실적'
import type { 연월, 주정보 } from '../_lib/주차'

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`

function AssignRow({ 행, 담당자목록 }: { 행: 실적행; 담당자목록: 담당자[] }) {
  const router = useRouter()
  const [선택, set선택] = useState<number | null>(null)
  const [저장중, set저장중] = useState(false)
  const [에러, set에러] = useState<string | null>(null)

  const save = async () => {
    if (선택 == null) return
    set저장중(true)
    set에러(null)
    const 결과 = await update공사이력(createClient(), 행.id, { 담당공무_id: 선택 })
    set저장중(false)
    if (!결과.ok) { set에러(저장실패메시지(결과.reason)); return }
    // 서버 컴포넌트를 다시 그려 집계를 새로 받는다 — 이 행은 담당자 카드로 옮겨간다
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      <div className="flex gap-2">
        <select
          className="h-8 flex-1 rounded-lg border border-input bg-background text-xs px-2 outline-none focus:border-ring"
          value={선택 ?? ''}
          onChange={(e) => set선택(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">담당 선택</option>
          {담당자목록.map((g) => <option key={g.id} value={g.id}>{g.이름}</option>)}
        </select>
        <Button size="sm" className="h-8 bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={save} disabled={선택 == null || 저장중}>
          {저장중 ? <Loader2 className="size-3.5 animate-spin" /> : '저장'}
        </Button>
      </div>
      {에러 && <p className="text-xs text-red-600">{에러}</p>}
    </div>
  )
}

export function ActualsSheet({
  묶음, 주목록, 선택월요일, 월, 담당자목록, onClose,
}: {
  묶음: 담당묶음 | null
  주목록: 주정보[]
  선택월요일: string
  월: 연월
  담당자목록: 담당자[]
  onClose: () => void
}) {
  // 선택한 주가 맨 위, 나머지는 시간순
  const 주순서 = 묶음
    ? [...주목록].sort((a, b) =>
        a.월요일 === 선택월요일 ? -1 : b.월요일 === 선택월요일 ? 1 : a.월요일.localeCompare(b.월요일))
    : []

  return (
    <Sheet open={묶음 != null} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold text-left">{묶음?.이름}</SheetTitle>
          <SheetDescription className="text-left">
            {Number(월.slice(5, 7))}월 누적 {천원표기(묶음?.월누적천원 ?? 0)} · {묶음?.건수 ?? 0}건
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-5">
          {묶음 && 묶음.건수 === 0 && (
            <p className="text-sm text-gray-400">
              {묶음.종류 === '미지정' ? '미지정 이력이 없습니다 ✓' : '이 달에 등록된 실적이 없습니다.'}
            </p>
          )}
          {주순서.map((w) => {
            const 행들 = 묶음!.행.filter((r) => r.월요일 === w.월요일)
            if (행들.length === 0) return null
            const 소계 = 행들.reduce((s, r) => s + r.천원, 0)
            return (
              <section key={w.월요일}>
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-1 mb-2">
                  <h3 className="text-sm font-semibold text-[#1e2d5a]">
                    {w.label}{w.월요일 === 선택월요일 && <span className="ml-1.5 text-xs text-blue-600">선택</span>}
                  </h3>
                  <span className="text-sm font-bold text-[#1e2d5a] tabular-nums">{천원표기(소계)}</span>
                </div>
                <ul className="space-y-2">
                  {행들.map((r) => (
                    <li key={r.id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{r.공사명}</p>
                          <p className="text-xs text-gray-400">
                            <span className="font-mono">{r.지중no}</span> · {r.작업일자.slice(5).replace('-', '/')}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-800">{천원표기(r.천원)}</span>
                      </div>
                      {묶음!.종류 === '미지정' && <AssignRow 행={r} 담당자목록={담당자목록} />}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {묶음?.종류 === '담당' && 묶음.담당공무_id != null && (
            <Link
              href={`/gongmu/${묶음.담당공무_id}?month=${월}`}
              className="block text-xs text-gray-400 hover:text-gray-600 pt-2"
            >
              주간 보고서 직접 작성(구 양식) →
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
