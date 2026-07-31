import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractKakaoId, getWhitelistEntry } from '@/lib/whitelist'
import { syncDashboardApprovedUser } from '@/lib/dashboard-whitelist'

// 카카오 OAuth 리다이렉트 콜백. code 교환 → kakao_id 추출 → 화이트리스트 검증 → 분기.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // 리버스 프록시(nginx) 뒤에서는 request.url이 내부 업스트림 주소(localhost:3001)라
  // origin으로 리다이렉트하면 안 됨. 프록시가 전달한 원래 호스트를 사용한다.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=oauth`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${baseUrl}/login?error=oauth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const kakaoId = extractKakaoId(user)
  if (!kakaoId) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${baseUrl}/login?error=not_allowed`)
  }

  let entry = await getWhitelistEntry(supabase, kakaoId)
  if (!entry) {
    try {
      entry = await syncDashboardApprovedUser(kakaoId)
    } catch (error) {
      console.error('Dashboard whitelist sync failed', error)
    }
  }
  if (!entry) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${baseUrl}/login?error=not_allowed`)
  }

  return NextResponse.redirect(`${baseUrl}/`)
}
