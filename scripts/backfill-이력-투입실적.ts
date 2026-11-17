/**
 * 입력 자동배분 (일회성, 2026-11-17 결정 — 진행 문서 §6)
 *
 * 미입력 공사이력의 남은 금액을 투입실적의 마지막 투입일(준공일 이전)에 1행씩 넣는다.
 * 규칙은 src/app/(dashboard)/progress/_lib/자동배분.ts 에 있고 vitest로 검증돼 있다. 이 파일은 읽기·쓰기만 한다.
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/backfill-이력-투입실적.ts
 *       ← dry-run: 조회만. backups/private/자동배분-미리보기-<시각>.json 을 만든다
 *   npx ts-node --project scripts/tsconfig.json scripts/backfill-이력-투입실적.ts --apply backups/private/자동배분-미리보기-<시각>.json
 *       ← 실제 쓰기: 다시 계산한 결과가 미리보기와 **한 칸도 다르지 않은 행만** 넣는다
 *
 * 그날 이미 이력 행이 있으면 새 행 대신 그 행에 금액을 더한다(운영 DB 유일 제약 수주_id+작업일자, (가)안).
 *
 * 되돌리기: 적용 후 생기는 backups/private/자동배분-적용-<시각>.json —
 *   '새행'은 id를 delete, '합친행'은 id의 성과금액·작업내용을 '적용전' 값으로 update.
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { build자동배분, 자동배분표시, type 배분행, type 배분수주Row, type 배분이력Row, type 투입일Row } from '../src/app/(dashboard)/progress/_lib/자동배분'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.')
  process.exit(1)
}
// service_role 키는 RLS를 우회한다 — 잘못된 쓰기를 막는 건 DB가 아니라 아래의 '미리보기와 대조' 한 단계뿐이다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = createClient(URL, KEY) as any

const applyIdx = process.argv.indexOf('--apply')
const 미리보기경로 = applyIdx >= 0 ? process.argv[applyIdx + 1] : null
if (applyIdx >= 0 && !미리보기경로) {
  console.error('❌ --apply 뒤에 승인한 미리보기 JSON 경로가 필요합니다.')
  process.exit(1)
}

const won = (n: number) => n.toLocaleString('ko-KR') + '원'
const backupDir = path.resolve(__dirname, '..', 'backups', 'private')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

async function fetchAll<T>(table: string, cols: string, filter: (q: any) => any = (q) => q): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(sb.from(table).select(cols)).order('id').range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break // PostgREST 1000행 캡에 조용히 잘리면 누계가 모자라 이중 배분된다
  }
  return out
}

/**
 * 미리보기와 비교하는 열쇠 — 저장할 모든 칸 + 합칠 기존 행의 적용 전 값.
 * 기존 행을 그사이 누가 고쳤으면 열쇠가 달라져 건너뛴다(옛 금액 위에 더해 덮어쓰는 사고 방지).
 */
const 열쇠 = (r: 배분행) => JSON.stringify([r.수주_id, r.작업일자, r.성과금액, r.저장성과금액, r.담당공무_id, r.작업내용, r.합칠행])

async function main() {
  console.log(`\n${'='.repeat(72)}`)
  console.log(미리보기경로 ? `🔴 APPLY — 미리보기 ${미리보기경로} 와 같은 행만 넣습니다` : '🔵 DRY-RUN — 조회만, 쓰기 없음')
  console.log('='.repeat(72))

  const 수주 = await fetchAll<배분수주Row>('수주', 'id, 지중no, 공사명, 준공여부, 준공일, 준공액_공급가, 보험료율, 하도전용율')
  // 준공정산 행은 2026-07-08 A안으로 0행이지만, 미입력 목록과 같은 조건으로 읽는다
  const 이력 = await fetchAll<배분이력Row>('공사이력', 'id, 수주_id, 작업일자, 성과금액, 담당공무_id, 작업내용', (q) => q.eq('준공정산', false))
  const 투입 = await fetchAll<투입일Row>('투입실적', 'id, 수주_id, 투입일')

  const { 배분, 보류 } = build자동배분(수주, 이력, 투입)
  const 합 = 배분.reduce((s, r) => s + r.성과금액, 0)
  console.log(`\n■ 배분 ${배분.length}건 ${won(합)} / 보류 ${보류.length}건 ${won(보류.reduce((s, r) => s + r.남은금액, 0))}`)
  const 사유별 = new Map<string, number>()
  for (const b of 보류) 사유별.set(b.사유, (사유별.get(b.사유) ?? 0) + 1)
  for (const [k, v] of 사유별) console.log(`   보류 — ${k}: ${v}건`)
  const 합침 = 배분.filter((r) => r.합칠행)
  console.log(`   새 행 ${배분.length - 합침.length}건 / 그날 기존 행에 더함 ${합침.length}건 ${won(합침.reduce((s, r) => s + r.성과금액, 0))}`)
  console.log(`   담당 없음(미지정으로 들어감): ${배분.filter((r) => r.담당공무_id == null).length}건`)

  fs.mkdirSync(backupDir, { recursive: true })

  if (!미리보기경로) {
    const p = path.join(backupDir, `자동배분-미리보기-${stamp}.json`)
    fs.writeFileSync(p, JSON.stringify({ 만든시각: new Date().toISOString(), 표시: 자동배분표시, 배분, 보류 }, null, 2), 'utf8')
    for (const r of 배분) {
      const 어디 = r.합칠행 ? `기존 행 #${r.합칠행.id}에 더함 → ${won(r.저장성과금액)}` : '새 행'
      console.log(`   ✔ [${r.지중no}] ${r.작업일자}  +${won(r.성과금액)}  ${어디}  담당=${r.담당공무_id ?? '미지정'}`)
    }
    console.log(`\n🔵 미리보기 저장: ${p}\n   검토 후 승인하면: --apply ${path.relative(path.resolve(__dirname, '..'), p)}`)
    return
  }

  // ── APPLY: 승인한 미리보기와 지금 다시 계산한 결과가 같은 행만 ──
  const 승인 = JSON.parse(fs.readFileSync(path.resolve(미리보기경로), 'utf8')) as { 배분: 배분행[] }
  const 승인열쇠 = new Set(승인.배분.map(열쇠))
  const 통과 = 배분.filter((r) => 승인열쇠.has(열쇠(r)))
  const 바뀜 = 배분.filter((r) => !승인열쇠.has(열쇠(r)))
  const 사라짐 = 승인.배분.filter((r) => !new Set(배분.map(열쇠)).has(열쇠(r)))
  console.log(`\n■ 대조: 넣을 행 ${통과.length} / 미리보기 이후 값이 바뀌어 건너뜀 ${바뀜.length} / 미리보기에만 있음 ${사라짐.length}`)
  for (const r of 바뀜) console.log(`   ⏭  [${r.지중no}] 지금 계산 ${r.작업일자} ${won(r.성과금액)} — 미리보기와 다름, 다시 dry-run 필요`)
  for (const r of 사라짐) console.log(`   ⏭  [${r.지중no}] 미리보기 ${r.작업일자} ${won(r.성과금액)} — 지금은 대상 아님`)
  if (통과.length === 0) { console.log('\n넣을 행이 없습니다.'); return }

  // upsert 한 번 = PostgREST 요청 하나 = 트랜잭션 하나 → 새 행·합칠 행 전부 반영되거나 하나도 안 된다.
  // 충돌 열쇠는 운영 DB의 유일 제약(수주_id, 작업일자). 합칠 행은 그 행의 칸을 우리가 계산한 값으로 바꾼다.
  // 모든 행이 같은 칸을 보낸다 — 칸이 빠지면 supabase-js가 그 칸을 null로 채워 기존 값을 지운다.
  const { data, error } = await sb
    .from('공사이력')
    .upsert(
      통과.map(({ 수주_id, 작업일자, 저장성과금액, 담당공무_id, 작업내용 }) => ({
        수주_id, 작업일자, 성과금액: 저장성과금액, 담당공무_id, 작업내용, 준공정산: false,
      })),
      { onConflict: '수주_id,작업일자' },
    )
    .select('id, 수주_id, 작업일자')
  if (error) throw error
  if (!data || data.length !== 통과.length) throw new Error(`반영 행 수가 다름: 요청 ${통과.length}, 응답 ${data?.length ?? 0}`)

  const idOf = new Map<string, number>(data.map((d: { id: number; 수주_id: number; 작업일자: string }) => [`${d.수주_id}|${d.작업일자}`, d.id]))
  const p = path.join(backupDir, `자동배분-적용-${stamp}.json`)
  fs.writeFileSync(p, JSON.stringify({
    실행시각: new Date().toISOString(),
    설명: '되돌리기 — 새행: id를 delete / 합친행: id의 성과금액·작업내용을 적용전 값으로 update',
    미리보기: 미리보기경로,
    새행: 통과.filter((r) => !r.합칠행).map((r) => ({ id: idOf.get(`${r.수주_id}|${r.작업일자}`), 지중no: r.지중no, 작업일자: r.작업일자, 성과금액: r.성과금액 })),
    합친행: 통과.filter((r) => r.합칠행).map((r) => ({ id: r.합칠행!.id, 지중no: r.지중no, 작업일자: r.작업일자, 적용전: { 성과금액: r.합칠행!.성과금액, 작업내용: r.합칠행!.작업내용 }, 더한금액: r.성과금액 })),
  }, null, 2), 'utf8')
  console.log(`\n🔴 ${data.length}건 반영 (새 행 ${통과.filter((r) => !r.합칠행).length} · 합침 ${통과.filter((r) => r.합칠행).length}, ${won(통과.reduce((s, r) => s + r.성과금액, 0))}). 되돌리기 근거: ${p}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
