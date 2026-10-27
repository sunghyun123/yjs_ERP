// src/app/api/mcp/constructions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { partsKST } from '@/lib/kst'
import { build공사목록응답, mcp인증, parse준공연도, type 공사목록행 } from '../_lib/응답'

// Claude Desktop 확장(yj-erp.mcpb)의 get_constructions용 읽기 전용 프로듀서.
export async function GET(req: NextRequest) {
  const 거절 = mcp인증(req.headers.get('authorization'), process.env.ERP_MCP_API_KEY)
  if (거절) return NextResponse.json({ error: 거절.error }, { status: 거절.status })

  const 준공연도 = parse준공연도(req.nextUrl.searchParams.get('completed_year'), partsKST())
  if (!준공연도.ok) return NextResponse.json({ error: 준공연도.error }, { status: 400 })

  try {
    const supabase = createAdminClient()
    const rows = await fetchAllRows('수주', (from, to) =>
      supabase
        .from('수주')
        // 판정·표시에 필요한 4칸만. service_role은 전 컬럼을 보므로 키가 새도 나가는 정보를 줄인다
        .select('지중no, 공사명, 준공여부, 준공일')
        .order('지중no')
        .range(from, to),
    )
    // 한국어 컬럼명 select는 postgrest-js 타입 파서가 못 읽어 unknown 경유 캐스트.
    // 아래 모양이 맞다는 보장은 위 select 문자열뿐이다.
    return NextResponse.json(
      build공사목록응답(rows as unknown as 공사목록행[], 준공연도.value),
    )
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
