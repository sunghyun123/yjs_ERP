export const assetCategories = ['데스크탑', '노트북', '전자칠판', '복합기', 'CCTV', '공유기', 'NAS'] as const
export const stockCategories = ['모니터', '대형 모니터', '키보드', '마우스', '케이블', '기타'] as const
export const blockKinds = ['자리', '서랍', '서버', '벽부착', '구역', '구조물', '보관'] as const
export const useStatuses = ['사용중', '재고', '수리중', '폐기대기'] as const
export type AssetCategory = typeof assetCategories[number]
export type StockCategory = typeof stockCategories[number]
export type UseStatus = typeof useStatuses[number]
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Stamp = { updated_at: string; updated_by: string | null; deleted_at: string | null; version: number }
export type Floor = { id: number; name: string; width: number; height: number; version: number }
export type Person = Stamp & { id: string; name: string; title: string; department: string | null; email: string | null; active: boolean; kakao_id: string | null }
export type Block = Stamp & { id: string; floor_id: number; kind: typeof blockKinds[number]; name: string; x: number; y: number; width: number; height: number; parent_id: string | null; person_id: string | null; registration: '미등록' | '일부등록' | '확인완료' | '장비있음'; unverified_category: AssetCategory | null; unverified_status: UseStatus; note: string | null }
export type Asset = Stamp & { id: string; asset_no: string; category: AssetCategory; name: string; block_id: string | null; model: string | null; serial: string | null; specs: Record<string, Json>; os: string | null; status: UseStatus; identity_status: '확정' | '중복미확정'; last_checked: string | null; note: string | null }
export type Stock = Stamp & { id: string; block_id: string | null; category: StockCategory; name: string; specification: string | null; quantity: number | null; confirmed: boolean; status: UseStatus; last_checked: string | null; note: string | null }
export type Service = Stamp & { id: string; name: string; purpose: string | null; vendor: string | null; account_owner: string | null; amount: number | null; currency: 'KRW' | 'USD' | null; cycle: string | null; billing_unit: string | null; users: number | null; renewal_date: string | null; measurement: '미측정'; asset_id: string | null; source: Record<string, Json>; needs_review: boolean; note: string | null }
export type EquipmentData = { floors: Floor[]; people: Person[]; blocks: Block[]; assets: Asset[]; stocks: Stock[]; services: Service[] }
export type ManagementInfo = Stamp & { id: string; asset_id: string; spec_grade: string | null; replacement_priority: string | null; source: Record<string, Json> }
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
type WithSource<Row> = Row & { source_key: string | null }
export type EquipmentTables = {
  장비_층: Table<Floor>
  장비_인원: Table<WithSource<Person> & { phone: string | null }>
  장비_배치: Table<WithSource<Block>>
  장비_자산: Table<WithSource<Asset>>
  장비_수량품: Table<WithSource<Stock>>
  장비_서비스: Table<WithSource<Service>>
  장비_자산관리정보: Table<ManagementInfo>
  장비_번호: Table<{ prefix: string; value: number }>
}
export type LayoutChange = { floor_id: number; version: number; width: number; height: number; blocks: Block[]; removed: string[]; assignments: { id: string; kind: 'asset' | 'stock'; block_id: string | null; version: number }[] }
export type EquipmentFunctions = {
  equipment_snapshot: { Args: Record<string, never>; Returns: Json }
  equipment_phone: { Args: { person: string }; Returns: string | null }
  equipment_save_layout: { Args: { payload: Json }; Returns: undefined }
  equipment_save_item: { Args: { kind: string; payload: Json }; Returns: undefined }
  equipment_adjust_stock: { Args: { item: string; expected: number; delta: number | null; counted: number | null; memo: string | null }; Returns: undefined }
}
