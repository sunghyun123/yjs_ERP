// 유형별 프로젝트 현황 도넛의 데이터 로직 — 렌더와 분리해 단위 테스트 가능하게 유지.
// 파이프라인: 공사행변환(서버, 공사 1건=1행) → 연도필터(클라) → 유형상태집계(클라, 렌더 중 파생).
// 공사 단위 행을 그대로 내려보내는 이유: 조각 클릭 팝업(공사 목록)이 원본 행을 요구하고,
// 도넛 합계와 팝업 목록이 같은 원본에서 파생돼야 어긋날 수 없다.

import { calc하도적용표시금액 } from '../orders/_lib/completion'

// 상태 규칙(2026-07-15 재정의): 준공여부=true → 완료, 공사이력 1건 이상 → 진행중, 0건 → 미진행.
// 시공상태 컬럼은 더 이상 안 본다 — 이관 데이터에서 NULL이 많아 미분류를 부풀리던 원인.
// 수주만 하고 공사는 나중에 하는 게 정상 흐름이라 이력 없음의 디폴트는 미분류가 아니라 '미진행'.
// (미분류는 상태 축에서 소멸 — 유형 축에는 공사구분 NULL용으로 남는다.)
// '완료'는 준공 기준이지 달성률 100% 기준이 아니다. 준공+이력 0건도 완료(하루짜리 공사가 흔함).
export type 상태 = '완료' | '진행중' | '미진행'
export type DonutRow = { 유형: string; 상태: 상태; 금액: number; 건수: number }

// 지중no에서 연도를 못 읽은 행이 모이는 자리. 조용히 버리면 "전체 ≠ 연도별 합"이 되므로
// 하나의 선택지로 노출해 티가 나게 한다.
export const 연도미상 = '연도미상'
export type 연도 = number | typeof 연도미상
export type 연도선택 = 연도 | '전체'

// 공사 1건 = 1행. 서버가 만들어 내려주고, 클라는 이걸로 도넛 집계와 클릭 팝업 목록을 모두 파생한다.
export type 공사도넛행 = {
  지중no: string
  공사명: string
  유형: string
  상태: 상태
  연도: 연도
  금액: number
}

// 수주 테이블에서 도넛에 필요한 컬럼만 (select 목록과 1:1).
// 이력건수는 공사이력(count) 임베드에서 서버가 풀어서 넣는다.
export type 수주도넛입력 = {
  지중no: string
  공사명: string
  공사구분: string | null
  준공여부: boolean
  이력건수: number
  수주금액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}

// 관급은 건수가 적어 민수에 합산 표시 (사장님 피드백 2026-07-09)
const 유형병합: Record<string, string> = { 관급: '민수' }

// 지중no 명명 규칙: 영문 2글자 + 2자리 연도 + '-' + 일련번호 (예: JY25-018 → 2025)
// 수주 테이블엔 수주일/계약일 컬럼이 없고, 착공일은 45%가 NULL(그중 대부분이 완료 건)이라
// 연도로 쓸 수 없다. 지중no는 549건 전부 규칙을 지켜 유일하게 결측 없는 연도 소스다.
const 지중no연도 = /^[A-Za-z]{2}(\d{2})-/

export function 연도추출(지중no: string): number | null {
  const m = 지중no연도.exec(지중no ?? '')
  return m ? 2000 + parseInt(m[1], 10) : null
}

export function 공사행변환(수주목록: 수주도넛입력[]): 공사도넛행[] {
  return 수주목록.map((r) => {
    const 원유형 = r.공사구분 ?? '미분류'
    return {
      지중no: r.지중no,
      공사명: r.공사명,
      유형: 유형병합[원유형] ?? 원유형,
      // 준공이 이력 존재보다 우선 — 준공된 공사는 이력이 있든 없든 완료다.
      상태: r.준공여부 ? '완료' : r.이력건수 > 0 ? '진행중' : '미진행',
      연도: 연도추출(r.지중no) ?? 연도미상,
      // 금액 = 수주대장과 같은 관대 하도적용(요율 없으면 공급가 폴백) → 합계가 수주대장과 일치
      금액: calc하도적용표시금액(r.수주금액_공급가, r.보험료율, r.하도전용율),
    }
  })
}

// 드롭다운에 띄울 연도 — 최신 연도가 위, 연도미상은 (있을 때만) 맨 뒤.
export function 연도목록(rows: { 연도: 연도 }[]): 연도[] {
  const 연도들 = [...new Set(rows.map((r) => r.연도))]
  const 숫자 = 연도들.filter((y): y is number => typeof y === 'number').sort((a, b) => b - a)
  return 연도들.includes(연도미상) ? [...숫자, 연도미상] : 숫자
}

// 선택된 연도의 공사 행만 남긴다. '전체'는 그대로 — 행을 잃지 않으므로
// 전체 금액 = 각 연도 금액의 합이 항상 성립.
export function 연도필터(rows: 공사도넛행[], 선택: 연도선택): 공사도넛행[] {
  return 선택 === '전체' ? rows : rows.filter((r) => r.연도 === 선택)
}

// 공사 행을 유형×상태로 합산 → 도넛 조각. 렌더 중 파생으로만 쓰고 저장하지 않는다.
export function 유형상태집계(rows: 공사도넛행[]): DonutRow[] {
  const acc = new Map<string, DonutRow>()
  for (const { 유형, 상태, 금액 } of rows) {
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

// 처음 열 때 보여줄 연도 — 올해 수주가 있으면 올해, 아직 없으면 최신 연도(빈 도넛 방지).
export function 기본연도(rows: { 연도: 연도 }[], 올해: number): 연도선택 {
  const 목록 = 연도목록(rows)
  if (목록.includes(올해)) return 올해
  return 목록[0] ?? '전체'
}
