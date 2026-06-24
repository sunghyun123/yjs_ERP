import { createClient } from '@/lib/supabase/server'
import { prepareEntry } from './_lib/format'
import type { AuditLogRow, LookupMaps, PreparedEntry } from './_lib/types'
import { UpdatesClient } from './_components/UpdatesClient'

export const dynamic = 'force-dynamic'

// 기본 기간 = 최근 7일
function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - 7)
  const from = fromDate.toISOString().slice(0, 10)
  return { from, to }
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const def = defaultRange()
  const from = sp.from ?? def.from
  const to = sp.to ?? def.to

  const supabase = await createClient()

  // 기간 조회: to 는 그날 끝까지 포함하려고 그날 23:59:59.999 까지(inclusive)
  const toInclusive = `${to}T23:59:59.999Z`
  const fromInclusive = `${from}T00:00:00.000Z`

  const [{ data: logs }, { data: 거래처들 }, { data: 공무들 }, { data: 수주들 }] =
    await Promise.all([
      supabase
        .from('audit_log')
        .select('*')
        .gte('changed_at', fromInclusive)
        .lte('changed_at', toInclusive)
        .order('changed_at', { ascending: false })
        .limit(500),
      supabase.from('거래처').select('id, 거래처명'),
      supabase.from('공무담당자').select('id, 이름'),
      supabase.from('수주').select('id, 공사명'),
    ])

  // Supabase 타입 클라이언트는 Promise.all 묶음 select에서 행 타입이 never로
  // 좁혀지는 알려진 이슈가 있어, 코드베이스 관례대로 명시 캐스트한다.
  const lookups: LookupMaps = {
    거래처: new Map(
      ((거래처들 ?? []) as { id: number; 거래처명: string }[]).map((r) => [r.id, r.거래처명]),
    ),
    공무담당자: new Map(
      ((공무들 ?? []) as { id: number; 이름: string }[]).map((r) => [r.id, r.이름]),
    ),
    수주: new Map(
      ((수주들 ?? []) as { id: number; 공사명: string }[]).map((r) => [r.id, r.공사명]),
    ),
  }

  const entries: PreparedEntry[] = (logs ?? []).map((row) =>
    prepareEntry(row as AuditLogRow, lookups),
  )

  return <UpdatesClient entries={entries} from={from} to={to} />
}
