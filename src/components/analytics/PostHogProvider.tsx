'use client'

import posthog from 'posthog-js'
import { PostHogProvider as Provider } from '@posthog/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!token || !host || posthog.__loaded) return

    posthog.init(token, {
      api_host: host,
      capture_pageview: false,  // PageViewTracker가 수동으로 처리
      capture_pageleave: true,
      persistence: 'localStorage',
    })
  }, [])

  return <Provider client={posthog}>{children}</Provider>
}
