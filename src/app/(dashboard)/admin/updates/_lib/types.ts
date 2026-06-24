// audit_log 행(페이지가 DB에서 읽는 형태)
export interface AuditLogRow {
  id: number
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: number | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_at: string
}

// FK id → 이름 해석용. 서버에서 한 번 로드해 주입.
export interface LookupMaps {
  거래처: Map<number, string>      // id → 거래처명
  공무담당자: Map<number, string>  // id → 이름
  수주: Map<number, string>        // id → 공사명
}

// 화면 필터 그룹
export type CategoryGroup =
  | '수주' | '준공완료' | '기성' | '공사이력' | '투입실적' | '마스터'

export interface Category {
  group: CategoryGroup
  label: string // 예: "수주등록", "준공완료", "마스터: 거래처 수정"
}

// 클라이언트로 넘기는 가공된 행
export interface PreparedEntry {
  id: number
  changed_at: string
  category: Category
  summary: string
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: number | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}
