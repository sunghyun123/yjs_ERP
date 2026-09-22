'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  PenLine,
  Activity,
  TrendingUp,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Package,
  Monitor,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/actions/auth'
import { DASHBOARD_URL } from '@/lib/dashboard-link'

const SIDEBAR_BG = '#1e2d5a'
const ACTIVE_BG = '#2d45a8'
const SIDEBAR_TEXT = '#c8d3f0'

// 그룹 사이에 구분선 — 현황(홈~매출손익) / 자재관리 / 공무
const navGroups = [
  [
    { href: '/', label: '홈', icon: LayoutDashboard },
    { href: '/orders', label: '수주대장', icon: ClipboardList },
    { href: '/input', label: '투입실적', icon: PenLine },
    { href: '/progress', label: '공사이력', icon: Activity },
    { href: '/sales', label: '매출손익 현황', icon: TrendingUp },
  ],
  [{ href: '/materials', label: '자재관리', icon: Package }],
  [{ href: '/gongmu', label: '공무', icon: FileText }],
  [{ href: '/assets', label: '영전사 전산 현황', icon: Monitor }],
] as const

const adminNav = [
  { href: '/admin/clients', label: '거래처 관리' },
  { href: '/admin/rates', label: '공사단가 관리' },
  { href: '/admin/gongmu', label: '공무담당자 관리' },
  { href: '/admin/sites', label: '공사현장 관리' },
  { href: '/admin/updates', label: '변경내역' },
] as const

interface SidebarProps {
  userName: string
  isAdmin: boolean
}

export function Sidebar({ userName, isAdmin }: SidebarProps) {
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
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {gi > 0 && <div className="my-2 border-t border-white/10" />}
            {group.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  // All dashboard pages are dynamic. Next.js 16 otherwise only
                  // prefetches the shared loading boundary, so the data request
                  // does not start until the user clicks the menu item.
                  prefetch
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
          </div>
        ))}

        {isAdmin && (
          <>
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
                      prefetch
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
          </>
        )}
      </nav>

      {/* 대시보드 바로가기 — 앱 밖으로 나가므로 next/link 가 아니라 순수 <a>.
          새 탭으로 여는 이유: ERP 폼 작성 중에 눌러도 입력이 날아가지 않는다.
          rel="noopener" 없이 _blank 를 쓰면 열린 쪽에서 window.opener 로 이 탭을 조작할 수 있다. */}
      <div className="px-3 pt-3 border-t border-white/10 shrink-0">
        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-white/10 transition-colors"
        >
          <Monitor className="size-4 shrink-0" />
          <span className="flex-1">대시보드</span>
          <ExternalLink className="size-3.5 opacity-60 shrink-0" />
        </a>
      </div>

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
