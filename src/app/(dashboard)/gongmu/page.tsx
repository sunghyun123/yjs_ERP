// src/app/(dashboard)/gongmu/page.tsx
import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { todayKST } from '@/lib/kst'
import { resolve선택, 주목록기간 } from './_lib/주차'
import {
  build담당자별실적, build달력비교, 설명줄, 조회기간, type 담당자, type 원이력행,
} from './_lib/erp-실적'
import { build월정산내역, type 월정산내역Row, type 정산기성Row } from '../_lib/monthly-split'
import type { 준공수주Row } from '../_lib/junggong-seonggwa'
import { GongmuActualsView } from './_components/GongmuActualsView'

export const metadata = { title: '공무 | 영전사 ERP' }

type 조회행 = {
  id: number
  수주_id: number
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
  수주: { 지중no: string; 공사명: string } | null
}

type 페이지결과<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * 실패하면 null — 호출부가 0이 아니라 에러 화면을 그리게 한다. JSX를 try 안에서 만들지 않으려고 분리했다.
 * 정산 재료(기성·수주)가 실패해도 페이지 전체를 에러로 보낸다 — 정산 줄만 조용히 빠지면 "정산 0"과 구별이 안 된다.
 */
async function load(
  기간: { from: string; to: string },
  주기간: { from: string; to: string },
): Promise<{ 담당자목록: 담당자[]; 행들: 원이력행[]; 정산행들: 월정산내역Row[] } | null> {
  try {
    const supabase = await createClient()
    const [담당결과, 이력, 기성전체, 수주목록] = await Promise.all([
      supabase.from('공무담당자').select('id, 이름').order('id'),
      // 1000행에서 조용히 잘리지 않게 페이지 단위로 끝까지 받는다(.order 필수)
      fetchAllRows<조회행>('공사이력', (from, to) =>
        supabase
          .from('공사이력')
          .select('id, 수주_id, 작업일자, 성과금액, 담당공무_id, 수주!수주_id(지중no, 공사명)')
          .eq('준공정산', false)
          .gte('작업일자', 기간.from)
          .lt('작업일자', 기간.to)
          .order('id')
          .range(from, to) as unknown as 페이지결과<조회행>,
      ),
      // 정산(대시보드와 같은 build월정산내역). 기성은 준공 금회지불액 차감 누계 때문에 기간으로 자르지 않는다
      // ⚠️ select 문자열과 정산기성Row·준공수주Row 를 손으로 맞춰야 한다(캐스트라 tsc 가 못 잡음) — 특히 정산담당자_id 가 빠지면 전원 '미지정'
      fetchAllRows<정산기성Row>('기성', (from, to) =>
        supabase
          .from('기성')
          .select('id, 수주_id, 차수, 기성일, 기성액_공급가')
          .order('id')
          .range(from, to) as unknown as 페이지결과<정산기성Row>,
      ),
      fetchAllRows<준공수주Row>('수주', (from, to) =>
        supabase
          .from('수주')
          .select('id, 지중no, 공사명, 공사구분, 준공여부, 준공일, 준공액_공급가, 수주금액_공급가, 보험료율, 하도전용율, 정산담당자_id')
          .order('id')
          .range(from, to) as unknown as 페이지결과<준공수주Row>,
      ),
    ])
    if (담당결과.error) throw new Error(`공무담당자 조회 실패: ${담당결과.error.message}`)
    // RLS에 막히면 에러가 아니라 200 + 빈 배열이 온다. 담당자가 0명일 리는 없으므로 실패로 본다 —
    // 그냥 그리면 합계 0에 "미지정 없음 ✓"이라는 틀린 초록불이 뜬다. (이력 0행은 월초에 정상이라 검사하지 않는다)
    if (!담당결과.data?.length) throw new Error('공무담당자 0명 — 권한(RLS) 또는 데이터 문제')
    const 담당자목록 = 담당결과.data as unknown as 담당자[]
    return {
      담당자목록,
      정산행들: build월정산내역(기성전체, 수주목록, 주기간.from, 주기간.to, new Map(담당자목록.map((d) => [d.id, d.이름]))),
      행들: 이력.map((r) => ({
        id: r.id,
        수주_id: r.수주_id,
        작업일자: r.작업일자,
        성과금액: r.성과금액,
        담당공무_id: r.담당공무_id,
        지중no: r.수주?.지중no ?? '',
        공사명: r.수주?.공사명 ?? '(공사명 없음)',
      })),
    }
  } catch (e) {
    unstable_rethrow(e) // redirect()·동적 렌더 신호 같은 Next 내부 제어 흐름은 삼키지 않는다
    console.error('[gongmu] ERP 실적 조회 실패', e)
    return null
  }
}

export default async function GongmuPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; week?: string }>
}) {
  const sp = await searchParams
  // '오늘'은 KST로 못 박는다. 서버 시계는 UTC라 new Date().getDate()로 읽으면
  // 월요일 KST 00:00~09:00 동안 '금주'가 지난주로 잡힌다.
  const 선택 = resolve선택(todayKST(), sp.month, sp.week)
  const 데이터 = await load(조회기간(선택.월, 선택.주목록), 주목록기간(선택.주목록))

  if (!데이터) {
    // 0으로 그리면 "이번 주 실적 없음"과 화면상 구별이 안 된다 — 못 불러왔다고 말한다
    return (
      <div className="p-4 md:p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">공무</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          ERP 실적을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      </div>
    )
  }

  const { 담당자목록, 행들, 정산행들 } = 데이터
  const 실적 = build담당자별실적(행들, 담당자목록, 선택.주목록, 선택.선택주.월요일, 정산행들)
  const 설명 = 설명줄(build달력비교(행들, 선택.월, 선택.주목록), 선택.월)

  return <GongmuActualsView 선택={선택} 실적={실적} 설명={설명} 담당자목록={담당자목록} />
}
