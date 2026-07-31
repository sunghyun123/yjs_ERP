import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { syncDashboardApprovedUser } from './dashboard-whitelist'

function fakeAdminClient(upsert = vi.fn().mockResolvedValue({ error: null })) {
  const from = vi.fn(() => ({ upsert }))
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    upsert,
  }
}

describe('syncDashboardApprovedUser', () => {
  it('대시보드 승인 계정을 Supabase whitelist에 추가한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ allowed: true, user_name: '승인 사용자', role: 'worker' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const admin = fakeAdminClient()

    const result = await syncDashboardApprovedUser('111222333', {
      accessCheckUrl: 'https://dashboard.example/api/auth/erp-access-check',
      apiKey: 'shared-key',
      fetchImpl,
      adminClient: admin.client,
    })

    expect(result).toEqual({ user_name: '승인 사용자', role: 'worker' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dashboard.example/api/auth/erp-access-check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer shared-key' }),
        body: JSON.stringify({ kakao_id: '111222333' }),
      })
    )
    expect(admin.from).toHaveBeenCalledWith('whitelist')
    expect(admin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        kakao_id: '111222333',
        user_name: '승인 사용자',
        role: 'worker',
      }),
      { onConflict: 'kakao_id' }
    )
  })

  it('미승인 계정은 추가하지 않는다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ allowed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const admin = fakeAdminClient()

    const result = await syncDashboardApprovedUser('999', {
      accessCheckUrl: 'https://dashboard.example/api/auth/erp-access-check',
      apiKey: 'shared-key',
      fetchImpl,
      adminClient: admin.client,
    })

    expect(result).toBeNull()
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('연동 설정이 없으면 기존 ERP 로그인 흐름을 방해하지 않는다', async () => {
    const fetchImpl = vi.fn()
    const result = await syncDashboardApprovedUser('111', {
      accessCheckUrl: 'https://dashboard.example/api/auth/erp-access-check',
      apiKey: '',
      fetchImpl,
    })

    expect(result).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
