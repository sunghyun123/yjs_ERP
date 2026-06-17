import type { AnalyticsEventName, AnalyticsProperties } from './events'

const ALLOWED_PROPERTY_KEYS = new Set<keyof AnalyticsProperties>([
  'route_key',
  'page_group',
  'filter_count',
  'action_type',
  'entity_type',
  'result',
  'error_code',
  'export_type',
  'source',
  'environment',
])

const SDK_URL_PROPERTIES = [
  '$current_url',
  '$pathname',
  '$initial_current_url',
  '$referrer',
] as const

export function isAnalyticsEnabled() {
  return process.env.NODE_ENV === 'production'
}

export function sanitizeAnalyticsProperties(properties: AnalyticsProperties = {}): AnalyticsProperties {
  const safe: AnalyticsProperties = {}

  for (const [key, value] of Object.entries(properties) as [keyof AnalyticsProperties, unknown][]) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue
    if (value === undefined || value === null) continue

    if (key === 'filter_count') {
      safe.filter_count = typeof value === 'number' && Number.isFinite(value) ? value : 0
      continue
    }

    if (typeof value === 'string') {
      safe[key] = value.slice(0, 80) as never
      continue
    }

    safe[key] = value as never
  }

  return safe
}

export function sanitizePostHogEvent<T extends { event?: string; properties?: Record<string, unknown> } | null>(
  event: T,
): T | null {
  if (!event) return null
  if (event.event && !isAllowedAnalyticsEvent(event.event)) return null

  const properties = event.properties ?? {}
  for (const key of SDK_URL_PROPERTIES) {
    delete properties[key]
  }
  event.properties = sanitizeAnalyticsProperties(properties as AnalyticsProperties) as Record<string, unknown>
  return event
}

export function isAllowedAnalyticsEvent(event: string): event is AnalyticsEventName {
  return [
    'page_viewed',
    'dashboard_viewed',
    'order_list_viewed',
    'order_created',
    'order_updated',
    'order_deleted',
    'construction_status_viewed',
    'work_log_list_viewed',
    'work_log_created',
    'work_log_updated',
    'profit_loss_viewed',
    'excel_export_started',
    'excel_exported',
    'excel_export_failed',
    'admin_page_viewed',
    'admin_action_performed',
  ].includes(event)
}
