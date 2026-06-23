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

  // ── 예외 통로 ($exception) ───────────────────────────────────
  // 에러 추적 이벤트는 허용목록 검사를 건너뛰고 원본 그대로 통과시킨다.
  // 이유: 에러 추적의 본질은 자유형 메시지·스택($exception_list 등)이라,
  //       분석용 ALLOWED_PROPERTY_KEYS로 거르면 디버깅 알맹이가 통째로 사라진다.
  // 정책(사용자 결정 2026-06-22): 사내 한정 환경 → 행 값 포함 메시지/스택 전체 보존.
  //       아래 일반 분석 이벤트의 엄격 정책은 손대지 않으므로 기존 동작은 불변.
  if (event.event === '$exception') return event

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
