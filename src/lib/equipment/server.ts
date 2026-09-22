import { getDashboardAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'
import type { EquipmentData } from './types'

export async function equipmentAccess(admin = false) {
  const access = await getDashboardAccess()
  if (!access.entry || (admin && access.entry.role !== 'admin')) throw new Error('접근 권한이 없습니다.')
  return { client: await createClient(), isAdmin: access.entry.role === 'admin' }
}

export async function loadEquipment() {
  const { client, isAdmin } = await equipmentAccess()
  const { data, error } = await client.rpc('equipment_snapshot', {})
  if (error || !data) throw new Error('전산 현황을 불러오지 못했습니다. 관리자에게 DB 준비 상태를 확인해 주세요.')
  const snapshot = data as unknown as EquipmentData
  if (!Array.isArray(snapshot.floors) || ![1, 2, 3].every(id => snapshot.floors.some(f => f.id === id))) {
    throw new Error('전산 현황 초기 데이터가 준비되지 않았습니다.')
  }
  return { data: snapshot, isAdmin }
}
