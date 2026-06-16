'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function KakaoLoginButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // 성공 시 카카오로 리다이렉트되어 이 아래는 실행되지 않음
    if (error) {
      setLoading(false)
      window.location.href = '/login?error=oauth'
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ backgroundColor: '#FEE500' }}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          로그인 중...
        </>
      ) : (
        '카카오로 로그인'
      )}
    </button>
  )
}
