import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { KakaoLoginButton } from './KakaoLoginButton'

// 이미 로그인한 경우 홈으로 보냄
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/')

  const { error } = await searchParams
  const errorMessage =
    error === 'not_allowed'
      ? '등록되지 않은 사용자입니다. 전산담당자에게 문의하세요.'
      : error
        ? '로그인이 취소되었거나 실패했습니다. 다시 시도해 주세요.'
        : null

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#f1f4fb' }}
    >
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ backgroundColor: '#1e2d5a' }}
          >
            <span className="text-white text-sm font-bold tracking-tight">YEC</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1e2d5a' }}>
            YEC ERP
          </h1>
          <p className="mt-1 text-sm text-gray-500">영전사 전기공사 ERP 시스템</p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        <KakaoLoginButton />
      </div>
    </div>
  )
}
