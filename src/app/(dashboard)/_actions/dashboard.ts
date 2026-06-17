'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/analytics/server'

export async function deleteUnregisteredProject(id: number) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('dashboard_공사').update({ 삭제됨: true }).eq('id', id)
  if (error) throw new Error(error.message)
  await captureServerEvent('admin_action_performed', {
    entity_type: 'dashboard',
    action_type: 'delete',
    result: 'success',
  })
  revalidatePath('/')
}
