import { deriveCategory } from './category'
import type { AuditLogRow, LookupMaps, PreparedEntry } from './types'

export function formatWon(v: unknown): string {
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return `${v.toLocaleString('ko-KR')}원`
}

// FK id → 이름. 맵에 없으면 id:N 폴백, id 자체가 없으면 '-'.
function name(map: Map<number, string>, id: unknown): string {
  if (typeof id !== 'number') return '-'
  return map.get(id) ?? `id:${id}`
}

function str(v: unknown): string {
  return v == null ? '-' : String(v)
}

// 변경 후 스냅샷 우선, 없으면(삭제) 변경 전.
function snapshot(row: AuditLogRow): Record<string, unknown> {
  return row.new_data ?? row.old_data ?? {}
}

export function formatSummary(row: AuditLogRow, lookups: LookupMaps): string {
  const d = snapshot(row)
  const parts: string[] = []

  switch (row.table_name) {
    case '수주':
      parts.push(str(d.공사명))
      parts.push(`발주자 ${name(lookups.거래처, d.발주자_id)}`)
      if (d.원청사_id != null) parts.push(`원청 ${name(lookups.거래처, d.원청사_id)}`)
      if (d.공무담당자_id != null) parts.push(`공무 ${name(lookups.공무담당자, d.공무담당자_id)}`)
      // 준공완료면 준공일·준공액 부각
      if (d.준공여부 === true) {
        parts.push(`준공일 ${str(d.준공일)}`)
        parts.push(`준공액 ${formatWon(d.준공액_공급가)}`)
      } else {
        parts.push(`금액 ${formatWon(d.수주금액_공급가)}`)
      }
      break

    case '기성':
      parts.push(name(lookups.수주, d.수주_id))
      parts.push(`${str(d.차수)}차`)
      parts.push(`기성일 ${str(d.기성일)}`)
      parts.push(`기성액 ${formatWon(d.기성액_공급가)}`)
      break

    case '공사이력':
      parts.push(name(lookups.수주, d.수주_id))
      parts.push(`작업일 ${str(d.작업일자)}`)
      parts.push(`성과 ${formatWon(d.성과금액)}`)
      break

    case '투입실적':
      parts.push(name(lookups.수주, d.수주_id))
      parts.push(`투입일 ${str(d.투입일)}`)
      break

    case '투입실적상세':
      parts.push(`투입실적#${str(d.투입실적_id)}`)
      parts.push(str(d.투입구분))
      parts.push(`주 ${str(d.주간수량)} / 야 ${str(d.야간수량)}`)
      break

    case '거래처':
      parts.push(str(d.거래처명))
      parts.push(`코드 ${str(d.거래처코드)}`)
      break

    case '공사단가':
      parts.push(str(d.투입구분))
      parts.push(`주간 ${formatWon(d.주간단가)}`)
      if (d.야간단가 != null) parts.push(`야간 ${formatWon(d.야간단가)}`)
      parts.push(`적용 ${str(d.적용시작일)}`)
      break

    case '공사현장':
      parts.push(str(d.현장명))
      break

    case '공무담당자':
      parts.push(str(d.이름))
      break

    default:
      // 미지정 테이블: 행 id만
      parts.push(`#${str(row.row_id)}`)
  }

  return parts.join(' · ')
}

export function prepareEntry(row: AuditLogRow, lookups: LookupMaps): PreparedEntry {
  return {
    id: row.id,
    changed_at: row.changed_at,
    category: deriveCategory(row),
    summary: formatSummary(row, lookups),
    table_name: row.table_name,
    operation: row.operation,
    row_id: row.row_id,
    old_data: row.old_data,
    new_data: row.new_data,
  }
}
