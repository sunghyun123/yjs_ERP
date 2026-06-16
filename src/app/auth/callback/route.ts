import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractKakaoId, getWhitelistEntry } from '@/lib/whitelist'

// 카카오 OAuth 리다이렉트 콜백. code 교환 → kakao_id 추출 → 화이트리스트 검증 → 분기.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const kakaoId = extractKakaoId(user)
  if (!kakaoId) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_allowed`)
  }

  const entry = await getWhitelistEntry(supabase, kakaoId)
  if (!entry) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_allowed`)
  }

  return NextResponse.redirect(`${origin}/`)
}
