import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'
import type { WhitelistEntry } from '@/lib/whitelist'

const DEFAULT_ACCESS_CHECK_URL = 'https://yjsboard.com/api/auth/erp-access-check'

interface DashboardAccessResponse {
  allowed?: unknown
  user_name?: unknown
  role?: unknown
}

interface DashboardWhitelistSyncOptions {
  accessCheckUrl?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  adminClient?: SupabaseClient<Database>
  timeoutMs?: number
}

/**
 * 대시보드에서 승인된 신규 카카오 계정을 ERP Supabase 화이트리스트에 추가한다.
 * 기존 ERP 화이트리스트 행은 수정 대상 계정 외에는 건드리지 않는다.
 */
export async function syncDashboardApprovedUser(
  kakaoId: string,
  options: DashboardWhitelistSyncOptions = {}
): Promise<WhitelistEntry | null> {
  const normalizedId = String(kakaoId || '').trim()
  const accessCheckUrl =
    options.accessCheckUrl ??
    process.env.DASHBOARD_ACCESS_CHECK_URL ??
    DEFAULT_ACCESS_CHECK_URL
  const apiKey = options.apiKey ?? process.env.DASHBOARD_API_KEY ?? ''
  const fetchImpl = options.fetchImpl ?? fetch

  if (!normalizedId || !accessCheckUrl || !apiKey) return null

  const response = await fetchImpl(accessCheckUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ kakao_id: normalizedId }),
    cache: 'no-store',
    signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
  })
  if (!response.ok) return null

  const data = (await response.json()) as DashboardAccessResponse
  if (data.allowed !== true) return null

  const entry: WhitelistEntry = {
    user_name: String(data.user_name || '').trim() || `kakao_${normalizedId}`,
    role: String(data.role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'worker',
  }
  const admin = options.adminClient ?? createAdminClient()
  const { error } = await admin.from('whitelist').upsert(
    {
      kakao_id: normalizedId,
      user_name: entry.user_name,
      role: entry.role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'kakao_id' }
  )
  if (error) throw error

  return entry
}
