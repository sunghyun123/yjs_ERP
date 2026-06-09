'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  PenLine,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/actions/auth'

const SIDEBAR_BG = '#1e2d5a'
const ACTIVE_BG = '#2d45a8'
const SIDEBAR_TEXT = '#c8d3f0'

const mainNav = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주대장', icon: ClipboardList },
  { href: '/input', label: '투입실적 입력', icon: PenLine },
  { href: '/sales', label: '매출손익 현황', icon: TrendingUp },
] as const

const adminNav = [
  { href: '/admin/clients', label: '거래처 관리' },
  { href: '/admin/rates', label: '공사단가 관리' },
] as const

interface SidebarProps {
  userName: string
}

export function Sidebar({ userName }: SidebarProps) {
  const pathname = usePathname()
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith('/admin'))

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isAdminActive = pathname.startsWith('/admin')

  return (
    <aside
      className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 overflow-hidden"
      style={{ width: 230, backgroundColor: SIDEBAR_BG, color: SIDEBAR_TEXT }}
    >
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: ACTIVE_BG }}
          >
            <span className="text-white text-xs font-bold tracking-tight">YEC</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">영전사</p>
            <p className="text-[11px] mt-0.5 opacity-60">ERP 시스템</p>
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {mainNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active ? 'text-white' : 'hover:bg-white/10',
              )}
              style={active ? { backgroundColor: ACTIVE_BG, color: '#fff' } : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {/* 구분선 */}
        <div className="my-2 border-t border-white/10" />

        {/* 관리자 메뉴 */}
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
            isAdminActive ? 'text-white' : 'hover:bg-white/10',
          )}
          style={isAdminActive ? { backgroundColor: ACTIVE_BG, color: '#fff' } : undefined}
        >
          <Settings className="size-4 shrink-0" />
          <span className="flex-1">관리자</span>
          {adminOpen ? (
            <ChevronDown className="size-3.5 opacity-70" />
          ) : (
            <ChevronRight className="size-3.5 opacity-70" />
          )}
        </button>

        {adminOpen && (
          <div className="ml-7 space-y-0.5">
            {adminNav.map(({ href, label }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center px-3 py-1.5 rounded-md text-[13px] transition-colors',
                    active ? 'text-white' : 'hover:bg-white/10',
                  )}
                  style={active ? { backgroundColor: ACTIVE_BG, color: '#fff' } : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="px-3 py-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div
            className="size-7 rounded-full flex items-center justify-center text-xs text-white font-semibold shrink-0"
            style={{ backgroundColor: ACTIVE_BG }}
          >
            {userName.slice(0, 1)}
          </div>
          <span className="text-sm truncate">{userName}</span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-white/10 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  )
}
