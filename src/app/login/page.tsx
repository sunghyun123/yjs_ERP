import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './LoginForm'

// 이미 로그인한 경우 대시보드로 보냄
export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

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

        <LoginForm />
      </div>
    </div>
  )
}
