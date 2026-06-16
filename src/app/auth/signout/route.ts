import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 세션 쿠키를 확실히 정리하고 로그인으로 보낸다. reason=not_allowed 시 에러 배너 표시.
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const supabase = await createClient()
  await supabase.auth.signOut()

  const reason = searchParams.get('reason')
  const suffix = reason ? `?error=${reason}` : ''
  return NextResponse.redirect(`${origin}/login${suffix}`)
}
