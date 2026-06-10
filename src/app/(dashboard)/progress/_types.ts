import type { 수주Row, 공사이력Row } from '@/types/database'

export type 수주목록항목 = Pick<
  수주Row,
  'id' | '지중no' | '공사명' | '수주금액_공급가' | '보험료율' | '하도전용율'
>

export type 공사이력행 = Pick<공사이력Row, 'id' | '작업일자' | '성과금액' | '수주_id'> & {
  수주: { 지중no: string; 공사명: string } | null
}
