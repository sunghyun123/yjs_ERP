// src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx
import type { 금요일월성과 } from '../../_lib/금요일성과'

/**
 * 금요일 기준 월별 성과 — 시공 기록 / 준공 반영 / 성과 세 줄.
 * 상태가 없어 서버 컴포넌트로 둔다. 숫자는 받은 그대로 그리고 여기서 다시 계산하지 않는다.
 */

const 줄: { key: '시공기록천원' | '준공반영천원' | '성과천원'; label: string; hint: string }[] = [
  { key: '시공기록천원', label: '시공 기록', hint: '공무 화면 월 누적과 같은 숫자' },
  { key: '준공반영천원', label: '준공 반영', hint: '준공액 − 시공 누계. 시공 기록에 없던 몫' },
  { key: '성과천원', label: '성과', hint: '시공 기록 + 준공 반영' },
]

function 칸(v: number): string {
  // 0도 숫자로 보인다 — 표시 달의 0은 '기록 없음'이 아니라 '정말 0'이다('—'는 표시 안 하는 달 전용)
  return v.toLocaleString('ko-KR')
}

export function FridayPerformanceTable({ rows }: { rows: 금요일월성과[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500">
            <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">구분</th>
            {rows.map((r) => (
              <th key={r.월} className="py-2 px-2 text-right font-medium">
                {Number(r.월.slice(5, 7))}월
                {r.표시 && (
                  <div className="text-[10px] font-normal text-gray-400">
                    {Number(r.from.slice(5, 7))}/{Number(r.from.slice(8, 10))}~
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {줄.map(({ key, label, hint }) => (
            <tr
              key={key}
              className={key === '성과천원' ? 'border-t border-gray-200 font-semibold' : 'border-b border-gray-50'}
            >
              <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium text-gray-700" title={hint}>
                {label}
              </th>
              {rows.map((r) => (
                <td
                  key={r.월}
                  className="py-2 px-2 text-right"
                  style={{ color: r.표시 ? (r[key] < 0 ? '#dc2626' : '#374151') : '#d1d5db' }}
                >
                  {r.표시 ? 칸(r[key]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-400">
        단위 천원 · 한 주(월~일)는 금요일이 속한 달로 센다 · 2026년 9월 앞 달과 아직 오지 않은 달은 &apos;—&apos;
      </p>
    </div>
  )
}
