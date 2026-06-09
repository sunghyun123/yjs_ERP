/**
 * 수주대장조회.xlsx → Supabase 수주/기성 테이블 마이그레이션
 *
 * 실행 전 준비:
 *   1. .env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 (RLS 우회 필요)
 *      Supabase 대시보드 → Settings → API → service_role 키 복사
 *   2. Supabase 거래처 테이블에 데이터가 입력되어 있어야 함 (거래처명으로 id 조회)
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/migrate-수주.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// ── 설정 ──────────────────────────────────────────────────────────────────────
const EXCEL_PATH  = path.resolve(__dirname, '..', '수주대장조회.xlsx')
const FAILED_PATH = path.resolve(__dirname, 'failed_rows.json')
const BATCH_SIZE  = 50

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 키가 .env.local 에 없습니다.')
  process.exit(1)
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY 없음 → ANON_KEY 사용')
  console.warn('    RLS 정책에 따라 INSERT가 실패할 수 있습니다.')
  console.warn('    .env.local 에 SUPABASE_SERVICE_ROLE_KEY=<서비스롤키> 추가를 권장합니다.\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY) as any

// ── 엑셀 컬럼 인덱스 (헤더 1행 기준, 0-indexed) ───────────────────────────────
const COL = {
  지중no:          0,
  공사번호:        1,
  공사명:          2,
  작업구분:        3,
  공사담당:        4,
  감독자:          5,
  착공일:          6,
  시공상태:        7,
  준공여부:        8,   // '완료' | '미완료' | ''
  정산상태:        9,
  포장여부:        10,  // '1' | '0'
  수주금액_공급가: 11,
  누적기성_공급가: 12,  // M열: 개별 차수 없이 합계만 존재
  참고사항:        13,
  발주자:          14,
  원청사:          15,
  공사구분:        16,
  공사종류:        17,
  공사현장:        18,
  보험료율:        19,  // 보험료율% → /100 소수 저장
  하도전용율:      20,  // 하도적용율% → /100 소수 저장
  달성율:          21,  // 공정율%
  준공액_공급가:   33,
  준공일:          38,
  관리자:          40,  // 감리자
  관리자_연락처:   42,  // 감리자h.p
  자재청구여부:    47,  // '1' | '0'
} as const

// ── 변환 유틸 ─────────────────────────────────────────────────────────────────
function excelDateToISO(serial: unknown): string | null {
  if (!serial || typeof serial !== 'number') return null
  try {
    // XLSX.SSF.parse_date_code: Excel 직렬 날짜 → { y, m, d }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (XLSX as any).SSF.parse_date_code(serial)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  } catch {
    return null
  }
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

/** '완료' → true, 나머지 → false */
function to준공여부Bool(v: unknown): boolean {
  return v === '완료'
}

/** '1' / 1 → true, 나머지 → false */
function toBool(v: unknown): boolean {
  return v === '1' || v === 1 || v === true
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// ── 타입 ──────────────────────────────────────────────────────────────────────
type 수주Row = {
  지중no: string
  공사번호: string | null
  공사명: string
  작업구분: string | null
  공사담당: string | null
  감독자: string | null
  착공일: string | null
  시공상태: string | null
  준공여부: boolean
  정산상태: string | null
  포장여부: boolean
  수주금액_공급가: number | null
  참고사항: string | null
  발주자_id: number | null
  원청사_id: number | null
  공사구분: string | null
  공사종류: string | null
  공사현장: string | null
  달성율: number | null
  보험료율: number | null
  하도전용율: number | null
  준공액_공급가: number | null
  준공일: string | null
  관리자: string | null
  관리자_연락처: string | null
  자재청구여부: boolean
}

type 기성Draft = {
  지중no: string
  차수: number
  기성액_공급가: number
  기성일: string | null
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. 엑셀 읽기
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ 파일 없음: ${EXCEL_PATH}`)
    process.exit(1)
  }
  console.log(`📂 엑셀 읽는 중: ${EXCEL_PATH}`)
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
  const dataRows = raw
    .slice(1)
    .filter((r): r is unknown[] => Array.isArray(r) && Boolean(r[0]))
  console.log(`📊 데이터 행: ${dataRows.length}건\n`)

  // 2. 거래처 preload (거래처명 → id 맵)
  const { data: 거래처목록, error: 거래처err } = await supabase
    .from('거래처')
    .select('id, 거래처명')
  if (거래처err) {
    console.error('❌ 거래처 로드 실패:', 거래처err.message)
    process.exit(1)
  }
  const 거래처맵 = new Map<string, number>()
  ;(거래처목록 as { id: number; 거래처명: string }[])
    .forEach(c => 거래처맵.set(c.거래처명.trim(), c.id))
  console.log(`🏢 거래처 ${거래처맵.size}개 로드 완료`)

  // 3. 행 변환
  const 수주배열: 수주Row[] = []
  const 기성배열: 기성Draft[] = []
  const 거래처미매핑 = new Set<string>()
  const failedRows: { 지중no: string; reason: string }[] = []

  for (const r of dataRows) {
    const row = r as unknown[]
    const 지중no = toStr(row[COL.지중no])
    if (!지중no) continue

    const 발주자명 = toStr(row[COL.발주자])
    const 원청사명 = toStr(row[COL.원청사])
    if (발주자명 && !거래처맵.has(발주자명)) 거래처미매핑.add(`발주자: ${발주자명}`)
    if (원청사명 && !거래처맵.has(원청사명)) 거래처미매핑.add(`원청사: ${원청사명}`)

    수주배열.push({
      지중no,
      공사번호:        toStr(row[COL.공사번호]),
      공사명:          toStr(row[COL.공사명]) ?? '',
      작업구분:        toStr(row[COL.작업구분]),
      공사담당:        toStr(row[COL.공사담당]),
      감독자:          toStr(row[COL.감독자]),
      착공일:          excelDateToISO(row[COL.착공일]),
      시공상태:        toStr(row[COL.시공상태]),
      준공여부:        to준공여부Bool(row[COL.준공여부]),
      정산상태:        toStr(row[COL.정산상태]),
      포장여부:        toBool(row[COL.포장여부]),
      수주금액_공급가: toNum(row[COL.수주금액_공급가]),
      참고사항:        toStr(row[COL.참고사항]),
      발주자_id:       발주자명 ? (거래처맵.get(발주자명) ?? null) : null,
      원청사_id:       원청사명 ? (거래처맵.get(원청사명) ?? null) : null,
      공사구분:        toStr(row[COL.공사구분]),
      공사종류:        toStr(row[COL.공사종류]),
      공사현장:        toStr(row[COL.공사현장]),
      달성율:          toNum(row[COL.달성율]),
      보험료율:        toNum(row[COL.보험료율]) != null ? toNum(row[COL.보험료율])! / 100 : null,
      하도전용율:      toNum(row[COL.하도전용율]) != null ? toNum(row[COL.하도전용율])! / 100 : null,
      준공액_공급가:   toNum(row[COL.준공액_공급가]),
      준공일:          excelDateToISO(row[COL.준공일]),
      관리자:          toStr(row[COL.관리자]),
      관리자_연락처:   toStr(row[COL.관리자_연락처]),
      자재청구여부:    toBool(row[COL.자재청구여부]),
    })

    // 누적기성(공급가) — 엑셀에 개별 차수 없이 합계만 존재, 차수=1로 단일 저장
    const 누적기성 = toNum(row[COL.누적기성_공급가])
    if (누적기성 && 누적기성 > 0) {
      기성배열.push({ 지중no, 차수: 1, 기성액_공급가: 누적기성, 기성일: null })
    }
  }

  if (거래처미매핑.size > 0) {
    console.warn('\n⚠️  DB에 없는 거래처명 (해당 컬럼 NULL로 저장):', [...거래처미매핑].join(', '))
  }

  // 4. 수주 배치 UPSERT
  console.log(`\n📥 수주 UPSERT 시작... (${수주배열.length}건, 배치 ${BATCH_SIZE}개 단위)`)
  const 지중no_id맵 = new Map<string, number>()
  let 수주성공 = 0

  for (const [bi, batch] of chunk(수주배열, BATCH_SIZE).entries()) {
    const { data, error } = await supabase
      .from('수주')
      .upsert(batch, { onConflict: '지중no' })
      .select('id, 지중no')

    if (error) {
      console.error(`\n  배치 ${bi + 1} 실패:`, error.message)
      ;(batch as 수주Row[]).forEach(r =>
        failedRows.push({ 지중no: r.지중no, reason: error.message }),
      )
    } else {
      ;(data as { id: number; 지중no: string }[]).forEach(r =>
        지중no_id맵.set(r.지중no, r.id),
      )
      수주성공 += (data as unknown[]).length
    }
    process.stdout.write(
      `  배치 ${bi + 1}/${Math.ceil(수주배열.length / BATCH_SIZE)} 완료 (수주 ${수주성공}건)\r`,
    )
  }
  console.log()

  // 5. 기성 배치 UPSERT
  let 기성성공 = 0
  if (기성배열.length > 0) {
    console.log(`\n📥 기성 UPSERT 시작... (${기성배열.length}건)`)
    const 기성행들 = 기성배열
      .filter(k => 지중no_id맵.has(k.지중no))
      .map(k => ({
        수주_id:        지중no_id맵.get(k.지중no)!,
        차수:           k.차수,
        기성액_공급가:  k.기성액_공급가,
        기성일:         k.기성일,
      }))

    for (const batch of chunk(기성행들, BATCH_SIZE)) {
      const { error } = await supabase
        .from('기성')
        .upsert(batch, { onConflict: '수주_id,차수' })
      if (!error) 기성성공 += batch.length
    }
  }

  // 6. 결과 출력
  const 수주실패 = failedRows.length
  console.log('\n' + '━'.repeat(46))
  console.log(`✅ 수주 성공:   ${수주성공}건`)
  console.log(`❌ 수주 실패:   ${수주실패}건`)
  console.log(
    `📋 기성 성공:   ${기성성공}건` +
    (기성배열.length === 0 ? '  ← 엑셀에 기성 데이터 없음 (정상)' : ''),
  )
  console.log('━'.repeat(46))

  if (failedRows.length > 0) {
    fs.writeFileSync(FAILED_PATH, JSON.stringify(failedRows, null, 2), 'utf-8')
    console.log(`⚠️  실패 행 저장: ${FAILED_PATH}`)
  } else {
    console.log('🎉 모든 행 처리 완료!')
  }
}

main().catch(err => {
  console.error('❌ 치명적 오류:', err)
  process.exit(1)
})
