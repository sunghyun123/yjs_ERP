export const ANALYTICS_EVENTS = [
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
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

export type PageGroup =
  | 'dashboard'
  | 'orders'
  | 'construction_status'
  | 'work_log'
  | 'profit_loss'
  | 'gongmu'
  | 'admin'
  | 'auth'
  | 'unknown'

export type AnalyticsProperties = {
  route_key?: string
  page_group?: PageGroup
  filter_count?: number
  action_type?: 'create' | 'update' | 'delete' | 'export' | 'view' | 'sync'
  entity_type?: 'order' | 'work_log' | 'construction_status' | 'profit_loss' | 'admin' | 'dashboard' | 'excel'
  result?: 'success' | 'failure'
  error_code?: string
  export_type?: 'profit_loss' | 'weekly_report'
  source?: 'client' | 'server'
  environment?: 'production'
}

export type RouteAnalytics = {
  route_key: string
  page_group: PageGroup
  view_event?: AnalyticsEventName
}

export function getRouteAnalytics(pathname: string): RouteAnalytics {
  if (pathname === '/') {
    return { route_key: 'dashboard.home', page_group: 'dashboard', view_event: 'dashboard_viewed' }
  }
  if (pathname === '/orders') {
    return { route_key: 'orders.list', page_group: 'orders', view_event: 'order_list_viewed' }
  }
  if (pathname === '/progress') {
    return {
      route_key: 'construction_status.list',
      page_group: 'construction_status',
      view_event: 'construction_status_viewed',
    }
  }
  if (pathname === '/input') {
    return { route_key: 'work_log.list', page_group: 'work_log', view_event: 'work_log_list_viewed' }
  }
  if (pathname === '/sales') {
    return { route_key: 'profit_loss.list', page_group: 'profit_loss', view_event: 'profit_loss_viewed' }
  }
  if (pathname === '/gongmu') {
    return { route_key: 'gongmu.list', page_group: 'gongmu' }
  }
  if (/^\/gongmu\/[^/]+$/.test(pathname)) {
    return { route_key: 'gongmu.detail', page_group: 'gongmu' }
  }
  if (pathname.startsWith('/admin/')) {
    const section = pathname.split('/')[2] || 'unknown'
    return { route_key: `admin.${section}`, page_group: 'admin', view_event: 'admin_page_viewed' }
  }
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/')) {
    return { route_key: 'auth.flow', page_group: 'auth' }
  }

  return { route_key: 'unknown', page_group: 'unknown' }
}
