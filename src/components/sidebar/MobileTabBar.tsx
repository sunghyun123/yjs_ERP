// src/components/sidebar/MobileTabBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { LayoutDashboard, ClipboardList, PenLine, Activity, TrendingUp, Package, FileText, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DASHBOARD_URL } from '@/lib/dashboard-link'

// 자재관리까지 기본 노출, 맨 뒤 공무는 스와이프해야 보인다(사용 빈도 순서 — 사용자 결정)
const tabs = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주', icon: ClipboardList },
  { href: '/input', label: '투입실적', icon: PenLine },
  { href: '/progress', label: '공사이력', icon: Activity },
  { href: '/sales', label: '매출손익', icon: TrendingUp },
  { href: '/materials', label: '자재', icon: Package },
  { href: '/gongmu', label: '공무', icon: FileText },
] as const

export function MobileTabBar() {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  // 화면 밖 탭(공무)이 활성일 때만 보이도록 스크롤 — DOM 스크롤 위치는 렌더 밖 세계라 effect가 정당
  useEffect(() => {
    navRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

  return (
    <nav
      ref={navRef}
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 h-16 safe-area-inset-bottom overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex h-full w-max min-w-full">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              data-active={active}
              className={cn(
                'flex-none w-[15.4vw] min-w-[58px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                active ? 'text-[#2d45a8]' : 'text-gray-400',
              )}
            >
              <Icon className={cn('size-5', active && 'text-[#2d45a8]')} />
              {label}
            </Link>
          )
        })}

        {/* 대시보드 바로가기 — ERP 밖이라 active 상태가 없다(pathname 과 무관).
            맨 뒤에 두는 이유: 스와이프해야 보이는 자리 = 하루에 몇 번 쓰는 이동. */}
        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none w-[15.4vw] min-w-[58px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-gray-400 transition-colors"
        >
          <Monitor className="size-5" />
          대시보드
        </a>
      </div>
    </nav>
  )
}
