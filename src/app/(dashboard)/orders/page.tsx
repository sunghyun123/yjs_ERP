import { createClient } from '@/lib/supabase/server'
import type { 수주행 } from './_types'
import { OrdersTable } from './_components/OrdersTable'

export default async function 수주대장Page() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('수주')
    .select(`
      id, 지중no, 공사번호, 공사명, 공사구분, 공사종류, 공사현장,
      작업구분, 시공상태, 준공여부, 착공일, 준공일,
      수주금액_공급가, 준공액_공급가, 달성율, 참고사항,
      보험료율, 하도전용율,
      발주자:거래처!발주자_id(거래처명),
      기성(차수, 기성일, 기성액_공급가)
    `)
    .order('지중no', { ascending: true })

  const orders = (data ?? []) as 수주행[]

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
      <OrdersTable data={orders} />
    </div>
  )
}
