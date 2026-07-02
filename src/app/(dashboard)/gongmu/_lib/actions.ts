// src/app/(dashboard)/gongmu/_lib/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/analytics/server'
import type { 공무_주간보고Insert } from '@/types/database'

/** 월간계획 upsert */
export async function upsert월간계획(
  공무_id: number,
  year: number,
  month: number,
  구분: '공사' | '공무',
  월간계획금액: number,
) {
  const supabase = await createClient()
  const { error } = await supabase.from('공무_월간계획').upsert(
    { 공무_id, year, month, 구분, 월간계획금액 },
    { onConflict: '공무_id,year,month,구분' },
  )
  if (error) throw new Error(error.message)
  await captureServerEvent('admin_action_performed', {
    entity_type: 'admin',
    action_type: 'update',
    result: 'success',
  })
  revalidatePath(`/gongmu/${공무_id}`)
}

/** 주간 보고 행 일괄 저장 (해당 주차 전체 교체) */
export async function save주간보고(
  공무_id: number,
  year: number,
  week_no: number,
  rows: Omit<공무_주간보고Insert, 'id'>[],
) {
  const supabase = await createClient()
  // 기존 행 삭제
  const { error: deleteError } = await supabase
    .from('공무_주간보고')
    .delete()
    .eq('공무_id', 공무_id)
    .eq('year', year)
    .eq('week_no', week_no)
  if (deleteError) throw new Error(deleteError.message)
  // 새 행 삽입
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('공무_주간보고').insert(rows)
    if (insertError) throw new Error(insertError.message)
  }
  await captureServerEvent('admin_action_performed', {
    entity_type: 'admin',
    action_type: 'update',
    result: 'success',
  })
  revalidatePath(`/gongmu/${공무_id}`)
}

/** 단일 행 삭제 */
export async function delete주간보고행(id: number, 공무_id: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('공무_주간보고').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await captureServerEvent('admin_action_performed', {
    entity_type: 'admin',
    action_type: 'delete',
    result: 'success',
  })
  revalidatePath(`/gongmu/${공무_id}`)
}
