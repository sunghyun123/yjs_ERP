import { redirect } from 'next/navigation'
import { getDashboardAccess } from '@/lib/auth/dashboard-access'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { MobileTabBar } from '@/components/sidebar/MobileTabBar'
import { WorkspaceProvider } from './_components/WorkspaceProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 매 요청마다 화이트리스트 재확인 (퇴사자/명단 이탈자 즉시 차단)
  const access = await getDashboardAccess()
  if (!access.authenticated) {
    redirect('/login')
  }
  if (!access.entry) {
    // 서버 컴포넌트에선 쿠키를 못 지우므로 로그아웃 라우트를 경유 (무한루프 방지)
    redirect('/auth/signout?reason=not_allowed')
  }

  const displayName = access.entry.user_name
  const isAdmin = access.entry.role === 'admin'

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f1f4fb' }}>
      <Sidebar userName={displayName} isAdmin={isAdmin} />
      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </main>
      <MobileTabBar />
    </div>
  )
}
