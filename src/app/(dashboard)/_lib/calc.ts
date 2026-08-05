import type { 공사단가Row, 투입실적Row, 투입실적상세Row } from '@/types/database'

export type 투입상세수량 = Pick<투입실적상세Row, '투입구분' | '주간수량' | '야간수량'>
export type 투입실적With상세 = 투입실적Row & {
  투입실적상세?: 투입상세수량[] | null
}

type 단가 = { 주간단가: number; 야간단가: number }

export const 재료비투입구분 = '재료비/인'

export const 레거시투입컬럼 = [
  { 투입구분: '상용직', 주: '상용직_주', 야: '상용직_야' },
  { 투입구분: '일용직', 주: '일용직_주', 야: '일용직_야' },
  { 투입구분: '모범신호수', 주: '모범신호수_주', 야: '모범신호수_야' },
  { 투입구분: '6W', 주: 'w6_주', 야: 'w6_야' },
  { 투입구분: '3W', 주: 'w3_주', 야: 'w3_야' },
  { 투입구분: '덤프15T', 주: '덤프15t_주', 야: '덤프15t_야' },
  { 투입구분: '크레인', 주: '크레인_주', 야: '크레인_야' },
  { 투입구분: '물청소차', 주: '물청소차_주', 야: '물청소차_야' },
  { 투입구분: 'MCM', 주: 'mcm_주', 야: 'mcm_야' },
  { 투입구분: '접속', 주: '접속_주', 야: '접속_야' },
] as const

const 기본투입구분순서: string[] = 레거시투입컬럼.map((row) => row.투입구분)

function n(v: unknown): number {
  const num = Number(v)
  return Number.isFinite(num) ? num : 0
}

export function get단가(
  단가목록: 공사단가Row[],
  투입구분: string,
  투입일: string,
): 단가 {
  const applicable = 단가목록
    .filter((d) => d.투입구분 === 투입구분 && d.적용시작일 <= 투입일)
    .sort((a, b) => {
      const byDate = b.적용시작일.localeCompare(a.적용시작일)
      return byDate !== 0 ? byDate : b.id - a.id
    })

  if (applicable.length === 0) return { 주간단가: 0, 야간단가: 0 }
  const d = applicable[0]
  return { 주간단가: d.주간단가, 야간단가: d.야간단가 ?? 0 }
}

export function get동적투입구분목록(단가목록: 공사단가Row[]): string[] {
  const seen = new Set<string>()
  const latest = [...단가목록].sort((a, b) => {
    const byDate = b.적용시작일.localeCompare(a.적용시작일)
    return byDate !== 0 ? byDate : b.id - a.id
  })

  for (const row of latest) {
    if (row.투입구분 === 재료비투입구분) continue
    if (!seen.has(row.투입구분)) seen.add(row.투입구분)
  }

  return [...seen].sort((a, b) => {
    const ai = 기본투입구분순서.indexOf(a)
    const bi = 기본투입구분순서.indexOf(b)
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }
    return a.localeCompare(b, 'ko')
  })
}

export function legacyRowTo상세(row: 투입실적Row): 투입상세수량[] {
  return 레거시투입컬럼.map(({ 투입구분, 주, 야 }) => ({
    투입구분,
    주간수량: n(row[주]),
    야간수량: n(row[야]),
  }))
}

export function merge상세목록(
  투입구분목록: string[],
  상세목록: 투입상세수량[] | null | undefined,
): 투입상세수량[] {
  const map = new Map((상세목록 ?? []).map((row) => [row.투입구분, row]))
  return 투입구분목록.map((투입구분) => ({
    투입구분,
    주간수량: n(map.get(투입구분)?.주간수량),
    야간수량: n(map.get(투입구분)?.야간수량),
  }))
}

export function 상세목록ToLegacyUpdate(상세목록: 투입상세수량[]) {
  const byName = new Map(상세목록.map((row) => [row.투입구분, row]))
  const 상용직 = byName.get('상용직')
  const payload: Record<string, number> = {}

  for (const { 투입구분, 주, 야 } of 레거시투입컬럼) {
    const row = byName.get(투입구분)
    payload[주] = n(row?.주간수량)
    payload[야] = n(row?.야간수량)
  }

  payload.재료비인_주 = n(상용직?.주간수량)
  payload.재료비인_야 = n(상용직?.야간수량)
  return payload
}

export const 일반관리비율 = 0.06

// 일반관리비가 붙지 않는 사외 지출.
// 외주는 영전사가 시공하지 않고, 기타재료비는 입력한 값을 그대로 쓴다.
export type 사외금액입력 = Pick<투입실적Row, '외주1' | '외주2' | '기타재료비'>

export function calc사외금액(row: 사외금액입력): number {
  return n(row.외주1) + n(row.외주2) + n(row.기타재료비)
}

// 일반관리비 6%가 붙는 사내(영전사) 투입금액 = 투입구분별 수량×단가 + 재료비.
export function calc사내투입금액(
  투입일: string,
  상세목록: 투입상세수량[],
  단가목록: 공사단가Row[],
): number {
  let 직접노무비 = 0
  const 상용직 = 상세목록.find((detail) => detail.투입구분 === '상용직')

  for (const detail of 상세목록) {
    if (detail.투입구분 === 재료비투입구분) continue
    const 단가 = get단가(단가목록, detail.투입구분, 투입일)
    직접노무비 += n(detail.주간수량) * 단가.주간단가
    직접노무비 += n(detail.야간수량) * 단가.야간단가
  }

  const 재료비단가 = get단가(단가목록, 재료비투입구분, 투입일)
  const 재료비 = (n(상용직?.주간수량) + n(상용직?.야간수량)) * 재료비단가.주간단가

  return 직접노무비 + 재료비
}

export function calc일반관리비상세(
  투입일: string,
  상세목록: 투입상세수량[],
  단가목록: 공사단가Row[],
): number {
  return Math.round(calc사내투입금액(투입일, 상세목록, 단가목록) * 일반관리비율)
}

// 투입금액 = 사내 + 사외 (일반관리비 제외한 실제 지출액)
export function calc투입금액상세(
  row: Pick<투입실적Row, '투입일'> & 사외금액입력,
  상세목록: 투입상세수량[],
  단가목록: 공사단가Row[],
): number {
  return calc사내투입금액(row.투입일, 상세목록, 단가목록) + calc사외금액(row)
}

// 합계 = 사내 + 사내×6% + 사외.
// 소비자(수주대장·매출손익·홈KPI·대시보드 프로듀서)가 전부 이 함수를 거치므로
// 관리비 공식은 여기 한 곳에만 산다.
export function calc합계상세(
  row: Pick<투입실적Row, '투입일'> & 사외금액입력,
  상세목록: 투입상세수량[],
  단가목록: 공사단가Row[],
): number {
  return calc투입금액상세(row, 상세목록, 단가목록)
    + calc일반관리비상세(row.투입일, 상세목록, 단가목록)
}

function row상세(row: 투입실적With상세): 투입상세수량[] {
  return row.투입실적상세?.length ? row.투입실적상세 : legacyRowTo상세(row)
}

export function calc투입금액(row: 투입실적With상세, 단가목록: 공사단가Row[]): number {
  return calc투입금액상세(row, row상세(row), 단가목록)
}

export function calc합계(row: 투입실적With상세, 단가목록: 공사단가Row[]): number {
  return calc합계상세(row, row상세(row), 단가목록)
}
