// src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx
'use client'

import Link from 'next/link'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { 공사별로묶기, type 담당묶음, type 담당자 } from '../_lib/erp-실적'
import {
  시공담당지정, 시공담당되돌리기, 정산담당지정, 정산담당되돌리기, 시공미지정공사목록, 정산미지정공사목록,
} from '../_lib/일괄지정'
import type { 연월, 주정보 } from '../_lib/주차'
import { BulkAssignPanel } from './BulkAssignPanel'

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

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
  // 1주차부터 고정 순서 — 선택한 주를 맨 위로 올리면 주를 바꿀 때마다 순서가 달라져 더 헷갈린다(선택 표시만 남김)
  // 미지정은 주별 목록 대신 그 달의 공사별 체크박스 목록(BulkAssignPanel)으로 그린다 — 지정하는 길을 하나로
  const 미지정 = 묶음?.종류 === '미지정'
  const 주순서 = 묶음 && !미지정 ? [...주목록].sort((a, b) => a.월요일.localeCompare(b.월요일)) : []

  return (
    <Sheet open={묶음 != null} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold text-left">{묶음?.이름}</SheetTitle>
          <SheetDescription className="text-left">
            {Number(월.slice(5, 7))}월 누적 시공 {천원표기(묶음?.월누적천원 ?? 0)} · {묶음?.건수 ?? 0}건
            {묶음 && 묶음.정산.건수 > 0 && <> · 정산 {천원표기(묶음.정산.월누적천원)} · {묶음.정산.건수}건</>}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-5">
          {묶음 && 묶음.건수 === 0 && 묶음.정산.건수 === 0 && (
            <p className="text-sm text-gray-400">
              {묶음.종류 === '미지정' ? '미지정 이력이 없습니다 ✓' : '이 달에 등록된 실적이 없습니다.'}
            </p>
          )}
          {묶음 && 미지정 && (
            <>
              <BulkAssignPanel
                제목="시공 — 담당 미지정 공사"
                항목들={시공미지정공사목록(묶음.행)}
                담당자목록={담당자목록}
                지정={시공담당지정}
                되돌리기={시공담당되돌리기}
                단위="행"
              />
              <BulkAssignPanel
                제목="정산 (계산서) — 정산 담당 미지정 공사"
                안내="정산 담당은 공사마다 하나라, 지정하면 이 공사의 모든 달 정산(앞으로의 기성 포함)에 적용됩니다."
                항목들={정산미지정공사목록(묶음.정산.행)}
                담당자목록={담당자목록}
                지정={정산담당지정}
                되돌리기={정산담당되돌리기}
                단위={null}
              />
            </>
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
                  {/* 주간공정회의록처럼 한 주의 같은 공사는 한 줄 — 진행한 날짜는 아래에 모아 적는다 */}
                  {공사별로묶기(행들).map((g) => (
                    <li key={g.수주_id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{g.공사명}</p>
                          <p className="text-xs text-gray-400">
                            <span className="font-mono">{g.지중no}</span> · {g.날짜들.map(md).join(', ')}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-800">{천원표기(g.천원)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {묶음 && !미지정 && 묶음.정산.건수 > 0 && (
            <section>
              <div className="flex justify-between items-baseline border-b border-emerald-200 pb-1 mb-2">
                <h3 className="text-sm font-semibold text-emerald-700">정산 (계산서)</h3>
                <span className="text-sm font-bold text-emerald-700 tabular-nums">{천원표기(묶음.정산.월누적천원)}</span>
              </div>
              <ul className="space-y-2">
                {묶음.정산.행.map((r, i) => (
                  <li key={`${r.수주_id}-${r.구분}-${r.날짜}-${i}`} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{r.공사명}</p>
                        <p className="text-xs text-gray-400">
                          <span className="font-mono">{r.지중no}</span> · {r.구분} · {md(r.날짜)}
                          {r.월요일 === 선택월요일 && <span className="ml-1.5 text-blue-600">선택 주</span>}
                        </p>
                      </div>
                      <span className={cn('shrink-0 font-semibold tabular-nums', r.금액천원 < 0 ? 'text-red-600' : 'text-gray-800')}>
                        {천원표기(r.금액천원)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
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
