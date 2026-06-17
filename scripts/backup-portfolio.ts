/**
 * Create a public-safe portfolio sample workbook.
 *
 * This script does not read private Excel rows. It generates synthetic data with
 * the same business shape as the operational backup so screenshots and case
 * studies can be prepared without exposing real customers/projects/amounts.
 *
 * Usage:
 *   npm run backup:portfolio
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import XLSX from 'xlsx'

type SheetSpec = {
  name: string
  rows: Record<string, string | number | boolean>[]
}

function today(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function money(base: number, step: number, index: number): number {
  return base + step * index
}

function monthValue(projectIndex: number, month: number, kind: 'revenue' | 'cost' | 'profit'): number {
  const revenue = month % 3 === 0 ? money(4_000_000, 450_000, projectIndex + month) : 0
  const cost = revenue > 0 ? Math.round(revenue * (0.58 + (projectIndex % 4) * 0.04)) : 0
  if (kind === 'revenue') return revenue
  if (kind === 'cost') return cost
  return revenue - cost
}

function buildSheets(): SheetSpec[] {
  const projects = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1
    return {
      id: `DEMO-2026-${String(n).padStart(3, '0')}`,
      name: `샘플 공사 ${String(n).padStart(2, '0')}`,
      client: `샘플 발주처 ${((i % 4) + 1).toString().padStart(2, '0')}`,
      manager: `담당자 ${((i % 3) + 1).toString()}`,
      progress: Math.min(100, 15 + i * 7),
      orderAmount: money(18_000_000, 2_500_000, i),
    }
  })

  const progressRows = projects.map((project, i) => {
    const revenue = Math.round(project.orderAmount * project.progress / 100)
    const cost = Math.round(revenue * (0.55 + (i % 5) * 0.04))
    return {
      지중No: project.id,
      작업일자: `2026-${String((i % 6) + 1).padStart(2, '0')}-15`,
      '달성률(%)': project.progress,
      공사명: project.name,
      성과금액: revenue,
      투입금액: cost,
      손익금액: revenue - cost,
    }
  })

  const salesRows = projects.flatMap((project, i) => {
    return (['성과금액', '투입금액', '손익금액'] as const).map((kind) => {
      const row: Record<string, string | number> = {
        지중No: project.id,
        공사명: project.name,
        구분: kind,
      }
      let total = 0
      for (let month = 1; month <= 12; month += 1) {
        const metric = kind === '성과금액' ? 'revenue' : kind === '투입금액' ? 'cost' : 'profit'
        const value = monthValue(i, month, metric)
        row[`${month}월`] = value
        total += value
      }
      row.합계 = total
      return row
    })
  })

  const orderRows = projects.map((project, i) => ({
    지중No: project.id,
    공사번호: `ORD-2026-${String(i + 1).padStart(3, '0')}`,
    공사명: project.name,
    작업구분: i % 2 === 0 ? '신설' : '보수',
    공사담당: project.manager,
    감독자: `감독자 ${((i % 2) + 1).toString()}`,
    착공일: `2026-${String((i % 6) + 1).padStart(2, '0')}-01`,
    시공상태: project.progress >= 100 ? '완료' : '진행',
    준공여부: project.progress >= 100,
    정산상태: project.progress >= 100 ? '정산대기' : '미정산',
    발주자: project.client,
    원청사: `샘플 원청 ${((i % 3) + 1).toString()}`,
    공사현장: `샘플 현장 ${String(i + 1).padStart(2, '0')}`,
    '수주금액(공급가)': project.orderAmount,
    '누적기성(공급가)': Math.round(project.orderAmount * project.progress / 100),
  }))

  const inputRows = projects.map((project, i) => ({
    지중No: project.id,
    투입일: `2026-${String((i % 6) + 1).padStart(2, '0')}-20`,
    상용직: (i % 3) + 1,
    일용직: (i % 4) + 2,
    모범신호수: i % 2,
    '6W': i % 3,
    '3W': (i + 1) % 2,
    덤프15T: i % 2,
    크레인: i % 4 === 0 ? 1 : 0,
    재료비: money(250_000, 35_000, i),
    외주1: money(500_000, 40_000, i),
    외주2: i % 3 === 0 ? money(300_000, 20_000, i) : 0,
    투입금액: money(1_500_000, 120_000, i),
    일반관리비: money(150_000, 12_000, i),
    합계: money(1_650_000, 132_000, i),
  }))

  return [
    { name: '공사현황', rows: progressRows },
    { name: '매출손익', rows: salesRows },
    { name: '수주대장조회', rows: orderRows },
    { name: '투입실적현황', rows: inputRows },
  ]
}

function main() {
  const root = path.resolve(__dirname, '..')
  const outputDir = path.join(root, 'backups', 'portfolio', 'generated')
  const fileName = `${today()}.portfolio-sample.xlsx`
  const outputPath = path.join(outputDir, fileName)
  const manifestPath = path.join(outputDir, `${today()}.portfolio-sample.manifest.json`)
  const wb = XLSX.utils.book_new()
  const sheets = buildSheets()

  fs.mkdirSync(outputDir, { recursive: true })

  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  XLSX.writeFile(wb, outputPath)

  const manifest = {
    generatedAt: new Date().toISOString(),
    fileName,
    path: outputPath,
    sha256: sha256(outputPath),
    publicSafe: true,
    sourcePolicy: 'Synthetic only. This script does not read private workbook rows.',
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows.length,
      columns: Object.keys(sheet.rows[0] ?? {}).length,
    })),
    reviewChecklist: [
      'No real customer names.',
      'No real project names or business identifiers.',
      'No real personal names, phone numbers, emails, or addresses.',
      'No exact row-level financial values from source workbooks.',
    ],
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  console.log('Portfolio sample backup created.')
  console.log(`  workbook: ${outputPath}`)
  console.log(`  manifest: ${manifestPath}`)
  console.log('  sheets:')
  for (const sheet of manifest.sheets) {
    console.log(`    - ${sheet.name}: rows=${sheet.rows}, columns=${sheet.columns}`)
  }
}

main()
