// src/app/api/dashboard-sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { dashboard_공사Insert } from '@/types/database'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.DASHBOARD_API_KEY}`) {
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
  let inserted = 0
  let skipped = 0

  for (const item of constructions) {
    const c = item as { 지중no?: string; 공사명?: string; 진행날짜?: string }
    if (!c.지중no || !c.공사명 || !c.진행날짜) continue

    const row: dashboard_공사Insert = {
      지중no: c.지중no,
      공사명: c.공사명,
      진행날짜: c.진행날짜,
    }
    // supabase-js 2.107의 타입 파서가 한국어 컬럼명을 지원하지 않아 unknown 경유
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as unknown as any).from('dashboard_공사').insert(row)

    if (error?.code === '23505') {
      skipped++
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      inserted++
    }
  }

  return NextResponse.json({ inserted, skipped })
}
