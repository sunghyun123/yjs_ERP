import Link from 'next/link'
import { formatEok, formatKRW, formatPercent } from '@/lib/format'
import type { 미입력목록 as 목록, 미입력행 } from '../_lib/미입력'

function 입력링크(수주_id: number) {
  // 입력 탭(기본 탭)이 이 공사를 골라 연다 — page.tsx의 default수주Id
  return `/progress?수주_id=${수주_id}`
}

function 이력표({ rows, 금액머리 }: { rows: 미입력행[]; 금액머리: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">지중No</th>
            <th className="px-3 py-2 text-left">공사명</th>
            <th className="px-3 py-2 text-left">준공일</th>
            <th className="px-3 py-2 text-right">목표(하도 기준)</th>
            <th className="px-3 py-2 text-right">이력 누계</th>
            <th className="px-3 py-2 text-right">이력 행</th>
            <th className="px-3 py-2 text-right">{금액머리}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.수주_id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2">
                <Link href={입력링크(r.수주_id)} className="text-blue-600 hover:underline">{r.지중no}</Link>
              </td>
              <td className="px-3 py-2">{r.공사명}</td>
              <td className="px-3 py-2">{r.준공일}</td>
              <td className="px-3 py-2 text-right">{formatKRW(r.목표)}</td>
              <td className="px-3 py-2 text-right">
                {formatKRW(r.누계)}
                {r.목표 > 0 && <span className="ml-1 text-gray-400">({formatPercent((r.누계 / r.목표) * 100)})</span>}
              </td>
              <td className="px-3 py-2 text-right">{r.이력수}</td>
              <td className="px-3 py-2 text-right font-medium">{formatKRW(r.금액)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function 미입력목록({ data }: { data: 목록 }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 space-y-1">
        <p>
          남은 입력 금액 <b>{formatEok(data.남은합)}</b> ({data.남은.length}건) · 입력 초과{' '}
          <b className="text-red-600">{formatEok(data.초과합)}</b> ({data.초과.length}건) · 다 입력함 {data.완료수}건
        </p>
        <p className="text-gray-500">
          목표 = 준공액 × (1 − 보험료율) × 하도전용율. 입력 초과는 남은 금액과 상계하지 않습니다.
          {data.제외수 > 0 && ` 준공일·준공액이 비어 빠진 준공 공사 ${data.제외수}건.`}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">남은 입력 ({data.남은.length}건)</h2>
        {data.남은.length > 0 ? <이력표 rows={data.남은} 금액머리="남은 금액" /> : <p className="text-sm text-gray-500">없음</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">입력 초과 ({data.초과.length}건)</h2>
        <p className="text-sm text-gray-500">이력 누계가 목표보다 큽니다. 준공액이 줄었거나 이력이 잘못 들어간 경우입니다.</p>
        {data.초과.length > 0 ? <이력표 rows={data.초과} 금액머리="초과 금액" /> : <p className="text-sm text-gray-500">없음</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">기성만 있음 — 준공 전 ({data.기성만.length}건)</h2>
        <p className="text-sm text-gray-500">기성은 있는데 공사이력이 한 줄도 없는 공사입니다. 기성 누계는 참고값이고 위 합계에 들어가지 않습니다.</p>
        {data.기성만.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">지중No</th>
                  <th className="px-3 py-2 text-left">공사명</th>
                  <th className="px-3 py-2 text-right">기성 누계(참고)</th>
                </tr>
              </thead>
              <tbody>
                {data.기성만.map(r => (
                  <tr key={r.수주_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={입력링크(r.수주_id)} className="text-blue-600 hover:underline">{r.지중no}</Link>
                    </td>
                    <td className="px-3 py-2">{r.공사명}</td>
                    <td className="px-3 py-2 text-right">{formatKRW(r.기성누계)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">없음</p>
        )}
      </section>
    </div>
  )
}
