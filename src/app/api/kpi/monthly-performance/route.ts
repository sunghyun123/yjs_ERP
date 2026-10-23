import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMonthlyKpiData,
  getMonthlyPeriod,
  load투입원가재료,
} from '@/app/(dashboard)/_lib/monthly-kpi'
import { load성과재료 } from '@/app/(dashboard)/_lib/junggong-seonggwa'
import { getMonthlySplit } from '@/app/(dashboard)/_lib/monthly-split'
import { 금주소속월기간 } from '@/app/(dashboard)/gongmu/_lib/주차'
import { formatKST } from '@/lib/kst'

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
    // 같은 순간(now)에서 두 기간을 정하고, 공사이력은 한 번만 읽어 나눠 준다
    const now = new Date()
    // 기존 칸(amounts·breakdown)은 ERP 홈 KPI와 같은 달력 월 그대로
    const period = getMonthlyPeriod(now)
    // split(대시보드 도넛·담당자별 진척)은 금요일 기준 주차의 달 — 공무 화면·주간업무 보고서와 같은 숫자가 나오게.
    // 오늘은 KST로 못 박는다(서버 시계는 UTC라 월요일 00~09시에 금주가 지난주로 잡힌다)
    const 주기간 = 금주소속월기간(formatKST(now))
    const 성과재료Promise = load성과재료(supabase)
    const 투입재료Promise = load투입원가재료(supabase, period)
    // split 의 야간 표기용 — 달력 월로 읽은 위 재료를 쓰면 9월 주차의 8/31 야간이 빠진다
    const 주투입재료Promise = load투입원가재료(supabase, {
      year: period.year,
      monthStart: 주기간.from,
      monthEnd: 주기간.to,
    })

    const [data, split] = await Promise.all([
      getMonthlyKpiData(supabase, now, 성과재료Promise, 투입재료Promise),
      // split 만의 실패(기성 전 테이블 조회 등)는 기존 칸까지 끌고 내려가지 않는다 — split: null 로 보내면
      // 새 대시보드는 대체값 경로로 가고, split 을 모르는 옛 대시보드는 아무 영향이 없다.
      // (공유 재료가 실패하면 getMonthlyKpiData 도 실패하므로 그때는 예전처럼 500)
      getMonthlySplit(supabase, 주기간, 성과재료Promise, 주투입재료Promise).catch((error: unknown) => {
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
