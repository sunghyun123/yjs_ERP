'use client'

import * as XLSX from 'xlsx'
import type { ProjectRow } from './ProjectTable'
import type { SalesChartRow } from './SalesChart'

type Props = {
  projectData: ProjectRow[]
  chartData: SalesChartRow[]
  year: number
}

export function ExcelExportButton({ projectData, chartData, year }: Props) {
  function handleExport() {
    const wb = XLSX.utils.book_new()

    // 시트 1: 공사별
    const projectSheet = XLSX.utils.aoa_to_sheet([
      ['지중No', '공사명', '성과금액(원)', '투입금액(원)', '손익금액(원)', '이익률(%)'],
      ...projectData.map(r => [
        r.지중no,
        r.공사명,
        r.성과금액,
        r.투입금액,
        r.손익금액,
        parseFloat(r.이익률.toFixed(2)),
      ]),
    ])
    XLSX.utils.book_append_sheet(wb, projectSheet, '공사별')

    // 시트 2: 월별
    const monthlySheet = XLSX.utils.aoa_to_sheet([
      ['월', '성과금액(원)', '투입금액(원)', '손익금액(원)'],
      ...chartData.map(r => [r.month, r.성과금액, r.투입금액, r.손익금액]),
    ])
    XLSX.utils.book_append_sheet(wb, monthlySheet, '월별')

    XLSX.writeFile(wb, `매출손익현황_${year}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors"
    >
      ⬇ 엑셀 내보내기
    </button>
  )
}
