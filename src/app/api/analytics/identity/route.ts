import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashUserId } from '@/lib/analytics/server'
import { isAnalyticsEnabled } from '@/lib/analytics/safe-properties'

export async function POST() {
  if (!isAnalyticsEnabled()) {
    return NextResponse.json({ enabled: false })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ enabled: false }, { status: 401 })
  }

  const distinctId = hashUserId(user.id)
  if (!distinctId) {
    return NextResponse.json({ enabled: false }, { status: 500 })
  }

  return NextResponse.json({ enabled: true, distinctId })
}
