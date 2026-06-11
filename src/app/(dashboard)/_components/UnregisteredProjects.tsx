// src/app/(dashboard)/_components/UnregisteredProjects.tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UnregisteredProjectsClient } from './UnregisteredProjectsClient'

export type ProjectStatus = {
  id: number
  지중no: string
  공사명: string
  진행날짜: string
  수주_id: number | null
  has공사이력: boolean
  has투입실적: boolean
}

export async function UnregisteredProjects() {
  const supabase = await createClient()

  // 미삭제 항목 전체
  const { data: pending } = await supabase
    .from('dashboard_공사')
    .select('id, 지중no, 공사명, 진행날짜')
    .eq('삭제됨', false)
    .order('진행날짜', { ascending: true })

  if (!pending || pending.length === 0) {
    return (
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">ERP 미입력 공사</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <p className="text-sm text-gray-400 text-center py-6">미입력 공사가 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  const 지중nos = [...new Set((pending as { 지중no: string }[]).map((p) => p.지중no))]

  // 수주 매핑
  const { data: 수주들Raw } = await supabase
    .from('수주')
    .select('id, 지중no')
    .in('지중no', 지중nos)

  const 수주들 = (수주들Raw ?? []) as { id: number; 지중no: string }[]
  const 수주Map = new Map(수주들.map((s) => [s.지중no, s.id]))

  const 수주ids = [...수주Map.values()]
  const dates = [...new Set((pending as { 진행날짜: string }[]).map((p) => p.진행날짜))]

  // 공사이력, 투입실적 한꺼번에 조회
  const [이력결과, 실적결과] = await Promise.all([
    수주ids.length > 0
      ? supabase.from('공사이력').select('수주_id, 작업일자').in('수주_id', 수주ids).in('작업일자', dates)
      : Promise.resolve({ data: [] }),
    수주ids.length > 0
      ? supabase.from('투입실적').select('수주_id, 투입일').in('수주_id', 수주ids).in('투입일', dates)
      : Promise.resolve({ data: [] }),
  ])

  const 이력Set = new Set(
    ((이력결과.data ?? []) as { 수주_id: number; 작업일자: string }[]).map(
      (r) => `${r.수주_id}_${r.작업일자}`,
    ),
  )
  const 실적Set = new Set(
    ((실적결과.data ?? []) as { 수주_id: number; 투입일: string }[]).map(
      (r) => `${r.수주_id}_${r.투입일}`,
    ),
  )

  const statuses: ProjectStatus[] = (pending as { id: number; 지중no: string; 공사명: string; 진행날짜: string }[])
    .map((p) => {
      const 수주_id = 수주Map.get(p.지중no) ?? null
      const key = 수주_id ? `${수주_id}_${p.진행날짜}` : null
      return {
        id: p.id,
        지중no: p.지중no,
        공사명: p.공사명,
        진행날짜: p.진행날짜,
        수주_id,
        has공사이력: key ? 이력Set.has(key) : false,
        has투입실적: key ? 실적Set.has(key) : false,
      }
    })
    .filter((p) => !(p.has공사이력 && p.has투입실적)) // 둘 다 있으면 제외

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-sm font-medium text-gray-600">
          ERP 미입력 공사
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({statuses.length}건)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <UnregisteredProjectsClient items={statuses} />
      </CardContent>
    </Card>
  )
}

export function UnregisteredProjectsSkeleton() {
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
