import { createClient } from '@/lib/supabase/server'
import type { 수주행, 거래처목록항목 } from './_types'
import { OrdersTable } from './_components/OrdersTable'

export default async function 수주대장Page() {
  const supabase = await createClient()

  const [{ data }, { data: 거래처data }, { data: 공무담당자raw }] = await Promise.all([
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
        기성(id, 차수, 기성일, 기성액_공급가, 작업내용, 담당공무_id)
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
  ])

  const orders = (data ?? []) as 수주행[]
  const 거래처목록 = (거래처data ?? []) as 거래처목록항목[]
  const 공무담당자목록 = (공무담당자raw ?? []) as { id: number; 이름: string }[]

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
          수주대장
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          전체 {orders.length.toLocaleString('ko-KR')}건
        </p>
      </div>
      <OrdersTable data={orders} 거래처목록={거래처목록} 공무담당자목록={공무담당자목록} />
    </div>
  )
}
