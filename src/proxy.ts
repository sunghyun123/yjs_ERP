import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16: middleware.ts는 deprecated → proxy.ts로 이전 (함수명도 proxy로 변경)
export async function proxy(request: NextRequest) {
  // supabaseResponse는 setAll 안에서 재생성될 수 있으므로 let으로 선언
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. 갱신된 쿠키를 request에 반영 (Route Handler가 최신 세션을 읽을 수 있도록)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 2. 갱신된 request를 기반으로 response 재생성
          supabaseResponse = NextResponse.next({ request })
          // 3. 브라우저에 Set-Cookie 헤더 전달
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser()가 만료된 Access Token을 자동으로 갱신하고 setAll을 통해 쿠키에 씀
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 파일, 이미지 최적화, favicon은 제외
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
