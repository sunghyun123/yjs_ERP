import type { AuditLogRow, Category, CategoryGroup } from './types'

const OP_KOR: Record<AuditLogRow['operation'], string> = {
  INSERT: '등록',
  UPDATE: '수정',
  DELETE: '삭제',
}

// table_name → 거래/계약 그룹 매핑 (없으면 마스터).
// 투입실적상세는 투입실적 그룹으로 묶어 한 칩에서 함께 조회한다.
const GROUP_BY_TABLE: Record<string, CategoryGroup> = {
  수주: '수주',
  기성: '기성',
  공사이력: '공사이력',
  투입실적: '투입실적',
  투입실적상세: '투입실적',
}

// 라벨을 붙여쓰는 그룹(수주등록/기성등록처럼 한 단어 도메인 용어로 읽힘).
// 나머지(공사이력 등록, 투입실적 등록)는 띄어쓰기가 더 읽기 쉬워 분리.
const NO_SPACE_GROUPS: ReadonlySet<CategoryGroup> = new Set(['수주', '기성'])

function isCompletion(row: AuditLogRow): boolean {
  // 준공완료 = 수주 UPDATE 에서 준공여부 false → true
  return (
    row.operation === 'UPDATE' &&
    row.old_data?.준공여부 === false &&
    row.new_data?.준공여부 === true
  )
}

export function deriveCategory(row: AuditLogRow): Category {
  const op = OP_KOR[row.operation]

  if (row.table_name === '수주' && isCompletion(row)) {
    return { group: '준공완료', label: '준공완료' }
  }

  const group = GROUP_BY_TABLE[row.table_name]
  if (!group) {
    // 마스터 데이터(거래처/공사단가/공사현장/공무담당자 등)
    return { group: '마스터', label: `마스터: ${row.table_name} ${op}` }
  }

  // 라벨 기준은 table_name이 아니라 group이다 → 투입실적상세도 "투입실적 …"로 묶인다.
  const label = NO_SPACE_GROUPS.has(group) ? `${group}${op}` : `${group} ${op}`
  return { group, label }
}
