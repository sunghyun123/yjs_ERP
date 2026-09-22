'use server'

import { revalidatePath } from 'next/cache'
import { equipmentAccess, loadEquipment } from '@/lib/equipment/server'
import type { Json, LayoutChange } from '@/lib/equipment/types'

export async function refreshEquipment() { return loadEquipment() }
export async function revealPhone(person: string) {
  const { client } = await equipmentAccess()
  const { data, error } = await client.rpc('equipment_phone', { person })
  if (error) return { error: '연락처를 불러오지 못했습니다.' }
  return { phone: data ?? '등록된 휴대폰 없음' }
}
function message(error: { code?: string }) {
  return error.code === '40001' ? '다른 사용자가 수정했습니다. 편집 내용은 유지됩니다. 취소 후 최신 내용을 불러와 주세요.' : error.code === '42501' ? '관리자만 편집할 수 있습니다.' : '저장하지 못했습니다. 입력값·배정 중복·구역 연결을 확인해 주세요.'
}
export async function saveLayout(payload: LayoutChange) {
  const { client } = await equipmentAccess(true)
  const { error } = await client.rpc('equipment_save_layout', { payload: payload as unknown as Json })
  if (error) return { error: message(error) }
  revalidatePath('/assets')
  return { ok: true }
}
export async function saveItem(kind: 'asset' | 'stock' | 'person' | 'service' | 'management', payload: Json) {
  const { client } = await equipmentAccess(true)
  const { error } = await client.rpc('equipment_save_item', { kind, payload })
  if (error) return { error: message(error) }
  revalidatePath('/assets')
  revalidatePath('/assets/stock')
  return { ok: true }
}
export async function getManagementInfo(assetId: string) {
  const { client } = await equipmentAccess(true)
  const { data, error } = await client.from('장비_자산관리정보').select('*').eq('asset_id', assetId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error('관리정보를 불러오지 못했습니다.')
  return data
}
export async function adjustStock(item: string, expected: number, delta: number | null, counted: number | null, memo: string | null) {
  const { client } = await equipmentAccess(true)
  const { error } = await client.rpc('equipment_adjust_stock', { item, expected, delta, counted, memo })
  if (error) return { error: message(error) }
  revalidatePath('/assets'); revalidatePath('/assets/stock')
  return { ok: true }
}
