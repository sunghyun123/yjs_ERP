'use client'

import posthog from 'posthog-js'
import type { AnalyticsEventName, AnalyticsProperties } from './events'
import { isAnalyticsEnabled, sanitizeAnalyticsProperties } from './safe-properties'

let identityLoaded = false

export async function identifyAnalyticsUser() {
  if (!isAnalyticsEnabled() || identityLoaded) return
  identityLoaded = true

  try {
    const res = await fetch('/api/analytics/identity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    if (!res.ok) return

    const data = await res.json() as { distinctId?: string }
    if (data.distinctId) {
      posthog.identify(data.distinctId)
    }
  } catch {
    // Analytics must never break the ERP workflow.
  }
}

export function captureClientEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!isAnalyticsEnabled()) return

  posthog.capture(event, sanitizeAnalyticsProperties({
    ...properties,
    source: 'client',
    environment: 'production',
  }))
}

export async function captureServerBackedEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!isAnalyticsEnabled()) return

  try {
    await fetch('/api/analytics/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, properties: sanitizeAnalyticsProperties(properties) }),
      keepalive: true,
    })
  } catch {
    // Analytics must never block the user workflow.
  }
}
