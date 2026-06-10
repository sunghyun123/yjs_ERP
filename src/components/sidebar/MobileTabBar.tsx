'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, PenLine, Activity, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주', icon: ClipboardList },
  { href: '/input', label: '투입입력', icon: PenLine },
  { href: '/progress', label: '공사이력', icon: Activity },
  { href: '/sales', label: '매출손익', icon: TrendingUp },
] as const

export function MobileTabBar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 flex h-16 safe-area-inset-bottom">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              active ? 'text-[#2d45a8]' : 'text-gray-400',
            )}
          >
            <Icon className={cn('size-5', active && 'text-[#2d45a8]')} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
