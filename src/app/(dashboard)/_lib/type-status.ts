// 유형별 프로젝트 현황 도넛의 데이터 로직 — 렌더와 분리해 단위 테스트 가능하게 유지.
// 파이프라인: 공사행변환(서버, 공사 1건=1행) → 연도필터(클라) → 유형상태집계(클라, 렌더 중 파생).
// 공사 단위 행을 그대로 내려보내는 이유: 조각 클릭 팝업(공사 목록)이 원본 행을 요구하고,
// 도넛 합계와 팝업 목록이 같은 원본에서 파생돼야 어긋날 수 없다.
// 연도·상태·유형 판정 규칙은 수주대장과 공유한다 → ./수주분류.ts (정본)

import { calc하도적용표시금액 } from '../orders/_lib/completion'
import {
  공사구분정규화,
  공사상태,
  연도미상,
  연도목록,
  연도추출,
  type 상태,
  type 연도,
  type 연도선택,
} from './수주분류'

export type DonutRow = { 유형: string; 상태: 상태; 금액: number; 건수: number }

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

export function 공사행변환(수주목록: 수주도넛입력[]): 공사도넛행[] {
  return 수주목록.map((r) => ({
    지중no: r.지중no,
    공사명: r.공사명,
    유형: 공사구분정규화(r.공사구분),
    상태: 공사상태(r.준공여부, r.이력건수),
    연도: 연도추출(r.지중no) ?? 연도미상,
    // 금액 = 수주대장과 같은 관대 하도적용(요율 없으면 공급가 폴백) → 합계가 수주대장과 일치
    금액: calc하도적용표시금액(r.수주금액_공급가, r.보험료율, r.하도전용율),
  }))
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
