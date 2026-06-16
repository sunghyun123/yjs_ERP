/**
 * 매출손익.xlsx → Supabase 공사이력 테이블 마이그레이션 (성과금액)
 *
 * 엑셀 구조:
 *   A(0): 지중No  B(1): 공사명  C(2): 구분(성과금액|투입금액|손익금액)
 *   D(3)~O(14): 1월~12월 금액  P(15): 합계
 *
 * 삽입 대상:
 *   구분 === '성과금액' && 해당 월 금액 > 0 인 셀만
 *   → 공사이력 (수주_id, 작업일자=해당월 말일, 성과금액)
 *
 * 투입금액/손익금액은 투입실적 × 공사단가로 앱에서 동적 계산하므로 미삽입
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/migrate-매출손익.ts [year]
 *   year 생략 시 2026 사용
 */

import dotenv from 'dotenv'
import path from 'path'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// ── 설정 ──────────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '..', '매출손익.xlsx')
const BATCH_SIZE = 50

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 키가 .env.local 에 없습니다.')
  process.exit(1)
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY 없음 → ANON_KEY 사용 (RLS로 실패할 수 있음)\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY) as any

// ── 유틸 ──────────────────────────────────────────────────────────────────────
/** 해당 연월의 마지막 날 (ISO 문자열) */
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0)) // month 0-indexed trick: month=1 → Jan last day
  return d.toISOString().slice(0, 10)
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  const year = parseInt(process.argv[2] ?? '2026', 10)
  console.log(`📅 대상 연도: ${year}년`)

  // 1. 엑셀 로드
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const dataRows = rawRows.slice(1).filter(r => r[0] && r[2] === '성과금액')
  console.log(`📂 엑셀 성과금액 행: ${dataRows.length}건 로드`)

  // 2. 수주 테이블에서 지중no → id 맵 생성
  const { data: 수주목록, error: 수주에러 } = await supabase
    .from('수주')
    .select('id, 지중no')
  if (수주에러) {
    console.error('❌ 수주 테이블 조회 실패:', 수주에러.message)
    process.exit(1)
  }
  const 수주Map = new Map<string, number>(
    (수주목록 as { id: number; 지중no: string }[]).map(r => [r.지중no, r.id])
  )
  console.log(`🗂  수주 테이블: ${수주Map.size}건 로드`)

  // 3. 행 변환 (월별 성과금액 → 공사이력 레코드)
  const records: Record<string, unknown>[] = []
  const skipped: string[] = []

  for (const row of dataRows) {
    const 지중no = String(row[0]).trim()
    const 수주id = 수주Map.get(지중no)
    if (!수주id) {
      skipped.push(지중no)
      continue
    }

    for (let m = 1; m <= 12; m++) {
      const 금액 = Number(row[m + 2]) // D열(인덱스3) = 1월, ..., O열(인덱스14) = 12월
      if (!금액 || isNaN(금액) || 금액 === 0) continue

      records.push({
        수주_id:  수주id,
        작업일자: lastDayOfMonth(year, m),
        성과금액: Math.round(금액 * 100) / 100,
      })
    }
  }

  console.log(`✅ 변환: ${records.length}건 삽입 예정`)
  if (skipped.length > 0) {
    console.log(`   수주 테이블에 없는 지중No (${[...new Set(skipped)].length}개): ${[...new Set(skipped)].join(', ')}`)
  }

  if (records.length === 0) {
    console.log('⚠️  삽입할 데이터가 없습니다.')
    return
  }

  // 4. 배치 UPSERT
  let upserted = 0
  const errors: string[] = []

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('공사이력')
      .upsert(batch, { onConflict: '수주_id,작업일자', ignoreDuplicates: false })
      .select('id')

    if (error) {
      errors.push(`배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      console.error(`❌ 배치 ${Math.floor(i / BATCH_SIZE) + 1} 실패:`, error.message)
    } else {
      upserted += (data as unknown[]).length
      process.stdout.write(`\r   진행: ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`)
    }
  }

  console.log(`\n\n🎉 완료!`)
  console.log(`   UPSERT: ${upserted}건`)
  if (errors.length > 0) {
    console.log(`   에러 ${errors.length}건:`)
    errors.forEach(e => console.log('   -', e))
  }
}

main().catch(err => {
  console.error('❌ 예외:', err)
  process.exit(1)
})
