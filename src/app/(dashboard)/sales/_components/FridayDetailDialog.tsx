// src/app/(dashboard)/sales/_components/FridayDetailDialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { addDays } from '../../gongmu/_lib/주차'
// ⚠️ type 으로만 — 값 import 하면 supabase 조회 코드(junggong-seonggwa)가 브라우저 번들로 끌려온다
import type { 금요일월성과 } from '../../_lib/금요일성과'

export type 표시월 = Extract<금요일월성과, { 표시: true }>
export type 줄키 = '시공' | '반영' | '성과'

const 제목: Record<줄키, string> = { 시공: '시공 기록', 반영: '준공 반영', 성과: '성과' }
const 설명: Record<줄키, string> = {
  시공: '공사이력 성과금액 · 대시보드 시공 실적 팝업과 같은 목록',
  반영: '이 기간에 준공한 공사 · 준공액 − 시공 누계(전 기간)',
  성과: '시공 기록 + 준공 반영 · 두 줄 모두에 나오는 공사는 한 줄로 합침',
}

const 숫자 = (v: number) => v.toLocaleString('ko-KR')
/** 'YYYY-MM-DD' → 'M/D' (문자열만 자른다 — 시계를 읽지 않는다) */
const 짧은날 = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
const 금액색 = (v: number) => (v < 0 ? 'text-red-600' : undefined)

const th = 'px-3 py-2 text-xs font-medium text-gray-500'
const td = 'px-3 py-2 align-top'

export function FridayDetailDialog({
  월,
  줄,
  onClose,
}: {
  월: 표시월 | null
  줄: 줄키 | null
  onClose: () => void
}) {
  // open 을 따로 boolean 으로 두면 TS 가 월·줄을 좁히지 못한다 — 조건을 매번 `월 && 줄` 로 직접 쓴다
  const open = 월 !== null && 줄 !== null
  // 합계 칸은 표 숫자 그대로 — 그 숫자가 곧 목록의 합이다(금요일성과.test.ts 가 지킨다)
  const 합계 = !월 || !줄 ? 0 : 줄 === '시공' ? 월.시공기록천원 : 줄 === '반영' ? 월.준공반영천원 : 월.성과천원
  const 건수 = !월 || !줄
    ? 0
    : 줄 === '시공'
      ? 월.시공내역.length
      : 줄 === '반영'
        ? 월.준공반영내역.length
        : 월.성과내역.length
  const 시공없음수 = 월 && 줄 === '반영' ? 월.준공반영내역.filter((r) => r.시공없음).length : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
        {월 && 줄 && (
          <>
            <DialogHeader className="border-b border-gray-100 px-5 py-4">
              <DialogTitle>
                {Number(월.월.slice(5, 7))}월 {제목[줄]} — 공사별
              </DialogTitle>
              <DialogDescription>
                {짧은날(월.from)} ~ {짧은날(addDays(월.to, -1))} · {설명[줄]} · 단위 천원
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm tabular-nums">
                {줄 === '시공' && (
                  <>
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className={`${th} w-28 text-left`}>지중No</th>
                        <th className={`${th} text-left`}>공사명</th>
                        <th className={`${th} w-32 text-right`}>실적</th>
                      </tr>
                    </thead>
                    <tbody>
                      {월.시공내역.map((r) => (
                        <tr key={r.수주_id} className="border-t border-gray-100">
                          <td className={`${td} text-gray-600`}>{r.지중no}</td>
                          <td className={td}>
                            {r.공사명}
                            <div className="text-[11px] text-gray-500">{r.날짜.map(짧은날).join(' · ')}</div>
                          </td>
                          <td className={`${td} text-right ${금액색(r.금액천원) ?? ''}`}>{숫자(r.금액천원)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {줄 === '반영' && (
                  <>
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className={`${th} w-28 text-left`}>지중No</th>
                        <th className={`${th} text-left`}>공사명</th>
                        <th className={`${th} w-20 text-left`}>준공일</th>
                        <th className={`${th} w-24 text-right`}>준공액</th>
                        <th className={`${th} w-24 text-right`}>시공 누계</th>
                        <th className={`${th} w-28 text-right`}>준공 반영</th>
                      </tr>
                    </thead>
                    <tbody>
                      {월.준공반영내역.map((r) => (
                        <tr key={r.수주_id} className="border-t border-gray-100">
                          <td className={`${td} text-gray-600`}>{r.지중no}</td>
                          <td className={td}>{r.공사명}</td>
                          <td className={`${td} text-gray-600`}>{짧은날(r.준공일)}</td>
                          <td className={`${td} text-right`}>{숫자(r.준공액천원)}</td>
                          <td
                            className={`${td} text-right ${r.시공없음 ? 'bg-orange-50 font-semibold text-orange-700' : ''}`}
                            title={r.시공없음 ? '시공 입력 없이 준공한 공사' : undefined}
                          >
                            {숫자(r.시공누계천원)}
                          </td>
                          <td className={`${td} text-right font-semibold ${금액색(r.반영천원) ?? ''}`}>
                            {숫자(r.반영천원)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {줄 === '성과' && (
                  <>
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className={`${th} w-28 text-left`}>지중No</th>
                        <th className={`${th} text-left`}>공사명</th>
                        <th className={`${th} w-24 text-right`}>시공 기록</th>
                        <th className={`${th} w-24 text-right`}>준공 반영</th>
                        <th className={`${th} w-28 text-right`}>성과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {월.성과내역.map((r) => (
                        <tr key={r.수주_id} className="border-t border-gray-100">
                          <td className={`${td} text-gray-600`}>{r.지중no}</td>
                          <td className={td}>{r.공사명}</td>
                          {/* 0 은 '이 공사엔 그 몫이 없다' — 진짜 0 과 헷갈리지 않게 '—' */}
                          <td className={`${td} text-right text-gray-600`}>{r.시공천원 ? 숫자(r.시공천원) : '—'}</td>
                          <td className={`${td} text-right ${금액색(r.반영천원) ?? 'text-gray-600'}`}>
                            {r.반영천원 ? 숫자(r.반영천원) : '—'}
                          </td>
                          <td className={`${td} text-right font-semibold ${금액색(r.성과천원) ?? ''}`}>
                            {숫자(r.성과천원)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
              {건수 === 0 && <p className="py-8 text-center text-sm text-gray-400">해당하는 공사가 없습니다.</p>}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-3 tabular-nums">
              <span className="text-gray-600">
                합계 <span className="text-blue-600">({숫자(건수)}건)</span>
                {줄 === '반영' && (
                  <span className="ml-2 text-[11px] text-gray-500">
                    시공 입력 없이 준공 {숫자(시공없음수)}건
                  </span>
                )}
              </span>
              <strong className={`text-base ${금액색(합계) ?? ''}`}>{숫자(합계)} 천원</strong>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
