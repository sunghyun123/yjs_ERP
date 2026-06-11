// src/app/(dashboard)/gongmu/_lib/excel.ts
import * as XLSX from 'xlsx'
import type { 공무_주간보고Row } from '@/types/database'

type ExportRow = Pick<공무_주간보고Row, '지중no' | '공사명' | '금주작업' | '차주작업' | '금주계획' | '금주실적' | '차주계획' | '구분' | '비고'>

export function exportWeeklyReport(
  이름: string,
  year: number,
  week_no: number,
  weekLabel: string,
  rows: ExportRow[],
) {
  const wb = XLSX.utils.book_new()

  const headers = ['구분', '지중No / 번호', '공사명 / 작업항목', '금주 작업', '차주 작업', '금주계획', '금주실적', '차주계획', '비고']

  const data = rows.map((r, i) => [
    r.구분,
    r.구분 === '공사' ? (r.지중no ?? '') : String(i + 1),
    r.공사명,
    r.금주작업 ?? '',
    r.차주작업 ?? '',
    r.금주계획,
    r.금주실적,
    r.차주계획,
    r.비고 ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([
    [`${이름} 주간업무보고 — ${year}년 ${weekLabel}`],
    [],
    headers,
    ...data,
  ])

  // 컬럼 너비
  ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws, `${year}-W${week_no}`)
  XLSX.writeFile(wb, `${이름}_주간업무보고_${year}W${String(week_no).padStart(2, '0')}.xlsx`)
}
