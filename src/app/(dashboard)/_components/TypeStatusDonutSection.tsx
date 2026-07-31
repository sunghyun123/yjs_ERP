// 유형별 프로젝트 현황 도넛의 서버 쪽 — 조회·행 변환만 하고 렌더는 TypeStatusDonut(클라)에 넘긴다.
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { partsKST } from '@/lib/kst'
import { 공사행변환, 기본연도 } from '../_lib/type-status'
import type { load성과재료 } from '../_lib/junggong-seonggwa'
import { TypeStatusDonut } from './TypeStatusDonut'

export async function TypeStatusDonutSection({
  성과재료Promise,
}: {
  성과재료Promise: ReturnType<typeof load성과재료>
}) {
  const { 공사이력, 수주 } = await 성과재료Promise
  const 이력건수 = new Map<number, number>()
  for (const row of 공사이력) {
    이력건수.set(row.수주_id, (이력건수.get(row.수주_id) ?? 0) + 1)
  }

  const rows = 공사행변환(
    수주.map((row) => ({
      지중no: row.지중no,
      공사명: row.공사명,
      공사구분: row.공사구분,
      준공여부: row.준공여부,
      이력건수: 이력건수.get(row.id) ?? 0,
      수주금액_공급가: row.수주금액_공급가,
      보험료율: row.보험료율,
      하도전용율: row.하도전용율,
    })),
  )

  // 서버 타임존이 UTC여도 KST 기준 '올해'를 써야 연말·연초에 기본 선택 연도가 밀리지 않는다.
  const 올해 = partsKST().year

  return <TypeStatusDonut rows={rows} 초기연도={기본연도(rows, 올해)} />
}

export function TypeStatusDonutSkeleton() {
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="px-5 pt-2 pb-5">
        <div className="flex h-[420px] items-center justify-center">
          <Skeleton className="size-72 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}
