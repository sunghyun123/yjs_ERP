import type { 투입실적Row, 투입실적상세Row } from '@/types/database'

export type 투입실적행 = 투입실적Row & {
  수주: { 지중no: string; 공사명: string } | null
  투입실적상세?: Pick<투입실적상세Row, '투입구분' | '주간수량' | '야간수량'>[] | null
}
