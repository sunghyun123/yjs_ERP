// 유형별 프로젝트 현황 도넛의 집계 로직 — 렌더와 분리해 단위 테스트 가능하게 유지.

import { calc하도적용표시금액 } from '../orders/_lib/completion'

export type 상태 = '완료' | '진행중' | '미진행' | '미분류'
export type DonutRow = { 유형: string; 상태: 상태; 금액: number; 건수: number }

// 지중no에서 연도를 못 읽은 행이 모이는 자리. 조용히 버리면 "전체 ≠ 연도별 합"이 되므로
// 하나의 선택지로 노출해 티가 나게 한다.
export const 연도미상 = '연도미상'
export type 연도 = number | typeof 연도미상
export type 연도선택 = 연도 | '전체'

// 연도 축이 붙은 집계 행 — 서버가 한 번 만들어 내려주고, 클라가 연도로 걸러 쓴다.
export type 연도DonutRow = DonutRow & { 연도: 연도 }

// 수주 테이블에서 도넛에 필요한 컬럼만 (select 목록과 1:1)
export type 수주도넛입력 = {
  지중no: string
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

// 지중no 명명 규칙: 영문 2글자 + 2자리 연도 + '-' + 일련번호 (예: JY25-018 → 2025)
// 수주 테이블엔 수주일/계약일 컬럼이 없고, 착공일은 45%가 NULL(그중 대부분이 완료 건)이라
// 연도로 쓸 수 없다. 지중no는 549건 전부 규칙을 지켜 유일하게 결측 없는 연도 소스다.
const 지중no연도 = /^[A-Za-z]{2}(\d{2})-/

export function 연도추출(지중no: string): number | null {
  const m = 지중no연도.exec(지중no ?? '')
  return m ? 2000 + parseInt(m[1], 10) : null
}

export function 유형상태집계(수주목록: 수주도넛입력[]): 연도DonutRow[] {
  const acc = new Map<string, 연도DonutRow>()
  for (const r of 수주목록) {
    const 원유형 = r.공사구분 ?? '미분류'
    const 유형 = 유형병합[원유형] ?? 원유형
    // 준공여부=true면 시공상태와 무관하게 완료 — 준공여부가 실제 플로우(수주대장 필터·준공검사)가
    // 쓰는 컬럼이라 더 신뢰. 이관 데이터의 시공상태 NULL 199건 중 42건이 이걸로 완료로 흡수된다.
    const 상태 = r.준공여부 ? '완료' : (상태라벨[r.시공상태 ?? ''] ?? '미분류')
    // 금액 = 수주대장과 같은 관대 하도적용(요율 없으면 공급가 폴백) → 합계가 수주대장과 일치
    const 금액 = calc하도적용표시금액(r.수주금액_공급가, r.보험료율, r.하도전용율)
    const 연도: 연도 = 연도추출(r.지중no) ?? 연도미상
    const key = `${연도}-${유형}-${상태}`
    const prev = acc.get(key)
    if (prev) {
      prev.금액 += 금액
      prev.건수 += 1
    } else {
      acc.set(key, { 연도, 유형, 상태, 금액, 건수: 1 })
    }
  }
  return [...acc.values()]
}

// 드롭다운에 띄울 연도 — 최신 연도가 위, 연도미상은 (있을 때만) 맨 뒤.
export function 연도목록(rows: 연도DonutRow[]): 연도[] {
  const 연도들 = [...new Set(rows.map((r) => r.연도))]
  const 숫자 = 연도들.filter((y): y is number => typeof y === 'number').sort((a, b) => b - a)
  return 연도들.includes(연도미상) ? [...숫자, 연도미상] : 숫자
}

// 선택된 연도만 남기고 유형×상태로 재합산 → 렌더가 쓰던 DonutRow[] 모양 그대로 돌려준다.
// '전체'는 연도를 키에서 빼고 합치므로 전체 금액 = 각 연도 금액의 합이 항상 성립.
export function 연도필터(rows: 연도DonutRow[], 선택: 연도선택): DonutRow[] {
  const 대상 = 선택 === '전체' ? rows : rows.filter((r) => r.연도 === 선택)
  const acc = new Map<string, DonutRow>()
  for (const { 유형, 상태, 금액, 건수 } of 대상) {
    const key = `${유형}-${상태}`
    const prev = acc.get(key)
    if (prev) {
      prev.금액 += 금액
      prev.건수 += 건수
    } else {
      acc.set(key, { 유형, 상태, 금액, 건수 })
    }
  }
  return [...acc.values()]
}

// 처음 열 때 보여줄 연도 — 올해 수주가 있으면 올해, 아직 없으면 최신 연도(빈 도넛 방지).
export function 기본연도(rows: 연도DonutRow[], 올해: number): 연도선택 {
  const 목록 = 연도목록(rows)
  if (목록.includes(올해)) return 올해
  return 목록[0] ?? '전체'
}
