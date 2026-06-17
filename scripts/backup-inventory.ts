/**
 * Print workbook-level backup inventory without row-level values.
 *
 * Usage:
 *   npm run backup:inventory
 *   npx ts-node --project scripts/tsconfig.json scripts/backup-inventory.ts --json
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import XLSX from 'xlsx'

type SheetInventory = {
  sheetName: string
  rows: number
  columns: number
  headers: string[]
}

type WorkbookInventory = {
  fileName: string
  sizeBytes: number
  modifiedAt: string
  sha256: string
  sheets: SheetInventory[]
  classification: 'private-source'
  publicSafe: false
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function sheetInventory(ws: XLSX.WorkSheet, sheetName: string): SheetInventory {
  const ref = ws['!ref'] ?? 'A1:A1'
  const range = XLSX.utils.decode_range(ref)
  const rows = Math.max(0, range.e.r - range.s.r)
  const columns = range.e.c - range.s.c + 1
  const headers: string[] = []

  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]
    headers.push(cell?.v == null ? '' : String(cell.v))
  }

  return { sheetName, rows, columns, headers }
}

function workbookInventory(filePath: string): WorkbookInventory {
  const stat = fs.statSync(filePath)
  const wb = XLSX.readFile(filePath, { cellDates: false })

  return {
    fileName: path.basename(filePath),
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    sha256: sha256(filePath),
    sheets: wb.SheetNames.map((sheetName) => sheetInventory(wb.Sheets[sheetName], sheetName)),
    classification: 'private-source',
    publicSafe: false,
  }
}

function main() {
  const root = path.resolve(__dirname, '..')
  const workbooks = fs
    .readdirSync(root)
    .filter((name) => name.toLowerCase().endsWith('.xlsx'))
    .sort((a, b) => a.localeCompare(b, 'ko-KR'))
    .map((name) => workbookInventory(path.join(root, name)))

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), workbooks }, null, 2))
    return
  }

  console.log('Backup inventory: workbook metadata only; row values are not printed.')
  console.log('')

  for (const workbook of workbooks) {
    console.log(`${workbook.fileName}`)
    console.log(`  classification: ${workbook.classification}`)
    console.log(`  publicSafe: ${workbook.publicSafe}`)
    console.log(`  sizeBytes: ${workbook.sizeBytes}`)
    console.log(`  modifiedAt: ${workbook.modifiedAt}`)
    console.log(`  sha256: ${workbook.sha256}`)

    for (const sheet of workbook.sheets) {
      console.log(`  sheet: ${sheet.sheetName} rows=${sheet.rows} columns=${sheet.columns}`)
      console.log(`  headers: ${sheet.headers.join(' | ')}`)
    }

    console.log('')
  }
}

main()
