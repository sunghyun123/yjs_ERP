'use client'

import * as XLSX from 'xlsx'
import type { PivotProjectRow } from './PivotProjectTable'
import type { SalesChartRow } from './SalesChart'
import { captureClientEvent, captureServerBackedEvent } from '@/lib/analytics/client'

type Props = {
  pivotData: PivotProjectRow[]
  chartData: SalesChartRow[]
  year: number
}

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export function ExcelExportButton({ pivotData, chartData, year }: Props) {
  function handleExport() {
    captureClientEvent('excel_export_started', {
      entity_type: 'excel',
      action_type: 'export',
      export_type: 'profit_loss',
    })

    try {
      const wb = XLSX.utils.book_new()

      // 시트 1: 공사별 (연간 합계, 이익률 제거)
      // 준공 2열은 성과금액의 내역 — 성과금액에 이미 포함돼 있다(더하면 이중 계산)
      const sheet1 = XLSX.utils.aoa_to_sheet([
        ['지중No', '공사명', '성과금액(원)', '투입금액(원)', '손익금액(원)', '준공월', '준공반영액(원)'],
        ...pivotData.map(r => [
          r.지중no,
          r.공사명,
          r.성과금액,
          r.투입금액,
          r.손익금액,
          r.준공 ? r.준공.월 + 1 : '',
          r.준공 ? r.준공.금액 : '',
        ]),
      ])
      XLSX.utils.book_append_sheet(wb, sheet1, '공사별')

      // 시트 2: 월별 피벗 (공사 × 월)
      const pivotHeader = [
        '지중No',
        '공사명',
        ...MONTHS.flatMap(m => [`${m}성과`, `${m}투입`, `${m}손익`]),
      ]
      const sheet2 = XLSX.utils.aoa_to_sheet([
        pivotHeader,
        ...pivotData.map(r => [
          r.지중no,
          r.공사명,
          ...r.monthly.flatMap(m => [m.성과, m.투입, m.손익]),
        ]),
      ])
      XLSX.utils.book_append_sheet(wb, sheet2, '월별 피벗')

      // 시트 3: 월별 합계
      const sheet3 = XLSX.utils.aoa_to_sheet([
        ['월', '성과금액(원)', '투입금액(원)', '손익금액(원)'],
        ...chartData.map(r => [r.month, r.성과금액, r.투입금액, r.손익금액]),
      ])
      XLSX.utils.book_append_sheet(wb, sheet3, '월별 합계')

      XLSX.writeFile(wb, `매출손익_${year}.xlsx`)
      void captureServerBackedEvent('excel_exported', {
        entity_type: 'excel',
        action_type: 'export',
        export_type: 'profit_loss',
        result: 'success',
      })
    } catch {
      captureClientEvent('excel_export_failed', {
        entity_type: 'excel',
        action_type: 'export',
        export_type: 'profit_loss',
        result: 'failure',
        error_code: 'excel_write_failed',
      })
    }
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
