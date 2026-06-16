/**
 * 카카오 화이트리스트 동기화: kakao_whitelist.json → Supabase whitelist 테이블
 * JSON 기준으로 upsert(추가/갱신) + JSON에 없는 행 삭제(퇴사자).
 *
 * 실행: npm run sync:whitelist
 *   (또는: npx ts-node --project scripts/tsconfig.json scripts/sync-whitelist.ts)
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { reconcileWhitelist, type WhitelistUser } from '../src/lib/whitelist-sync'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(SUPABASE_URL, SERVICE_KEY) as any

interface JsonUser {
  kakao_id: string | number
  user_id?: string
  user_name: string
  role: string
}

async function main() {
  // 1. JSON 읽기
  const jsonPath = path.resolve(__dirname, '..', 'kakao_whitelist.json')
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as { users: JsonUser[] }
  const jsonUsers: WhitelistUser[] = parsed.users.map((u) => ({
    kakao_id: String(u.kakao_id),
    user_name: u.user_name,
    role: u.role,
  }))

  // 2. DB 현재 상태 조회
  const { data: existing, error: selErr } = await supabase
    .from('whitelist')
    .select('kakao_id')
  if (selErr) throw selErr
  const dbIds: string[] = (existing ?? []).map((r: { kakao_id: string }) => r.kakao_id)

  // 3. 계획 계산
  const plan = reconcileWhitelist(jsonUsers, dbIds)

  // 4. upsert
  if (plan.toUpsert.length > 0) {
    const rows = plan.toUpsert.map((u) => ({ ...u, updated_at: new Date().toISOString() }))
    const { error: upErr } = await supabase
      .from('whitelist')
      .upsert(rows, { onConflict: 'kakao_id' })
    if (upErr) throw upErr
  }

  // 5. 삭제
  if (plan.toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('whitelist')
      .delete()
      .in('kakao_id', plan.toDelete)
    if (delErr) throw delErr
  }

  console.log(
    `✅ whitelist 동기화 완료: upsert ${plan.toUpsert.length}건, 삭제 ${plan.toDelete.length}건`
  )
}

main().catch((e) => {
  console.error('❌ 동기화 실패:', e)
  process.exit(1)
})
