// 유형별 프로젝트 현황 도넛의 집계 로직 — 렌더와 분리해 단위 테스트 가능하게 유지.

import { calc하도적용표시금액 } from '../orders/_lib/completion'

export type 상태 = '완료' | '진행중' | '미진행' | '미분류'
export type DonutRow = { 유형: string; 상태: 상태; 금액: number; 건수: number }

// 수주 테이블에서 도넛에 필요한 컬럼만 (select 목록과 1:1)
export type 수주도넛입력 = {
  공사구분: string | null
  시공상태: string | null
  준공여부: boolean
  수주금액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}

// 관급은 건수가 적어 민수에 합산 표시 (사장님 피드백 2026-07-09)
const 유형병합: Record<string, string> = { 관급: '민수' }

// 시공상태(DB 값) → 차트 상태 라벨
const 상태라벨: Record<string, 상태> = { 미시공: '미진행', 시공중: '진행중', 완료: '완료' }

export function 유형상태집계(수주목록: 수주도넛입력[]): DonutRow[] {
  const acc = new Map<string, DonutRow>()
  for (const r of 수주목록) {
    const 원유형 = r.공사구분 ?? '미분류'
    const 유형 = 유형병합[원유형] ?? 원유형
    // 준공여부=true면 시공상태와 무관하게 완료 — 준공여부가 실제 플로우(수주대장 필터·준공검사)가
    // 쓰는 컬럼이라 더 신뢰. 이관 데이터의 시공상태 NULL 199건 중 42건이 이걸로 완료로 흡수된다.
    const 상태 = r.준공여부 ? '완료' : (상태라벨[r.시공상태 ?? ''] ?? '미분류')
    // 금액 = 수주대장과 같은 관대 하도적용(요율 없으면 공급가 폴백) → 합계가 수주대장과 일치
    const 금액 = calc하도적용표시금액(r.수주금액_공급가, r.보험료율, r.하도전용율)
    const key = `${유형}-${상태}`
    const prev = acc.get(key)
    if (prev) {
      prev.금액 += 금액
      prev.건수 += 1
    } else {
      acc.set(key, { 유형, 상태, 금액, 건수: 1 })
    }
  }
  return [...acc.values()]
}
