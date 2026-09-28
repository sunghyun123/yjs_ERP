import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMonthlyKpiData,
  getMonthlyPeriod,
  load투입원가재료,
} from '@/app/(dashboard)/_lib/monthly-kpi'
import { load성과재료 } from '@/app/(dashboard)/_lib/junggong-seonggwa'
import { getMonthlySplit } from '@/app/(dashboard)/_lib/monthly-split'

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
    // 기존 칸과 split 이 같은 달·같은 재료를 보도록 한 번만 정하고 한 번만 읽어 나눠 준다
    const now = new Date()
    const period = getMonthlyPeriod(now)
    const 성과재료Promise = load성과재료(supabase)
    const 투입재료Promise = load투입원가재료(supabase, period)

    const [data, split] = await Promise.all([
      getMonthlyKpiData(supabase, now, 성과재료Promise, 투입재료Promise),
      // split 만의 실패(기성 전 테이블 조회 등)는 기존 칸까지 끌고 내려가지 않는다 — split: null 로 보내면
      // 새 대시보드는 대체값 경로로 가고, split 을 모르는 옛 대시보드는 아무 영향이 없다.
      // (공유 재료가 실패하면 getMonthlyKpiData 도 실패하므로 그때는 예전처럼 500)
      getMonthlySplit(supabase, period, 성과재료Promise, 투입재료Promise).catch((error: unknown) => {
        console.error('[kpi/monthly-performance] split 계산 실패 — split: null 로 응답', error)
        return null
      }),
    ])
    // split 은 '추가'다 — 기존 칸(amounts·breakdown 등)의 값과 의미는 그대로 두어 옛 대시보드가 깨지지 않게 한다
    return NextResponse.json({ ...data, split })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load KPI data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
