// 유형별 프로젝트 현황 도넛의 서버 쪽 — 조회·행 변환만 하고 렌더는 TypeStatusDonut(클라)에 넘긴다.
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { partsKST } from '@/lib/kst'
import { 공사행변환, 기본연도, type 수주도넛입력 } from '../_lib/type-status'
import { TypeStatusDonut } from './TypeStatusDonut'

// 공사이력!수주_id(count)는 DB가 수주별 이력 건수를 세서 붙여준다 — 쿼리 1방이고,
// 이력 테이블 행수가 몇천이어도 1000행 캡은 수주 행에만 걸린다(이력 행을 직접 받지 않으므로).
type 수주도넛조회행 = Omit<수주도넛입력, '이력건수'> & { 공사이력: { count: number }[] }

export async function TypeStatusDonutSection() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('수주')
    .select(
      '지중no, 공사명, 공사구분, 준공여부, 수주금액_공급가, 보험료율, 하도전용율, 공사이력!수주_id(count)',
    )
  if (error) throw error

  // 한글 컬럼명이 supabase의 select 타입 파서를 깨서 단언으로 우회 — 레포 관례(orders/page.tsx와 동일).
  // 정합성 책임: select 목록과 수주도넛조회행 필드가 1:1이라는 약속은 사람이 지킨다.
  const raw = (data ?? []) as unknown as 수주도넛조회행[]

  // PostgREST는 1000행에서 조용히 자른다 — 잘린 합계를 맞는 것처럼 보여주느니 티 나게 실패.
  if (raw.length >= 1000) {
    throw new Error('수주 조회가 1000행 캡에 도달 — 도넛 집계가 잘릴 수 있어 중단(페이지네이션 필요)')
  }

  // 카운트 임베드는 [{ count: n }] 모양으로 온다 — 평평한 이력건수로 풀어서 변환에 넘긴다.
  const rows = 공사행변환(
    raw.map(({ 공사이력, ...r }) => ({ ...r, 이력건수: 공사이력?.[0]?.count ?? 0 })),
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
