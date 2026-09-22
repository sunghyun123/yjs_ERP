import type { Asset, Block, EquipmentData, Stock } from './types'

export function summarize(assets: Asset[], stocks: Stock[], unverifiedCategories: string[] = []) {
  const groups = new Map<string, { known: number; unknown: boolean; records: number }>()
  for (const item of [...assets, ...stocks]) {
    if (item.deleted_at) continue
    const group = groups.get(item.category) ?? { known: 0, unknown: false, records: 0 }
    group.records++
    if ('quantity' in item) {
      if (item.quantity === null) group.unknown = true
      else group.known += item.quantity
    } else if (item.identity_status === '중복미확정') group.unknown = true
    else group.known++
    groups.set(item.category, group)
  }
  for (const category of unverifiedCategories) {
    const group = groups.get(category) ?? { known: 0, unknown: true, records: 0 }
    group.unknown = true
    groups.set(category, group)
  }
  return [...groups].map(([category, value]) => ({ category, ...value,
    label: value.unknown ? (value.known ? `확인된 ${value.known}개 · 미확인 있음` : '미확인') : `${value.known}개`,
  }))
}

export function containedIds(block: Block, blocks: Block[]): Set<string> {
  const ids = new Set([block.id])
  let size = 0
  while (size !== ids.size) {
    size = ids.size
    for (const b of blocks) if (!b.deleted_at && b.parent_id && ids.has(b.parent_id)) ids.add(b.id)
  }
  return ids
}

export function searchEquipment(data: EquipmentData, query: string) {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return []
  const results: { id: string; label: string; block_id: string | null; floor_id: number | null }[] = []
  for (const b of data.blocks) {
    const p = data.people.find(p => p.id === b.person_id)
    if (!b.deleted_at && `${b.name} ${p?.name ?? ''} ${p?.title ?? ''}`.toLocaleLowerCase().includes(q))
      results.push({ id: b.id, label: b.name, block_id: b.id, floor_id: b.floor_id })
  }
  for (const a of [...data.assets, ...data.stocks]) {
    if (!a.deleted_at && `${a.name} ${'asset_no' in a ? a.asset_no : ''}`.toLocaleLowerCase().includes(q)) {
      const b = data.blocks.find(b => b.id === a.block_id && !b.deleted_at)
      results.push({ id: a.id, label: a.name, block_id: b?.id ?? null, floor_id: b?.floor_id ?? null })
    }
  }
  return results
}

export function renewalLabel(date: string | null, now = new Date()) {
  if (!date) return '날짜 미등록'
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now)
  const days = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000)
  return days < 0 ? `${-days}일 경과 · 만료` : days === 0 ? '오늘 갱신' : `갱신까지 ${days}일`
}

export function sortByRenewal<T extends { renewal_date: string | null }>(services: T[]): T[] {
  return [...services].sort((a, b) => {
    if (!a.renewal_date) return b.renewal_date ? 1 : 0
    if (!b.renewal_date) return -1
    return a.renewal_date.localeCompare(b.renewal_date)
  })
}

export function clampBlock(block: Block, width: number, height: number): Block {
  const w = Math.min(width, Math.max(100, Math.round(block.width / 10) * 10))
  const h = Math.min(height, Math.max(60, Math.round(block.height / 10) * 10))
  return { ...block, width: w, height: h, x: Math.max(0, Math.min(width - w, Math.round(block.x / 10) * 10)), y: Math.max(0, Math.min(height - h, Math.round(block.y / 10) * 10)) }
}
