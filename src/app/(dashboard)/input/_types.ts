import type { 투입실적Row } from '@/types/database'

export type 투입실적행 = 투입실적Row & {
  수주: { 지중no: string; 공사명: string } | null
}
