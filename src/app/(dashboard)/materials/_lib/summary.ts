// src/app/(dashboard)/materials/_lib/summary.ts
// 대시보드(외부 FastAPI)용 자재 요약 집계. page.tsx와 같은 조회·파생을 쓰되,
// 원본 행은 내보내지 않고 계약 JSON만 반환한다(집계는 ERP가 끝낸다).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, 자재_드럼Row, 자재_드럼기록Row, 자재_선종Row, 자재_품목Row, 자재_품목기록Row } from '@/types/database'
import { fetchAll } from './fetch-all'
import { derive드럼, derive품목, calc스탯, group칩 } from './derive'

export interface MaterialsSummary {
  status: 'success'
  cable: {
    stats: { highVoltageStock: number; lowVoltageStock: number; remnantDrums: number }
    groups: CableGroup[]
  }
  etc: { groups: EtcGroup[] }
  updatedAt: string
}

interface CableGroup {
  voltage: string
  lines: CableLine[]
}
interface CableLine {
  code: string
  totalRemaining: number
  drumCount: number
  chips: CableChip[]
}
interface CableChip {
  remaining: number
  count: number
  maker: string | null
  remnant: boolean
  shipping: boolean
}
interface EtcGroup {
  category: string
  items: { name: string; count: number; unit: string }[]
}

// 고압 먼저·저압 다음 (스펙 고정 순서). 전압 문자열의 정렬순서에 기대지 않는다.
const VOLTAGE_ORDER = ['고압', '저압'] as const

export async function getMaterialsSummary(
  supabase: SupabaseClient<Database>,
  now = new Date(),
): Promise<MaterialsSummary> {
  // 선종·품목은 정렬 순서가 계약의 라인 순서를 결정하므로 order를 그대로 가져간다.
  const [선종res, 품목res] = await Promise.all([
    supabase.from('자재_선종').select('*').order('정렬'),
    supabase.from('자재_품목').select('*').order('분류').order('정렬'),
  ])
  if (선종res.error) throw new Error(`선종 조회 실패: ${선종res.error.message}`)
  if (품목res.error) throw new Error(`품목 조회 실패: ${품목res.error.message}`)

  // 잔량 파생은 기록 '전체'가 필요 — 조용히 잘리면 재고가 틀리므로 fetchAll로 끝까지 페이징
  const [드럼raw, 드럼기록raw, 품목기록raw] = await Promise.all([
    fetchAll<자재_드럼Row>((f, t) => supabase.from('자재_드럼').select('*').order('id').range(f, t) as never),
    fetchAll<자재_드럼기록Row>((f, t) => supabase.from('자재_드럼기록').select('*').order('id').range(f, t) as never),
    fetchAll<자재_품목기록Row>((f, t) => supabase.from('자재_품목기록').select('*').order('id').range(f, t) as never),
  ])

  const 선종들 = (선종res.data ?? []) as unknown as 자재_선종Row[]
  const 품목들raw = (품목res.data ?? []) as unknown as 자재_품목Row[]
  const 드럼들 = derive드럼(드럼raw, 드럼기록raw)
  const 품목들 = derive품목(품목들raw, 품목기록raw)

  const { 고압재고, 저압재고, 잔재드럼수 } = calc스탯(드럼들, 선종들)

  // 케이블 그룹: 전압별로 선종을 훑고, 각 선종의 드럼만 골라 group칩 호출
  // (드럼칩엔 선종_id가 없어 전체를 한 번에 넘기면 선종 구분이 무너진다).
  const cableGroups: CableGroup[] = VOLTAGE_ORDER.map((voltage) => {
    const lines: CableLine[] = []
    for (const 선종 of 선종들) {
      if (선종.전압 !== voltage) continue
      const chips = group칩(드럼들.filter((d) => d.선종_id === 선종.id))
      if (chips.length === 0) continue // 재고 0(전부 소진) 선종은 제외 — etc의 "수량 0 제외"와 대칭(A안)
      lines.push({
        code: 선종.코드,
        totalRemaining: chips.reduce((s, c) => s + c.잔량 * c.개수, 0),
        drumCount: chips.reduce((s, c) => s + c.개수, 0),
        // 계약에 없는 key·드럼ids는 버리고, group칩이 이미 잡은 정렬 순서는 그대로 유지
        chips: chips.map((c) => ({
          remaining: c.잔량,
          count: c.개수,
          maker: c.제조표기,
          remnant: c.잔재,
          shipping: c.출고중,
        })),
      })
    }
    return { voltage, lines }
  })

  // 기타 자재: 수량 0 품목은 제외. 품목들raw가 (분류, 정렬)로 정렬돼 있으므로
  // 삽입순 Map이 곧 분류순 그룹 + 정렬순 항목이 된다.
  const etcMap = new Map<string, EtcGroup>()
  for (const p of 품목들) {
    if (p.수량 === 0) continue
    const g = etcMap.get(p.분류)
    if (g) g.items.push({ name: p.품명, count: p.수량, unit: p.단위 })
    else etcMap.set(p.분류, { category: p.분류, items: [{ name: p.품명, count: p.수량, unit: p.단위 }] })
  }

  return {
    status: 'success',
    cable: {
      stats: { highVoltageStock: 고압재고, lowVoltageStock: 저압재고, remnantDrums: 잔재드럼수 },
      groups: cableGroups,
    },
    etc: { groups: [...etcMap.values()] },
    updatedAt: now.toISOString(),
  }
}
