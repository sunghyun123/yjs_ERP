import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMonthlyKpiData } from '@/app/(dashboard)/_lib/monthly-kpi'

export async function GET(req: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const data = await getMonthlyKpiData(supabase)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load KPI data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
