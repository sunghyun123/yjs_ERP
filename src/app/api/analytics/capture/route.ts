import { NextRequest, NextResponse } from 'next/server'
import { captureServerEvents } from '@/lib/analytics/server'
import type { AnalyticsEventName, AnalyticsProperties } from '@/lib/analytics/events'
import { isAllowedAnalyticsEvent, sanitizeAnalyticsProperties } from '@/lib/analytics/safe-properties'

const MAX_BATCH_SIZE = 20

type EventInput = {
  event?: unknown
  properties?: AnalyticsProperties
}

function parseEvent(input: EventInput) {
  if (typeof input.event !== 'string' || !isAllowedAnalyticsEvent(input.event)) {
    return null
  }
  if (
    input.properties != null &&
    (typeof input.properties !== 'object' || Array.isArray(input.properties))
  ) {
    return null
  }
  return {
    event: input.event as AnalyticsEventName,
    properties: sanitizeAnalyticsProperties({
      ...input.properties,
      source: 'client',
    }),
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const input = body as EventInput & { events?: unknown }
  if (Array.isArray(input.events) && input.events.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: 'batch_too_large' }, { status: 400 })
  }
  const rawEvents = Array.isArray(input.events) ? input.events : [input]
  const parsedEvents = rawEvents.map((item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? parseEvent(item as EventInput)
      : null,
  )

  if (parsedEvents.length === 0 || parsedEvents.some((event) => event === null)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const events = parsedEvents.filter((event) => event !== null)
  await captureServerEvents(events)
  return NextResponse.json({ ok: true })
}
