/**
 * 준공액 A군 30건 정정 (일회성).
 *
 * 배경: 준공 입력칸이 하나뿐이라 어떤 사람은 총액을, 어떤 사람은 잔여분을 넣었다.
 *       잔여를 넣은 행은 준공액이 축소 저장돼 수주대장·매출손익 숫자가 틀렸다.
 *       입력 UI는 커밋 a09224b에서 두 칸으로 갈랐고, 이 스크립트는 그 전에 쌓인 데이터를 고친다.
 *
 * 대상: 아래 30건만. 2026-07-29 진단에서 `준공액 + 기성누계 == 수주금액`이
 *       원 단위까지 일치한 행들이다(= 저장된 값이 잔여였다는 지문).
 *       B군(기성 과다) 2건과 C군(미확인) 5건은 성격이 달라 손대지 않는다.
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/fix-준공액-A군.ts          ← dry-run(조회만)
 *   npx ts-node --project scripts/tsconfig.json scripts/fix-준공액-A군.ts --apply  ← 실제 쓰기
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.')
  process.exit(1)
}
// service_role 키는 RLS를 우회한다 — 이 스크립트에서 오입력을 막는 건 DB가 아니라 아래의 명시적 대조뿐이다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = createClient(URL, KEY) as any

const APPLY = process.argv.includes('--apply')

/** 정정 대상 — 사람이 눈으로 확인한 목록. 여기 없는 행은 무슨 일이 있어도 건드리지 않는다. */
const 정정목록: { id: number; 지중no: string; 기존: number; 새값: number }[] = [
  { id: 500, 지중no: 'SY25-015', 기존:   7_970_421, 새값: 42_970_421 },
  { id: 150, 지중no: 'JY25-036', 기존:   4_577_848, 새값: 22_857_815 },
  { id: 213, 지중no: 'JY25-099', 기존:   2_255_423, 새값: 17_360_234 },
  { id:  42, 지중no: 'JG25-002', 기존:  11_343_895, 새값: 35_145_116 },
  { id: 212, 지중no: 'JY25-098', 기존:   9_467_487, 새값: 27_522_615 },
  { id:  49, 지중no: 'JG25-009', 기존:   4_676_472, 새값:  9_978_298 },
  { id: 156, 지중no: 'JY25-042', 기존:   1_134_475, 새값:  6_134_475 },
  { id: 160, 지중no: 'JY25-046', 기존:   2_923_729, 새값:  9_265_628 },
  { id: 167, 지중no: '25',       기존:   6_461_490, 새값: 21_590_934 },
  { id:  51, 지중no: 'JG25-011', 기존:  14_860_308, 새값: 43_675_043 },
  { id: 285, 지중no: 'JY25-171', 기존:   3_300_075, 새값: 16_224_994 },
  { id:  56, 지중no: 'JG25-016', 기존:   4_269_306, 새값: 29_357_016 },
  { id:  66, 지중no: 'JG25-026', 기존:   4_948_475, 새값: 16_932_843 },
  { id: 172, 지중no: 'JY25-058', 기존:  12_138_465, 새값: 30_783_957 },
  { id: 173, 지중no: 'JY25-059', 기존:   4_226_028, 새값: 11_503_794 },
  { id: 177, 지중no: 'JY25-063', 기존:     464_162, 새값: 10_458_523 },
  { id: 528, 지중no: 'SY26-005', 기존:   4_177_712, 새값: 42_022_350 },
  { id: 191, 지중no: 'JY25-077', 기존:     253_766, 새값: 10_298_059 },
  { id:  68, 지중no: 'JG25-028', 기존:  12_550_789, 새값: 26_583_436 },
  { id:  72, 지중no: 'JG25-032', 기존:   7_059_423, 새값: 14_759_423 },
  { id:  77, 지중no: 'JG25-037', 기존:   9_728_122, 새값: 19_888_086 },
  { id: 270, 지중no: 'JY25-156', 기존:   3_686_010, 새값:  8_863_602 },
  { id: 278, 지중no: 'JY25-164', 기존:   1_389_037, 새값:  6_403_966 },
  { id: 324, 지중no: 'JY25-210', 기존:   2_732_068, 새값:  7_732_068 },
  { id: 462, 지중no: 'SG25-023', 기존:  -8_335_596, 새값: 17_704_982 }, // 유일하게 기존값이 음수
  { id: 447, 지중no: 'SG25-008', 기존:   9_005_777, 새값: 39_729_209 },
  { id: 449, 지중no: 'SG25-010', 기존:  13_683_149, 새값: 38_831_263 },
  { id: 516, 지중no: 'SY25-031', 기존:   1_777_343, 새값:  8_378_263 },
  { id: 455, 지중no: 'SG25-016', 기존:   6_586_479, 새값: 22_066_970 },
  { id: 458, 지중no: 'SG25-019', 기존:  12_567_861, 새값: 66_712_009 },
]

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

async function fetchAll(table: string, cols: string) {
  const out: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break // PostgREST 1000행 캡에 조용히 잘리면 검증이 거짓말이 된다
  }
  return out
}

async function main() {
  console.log(`\n${'='.repeat(72)}`)
  console.log(APPLY ? '🔴 APPLY 모드 — 실제로 DB를 수정합니다' : '🔵 DRY-RUN — 조회·검증만, 쓰기 없음 (실행하려면 --apply)')
  console.log(`대상 ${정정목록.length}건`)
  console.log('='.repeat(72))

  // ── 1. 현재 상태 읽기 ────────────────────────────────────────────────
  const 수주 = await fetchAll('수주', 'id, 지중no, 공사명, 수주금액_공급가, 준공액_공급가, 준공여부') as {
    id: number; 지중no: string | null; 공사명: string | null
    수주금액_공급가: number | null; 준공액_공급가: number | null; 준공여부: boolean | null
  }[]
  const 기성 = await fetchAll('기성', '수주_id, 기성액_공급가') as { 수주_id: number; 기성액_공급가: number | null }[]
  const 기성누계 = new Map<number, number>()
  for (const g of 기성) 기성누계.set(g.수주_id, (기성누계.get(g.수주_id) ?? 0) + (g.기성액_공급가 ?? 0))
  const byId = new Map(수주.map((r) => [r.id, r]))

  // ── 2. 목록의 각 행을 DB 현재값과 대조 (여기서 걸리면 그 행은 안 고친다) ──
  const 통과: typeof 정정목록 = []
  const 보류: { 지중no: string; id: number; 사유: string }[] = []

  for (const t of 정정목록) {
    const r = byId.get(t.id)
    if (!r) { 보류.push({ ...t, 사유: '수주 행이 없음(삭제됨?)' }); continue }
    if (!r.준공여부) { 보류.push({ ...t, 사유: '준공여부가 false로 바뀜' }); continue }
    if (r.준공액_공급가 !== t.기존) {
      보류.push({ ...t, 사유: `준공액이 이미 다름 (DB ${won(r.준공액_공급가 ?? 0)} ≠ 목록 ${won(t.기존)})` }); continue
    }
    // 지문 재확인: 저장된 값이 정말 '잔여'였다면 기존 + 기성누계 == 수주금액이어야 한다
    const k = 기성누계.get(t.id) ?? 0
    if (t.기존 + k !== r.수주금액_공급가) {
      보류.push({ ...t, 사유: `지문 불일치 — 기존+기성누계(${won(t.기존 + k)}) ≠ 수주금액(${won(r.수주금액_공급가 ?? 0)}). 기성이 바뀐 듯` }); continue
    }
    if (t.새값 !== r.수주금액_공급가) {
      보류.push({ ...t, 사유: `새값이 수주금액과 다름 (${won(t.새값)} ≠ ${won(r.수주금액_공급가 ?? 0)})` }); continue
    }
    통과.push(t)
  }

  console.log(`\n■ 대조 결과: 정정 가능 ${통과.length}건 / 보류 ${보류.length}건`)
  for (const b of 보류) console.log(`   ⏭  [${b.지중no}] id=${b.id} — ${b.사유}`)
  for (const t of 통과) console.log(`   ✔  [${t.지중no}] id=${t.id}  ${won(t.기존)} → ${won(t.새값)}`)

  if (통과.length === 0) { console.log('\n정정할 행이 없습니다.'); return }

  if (!APPLY) {
    console.log(`\n🔵 dry-run 종료. 위 ${통과.length}건을 실제로 고치려면 --apply 를 붙여 다시 실행하세요.`)
    return
  }

  // ── 3. 변경 전 값 백업 (되돌릴 근거) ─────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.resolve(__dirname, '..', 'backups', 'private')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `준공액-정정-${stamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify({
    실행시각: new Date().toISOString(),
    설명: '준공액 A군 정정 — 되돌리려면 각 행의 준공액_공급가를 기존값으로 update',
    대상: 통과.map((t) => ({ ...t, 공사명: byId.get(t.id)?.공사명 ?? null })),
  }, null, 2), 'utf8')
  console.log(`\n💾 변경 전 값 백업: ${backupPath}`)

  // ── 4. 한 행씩 쓰기 ──────────────────────────────────────────────────
  // .eq('준공액_공급가', 기존)을 함께 걸어, 조회와 쓰기 사이에 값이 바뀌었으면 0행이 갱신되게 한다.
  // 30번의 update는 하나의 트랜잭션이 아니다 — 중간에 끊겨도 안전한 이유는 이 작업이 멱등이기 때문:
  // 고쳐진 행은 다음 실행 때 '준공액이 이미 다름'으로 보류돼 두 번 더해지지 않는다.
  let 성공 = 0, 실패 = 0
  for (const t of 통과) {
    const { data, error } = await sb.from('수주')
      .update({ 준공액_공급가: t.새값 })
      .eq('id', t.id)
      .eq('준공액_공급가', t.기존)
      .select('id, 준공액_공급가')
    if (error) { console.log(`   ❌ [${t.지중no}] id=${t.id} — ${error.message}`); 실패++; continue }
    if (!data || data.length === 0) { console.log(`   ❌ [${t.지중no}] id=${t.id} — 0행 갱신(그 사이 값이 바뀜)`); 실패++; continue }
    성공++
  }
  console.log(`\n■ 쓰기 완료: 성공 ${성공}건 / 실패 ${실패}건`)

  // ── 5. 재조회 검증 ───────────────────────────────────────────────────
  const 검증 = await fetchAll('수주', 'id, 지중no, 준공액_공급가, 수주금액_공급가') as {
    id: number; 지중no: string | null; 준공액_공급가: number | null; 수주금액_공급가: number | null }[]
  const 검증맵 = new Map(검증.map((r) => [r.id, r]))
  let 어긋남 = 0
  for (const t of 통과) {
    const r = 검증맵.get(t.id)
    if (r?.준공액_공급가 !== t.새값) { console.log(`   ⚠️ [${t.지중no}] id=${t.id} 검증 실패: ${won(r?.준공액_공급가 ?? 0)}`); 어긋남++ }
  }
  console.log(어긋남 === 0
    ? `\n✅ 검증 통과 — ${통과.length}건 모두 준공액이 수주금액과 일치합니다.`
    : `\n❌ 검증 실패 ${어긋남}건 — 백업(${backupPath})으로 확인하세요.`)

  console.log('\n※ id=462(SG25-023)는 정정 후에도 감사 목록에 남습니다 — 기성누계(26,040,578원)가')
  console.log('   수주금액(17,704,982원)보다 커서 이제 B군(기성 과다)으로 분류됩니다. 실패가 아닙니다.')
}

main().catch((e) => { console.error(e); process.exit(1) })
