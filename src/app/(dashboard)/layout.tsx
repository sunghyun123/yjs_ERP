import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { 사용자Row } from '@/types/database'
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

  const { data: rawProfile } = await supabase
    .from('사용자')
    .select()
    .eq('id', user.id)
    .single()

  const profile = rawProfile as Pick<사용자Row, '이름' | '이메일'> | null
  const displayName = profile?.이름 || profile?.이메일 || user.email || '사용자'

  return (
    <div className="flex h-full" style={{ backgroundColor: '#f1f4fb' }}>
      <Sidebar userName={displayName} />
      <main className="flex-1 min-w-0 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
      <MobileTabBar />
    </div>
  )
}
