'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/analytics/server'

export async function deleteUnregisteredProject(id: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('dashboard_공사').update({ 삭제됨: true }).eq('id', id)
  if (error) throw new Error(error.message)
  await captureServerEvent('admin_action_performed', {
    entity_type: 'dashboard',
    action_type: 'delete',
    result: 'success',
  })
  revalidatePath('/')
}
