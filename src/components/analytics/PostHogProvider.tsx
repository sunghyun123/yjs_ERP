'use client'

import posthog from 'posthog-js'
import { PostHogProvider as Provider } from '@posthog/react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <Provider client={posthog}>{children}</Provider>
}
