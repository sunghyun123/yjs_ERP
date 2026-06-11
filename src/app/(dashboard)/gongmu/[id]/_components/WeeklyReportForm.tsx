// src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx
// STUB — will be replaced in Task 8
import type { 공무_주간보고Row, 공무_월간계획Row } from '@/types/database'

type 이력초안Item = {
  id: number
  수주_id: number | null
  작업일자: string
  성과금액: number | null
  작업내용: string | null
}

type 기성초안Item = {
  id: number
  수주_id: number | null
  기성일: string | null
  기성액_공급가: number | null
  작업내용: string | null
}

type Props = {
  공무_id: number
  year: number
  week_no: number
  savedRows: 공무_주간보고Row[]
  이력초안: 이력초안Item[]
  기성초안: 기성초안Item[]
  수주목록: { id: number; 지중no: string; 공사명: string }[]
  공무담당자목록: { id: number; 이름: string }[]
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  month: number
}

export function WeeklyReportForm(_props: Props) {
  return null
}
