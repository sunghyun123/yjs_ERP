import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  extractKakaoIdFromClaims,
  getWhitelistEntry,
  type WhitelistEntry,
} from '@/lib/whitelist'

export type DashboardAccess =
  | { authenticated: false; entry: null }
  | { authenticated: true; entry: WhitelistEntry | null }

/**
 * 한 서버 렌더 안에서 대시보드·관리자 레이아웃이 같은 인증/권한 조회를 공유한다.
 * React cache는 요청 단위 메모이제이션이므로 사용자 간 결과가 섞이지 않는다.
 */
export const getDashboardAccess = cache(async (): Promise<DashboardAccess> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return { authenticated: false, entry: null }

  const kakaoId = extractKakaoIdFromClaims(data.claims)
  const entry = kakaoId ? await getWhitelistEntry(supabase, kakaoId) : null
  return { authenticated: true, entry }
})
