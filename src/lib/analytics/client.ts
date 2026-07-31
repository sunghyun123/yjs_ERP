'use client'

import type { AnalyticsEventName, AnalyticsProperties } from './events'
import { isAnalyticsEnabled, sanitizeAnalyticsProperties } from './safe-properties'

type QueuedEvent = {
  event: AnalyticsEventName
  properties: AnalyticsProperties
}

let eventQueue: QueuedEvent[] = []
let flushScheduled = false

function flushClientEvents() {
  flushScheduled = false
  const events = eventQueue
  eventQueue = []
  if (events.length === 0) return

  void fetch('/api/analytics/capture', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never break the ERP workflow.
  })
}

export function captureClientEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!isAnalyticsEnabled()) return

  eventQueue.push({
    event,
    properties: sanitizeAnalyticsProperties(properties),
  })
  if (!flushScheduled) {
    flushScheduled = true
    queueMicrotask(flushClientEvents)
  }
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
