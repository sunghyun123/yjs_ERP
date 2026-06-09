import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { 수주Row } from '@/types/database'

type ProjectRow = Pick<수주Row, 'id' | '지중no' | '공사명' | '달성율'>

function AchievementBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#3d5af1'
  const clamped = Math.min(Math.max(rate, 0), 100)

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right" style={{ color }}>
        {rate.toFixed(0)}%
      </span>
    </div>
  )
}

export async function ActiveProjects() {
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('수주')
    .select('id, 지중no, 공사명, 달성율')
    .eq('준공여부', false)
    .order('생성일', { ascending: false })
    .limit(10)

  const projects = (raw ?? []) as ProjectRow[]

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-sm font-medium text-gray-600">
          진행중 공사 현황
          <span className="ml-2 text-xs font-normal text-gray-400">
            (최대 10건)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">진행중 공사가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400 shrink-0 w-24 truncate">
                    {p.지중no}
                  </span>
                  <span className="text-sm text-gray-800 truncate flex-1">
                    {p.공사명}
                  </span>
                </div>
                <AchievementBar rate={p.달성율 ?? 0} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ActiveProjectsSkeleton() {
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
