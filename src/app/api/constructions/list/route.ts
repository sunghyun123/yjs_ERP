// src/app/api/constructions/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { 수주Row } from '@/types/database'

// 대시보드 공사명 자동완성용 읽기 전용 프로듀서.
// kpi/monthly-performance·materials/summary와 같은 계약(같은 호스트·같은 DASHBOARD_API_KEY).
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
    const { data, error } = await supabase
      .from('수주')
      // 자동완성에 실제로 쓰는 4개 컬럼만. service_role은 전 컬럼을 볼 수 있으므로
      // 키가 새더라도 이 경로로 나가는 정보를 최소화한다(금액·발주자 등은 보내지 않음).
      .select('지중no, 공사명, 작업구분, 공사담당')
      .order('지중no', { ascending: false })
      // PostgREST 기본 상한(1000행)에 조용히 잘리지 않게 명시. 현재 약 540행.
      .limit(5000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 한국어 컬럼명이 든 select 문자열은 postgrest-js 타입 파서가 못 읽어 unknown 경유 캐스트
    // (gongmu/[id]/page.tsx와 같은 관례). 아래 모양이 맞다는 보장은 위 select 문자열뿐이다.
    const rows = (data ?? []) as unknown as Pick<
      수주Row,
      '지중no' | '공사명' | '작업구분' | '공사담당'
    >[]

    const items = rows
      .map((r) => ({
        code: (r.지중no ?? '').trim(),
        name: (r.공사명 ?? '').trim(),
        work_type: (r.작업구분 ?? '').trim(),
        manager: (r.공사담당 ?? '').trim(),
      }))
      // 코드나 공사명이 비면 자동완성에서 고를 수 없는 행이므로 제외
      .filter((r) => r.code && r.name)

    return NextResponse.json({
      data: items,
      total: items.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load construction list'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
