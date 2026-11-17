/**
 * 입력 자동배분 — 미입력 공사이력을 투입실적의 마지막 투입일로 채운다 (2026-11-17, 1회성)
 *
 * 규칙: 준공 공사마다 남은 금액(하도 기준 준공액 − 공사이력 누계 ≥ 1,000원)을
 *       **준공일 이전(당일 포함) 마지막 투입일**에 1행으로 넣는다.
 * 왜 투입실적인가: 날짜는 사장님이 목격한 사건(그날 나갔다)이어야 하고, 금액은 작업일지도 원래 추정이다.
 *   운영 실측 87%의 이력 날짜가 이미 투입일과 같았다.
 * 왜 마지막 투입일인가: 남은 공사는 마지막으로 나간 날 끝났다고 보는 게 자연스럽다(조성현).
 *   대가: 떨어져 있는 마지막 투입일로 앞 달 공사분이 몰린다.
 *
 * '남은 금액' 판정은 미입력.ts build미입력목록과 같은 규칙의 두 번째 사본이다
 * (그 파일은 런타임에 '@/' import가 있어 ts-node 스크립트가 못 부른다).
 * 두 사본이 같은 답을 내는지는 자동배분.test.ts 마지막 테스트가 묶는다.
 *
 * 그날 이미 이력 행이 있으면(운영 DB 유일 제약 공사이력_수주_id_작업일자_key — 공사 1건 하루 1행,
 * 레포 마이그레이션에는 없고 운영 DB에만 있다) 새 행 대신 그 행에 금액을 더한다(2026-11-17 (가)안).
 * 첫 apply가 이 제약에 걸려 48행 전부 취소된 뒤 정했다.
 *
 * DB에 쓰지 않는다. 쓰기는 scripts/backfill-이력-투입실적.ts.
 * '@/' 경로 금지 — ts-node가 이 파일을 상대경로로 import한다.
 */
import { calc하도적용표시금액 } from '../../orders/_lib/completion'

/** 자동으로 만든 행의 작업내용 — 찾기·되돌리기·두 번 실행 방지의 열쇠 */
export const 자동배분표시 = '투입실적 자동배분'

/** 미입력 목록의 '다 입력함' 폭과 같아야 한다(미입력.ts 완료폭) */
const 완료폭 = 1_000

export type 배분수주Row = {
  id: number
  지중no: string
  공사명: string
  준공여부: boolean
  준공일: string | null
  준공액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}
export type 배분이력Row = {
  id: number
  수주_id: number
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
  작업내용: string | null
}
export type 투입일Row = { 수주_id: number; 투입일: string }

/** 금액을 더할 기존 행 — 적용 전 값을 그대로 담아 미리보기 대조·되돌리기에 쓴다 */
export type 합칠행 = { id: number; 성과금액: number | null; 작업내용: string | null }

export type 배분행 = {
  수주_id: number
  지중no: string
  작업일자: string
  /** 이번에 더하는 금액(= 남은 금액) */
  성과금액: number
  /** DB에 저장될 성과금액 — 새 행이면 성과금액, 합칠 행이면 기존 + 성과금액 */
  저장성과금액: number
  담당공무_id: number | null
  /** DB에 저장될 작업내용 — 새 행이면 표시, 합칠 행이면 기존 내용 뒤에 표시 + 금액 */
  작업내용: string
  합칠행: 합칠행 | null
}
export type 보류사유 = '투입실적 없음' | '준공일 이전 투입 없음' | '이미 자동배분됨'
export type 보류행 = { 수주_id: number; 지중no: string; 남은금액: number; 사유: 보류사유 }

/** 1234567 → '1,234,567' (로캘에 기대지 않는다 — 미리보기와 apply가 같은 글자를 내야 대조가 맞다) */
const 콤마 = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export function build자동배분(
  수주목록: 배분수주Row[],
  이력: 배분이력Row[],
  투입: 투입일Row[],
): { 배분: 배분행[]; 보류: 보류행[] } {
  const 이력by = new Map<number, 배분이력Row[]>()
  for (const r of 이력) (이력by.get(r.수주_id) ?? 이력by.set(r.수주_id, []).get(r.수주_id)!).push(r)
  const 투입by = new Map<number, Set<string>>()
  for (const r of 투입) (투입by.get(r.수주_id) ?? 투입by.set(r.수주_id, new Set()).get(r.수주_id)!).add(r.투입일)

  const 배분: 배분행[] = []
  const 보류: 보류행[] = []

  for (const o of 수주목록) {
    if (!o.준공여부 || !o.준공일 || o.준공액_공급가 == null) continue
    const 행들 = 이력by.get(o.id) ?? []
    const 목표 = calc하도적용표시금액(o.준공액_공급가, o.보험료율, o.하도전용율)
    const 남은 = 목표 - 행들.reduce((s, r) => s + (r.성과금액 ?? 0), 0)
    if (남은 < 완료폭) continue // 다 입력함(|남은| < 1,000) 또는 입력 초과(음수)
    const 남은금액 = Math.round(남은)
    const 기본 = { 수주_id: o.id, 지중no: o.지중no, 남은금액 }

    // 합친 행은 기존 작업내용 뒤에 표시가 붙으므로 '같다'가 아니라 '포함한다'로 본다
    if (행들.some((r) => r.작업내용?.includes(자동배분표시))) { 보류.push({ ...기본, 사유: '이미 자동배분됨' }); continue }
    const 투입일 = 투입by.get(o.id)
    if (!투입일 || 투입일.size === 0) { 보류.push({ ...기본, 사유: '투입실적 없음' }); continue }
    // 날짜는 'YYYY-MM-DD' 문자열 비교 — new Date()를 거치지 않는다(서버 시계 UTC 문제 회피)
    const 후보 = [...투입일].filter((d) => d <= o.준공일!).sort()
    if (후보.length === 0) { 보류.push({ ...기본, 사유: '준공일 이전 투입 없음' }); continue }

    // .at(-1) 대신 인덱스 — scripts/tsconfig.json 이 ES2020 이라 .at 이 타입 검사에 걸린다
    const 담당행 = 행들
      .filter((r) => r.담당공무_id != null)
      .sort((a, b) => a.작업일자.localeCompare(b.작업일자) || a.id - b.id)
    const 최근담당 = 담당행[담당행.length - 1]

    const 작업일자 = 후보[후보.length - 1]
    const 그날행 = 행들.find((r) => r.작업일자 === 작업일자) // 유일 제약이라 많아야 1행

    if (그날행) {
      const 기존내용 = 그날행.작업내용?.trim() ?? ''
      const 꼬리 = `${자동배분표시} +${콤마(남은금액)}원`
      배분.push({
        수주_id: o.id,
        지중no: o.지중no,
        작업일자,
        성과금액: 남은금액,
        저장성과금액: (그날행.성과금액 ?? 0) + 남은금액,
        담당공무_id: 그날행.담당공무_id, // 사람이 입력한 행의 담당은 건드리지 않는다
        작업내용: 기존내용 ? `${기존내용} / ${꼬리}` : 꼬리,
        합칠행: { id: 그날행.id, 성과금액: 그날행.성과금액, 작업내용: 그날행.작업내용 },
      })
      continue
    }

    배분.push({
      수주_id: o.id,
      지중no: o.지중no,
      작업일자,
      성과금액: 남은금액,
      저장성과금액: 남은금액,
      담당공무_id: 최근담당?.담당공무_id ?? null,
      작업내용: 자동배분표시,
      합칠행: null,
    })
  }

  배분.sort((a, b) => a.지중no.localeCompare(b.지중no))
  보류.sort((a, b) => a.지중no.localeCompare(b.지중no))
  return { 배분, 보류 }
}
