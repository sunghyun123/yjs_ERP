/**
 * 공사현황.xlsx → Supabase 공사이력 테이블 마이그레이션
 *
 * 엑셀 구조:
 *   A(0): 지중No  B(1): 작업일자(serial)  C(2): 달성률(%)
 *   D(3): 공사명  E(4): 성과금액(누적합계)  F(5): 투입금액  G(6): 손익금액
 *
 *   ※ 성과금액/투입금액/손익금액은 전부 최신 시점 누적값이 반복 표시됨
 *     → 사용 안 함. 날짜별 증분 성과금액을 Δ달성률 × 하도적용금액으로 계산
 *
 * 하도적용금액 계산:
 *   수주.수주금액_공급가 × (1 - (보험료율 ?? 0)) × (하도전용율 ?? 1)
 *
 * 삽입 조건:
 *   Δ달성률 > 0 인 날만 삽입 (달성률 감소/정체 행은 스킵)
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/migrate-공사이력.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// ── 설정 ──────────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '..', '공사현황.xlsx')
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
function excelDateToISO(serial: number): string {
  return new Date((serial - 25569) * 86400000).toISOString().slice(0, 10)
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. 엑셀 로드
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const dataRows = rawRows.slice(1).filter(r => r[0] && r[1] != null && r[2] != null)
  console.log(`📂 엑셀 데이터: ${dataRows.length}행 로드`)

  // 2. 수주 테이블에서 지중no → { id, 하도적용금액 } 맵 생성
  const { data: 수주목록, error: 수주에러 } = await supabase
    .from('수주')
    .select('id, 지중no, 수주금액_공급가, 보험료율, 하도전용율')
  if (수주에러) {
    console.error('❌ 수주 테이블 조회 실패:', 수주에러.message)
    process.exit(1)
  }

  type 수주Row = { id: number; 지중no: string; 수주금액_공급가: number | null; 보험료율: number | null; 하도전용율: number | null }
  const 수주Map = new Map<string, { id: number; 하도적용금액: number }>(
    (수주목록 as 수주Row[]).map(r => {
      const 공급가 = r.수주금액_공급가 ?? 0
      const 하도적용금액 = 공급가 * (1 - (r.보험료율 ?? 0)) * (r.하도전용율 ?? 1)
      return [r.지중no, { id: r.id, 하도적용금액 }]
    })
  )
  console.log(`🗂  수주 테이블: ${수주Map.size}건 로드`)

  // 3. 엑셀 행을 지중No별로 그룹화
  type Entry = { 작업일자: string; 달성률: number }
  const groups = new Map<string, Entry[]>()
  for (const row of dataRows) {
    const 지중no = String(row[0]).trim()
    const 작업일자 = excelDateToISO(Number(row[1]))
    const 달성률 = Number(row[2])
    if (isNaN(달성률)) continue
    if (!groups.has(지중no)) groups.set(지중no, [])
    groups.get(지중no)!.push({ 작업일자, 달성률 })
  }

  // 4. 지중No별로 날짜 정렬 후 증분 성과금액 계산
  const records: Record<string, unknown>[] = []
  const skippedNos: string[] = []
  let skippedRows = 0

  for (const [지중no, entries] of groups) {
    const 수주 = 수주Map.get(지중no)
    if (!수주) {
      skippedNos.push(지중no)
      skippedRows += entries.length
      continue
    }

    // 날짜 오름차순 정렬
    entries.sort((a, b) => a.작업일자.localeCompare(b.작업일자))

    let prev달성률 = 0
    for (const { 작업일자, 달성률 } of entries) {
      const delta = 달성률 - prev달성률

      if (delta <= 0) {
        skippedRows++
        // 감소/정체는 스킵 — prev는 유지(단조증가 보장)
        continue
      }

      prev달성률 = 달성률  // 증가했을 때만 갱신

      const 성과금액 = Math.round((delta / 100) * 수주.하도적용금액 * 100) / 100
      records.push({
        수주_id:  수주.id,
        작업일자,
        성과금액,
      })
    }
  }

  console.log(`✅ 변환: ${records.length}건 삽입 예정`)
  console.log(`   스킵 (달성률 정체/감소 또는 수주 미등록): ${skippedRows}건`)
  if (skippedNos.length > 0) {
    console.log(`   수주 테이블에 없는 지중No: ${[...new Set(skippedNos)].join(', ')}`)
  }

  if (records.length === 0) {
    console.log('⚠️  삽입할 데이터가 없습니다.')
    return
  }

  // 5. 배치 UPSERT
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
