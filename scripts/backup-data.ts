/**
 * Create a private local backup bundle for source Excel files.
 *
 * The bundle is written under backups/private/, which is ignored by git. It
 * creates one date-stamped workbook with the operational source sheets plus
 * metadata/checksums, but never copies env files.
 *
 * Usage:
 *   npm run backup:data
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

type BackupManifest = {
  generatedAt: string
  backupId: string
  backupPath: string
  sourceRoot: string
  backupWorkbook: {
    fileName: string
    relativePath: string
    sizeBytes: number
    sha256: string
  }
  files: Array<{
    fileName: string
    sizeBytes: number
    sha256: string
    sheetName: string
  }>
  excludedFiles: Array<{
    fileName: string
    reason: string
  }>
  notes: string[]
}

const BACKUP_SOURCES = [
  { fileName: '공사현황.xlsx', sheetName: '공사현황' },
  { fileName: '매출손익.xlsx', sheetName: '매출손익' },
  { fileName: '수주대장조회.xlsx', sheetName: '수주대장조회' },
  { fileName: '투입실적현황.xlsx', sheetName: '투입실적현황' },
] as const

const EXCLUDED_SOURCES = [
  {
    fileName: '거래처 데이터.xlsx',
    reason: 'Mostly static reference data; keep out of daily operational backup.',
  },
] as const

function timestamp(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}-${hh}${min}${ss}`
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
  const backupId = `${timestamp()}-data-backup`
  const backupRoot = path.join(root, 'backups', 'private', backupId)
  const today = backupId.slice(0, 10)
  const backupWorkbookPath = path.join(backupRoot, `${today}.backup.xlsx`)

  for (const source of BACKUP_SOURCES) {
    const sourcePath = path.join(root, source.fileName)
    if (!fs.existsSync(sourcePath)) {
      console.error(`Required source workbook not found: ${source.fileName}`)
      process.exit(1)
    }
  }

  fs.mkdirSync(backupRoot, { recursive: true })

  const inventories: WorkbookInventory[] = []
  const manifestFiles: BackupManifest['files'] = []
  const backupWorkbook = XLSX.utils.book_new()

  for (const source of BACKUP_SOURCES) {
    const sourcePath = path.join(root, source.fileName)
    const stat = fs.statSync(sourcePath)
    manifestFiles.push({
      fileName: source.fileName,
      sizeBytes: stat.size,
      sha256: sha256(sourcePath),
      sheetName: source.sheetName,
    })

    inventories.push(workbookInventory(sourcePath))

    const wb = XLSX.readFile(sourcePath, { cellDates: false })
    const firstSheet = wb.Sheets[wb.SheetNames[0]]
    XLSX.utils.book_append_sheet(backupWorkbook, firstSheet, source.sheetName)
  }

  XLSX.writeFile(backupWorkbook, backupWorkbookPath)

  const generatedAt = new Date().toISOString()
  const backupWorkbookStat = fs.statSync(backupWorkbookPath)
  const manifest: BackupManifest = {
    generatedAt,
    backupId,
    backupPath: backupRoot,
    sourceRoot: root,
    backupWorkbook: {
      fileName: path.basename(backupWorkbookPath),
      relativePath: path.relative(backupRoot, backupWorkbookPath),
      sizeBytes: backupWorkbookStat.size,
      sha256: sha256(backupWorkbookPath),
    },
    files: manifestFiles,
    excludedFiles: [...EXCLUDED_SOURCES],
    notes: [
      'Private local backup. Do not commit this folder.',
      'The backup workbook may contain project, person, site, and financial data.',
      'Client reference workbook is intentionally excluded from the daily backup.',
      'No .env files or service-role keys are included by this script.',
      'Portfolio artifacts must be generated separately with anonymized or synthetic data.',
    ],
  }

  fs.writeFileSync(
    path.join(backupRoot, 'workbook-inventory.json'),
    JSON.stringify({ generatedAt, workbooks: inventories }, null, 2),
    'utf8',
  )
  fs.writeFileSync(path.join(backupRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  fs.writeFileSync(
    path.join(root, 'backups', 'private', 'LATEST_BACKUP.txt'),
    [
      `backupId=${backupId}`,
      `path=${backupRoot}`,
      `workbook=${backupWorkbookPath}`,
      `generatedAt=${generatedAt}`,
      `sheets=${BACKUP_SOURCES.length}`,
      '',
    ].join('\n'),
    'utf8',
  )

  console.log('Private backup created.')
  console.log(`  backupId: ${backupId}`)
  console.log(`  path: ${backupRoot}`)
  console.log(`  workbook: ${backupWorkbookPath}`)
  console.log(`  sheets: ${BACKUP_SOURCES.length}`)
  console.log('  source sheets:')
  for (const file of manifestFiles) {
    console.log(`    - ${file.fileName} -> ${file.sheetName} (${file.sizeBytes} bytes)`)
  }
  console.log('  excluded:')
  for (const file of EXCLUDED_SOURCES) {
    console.log(`    - ${file.fileName}: ${file.reason}`)
  }
}

main()
