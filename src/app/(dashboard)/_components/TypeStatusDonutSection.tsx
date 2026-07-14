// 유형별 프로젝트 현황 도넛의 서버 쪽 — 조회·집계만 하고 렌더는 TypeStatusDonut(클라)에 넘긴다.
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { partsKST } from '@/lib/kst'
import { 유형상태집계, 기본연도, type 수주도넛입력 } from '../_lib/type-status'
import { TypeStatusDonut } from './TypeStatusDonut'

export async function TypeStatusDonutSection() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('수주')
    .select('지중no, 공사구분, 시공상태, 준공여부, 수주금액_공급가, 보험료율, 하도전용율')
  if (error) throw error

  // 한글 컬럼명이 supabase의 select 타입 파서를 깨서 단언으로 우회 — 레포 관례(orders/page.tsx와 동일).
  // 정합성 책임: select 목록과 수주도넛입력 필드가 1:1이라는 약속은 사람이 지킨다.
  const rows = (data ?? []) as unknown as 수주도넛입력[]

  // PostgREST는 1000행에서 조용히 자른다 — 잘린 합계를 맞는 것처럼 보여주느니 티 나게 실패.
  if (rows.length >= 1000) {
    throw new Error('수주 조회가 1000행 캡에 도달 — 도넛 집계가 잘릴 수 있어 중단(페이지네이션 필요)')
  }

  // 연도 축까지 포함해 서버에서 한 번만 집계 — 연도 필터는 DB가 못 거른다(지중no 3~4번째 글자라
  // PostgREST에 substring 필터가 없다). 어차피 메모리에서 거를 거라면 조회는 1회로 끝내고
  // 연도 전환은 클라가 파생으로 처리하는 게 서버 왕복이 없다.
  const 집계 = 유형상태집계(rows)
  // 서버 타임존이 UTC여도 KST 기준 '올해'를 써야 연말·연초에 기본 선택 연도가 밀리지 않는다.
  const 올해 = partsKST().year

  return <TypeStatusDonut rows={집계} 초기연도={기본연도(집계, 올해)} />
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
