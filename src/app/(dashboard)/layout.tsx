import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { extractKakaoId, getWhitelistEntry } from '@/lib/whitelist'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { MobileTabBar } from '@/components/sidebar/MobileTabBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 매 요청마다 화이트리스트 재확인 (퇴사자/명단 이탈자 즉시 차단)
  const kakaoId = extractKakaoId(user)
  const entry = kakaoId ? await getWhitelistEntry(supabase, kakaoId) : null
  if (!entry) {
    // 서버 컴포넌트에선 쿠키를 못 지우므로 로그아웃 라우트를 경유 (무한루프 방지)
    redirect('/auth/signout?reason=not_allowed')
  }

  const displayName = entry.user_name

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f1f4fb' }}>
      <Sidebar userName={displayName} />
      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        {children}
      </main>
      <MobileTabBar />
    </div>
  )
}
