// src/app/api/dashboard-sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { dashboard_공사Insert } from '@/types/database'

export async function POST(req: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { constructions } = body as { constructions?: unknown[] }
  if (!Array.isArray(constructions)) {
    return NextResponse.json({ error: '"constructions" must be an array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 유효 행만 추리고, 배치 내 (지중no, 진행날짜) 중복은 미리 제거한다.
  // (DB 유니크 키: dashboard_공사_지중no_진행날짜_key)
  const seen = new Set<string>()
  const rows: dashboard_공사Insert[] = []
  for (const item of constructions) {
    const c = item as { 지중no?: string; 공사명?: string; 진행날짜?: string }
    if (!c.지중no || !c.공사명 || !c.진행날짜) continue
    const key = `${c.지중no}__${c.진행날짜}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ 지중no: c.지중no, 공사명: c.공사명, 진행날짜: c.진행날짜 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 })
  }

  // 행별 insert(N+1) 대신 단일 배치 upsert.
  // ignoreDuplicates: 기존 행은 건너뛰고 신규 행만 삽입·반환하므로
  // .select()의 반환 개수가 곧 inserted 수가 된다.
  // supabase-js 2.107의 타입 파서가 한국어 컬럼명을 지원하지 않아 unknown 경유.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as unknown as any)
    .from('dashboard_공사')
    .upsert(rows, { onConflict: '지중no,진행날짜', ignoreDuplicates: true })
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const inserted = (data as unknown[] | null)?.length ?? 0
  const skipped = rows.length - inserted

  return NextResponse.json({ inserted, skipped })
}
