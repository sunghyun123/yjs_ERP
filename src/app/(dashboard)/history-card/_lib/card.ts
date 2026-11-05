import { calc하도적용금액 } from '@/app/(dashboard)/orders/_lib/completion'
import { find기존수주, 조회가능, type 수주후보 } from './공사번호'
import { suggest지중no } from './번호'
import type { 추출결과 } from './extract'

export type 카드입력 = {
  추출: 추출결과
  규칙: { 머리글자: string; 거래처_id: number | null }
  /** 규칙에 연결된 거래처의 요율. 거래처가 없으면 null */
  거래처요율: { 보험료제외율: number | null; 하도전용율: number | null } | null
  수주목록: 수주후보[]
}

export type 카드결과 = {
  text: string
  warnings: string[]
  번호상태: '기존' | '제안' | '확인 필요'
  /** 같은 공사번호의 수주가 2건 이상일 때 그 지중no들 */
  후보: string[]
}

const 확인필요 = '확인 필요'

/** 천원 버림 (게이트1 결정). 원 단위로 먼저 반올림해 부동소수 오차(…999.9999)가 1천원을 깎지 않게 한다. */
export function 천원버림(원: number): string {
  const 천원 = Math.floor(Math.round(원) / 1000)
  return `${new Intl.NumberFormat('ko-KR').format(천원)}천원`
}

/** 'YYYY-MM-DD' → 'YY.MM.DD'. 문자열만 다룬다 — new Date()를 안 써서 타임존 창이 생길 자리가 없다. */
export function toYYMMDD(날짜: string | null): string | null {
  const m = 날짜 ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(날짜) : null
  return m ? `${m[1].slice(2)}.${m[2]}.${m[3]}` : null
}

// AI가 준 글자에 탭·줄바꿈이 섞이면 씽크와이즈 가지 구조가 깨진다
function 한줄(s: string | null): string | null {
  if (s == null) return null
  const t = s.replace(/[\t\r\n]+/g, ' ').trim()
  return t === '' ? null : t
}

const 금액표시 = (원: number | null) => (원 == null ? 확인필요 : 천원버림(원))

export function build카드(입력: 카드입력): 카드결과 {
  const { 추출, 규칙, 거래처요율, 수주목록 } = 입력
  // 경고 = 카드에서는 멀쩡해 보이는데 틀렸을 수 있는 것만 (사용자 결정 2026-11-05).
  // 읽지 못한 칸은 카드에 '확인 필요'로 이미 보이므로 경고를 따로 띄우지 않는다.
  const warnings: string[] = []

  // 검산: 숫자 셋 중 하나가 틀린 것만 잡는다(셋이 같이 틀리면 못 잡는다 — 화면에 '통보서와 대조' 상시 표시)
  const { 공급가액, 부가가치세, 계약금액 } = 추출
  // 숫자가 찍혀 있으면 사람은 맞다고 믿는다 — 잘못 읽은 금액의 유일한 신호라 남긴다
  if (공급가액 != null && 부가가치세 != null && 계약금액 != null && 공급가액 + 부가가치세 !== 계약금액) {
    warnings.push('통보서 금액을 다시 확인하세요 (공급가 + 부가세 ≠ 계약금액).')
  }

  const 기존 = find기존수주(추출.공사번호, 수주목록)
  let 번호: string | null
  let 번호상태: 카드결과['번호상태']
  let 공사명: string | null
  let 공급가: number | null
  let 영전사: number | null

  if (기존.length === 1) {
    const r = 기존[0]
    번호 = r.지중no
    번호상태 = '기존'
    공사명 = r.공사명
    // 공급가는 통보서 금액 (사용자 결정 2026-11-05) — 이 칸은 '시공통보서 접수' 아래라 접수 당시 금액을 남긴다.
    // ERP 수주금액은 변경계약 등으로 나중에 바뀔 수 있다(금성 건: 통보서 49,302천원 / ERP 60,355천원).
    공급가 = 공급가액
    // 요율은 그 수주의 것 — 거래처 기본값보다 그 공사에 맞다.
    // 공식을 새로 쓰지 않는다 — 수주대장과 같은 함수(엄격판: 요율이 하나라도 없으면 null)
    영전사 = calc하도적용금액(공급가, r.보험료율, r.하도전용율)
    if (r.원청사_id != null && 규칙.거래처_id != null && r.원청사_id !== 규칙.거래처_id) {
      warnings.push(`ERP의 ${r.지중no} 원청사가 고른 머리글자(${규칙.머리글자})의 거래처와 다릅니다. 머리글자를 확인하세요.`)
    }
  } else {
    if (기존.length >= 2) {
      번호 = null
      번호상태 = '확인 필요'
      warnings.push(`같은 공사번호의 수주가 ${기존.length}건 있습니다: ${기존.map(r => r.지중no).join(', ')}. 번호를 직접 고르세요.`)
    } else if (!조회가능(추출.공사번호)) {
      // 조회를 못 했는데 새 번호를 제안하면 이미 있는 공사에 번호가 하나 더 생긴다
      번호 = null
      번호상태 = '확인 필요'
    } else {
      번호 = 추출.시공통보일자 ? suggest지중no(규칙.머리글자, 추출.시공통보일자, 수주목록.map(r => r.지중no)) : null
      번호상태 = 번호 ? '제안' : '확인 필요'
    }
    공사명 = 추출.공사명
    공급가 = 공급가액
    영전사 = calc하도적용금액(공급가, 거래처요율?.보험료제외율 ?? null, 거래처요율?.하도전용율 ?? null)
  }

  const 날짜 = toYYMMDD(추출.시공통보일자)
  const 초안 = 추출.공사시행초안.map(한줄).filter((s): s is string => s !== null)

  const lines = [
    `${번호 ?? 확인필요}. ${한줄(공사명) ?? 확인필요}`,
    '\t접수',
    `\t\t${날짜 ?? 확인필요} 시공통보서 접수`,
    '\t\t공급가액',
    `\t\t\t${금액표시(공급가)}`,
    '\t\t영전사금액',
    `\t\t\t${금액표시(영전사)}`,
    '\t진행사항',
    '\t공사시행',
    ...(초안.length > 0 ? ['\t\t(AI 초안)', ...초안.map(s => `\t\t${s}`)] : []),
    '\t향후계획',
  ]

  return { text: lines.join('\n'), warnings, 번호상태, 후보: 기존.length >= 2 ? 기존.map(r => r.지중no) : [] }
}
