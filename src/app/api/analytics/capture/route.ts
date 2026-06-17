import { NextRequest, NextResponse } from 'next/server'
import { captureServerEvent } from '@/lib/analytics/server'
import type { AnalyticsProperties } from '@/lib/analytics/events'
import { isAllowedAnalyticsEvent, sanitizeAnalyticsProperties } from '@/lib/analytics/safe-properties'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { event, properties } = body as { event?: string; properties?: AnalyticsProperties }
  if (!event || !isAllowedAnalyticsEvent(event)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  await captureServerEvent(event, sanitizeAnalyticsProperties(properties))
  return NextResponse.json({ ok: true })
}
