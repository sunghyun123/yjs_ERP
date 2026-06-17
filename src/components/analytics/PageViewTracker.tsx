'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureClientEvent, identifyAnalyticsUser } from '@/lib/analytics/client'
import { getRouteAnalytics } from '@/lib/analytics/events'

function PageViewTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    identifyAnalyticsUser()
  }, [])

  useEffect(() => {
    if (!pathname) return

    const route = getRouteAnalytics(pathname)
    const filterCount = Array.from(searchParams.keys()).length
    const key = `${route.route_key}:${filterCount}`
    if (lastKey.current === key) return
    lastKey.current = key

    const properties = {
      route_key: route.route_key,
      page_group: route.page_group,
      filter_count: filterCount,
    }

    captureClientEvent('page_viewed', properties)
    if (route.view_event) {
      captureClientEvent(route.view_event, properties)
    }
  }, [pathname, searchParams])

  return null
}

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <PageViewTrackerInner />
    </Suspense>
  )
}
