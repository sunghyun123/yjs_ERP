// src/app/api/mcp/profit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { partsKST } from '@/lib/kst'
import { aggregate공사별손익, load공사별손익재료 } from '@/app/(dashboard)/_lib/공사별손익'
import { build손익응답, mcp인증, parse연도, parse월 } from '../_lib/응답'

// Claude Desktop 확장(yj-erp.mcpb)의 get_profit용 읽기 전용 프로듀서.
// 계산은 매출손익 화면과 같은 _lib/공사별손익을 거친다.
export async function GET(req: NextRequest) {
  const 거절 = mcp인증(req.headers.get('authorization'), process.env.ERP_MCP_API_KEY)
  if (거절) return NextResponse.json({ error: 거절.error }, { status: 거절.status })

  // '이번 달'·'올해'는 서버가 KST로 정한다 (서버 시계는 UTC)
  const 지금 = partsKST()
  const sp = req.nextUrl.searchParams
  const 연도 = parse연도(sp.get('year'), 지금)
  if (!연도.ok) return NextResponse.json({ error: 연도.error }, { status: 400 })
  const 월 = parse월(sp.get('month'), 지금)
  if (!월.ok) return NextResponse.json({ error: 월.error }, { status: 400 })

  try {
    const supabase = createAdminClient()
    const 결과 = aggregate공사별손익(await load공사별손익재료(supabase, 연도.value), 연도.value)
    return NextResponse.json(build손익응답(결과, 연도.value, 월.value))
  } catch (e) {
    // 조회 실패를 빈 결과로 내보내지 않는다 — 그러면 Claude가 "손익 없음"이라고 답한다
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
