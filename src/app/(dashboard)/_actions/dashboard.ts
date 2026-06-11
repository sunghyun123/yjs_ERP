'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function deleteUnregisteredProject(id: number) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as unknown as any).from('dashboard_공사').update({ 삭제됨: true }).eq('id', id)
  revalidatePath('/')
}
