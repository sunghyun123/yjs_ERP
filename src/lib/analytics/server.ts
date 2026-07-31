import crypto from 'crypto'
import { PostHog } from 'posthog-node'
import { createClient } from '@/lib/supabase/server'
import type { AnalyticsEventName, AnalyticsProperties } from './events'
import { isAnalyticsEnabled, sanitizeAnalyticsProperties } from './safe-properties'

function getPostHogConfig() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!isAnalyticsEnabled() || !token || !host) return null
  return { token, host }
}

export function hashUserId(userId: string) {
  const salt = process.env.POSTHOG_USER_HASH_SALT
  if (!salt) return null

  return crypto
    .createHash('sha256')
    .update(`${salt}:${userId}`)
    .digest('hex')
}

export async function getServerDistinctId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ? hashUserId(user.id) : null
}

export async function captureServerEvent(event: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  await captureServerEvents([{ event, properties }])
}

export async function captureServerEvents(
  events: { event: AnalyticsEventName; properties?: AnalyticsProperties }[],
) {
  const config = getPostHogConfig()
  if (!config || events.length === 0) return

  const distinctId = await getServerDistinctId()
  if (!distinctId) return

  const client = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  })

  for (const { event, properties = {} } of events) {
    client.capture({
      distinctId,
      event,
      properties: sanitizeAnalyticsProperties({
        ...properties,
        source: properties.source ?? 'server',
        environment: 'production',
      }),
    })
  }
  await client.shutdown()
}

export async function captureServerException(
  error: unknown,
  properties: AnalyticsProperties = {},
) {
  const config = getPostHogConfig()
  if (!config) return

  const distinctId = await getServerDistinctId()
  if (!distinctId) return

  const client = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  })

  await client.captureExceptionImmediate(error, distinctId, sanitizeAnalyticsProperties({
    ...properties,
    source: 'client',
    environment: 'production',
  }))
  await client.shutdown()
}
