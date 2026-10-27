/**
 * ERP MCP 라우트(/api/mcp/*)의 키 검사·입력 해석·응답 모양 — DB를 모르는 순수 함수.
 *
 * 여기서는 손익을 새로 계산하지 않는다. _lib/공사별손익의 결과에서 기간을 고르고
 * 반올림해 모양만 바꾼다. 세기(건수)와 더하기(합계)는 서버가 해서 같이 준다 —
 * 행이 수백 개면 Claude가 직접 세거나 더하다 틀리고, 틀려도 그럴듯한 숫자로 나온다.
 */
import type { 공사별손익결과 } from '@/app/(dashboard)/_lib/공사별손익'

/**
 * 유일한 문지기. 이 라우트들은 service_role로 RLS를 우회하므로 이 비교가 전부다.
 * 대시보드 키(DASHBOARD_API_KEY)와 분리한 이유: 이 키는 사장님 PC 확장 설정에 저장된다.
 * 거기서 새도 열리는 건 /api/mcp/* 뿐이다.
 */
export function mcp인증(
  authorization: string | null,
  apiKey: string | undefined,
): { status: 401 | 500; error: string } | null {
  if (!apiKey) return { status: 500, error: 'Server misconfiguration' }
  if (authorization !== `Bearer ${apiKey}`) return { status: 401, error: 'Unauthorized' }
  return null
}

export type 해석<T> = { ok: true; value: T } | { ok: false; error: string }
/** 서버가 partsKST()로 정한 지금 — 'current'는 이것으로만 해석한다 */
export type 지금 = { year: number; month: number }

const MIN_YEAR = 2000
const MAX_YEAR = 2100

function 연도해석(raw: string, 지금: 지금, 이름: string): 해석<number> {
  if (raw === 'current') return { ok: true, value: 지금.year }
  if (!/^\d{4}$/.test(raw)) {
    return { ok: false, error: `${이름}는 4자리 연도 또는 'current'여야 합니다: ${raw}` }
  }
  const y = Number(raw)
  if (y < MIN_YEAR || y > MAX_YEAR) {
    return { ok: false, error: `${이름}는 ${MIN_YEAR}~${MAX_YEAR} 사이여야 합니다: ${raw}` }
  }
  return { ok: true, value: y }
}

/**
 * year: 없으면(파라미터 자체가 없으면) 올해. 빈 문자열('')은 없음이 아니라 잘못된 값이라 거절한다.
 * 매출손익 화면과 달리 잘못된 값을 올해로 바꾸지 않고 거절한다(→ 400).
 * "2025년"을 물었는데 2026년 숫자를 받아 2025년이라고 답하는 사고를 막는다.
 */
export function parse연도(raw: string | null, 지금: 지금): 해석<number> {
  if (raw === null) return { ok: true, value: 지금.year }
  return 연도해석(raw, 지금, 'year')
}

/** month: 없으면(파라미터 없음) null(연간). 'current' 또는 1~12. 빈 문자열은 거절. */
export function parse월(raw: string | null, 지금: 지금): 해석<number | null> {
  if (raw === null) return { ok: true, value: null }
  if (raw === 'current') return { ok: true, value: 지금.month }
  const m = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN
  if (!(m >= 1 && m <= 12)) {
    return { ok: false, error: `month는 1~12 또는 'current'여야 합니다: ${raw}` }
  }
  return { ok: true, value: m }
}

/** completed_year: 없으면(파라미터 없음) null(준공 필터 없음). 빈 문자열은 거절. */
export function parse준공연도(raw: string | null, 지금: 지금): 해석<number | null> {
  if (raw === null) return { ok: true, value: null }
  return 연도해석(raw, 지금, 'completed_year')
}

export type 손익행 = {
  지중no: string
  공사명: string
  성과: number
  투입: number
  손익: number
  /** 그 기간 성과 중 준공 잔여분으로 얹힌 금액(성과에 이미 포함). 없으면 칸 자체가 없다 */
  준공반영액?: number
}

export type 손익응답 = {
  기준: { 연도: number; 월: number | null }
  단위: '원'
  합계: { 성과: number; 투입: number; 손익: number }
  건수: { 플러스: number; 마이너스: number; 영: number }
  공사: 손익행[]
  제외: { '성과·투입 모두 0인 공사': number }
}

export function build손익응답(결과: 공사별손익결과, 연도: number, 월: number | null): 손익응답 {
  const 월idx = 월 === null ? null : 월 - 1
  const 공사: 손익행[] = []
  let 제외 = 0

  for (const r of 결과.pivotData) {
    const 성과 = 월idx === null ? r.성과금액 : r.monthly[월idx].성과
    const 투입 = 월idx === null ? r.투입금액 : r.monthly[월idx].투입
    // 준공.월은 0-based. 월을 골랐으면 그 달에 얹힌 준공만 보인다
    const 준공반영액 =
      r.준공 && (월idx === null || r.준공.월 === 월idx) ? r.준공.금액 : undefined

    // 그 기간 움직임이 없는 공사는 0원 행만 늘린다 — 빼되 몇 건 뺐는지는 남긴다
    if (성과 === 0 && 투입 === 0 && 준공반영액 === undefined) {
      제외 += 1
      continue
    }

    // 반올림은 성과·투입에 먼저 하고 손익은 반올림된 값끼리 뺀다 — 읽는 쪽이 LLM이라
    // 행마다 성과−투입을 다시 검산할 수 있고, 원 단위 오차 때문에 안 맞으면 숫자 전체를 의심한다
    const 성과r = Math.round(성과)
    const 투입r = Math.round(투입)
    const 행: 손익행 = {
      지중no: r.지중no,
      공사명: r.공사명,
      성과: 성과r,
      투입: 투입r,
      손익: 성과r - 투입r,
    }
    if (준공반영액 !== undefined) 행.준공반영액 = Math.round(준공반영액)
    공사.push(행)
  }

  // 플러스 공사가 위, 마이너스 공사가 아래로 모인다
  공사.sort((a, b) => b.손익 - a.손익 || a.지중no.localeCompare(b.지중no, 'ko'))

  // 합계는 행 목록이 아니라 월별 합계에서 낸다 → 제외된 공사까지 포함하고,
  // 매출손익 화면 KPI·차트와 같은 원천이라 화면 숫자와 같아야 한다
  const 기간 = 월idx === null ? 결과.monthly : [결과.monthly[월idx]]
  const 성과합 = 기간.reduce((s, m) => s + m.성과, 0)
  const 투입합 = 기간.reduce((s, m) => s + m.투입, 0)

  // 합계도 같은 이유로 반올림된 성과·투입에서 손익을 낸다
  const 합계성과 = Math.round(성과합)
  const 합계투입 = Math.round(투입합)

  return {
    기준: { 연도, 월 },
    단위: '원',
    합계: { 성과: 합계성과, 투입: 합계투입, 손익: 합계성과 - 합계투입 },
    // 포함된 행(공사)의 부호별 개수 — LLM이 행을 직접 세다 틀리지 않게 서버가 센다
    건수: {
      플러스: 공사.filter((p) => p.손익 > 0).length,
      마이너스: 공사.filter((p) => p.손익 < 0).length,
      영: 공사.filter((p) => p.손익 === 0).length,
    },
    공사,
    제외: { '성과·투입 모두 0인 공사': 제외 },
  }
}

export type 공사목록행 = {
  지중no: string
  공사명: string
  준공여부: boolean
  준공일: string | null
}

export type 공사목록응답 = {
  기준: { 준공연도?: number }
  건수: number
  공사: 공사목록행[]
  제외?: { '준공됐지만 준공일 없음': number }
}

/**
 * '완결' = 준공여부 true (수주대장 '준공완료' 필터·도넛 '완료'와 같은 판정).
 * 연도는 준공일 문자열 앞 4자리로 본다 — new Date()를 쓰면 서버 시계(UTC)가 날짜를 민다.
 */
export function build공사목록응답(rows: 공사목록행[], 준공연도: number | null): 공사목록응답 {
  // 수주 전체가 0건이면 '공사가 없다'가 아니라 조회가 깨진 것 — 빈 목록을 정상처럼 내보내지 않는다
  if (rows.length === 0) throw new Error('수주 목록이 비어 있습니다. 조회가 정상이 아닙니다.')
  if (준공연도 === null) return { 기준: {}, 건수: rows.length, 공사: rows }
  const 접두 = `${준공연도}-`
  const 공사 = rows.filter((r) => r.준공여부 && r.준공일 !== null && r.준공일.startsWith(접두))
  // 준공일이 없는 준공 건은 어느 해에도 셀 수 없다 — 0건처럼 숨기지 않고 건수를 남긴다(구ERP 이관분 등)
  const 일없음 = rows.filter((r) => r.준공여부 && r.준공일 === null).length
  return {
    기준: { 준공연도 },
    건수: 공사.length,
    공사,
    제외: { '준공됐지만 준공일 없음': 일없음 },
  }
}
