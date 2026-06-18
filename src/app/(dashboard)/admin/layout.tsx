import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { extractKakaoId, getWhitelistEntry } from '@/lib/whitelist'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const kakaoId = extractKakaoId(user)
  const entry = kakaoId ? await getWhitelistEntry(supabase, kakaoId) : null

  if (entry?.role !== 'admin') {
    redirect('/')
  }

  return children
}
