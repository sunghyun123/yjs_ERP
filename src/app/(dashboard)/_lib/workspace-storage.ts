export const WORKSPACE_STORAGE_KEY = 'erp_workspace_v1'

export function serializeWorkspace(state: Record<string, unknown>): string {
  return JSON.stringify(state)
}

export function deserializeWorkspace(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
