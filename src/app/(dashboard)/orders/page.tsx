import { createClient } from '@/lib/supabase/server'
import type { 수주행, 거래처목록항목 } from './_types'
import { OrdersTable } from './_components/OrdersTable'

export default async function 수주대장Page() {
  const supabase = await createClient()

  const [{ data }, { data: 거래처data }, { data: 공무담당자raw }, { data: 공사현장raw }] = await Promise.all([
    supabase
      .from('수주')
      .select(`
        id, 지중no, 공사번호, 공사명, 공사구분, 공사종류, 공사현장,
        작업구분, 시공상태, 준공여부, 착공일, 준공일,
        수주금액_공급가, 준공액_공급가, 달성율, 참고사항,
        보험료율, 하도전용율,
        발주자_id, 원청사_id,
        공사담당, 감독자, 정산상태, 포장여부, 자재청구여부, 공무담당자_id,
        발주자:거래처!발주자_id(거래처명),
        원청사:거래처!원청사_id(거래처명),
        기성(id, 차수, 기성일, 기성액_공급가, 작업내용, 담당공무_id),
        공사이력!수주_id(count)
      `)
      .order('지중no', { ascending: true }),
    supabase
      .from('거래처')
      .select('id, 거래처명, 보험료제외율, 하도전용율')
      .order('거래처명'),
    supabase
      .from('공무담당자')
      .select('id, 이름')
      .order('이름'),
    supabase
      .from('공사현장')
      .select('현장명')
      .order('id'),  // 생성순: 관리자가 추가한 순서대로(기타 등 맨 뒤 고정)
  ])

  // 카운트 임베드는 [{ count: n }] 모양으로 온다 — 평평한 이력건수로 풀어서 표에 넘긴다.
  // DB가 세서 붙여주므로 쿼리는 여전히 1방이고, 이력 행을 직접 받지 않으니
  // 1000행 캡은 수주 행에만 걸린다.
  type 수주조회행 = Omit<수주행, '이력건수'> & { 공사이력: { count: number }[] }
  const raw = (data ?? []) as unknown as 수주조회행[]

  // PostgREST는 1000행에서 조용히 자른다 — 잘린 대장을 맞는 것처럼 보여주면
  // 합계 푸터 숫자까지 틀려진다. 티 나게 실패시킨다.
  if (raw.length >= 1000) {
    throw new Error('수주 조회가 1000행 캡에 도달 — 대장 합계가 잘릴 수 있어 중단(페이지네이션 필요)')
  }

  const orders: 수주행[] = raw.map(({ 공사이력, ...r }) => ({
    ...r,
    이력건수: 공사이력?.[0]?.count ?? 0,
  }))
  const 거래처목록 = (거래처data ?? []) as unknown as 거래처목록항목[]
  const 공무담당자목록 = (공무담당자raw ?? []) as unknown as { id: number; 이름: string }[]
  const 공사현장목록 = ((공사현장raw ?? []) as unknown as { 현장명: string }[]).map((r) => r.현장명)

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
          수주대장
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          전체 {orders.length.toLocaleString('ko-KR')}건
        </p>
      </div>
      <OrdersTable data={orders} 거래처목록={거래처목록} 공무담당자목록={공무담당자목록} 공사현장목록={공사현장목록} />
    </div>
  )
}
