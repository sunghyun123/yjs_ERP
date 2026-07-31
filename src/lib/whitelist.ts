import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase 인증 사용자에서 카카오 회원번호(kakao_id)를 추출한다.
 * 카카오 identity → identity_data.provider_id → sub → identity.id → user_metadata 순으로 탐색.
 */
export function extractKakaoId(user: User | null): string | null {
  if (!user) return null

  const kakaoIdentity = user.identities?.find((i) => i.provider === 'kakao')
  if (kakaoIdentity) {
    const data = (kakaoIdentity.identity_data ?? {}) as Record<string, unknown>
    const fromData = data.provider_id ?? data.sub
    if (fromData != null) return String(fromData)
    if (kakaoIdentity.id) return String(kakaoIdentity.id)
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const fromMeta = meta.provider_id ?? meta.sub
  return fromMeta != null ? String(fromMeta) : null
}

export interface WhitelistEntry {
  user_name: string
  role: string
}

type AuthClaims = {
  user_metadata?: Record<string, unknown>
}

/**
 * 서명이 검증된 Supabase JWT claims에서 카카오 회원번호를 추출한다.
 * 현재 카카오 로그인 토큰에는 provider_id와 sub가 모두 user_metadata에 포함된다.
 */
export function extractKakaoIdFromClaims(claims: AuthClaims | null): string | null {
  const metadata = claims?.user_metadata
  if (!metadata) return null

  const kakaoId = metadata.provider_id ?? metadata.sub
  return kakaoId != null ? String(kakaoId) : null
}

/**
 * kakao_id가 화이트리스트에 있으면 해당 항목을, 없으면 null을 반환한다.
 */
export async function getWhitelistEntry(
  supabase: SupabaseClient<Database>,
  kakaoId: string
): Promise<WhitelistEntry | null> {
  const { data } = await supabase
    .from('whitelist')
    .select('user_name, role')
    .eq('kakao_id', kakaoId)
    .maybeSingle()

  return (data as WhitelistEntry | null) ?? null
}
