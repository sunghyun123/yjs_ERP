/**
 * 투입실적현황.xlsx → Supabase 투입실적 테이블 마이그레이션
 *
 * 실행 전 준비:
 *   .env.local 에 SUPABASE_SERVICE_ROLE_KEY 필요 (RLS 우회)
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/migrate-투입실적.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// ── 설정 ──────────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '..', '투입실적현황.xlsx')
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

// ── Excel 시리얼 날짜 → ISO 문자열 변환 ────────────────────────────────────────
// Excel은 1899-12-30 기준. UTC days = serial - 25569 (Unix epoch 기준)
function excelDateToISO(serial: number): string {
  const utcMs = (serial - 25569) * 86400000
  return new Date(utcMs).toISOString().slice(0, 10)
}

// ── 숫자 변환 (null/undefined → 0) ────────────────────────────────────────────
function n(v: unknown): number {
  const num = Number(v)
  return isNaN(num) ? 0 : num
}

// ── 엑셀 컬럼 인덱스 (헤더 2행 기준, 데이터는 3행~) ──────────────────────────
const COL = {
  지중no:       0,
  투입일:       1,
  상용직_주:    2,
  상용직_야:    3,
  일용직_주:    4,
  일용직_야:    5,
  모범신호수_주: 6,
  모범신호수_야: 7,
  w6_주:        8,
  w6_야:        9,
  w3_주:        10,
  w3_야:        11,
  덤프15t_주:   12,
  덤프15t_야:   13,
  크레인_주:    14,
  크레인_야:    15,
  물청소차_주:  16,
  물청소차_야:  17,
  mcm_주:       18,
  mcm_야:       19,
  재료비인_주:  20,
  재료비인_야:  21,
  접속_주:      22,
  접속_야:      23,
  외주1:        24,
  외주2:        25,
  // 26: 투입금액, 27: 일반관리비, 28: 합계 → 계산값이므로 제외
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. 엑셀 로드
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // 헤더 2행 제외, 지중No 없는 행 제외
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRows: any[][] = rawRows.slice(2).filter(r => r[COL.지중no])
  console.log(`📂 엑셀 데이터: ${dataRows.length}행 로드`)

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

  // 3. 행 변환
  const records: Record<string, unknown>[] = []
  const skipped: string[] = []

  for (const row of dataRows) {
    const 지중no = String(row[COL.지중no]).trim()
    const 수주id = 수주Map.get(지중no)

    if (!수주id) {
      skipped.push(지중no)
      continue
    }

    const 투입일시리얼 = row[COL.투입일]
    if (!투입일시리얼) {
      skipped.push(`${지중no}(날짜없음)`)
      continue
    }

    records.push({
      수주_id:       수주id,
      투입일:        excelDateToISO(Number(투입일시리얼)),
      상용직_주:     n(row[COL.상용직_주]),
      상용직_야:     n(row[COL.상용직_야]),
      일용직_주:     n(row[COL.일용직_주]),
      일용직_야:     n(row[COL.일용직_야]),
      모범신호수_주: n(row[COL.모범신호수_주]),
      모범신호수_야: n(row[COL.모범신호수_야]),
      w6_주:         n(row[COL.w6_주]),
      w6_야:         n(row[COL.w6_야]),
      w3_주:         n(row[COL.w3_주]),
      w3_야:         n(row[COL.w3_야]),
      덤프15t_주:    n(row[COL.덤프15t_주]),
      덤프15t_야:    n(row[COL.덤프15t_야]),
      크레인_주:     n(row[COL.크레인_주]),
      크레인_야:     n(row[COL.크레인_야]),
      물청소차_주:   n(row[COL.물청소차_주]),
      물청소차_야:   n(row[COL.물청소차_야]),
      mcm_주:        n(row[COL.mcm_주]),
      mcm_야:        n(row[COL.mcm_야]),
      재료비인_주:   n(row[COL.재료비인_주]),
      재료비인_야:   n(row[COL.재료비인_야]),
      접속_주:       n(row[COL.접속_주]),
      접속_야:       n(row[COL.접속_야]),
      외주1:         n(row[COL.외주1]),
      외주2:         n(row[COL.외주2]),
    })
  }

  console.log(`✅ 변환 완료: ${records.length}건 | 스킵: ${skipped.length}건`)
  if (skipped.length > 0) {
    const unique = [...new Set(skipped)]
    console.log(`   스킵된 지중No (수주 테이블에 없음): ${unique.join(', ')}`)
  }

  if (records.length === 0) {
    console.log('⚠️  삽입할 데이터 없음. 종료.')
    return
  }

  // 4. 배치 UPSERT (수주_id + 투입일 UNIQUE 충돌 시 덮어씀)
  let inserted = 0
  let updated = 0
  const errors: string[] = []

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase
      .from('투입실적')
      .upsert(batch, { onConflict: '수주_id,투입일', ignoreDuplicates: false })
      .select('id')

    if (error) {
      errors.push(`배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      console.error(`❌ 배치 ${Math.floor(i / BATCH_SIZE) + 1} 실패:`, error.message)
    } else {
      const count = (data as unknown[]).length
      inserted += count
      process.stdout.write(`\r   진행: ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`)
    }
  }

  console.log(`\n\n🎉 완료!`)
  console.log(`   UPSERT: ${inserted}건`)
  if (errors.length > 0) {
    console.log(`   에러 ${errors.length}건:`)
    errors.forEach(e => console.log('   -', e))
  }
}

main().catch(err => {
  console.error('❌ 예외:', err)
  process.exit(1)
})
