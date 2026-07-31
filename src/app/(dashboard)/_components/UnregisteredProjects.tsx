// src/app/(dashboard)/_components/UnregisteredProjects.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { load성과재료 } from '../_lib/junggong-seonggwa'
import type {
  load미입력공사,
  load투입헤더,
} from '../_lib/dashboard-data'
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

export async function UnregisteredProjects({
  성과재료Promise,
  투입헤더Promise,
  미입력공사Promise,
}: {
  성과재료Promise: ReturnType<typeof load성과재료>
  투입헤더Promise: ReturnType<typeof load투입헤더>
  미입력공사Promise: ReturnType<typeof load미입력공사>
}) {
  const [pending, 성과재료, 투입헤더] = await Promise.all([
    미입력공사Promise,
    성과재료Promise,
    투입헤더Promise,
  ])

  if (pending.length === 0) {
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

  const 수주Map = new Map(성과재료.수주.map((row) => [row.지중no, row.id]))

  const 이력Set = new Set(
    성과재료.공사이력.map(
      (r) => `${r.수주_id}_${r.작업일자}`,
    ),
  )
  const 실적Set = new Set(
    투입헤더.map(
      (r) => `${r.수주_id}_${r.투입일}`,
    ),
  )

  const statuses: ProjectStatus[] = pending
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
