/**
 * 대시보드(yjs_Dashboard)가 읽는 실적 API. service_role 로 RLS 를 우회하므로 아래 Bearer 비교가 유일한 문지기다.
 *
 * 응답 모양은 두 가지다 (2026-11-10, 설계 §6 PR-2 · 게이트 1 B안)
 *   ?month 없음      → { ...MonthlyKpiData(달력 월), split(금요일 기준 금주 달) | null }  — 지금까지와 같다
 *   ?month=YYYY-MM   → { month, split }  — 그 달의 split 만. 범위 [최소월, 금주 소속월] 밖·형식 오류는 400
 * month 가 있을 때 달력 월 칸(amounts·breakdown)을 같이 보내지 않는 이유: 그 칸은 '이번 달'이라
 * 한 응답에 두 달이 섞이고, 소비자가 잘못 읽으면 에러 없이 다른 달 숫자가 그려진다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMonthlyKpiData,
  getMonthlyPeriod,
  load투입원가재료,
} from '@/app/(dashboard)/_lib/monthly-kpi'
import { load성과재료 } from '@/app/(dashboard)/_lib/junggong-seonggwa'
import { getMonthlySplit } from '@/app/(dashboard)/_lib/monthly-split'
import { 금주소속월기간, 조회월기간 } from '@/app/(dashboard)/gongmu/_lib/주차'
import { formatKST } from '@/lib/kst'

function 실패응답(error: unknown) {
  const message = error instanceof Error ? error.message : 'Failed to load KPI data'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 같은 순간(now)에서 모든 기간을 정한다
  const now = new Date()

  const monthParam = req.nextUrl.searchParams.get('month')
  if (monthParam !== null) {
    // 오늘은 KST 로 못 박는다 — 서버 시계(UTC) 날짜로 정하면 새 달 첫 주 월요일 00~09시에
    // 금주 달이 지난달로 잡혀 이번 달 조회가 400 이 된다. 검사는 DB 를 읽기 전에 끝낸다
    const 조회 = 조회월기간(monthParam, formatKST(now))
    if (!조회.ok) {
      return NextResponse.json({ error: 조회.error }, { status: 400 })
    }
    try {
      const supabase = createAdminClient()
      const { 월, from, to } = 조회.기간
      const split = await getMonthlySplit(
        supabase,
        조회.기간,
        load성과재료(supabase),
        // 야간 표기용 투입실적 — 그 달 금요일 기준 기간으로 읽는다. year 는 split 이 읽지 않는다
        load투입원가재료(supabase, { year: Number(월.slice(0, 4)), monthStart: from, monthEnd: to }),
      )
      // split 실패를 null 로 감싸지 않는다 — 내용이 split 하나뿐이라 null + 200 이면 성공처럼 생긴 빈 응답이 된다
      return NextResponse.json({ month: 월, split })
    } catch (error) {
      return 실패응답(error)
    }
  }

  try {
    const supabase = createAdminClient()
    // 공사이력은 한 번만 읽어 기존 칸과 split 에 나눠 준다
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
    return 실패응답(error)
  }
}
