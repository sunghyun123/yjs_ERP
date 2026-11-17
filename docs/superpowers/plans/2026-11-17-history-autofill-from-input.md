# 입력 자동배분 — 투입실적의 마지막 투입일로 남은 공사이력 채우기 Implementation Plan

> **구현 결과 (2026-11-17):** 아래 Task 1·2의 코드는 계획 원안이다. 구현 중 운영 DB 유일 제약을 만나 '합치기' 경로가 추가됐다(게이트 1 표 마지막 행). 실제 코드는 `자동배분.ts`·`scripts/backfill-이력-투입실적.ts`가 정본. 적용: 48건 277,125,097원(새 행 8 · 합침 40), 진행 문서 §5.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **세션 규칙:** 먼저 `docs/superpowers/specs/2026-11-17-revenue-simplification-roadmap.md` 맨 위 "세션 규칙" 블록을 읽고 따른다. 이 계획은 진행 문서 §4의 **'입력' 단계 안에 들어간 자동화 단계**다(PR-C 아님).

**Goal:** 미입력 목록의 '남은 입력' 중 투입실적이 있는 공사(2026-11-17 기준 48건 2.77억)에 대해, 남은 금액을 **준공일 이전 마지막 투입일**에 공사이력 1행으로 넣는 1회성 스크립트를 만든다.

**Architecture:** 계산은 DB에 손대지 않는 순수 함수 `build자동배분`(vitest로 검증)이 하고, `scripts/backfill-이력-투입실적.ts`가 읽기 → 미리보기 JSON 저장(dry-run) → 사람이 승인한 미리보기와 다시 계산한 결과가 같은 행만 한 번의 insert로 쓴다(`--apply <미리보기>`). 자동으로 만든 행은 `작업내용 = '투입실적 자동배분'`으로 표시해 나중에 찾고 되돌릴 수 있게 한다.

**Tech Stack:** TypeScript, Supabase(service_role, 스크립트 전용), vitest, ts-node(`scripts/tsconfig.json`)

---

## 게이트 1 결정 (2026-11-17, 조성현)

| 항목 | 결정 | 근거 / 대가 |
|---|---|---|
| 방향 | **손입력 대신 투입실적으로 자동 채움** | 조성현: 작업일지 금액도 "대충 이 정도 했겠지"라는 추정이라 손입력이 정확도를 더해주지 않는다. 사장님 말씀("그날 나갔는데 이력이 없다")은 투입한 날 = 이력 날짜라는 뜻이다. 실측: 이력·투입이 둘 다 있는 공사 238건에서 이력 날짜 588개 중 **509개(87%)가 투입일과 같은 날** = 지금까지도 사실상 이 규칙으로 운영해 왔다. 진행 문서 §2 규칙은 **"날짜는 목격한 사건(투입), 금액은 처음부터 추정"**으로 다시 읽는다 |
| ① 날짜 정본 | **투입실적** (작업일지와 다르면 투입실적이 이긴다) | ERP에 남아 누구나 다시 확인할 수 있다 |
| ② 투입실적 없는 공사 | 자동배분 안 함 → 목록으로 조성현이 따로 확인 | 60건 1.81억(파일: `Documents/미입력_확인_2026-11-17/투입실적없는_미입력공사.csv`). '진짜 기록이 없음'과 '투입 입력 누락'을 사람이 가른다 |
| ③ 오늘 손입력 초과 10건 | 기존 입력 초과 47건과 묶어 **데이터 작업**으로 (이 단계 범위 밖) | 원인은 아래 '실측 근거' |
| ④ 단계 | PR-C 앞의 새 단계로 분리, PR-C 기획은 뒤로 | 끄는 조건이 아직 멀다 |
| 배분 날짜 | **준공일 이전 마지막 투입일 하루**에 1행 | 조성현: "남은 공사는 마지막으로 나간 날 끝났다고 보는 게 자연스러워서". 대가: 마지막 투입일이 떨어져 있는 공사는 앞 달 공사분이 그 달로 몰린다(예: JG26-022 투입 6/17·6/18·6/23·**8/31** → 남은 245만이 8월로). 받아들임 |
| 담당 공무 | **그 공사의 가장 최근 이력 행의 담당 복사**, 없으면 비움(미지정) | 4건이 비게 된다(대시보드 담당자 칸의 '미지정'으로 보임). 정산담당자는 정산 축이라 쓰지 않음 |
| 오늘 손입력 중 투입일과 날짜가 다른 16행 | **먼저 확인 후 결정** (이 단계 범위 밖) | 파일: `Documents/미입력_확인_2026-11-17/오늘입력_투입일과다른날짜.csv` |
| 실행 방식 | **1회성 스크립트**, dry-run → 미리보기 승인 → apply | 화면 버튼은 한 번 쓸 기능이 영구히 남고 RLS 범위가 커진다 |
| 그날 이미 이력 행이 있을 때 (구현 세션 추가) | **(가) 그 행에 금액을 더함** — 작업내용 끝에 `/ 투입실적 자동배분 +N원`, 담당은 그대로. 전부 upsert 한 번 | 운영 DB에 유일 제약 `공사이력_수주_id_작업일자_key`(공사 1건 하루 1행)가 있어 첫 apply가 48행 전부 취소됨. 레포 마이그레이션엔 이 제약이 없다. 대가: 사람이 입력한 행 40개를 고치므로 되돌리기가 delete가 아니라 원래 값 update |

---

## 실측 근거 (2026-11-17 운영 DB, select만 사용)

- 오늘 조성현 손입력: 이력 **119행**(공사 119건, 전부 2025년 준공분). 106건은 남은 금액 정확히 0원.
- 지금 미입력 목록: 남은 **109건 460,810,091원**(전부 2026 준공) · 입력 초과 **56건 −185,917,501원**(PR-B 배포일 47건 −113,646,776 → 오늘 손입력에서 10건 새로 생김, 1건은 해소).
  - 새 초과 원인: ㉮ 초과액 = 기존 누계와 원 단위까지 같음(JG25-040 −4,532만, JY25-099 −1,228만, JY25-020) — 기존 행보다 **앞 날짜**에 `%` 100을 넣어서 `%`의 "그 날짜까지 누적"이 뒤의 기존 행을 못 봄 ㉯ 오늘 전 0원인데 목표의 1.5~2.2배(JY25-075·083·094) — **`%` 모드의 100%는 수주금액 기준, 미입력 목표는 준공액 기준**(Claude가 "100% = 목표"라고 잘못 안내함) ㉰ 수천 원 반올림 3건, 준공액 0원 공사에 92.5만(MY26-011).
- 남은 109건의 갈래: 투입실적 있음 **49건 280,085,097원** / 없음 **60건 180,724,992원**.
- 투입실적 있는 49건의 원인: 이력 날짜는 투입일에 이미 있는데 금액이 수주 기준 100%에 못 미침 **42건 1.63억** · 이력 0행 **3건 1.15억** · 수주 기준 100%였는데 준공 때 증액 **4건 0.01억**. 투입일 수 중앙값 1일, 최대 7일, 2일 이상 14건.
- 규칙(준공일 이전 마지막 투입일)을 적용하면: **배분 48건 277,125,097원** · 보류 1건(MY26-006, 투입일이 전부 준공일 뒤) · 담당 없음 4건 · 준공일과 같은 달 3건 / 다른 달 45건.
- **매출 이동(달별, 매출손익 성과 기준):** 2025-12 +12.9만 · 2026-01 +84만 · 02 +761만 · 03 +111만 · 04 −88만 · 05 +102만 · **06 +9,219만 · 07 +4,886만** · 08 +97만 · **09 −4,794만 · 10 −1억 145만** · 11 −247만. **해 사이 이동은 2025 → +129,437원뿐**이고 매출 총액은 그대로다(준공 잔여성과 = 준공액 − 이력 누계라서 이력이 늘어난 만큼 준공월 덩어리가 줄어든다. 음수 상계, 0 고정 없음 — `junggong-seonggwa.ts` `sum준공잔여성과`).
  - 공무 화면·대시보드의 **시공** 축(공사이력만)은 줄어드는 달 없이 6·7월 등이 늘기만 한다. 지난 달 담당자별 시공 칸도 늘어난다.

> 숫자는 입력이 진행되면 바뀐다. 구현 세션은 Task 3에서 그날 다시 측정한 값으로 대조한다.

---

## 사장님 확인 (apply 전, 조성현)

진행 문서 §2 진행 원칙(만들기 전에 한 문장으로 확인)에 따라 apply 전에 확인받는다. 초안:

> "빠진 공사이력은 작업일지 대신 ERP 투입실적에서 그 공사에 **마지막으로 나간 날**로 채우겠습니다. 매출 총액은 그대로이고, 9~10월 준공일에 몰려 있던 약 1.5억이 실제로 나간 6~7월로 옮겨갑니다."

확인 전에는 Task 4(apply)를 하지 않는다. 코드·dry-run·커밋은 확인과 무관하게 진행할 수 있다.

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| Create `src/app/(dashboard)/progress/_lib/자동배분.ts` | 순수 함수 `build자동배분` + 행 타입 + 표시 문자열 상수. **`@/` 경로를 쓰지 않는다**(ts-node 스크립트가 import하는데 `scripts/tsconfig.json`에 paths가 없다) — 상대경로 `../../orders/_lib/completion`만 |
| Create `src/app/(dashboard)/progress/_lib/자동배분.test.ts` | 규칙·경계·보류 사유 + `build미입력목록`과의 일치 테스트 |
| Create `scripts/backfill-이력-투입실적.ts` | dry-run(미리보기 JSON) / `--apply <미리보기>` |
| Modify 진행 문서 §5·§6 | 결과 기록 |

`build미입력목록`(`미입력.ts`)을 직접 부르지 못하는 이유: 그 파일이 런타임에 `@/lib/supabase/fetch-all`을 import해서 ts-node가 못 푼다. 그래서 '남은 금액' 판정(목표 = `calc하도적용표시금액`, 남은 = 목표 − 누계 ≥ 1,000원)을 `자동배분.ts`에 한 번 더 쓰고, **두 판정이 같은 공사·같은 금액을 고른다는 것을 테스트로 묶는다**(Task 1 마지막 테스트). 두 벌이 갈라지면 테스트가 깨진다.

---

### Task 1: 순수 함수 `build자동배분` (TDD)

**Files:**
- Create: `src/app/(dashboard)/progress/_lib/자동배분.ts`
- Test: `src/app/(dashboard)/progress/_lib/자동배분.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { build자동배분, 자동배분표시, type 배분수주Row, type 배분이력Row } from './자동배분'
import { build미입력목록 } from './미입력'

const 수주 = (over: Partial<배분수주Row> & { id: number }): 배분수주Row => ({
  지중no: `JG26-${String(over.id).padStart(3, '0')}`,
  공사명: '테스트 공사',
  준공여부: true,
  준공일: '2026-09-15',
  준공액_공급가: 10_000_000,
  보험료율: 0.075,
  하도전용율: 0.85,
  ...over,
})
// 하도 기준 목표 = 10,000,000 × 0.925 × 0.85 = 7,862,500
const 목표 = 7_862_500
let 다음id = 1000
const 이력 = (수주_id: number, 작업일자: string, 성과금액: number, 담당공무_id: number | null = null, 작업내용: string | null = null): 배분이력Row =>
  ({ id: 다음id++, 수주_id, 작업일자, 성과금액, 담당공무_id, 작업내용 })
const 투입 = (수주_id: number, ...날짜: string[]) => 날짜.map((투입일) => ({ 수주_id, 투입일 }))

describe('build자동배분', () => {
  it('남은 금액 전부를 준공일 이전 마지막 투입일에 1행으로 넣는다', () => {
    const r = build자동배분(
      [수주({ id: 1 })],
      [이력(1, '2026-06-17', 2_000_000, 7)],
      투입(1, '2026-06-17', '2026-06-23', '2026-08-31'),
    )
    expect(r.배분).toEqual([
      { 수주_id: 1, 지중no: 'JG26-001', 작업일자: '2026-08-31', 성과금액: 목표 - 2_000_000, 담당공무_id: 7, 작업내용: 자동배분표시 },
    ])
    expect(r.보류).toEqual([])
  })

  it('준공일 뒤의 투입일은 고르지 않는다', () => {
    const r = build자동배분([수주({ id: 1, 준공일: '2026-07-01' })], [], 투입(1, '2026-06-10', '2026-07-01', '2026-07-20'))
    expect(r.배분[0].작업일자).toBe('2026-07-01') // 준공일 당일은 포함
  })

  it('투입일이 전부 준공일 뒤면 보류', () => {
    const r = build자동배분([수주({ id: 1, 준공일: '2026-07-01' })], [], 투입(1, '2026-07-20'))
    expect(r.배분).toEqual([])
    expect(r.보류).toEqual([{ 수주_id: 1, 지중no: 'JG26-001', 남은금액: 목표, 사유: '준공일 이전 투입 없음' }])
  })

  it('투입실적이 없으면 보류', () => {
    const r = build자동배분([수주({ id: 1 })], [], [])
    expect(r.보류).toEqual([{ 수주_id: 1, 지중no: 'JG26-001', 남은금액: 목표, 사유: '투입실적 없음' }])
  })

  it('이미 자동배분 행이 있는 공사는 다시 넣지 않는다(두 번 실행 방지)', () => {
    const r = build자동배분(
      [수주({ id: 1 })],
      [이력(1, '2026-06-17', 1_000_000, null, 자동배분표시)],
      투입(1, '2026-06-17'),
    )
    expect(r.배분).toEqual([])
    expect(r.보류[0].사유).toBe('이미 자동배분됨')
  })

  it('담당은 가장 최근 이력(작업일자 → id 순)의 담당, 담당 있는 행이 없으면 null', () => {
    const r = build자동배분(
      [수주({ id: 1 }), 수주({ id: 2 })],
      [이력(1, '2026-05-01', 100_000, 3), 이력(1, '2026-06-01', 100_000, 5), 이력(1, '2026-07-01', 100_000, null), 이력(2, '2026-05-01', 100_000, null)],
      [...투입(1, '2026-07-01'), ...투입(2, '2026-05-01')],
    )
    expect(r.배분.find((x) => x.수주_id === 1)?.담당공무_id).toBe(5)
    expect(r.배분.find((x) => x.수주_id === 2)?.담당공무_id).toBeNull()
  })

  it('남은 금액이 1,000원 미만이거나 초과(음수)면 대상이 아니다', () => {
    const r = build자동배분(
      [수주({ id: 1 }), 수주({ id: 2 })],
      [이력(1, '2026-06-01', 목표 - 999), 이력(2, '2026-06-01', 목표 + 5_000_000)],
      [...투입(1, '2026-06-01'), ...투입(2, '2026-06-01')],
    )
    expect(r.배분).toEqual([])
    expect(r.보류).toEqual([])
  })

  it('준공 안 됨·준공일 없음·준공액 없음은 대상이 아니다', () => {
    const r = build자동배분(
      [수주({ id: 1, 준공여부: false }), 수주({ id: 2, 준공일: null }), 수주({ id: 3, 준공액_공급가: null })],
      [],
      [...투입(1, '2026-06-01'), ...투입(2, '2026-06-01'), ...투입(3, '2026-06-01')],
    )
    expect(r.배분).toEqual([])
    expect(r.보류).toEqual([])
  })

  it('성과금액은 원 단위 정수로 반올림한다', () => {
    const r = build자동배분([수주({ id: 1, 준공액_공급가: 10_000_001 })], [], 투입(1, '2026-06-01'))
    expect(Number.isInteger(r.배분[0].성과금액)).toBe(true)
  })

  it('미입력 목록의 남은 입력과 같은 공사·같은 금액을 고른다(판정 두 벌 일치)', () => {
    const 수주들 = [
      수주({ id: 1 }),
      수주({ id: 2, 보험료율: null }),
      수주({ id: 3, 하도전용율: null }),
      수주({ id: 4 }),
      수주({ id: 5 }),
    ]
    const 이력들 = [이력(2, '2026-06-01', 3_000_000), 이력(4, '2026-06-01', 목표 - 500), 이력(5, '2026-06-01', 목표 + 10_000)]
    const 투입들 = 수주들.flatMap((o) => 투입(o.id, '2026-06-01'))
    const 자동 = build자동배분(수주들, 이력들, 투입들)
    const 목록 = build미입력목록(
      수주들,
      이력들.map(({ 수주_id, 성과금액 }) => ({ 수주_id, 성과금액 })),
      [],
    )
    expect(자동.배분.map((x) => [x.수주_id, x.성과금액]).sort()).toEqual(
      목록.남은.map((x) => [x.수주_id, Math.round(x.금액)]).sort(),
    )
  })

  it('결과는 지중no 순', () => {
    const r = build자동배분(
      [수주({ id: 2, 지중no: 'JY26-001' }), 수주({ id: 1, 지중no: 'JG26-009' })],
      [],
      [...투입(1, '2026-06-01'), ...투입(2, '2026-06-01')],
    )
    expect(r.배분.map((x) => x.지중no)).toEqual(['JG26-009', 'JY26-001'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/progress/_lib/자동배분.test.ts"`
Expected: FAIL — `Cannot find module './자동배분'` 또는 동등한 import 실패

- [ ] **Step 3: 구현**

```ts
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

export type 배분행 = {
  수주_id: number
  지중no: string
  작업일자: string
  성과금액: number
  담당공무_id: number | null
  작업내용: string
}
export type 보류사유 = '투입실적 없음' | '준공일 이전 투입 없음' | '이미 자동배분됨'
export type 보류행 = { 수주_id: number; 지중no: string; 남은금액: number; 사유: 보류사유 }

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

    if (행들.some((r) => r.작업내용 === 자동배분표시)) { 보류.push({ ...기본, 사유: '이미 자동배분됨' }); continue }
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

    배분.push({
      수주_id: o.id,
      지중no: o.지중no,
      작업일자: 후보[후보.length - 1],
      성과금액: 남은금액,
      담당공무_id: 최근담당?.담당공무_id ?? null,
      작업내용: 자동배분표시,
    })
  }

  배분.sort((a, b) => a.지중no.localeCompare(b.지중no))
  보류.sort((a, b) => a.지중no.localeCompare(b.지중no))
  return { 배분, 보류 }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/progress/_lib/자동배분.test.ts"`
Expected: PASS (11 tests)

- [ ] **Step 5: 전체 테스트·타입·린트**

Run: `npx vitest run; npx tsc --noEmit; npx eslint "src/app/(dashboard)/progress/_lib"`
Expected: 전부 통과

- [ ] **Step 6: 커밋 ①** — `자동배분.ts` + 테스트. 메시지는 조성현이 쓴다.

---

### Task 2: 스크립트 `scripts/backfill-이력-투입실적.ts`

**Files:**
- Create: `scripts/backfill-이력-투입실적.ts`

- [ ] **Step 1: 스크립트 작성**

```ts
/**
 * 입력 자동배분 (일회성, 2026-11-17 결정 — 진행 문서 §6)
 *
 * 미입력 공사이력의 남은 금액을 투입실적의 마지막 투입일(준공일 이전)에 1행씩 넣는다.
 * 규칙은 src/app/(dashboard)/progress/_lib/자동배분.ts 에 있고 vitest로 검증돼 있다. 이 파일은 읽기·쓰기만 한다.
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/backfill-이력-투입실적.ts
 *       ← dry-run: 조회만. backups/private/자동배분-미리보기-<시각>.json 을 만든다
 *   npx ts-node --project scripts/tsconfig.json scripts/backfill-이력-투입실적.ts --apply backups/private/자동배분-미리보기-<시각>.json
 *       ← 실제 쓰기: 다시 계산한 결과가 미리보기와 **한 칸도 다르지 않은 행만** 넣는다
 *
 * 되돌리기: 적용 후 생기는 backups/private/자동배분-적용-<시각>.json 의 id 목록을 delete.
 *   (또는 작업내용 = '투입실적 자동배분' 인 행 — 단 그 뒤에 사람이 같은 표시를 쓴 행이 없을 때만)
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { build자동배분, 자동배분표시, type 배분행, type 배분수주Row, type 배분이력Row, type 투입일Row } from '../src/app/(dashboard)/progress/_lib/자동배분'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.')
  process.exit(1)
}
// service_role 키는 RLS를 우회한다 — 잘못된 쓰기를 막는 건 DB가 아니라 아래의 '미리보기와 대조' 한 단계뿐이다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = createClient(URL, KEY) as any

const applyIdx = process.argv.indexOf('--apply')
const 미리보기경로 = applyIdx >= 0 ? process.argv[applyIdx + 1] : null
if (applyIdx >= 0 && !미리보기경로) {
  console.error('❌ --apply 뒤에 승인한 미리보기 JSON 경로가 필요합니다.')
  process.exit(1)
}

const won = (n: number) => n.toLocaleString('ko-KR') + '원'
const backupDir = path.resolve(__dirname, '..', 'backups', 'private')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

async function fetchAll<T>(table: string, cols: string, filter: (q: any) => any = (q) => q): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(sb.from(table).select(cols)).order('id').range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break // PostgREST 1000행 캡에 조용히 잘리면 누계가 모자라 이중 배분된다
  }
  return out
}

/** 미리보기와 비교하는 열쇠 — 넣을 행의 모든 칸 */
const 열쇠 = (r: 배분행) => [r.수주_id, r.작업일자, r.성과금액, r.담당공무_id, r.작업내용].join('|')

async function main() {
  console.log(`\n${'='.repeat(72)}`)
  console.log(미리보기경로 ? `🔴 APPLY — 미리보기 ${미리보기경로} 와 같은 행만 넣습니다` : '🔵 DRY-RUN — 조회만, 쓰기 없음')
  console.log('='.repeat(72))

  const 수주 = await fetchAll<배분수주Row>('수주', 'id, 지중no, 공사명, 준공여부, 준공일, 준공액_공급가, 보험료율, 하도전용율')
  // 준공정산 행은 2026-07-08 A안으로 0행이지만, 미입력 목록과 같은 조건으로 읽는다
  const 이력 = await fetchAll<배분이력Row>('공사이력', 'id, 수주_id, 작업일자, 성과금액, 담당공무_id, 작업내용', (q) => q.eq('준공정산', false))
  const 투입 = await fetchAll<투입일Row>('투입실적', 'id, 수주_id, 투입일')

  const { 배분, 보류 } = build자동배분(수주, 이력, 투입)
  const 합 = 배분.reduce((s, r) => s + r.성과금액, 0)
  console.log(`\n■ 배분 ${배분.length}건 ${won(합)} / 보류 ${보류.length}건 ${won(보류.reduce((s, r) => s + r.남은금액, 0))}`)
  const 사유별 = new Map<string, number>()
  for (const b of 보류) 사유별.set(b.사유, (사유별.get(b.사유) ?? 0) + 1)
  for (const [k, v] of 사유별) console.log(`   보류 — ${k}: ${v}건`)
  console.log(`   담당 없음(미지정으로 들어감): ${배분.filter((r) => r.담당공무_id == null).length}건`)

  fs.mkdirSync(backupDir, { recursive: true })

  if (!미리보기경로) {
    const p = path.join(backupDir, `자동배분-미리보기-${stamp}.json`)
    fs.writeFileSync(p, JSON.stringify({ 만든시각: new Date().toISOString(), 표시: 자동배분표시, 배분, 보류 }, null, 2), 'utf8')
    for (const r of 배분) console.log(`   ✔ [${r.지중no}] ${r.작업일자}  ${won(r.성과금액)}  담당=${r.담당공무_id ?? '미지정'}`)
    console.log(`\n🔵 미리보기 저장: ${p}\n   검토 후 승인하면: --apply ${path.relative(path.resolve(__dirname, '..'), p)}`)
    return
  }

  // ── APPLY: 승인한 미리보기와 지금 다시 계산한 결과가 같은 행만 ──
  const 승인 = JSON.parse(fs.readFileSync(path.resolve(미리보기경로), 'utf8')) as { 배분: 배분행[] }
  const 승인열쇠 = new Set(승인.배분.map(열쇠))
  const 통과 = 배분.filter((r) => 승인열쇠.has(열쇠(r)))
  const 바뀜 = 배분.filter((r) => !승인열쇠.has(열쇠(r)))
  const 사라짐 = 승인.배분.filter((r) => !new Set(배분.map(열쇠)).has(열쇠(r)))
  console.log(`\n■ 대조: 넣을 행 ${통과.length} / 미리보기 이후 값이 바뀌어 건너뜀 ${바뀜.length} / 미리보기에만 있음 ${사라짐.length}`)
  for (const r of 바뀜) console.log(`   ⏭  [${r.지중no}] 지금 계산 ${r.작업일자} ${won(r.성과금액)} — 미리보기와 다름, 다시 dry-run 필요`)
  for (const r of 사라짐) console.log(`   ⏭  [${r.지중no}] 미리보기 ${r.작업일자} ${won(r.성과금액)} — 지금은 대상 아님`)
  if (통과.length === 0) { console.log('\n넣을 행이 없습니다.'); return }

  // insert 한 번 = PostgREST 요청 하나 = 트랜잭션 하나 → 전부 들어가거나 하나도 안 들어간다
  const { data, error } = await sb
    .from('공사이력')
    .insert(통과.map(({ 수주_id, 작업일자, 성과금액, 담당공무_id, 작업내용 }) => ({ 수주_id, 작업일자, 성과금액, 담당공무_id, 작업내용, 준공정산: false })))
    .select('id, 수주_id')
  if (error) throw error
  if (!data || data.length !== 통과.length) throw new Error(`넣은 행 수가 다름: 요청 ${통과.length}, 응답 ${data?.length ?? 0}`)

  const p = path.join(backupDir, `자동배분-적용-${stamp}.json`)
  fs.writeFileSync(p, JSON.stringify({
    실행시각: new Date().toISOString(),
    설명: '되돌리려면 아래 id들을 공사이력에서 delete',
    미리보기: 미리보기경로,
    넣은행: data,
  }, null, 2), 'utf8')
  console.log(`\n🔴 ${data.length}건 넣음 (${won(통과.reduce((s, r) => s + r.성과금액, 0))}). 되돌리기 근거: ${p}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: 타입·린트**

Run: `npx tsc --noEmit -p scripts/tsconfig.json; npx eslint scripts/backfill-이력-투입실적.ts`
Expected: 통과. (`scripts/tsconfig.json`의 include가 `*.ts`라 상대 import한 `자동배분.ts`·`completion.ts`까지 따라 검사된다. 둘 다 `@/`가 없어야 한다 — 실패하면 Task 1 파일 맨 위 import를 확인)

- [ ] **Step 3: dry-run 실행**

Run: `npx ts-node --project scripts/tsconfig.json scripts/backfill-이력-투입실적.ts`
Expected: `배분 N건 / 보류 M건`, 미리보기 JSON 경로 출력, DB 쓰기 없음. N·M·합은 Task 3에서 대조한다.

- [ ] **Step 4: 커밋 ②** — 스크립트. 메시지는 조성현이 쓴다.

---

### Task 3: 미리보기를 독립 측정과 대조 (select만)

기대값은 스크립트가 아니라 **`build자동배분`을 import하지 않는 독립 측정**에서 온다(같은 함수를 두 번 부르는 대조는 함수의 옳음을 검사하지 못한다).

- [ ] **Step 1: 독립 측정 스크립트를 scratchpad에 두고 실행**

```js
// scratchpad/measure-autofill-shift.cjs — node measure-autofill-shift.cjs <repo 경로>
const path = require('path'); const repo = process.argv[2]
const { createClient } = require(path.join(repo, 'node_modules/@supabase/supabase-js'))
require(path.join(repo, 'node_modules/dotenv')).config({ path: path.join(repo, '.env.local'), quiet: true })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function all(t, c, f = q => q) { const o = []; for (let i = 0; ; i += 1000) { const { data, error } = await f(sb.from(t).select(c)).order('id').range(i, i + 999); if (error) throw error; o.push(...data); if (data.length < 1000) return o } }
;(async () => {
  const 수주 = await all('수주', 'id,지중no,준공여부,준공일,준공액_공급가,보험료율,하도전용율')
  const 이력 = await all('공사이력', 'id,수주_id,작업일자,성과금액,담당공무_id', q => q.eq('준공정산', false))
  const 투입 = await all('투입실적', 'id,수주_id,투입일')
  const 누 = new Map(); for (const r of 이력) 누.set(r.수주_id, (누.get(r.수주_id) ?? 0) + (r.성과금액 ?? 0))
  const 투 = new Map(); for (const r of 투입) (투.get(r.수주_id) ?? 투.set(r.수주_id, new Set()).get(r.수주_id)).add(r.투입일)
  const 월 = {}; let 배분 = 0, 합 = 0, 보류 = [], 담당없음 = 0, 투입없음 = 0
  for (const o of 수주) {
    if (!o.준공여부 || !o.준공일 || o.준공액_공급가 == null) continue
    let t = o.준공액_공급가; if (o.보험료율 != null) t *= 1 - o.보험료율; if (o.하도전용율 != null) t *= o.하도전용율
    const d = t - (누.get(o.id) ?? 0); if (!(d >= 1000)) continue
    if (!투.has(o.id)) { 투입없음++; continue }
    const 후보 = [...투.get(o.id)].filter(x => x <= o.준공일).sort()
    if (!후보.length) { 보류.push(o.지중no); continue }
    const 날 = 후보.at(-1), 금 = Math.round(d); 배분++; 합 += 금
    if (!이력.some(r => r.수주_id === o.id && r.담당공무_id != null)) 담당없음++
    월[날.slice(0, 7)] = (월[날.slice(0, 7)] ?? 0) + 금
    월[o.준공일.slice(0, 7)] = (월[o.준공일.slice(0, 7)] ?? 0) - 금
  }
  console.log({ 배분, 합, 보류, 담당없음, 투입없음 })
  console.log(Object.entries(월).filter(([, v]) => v).sort().map(([k, v]) => `${k} ${v.toLocaleString()}`).join('\n'))
})()
```

Run: `node <scratchpad>/measure-autofill-shift.cjs <repo>`

- [ ] **Step 2: 대조** — 미리보기 JSON의 `배분.length`·성과금액 합·보류(사유별)·담당 null 수가 Step 1의 `배분`·`합`·`보류.length + 투입없음`·`담당없음`과 같아야 한다. 다르면 apply하지 않고 원인을 찾는다. 2026-11-17 기획 시점 값: 배분 48건 277,125,097원 · 준공일 이전 투입 없음 1건(MY26-006) · 투입실적 없음 60건 · 담당 없음 4건. 그사이 손입력이 있었다면 달라도 정상이다(달라진 이유를 적는다).

- [ ] **Step 3: 달별 이동표를 사장님 확인 문장에 맞춰 갱신** — Step 1의 달별 출력으로 위 '사장님 확인' 초안의 금액·달을 그날 값으로 고친다.

---

### Task 4: 적용 (조성현 승인 후에만)

- [ ] **Step 1: 전제 확인** — ① 사장님 확인 받음 ② Task 3 대조 통과 ③ 조성현이 이 세션에서 "apply 해도 된다"고 명시. 하나라도 없으면 이 Task는 건너뛰고 §5에 '적용 대기'로 적는다.

- [ ] **Step 2: 적용 직전 측정 기록** — PR-B 계획 Task 5 Step 1 스크립트(`measure-pr-b.cjs`, 남은·초과·완료·제외·기성만)를 돌려 값을 적어 둔다.

- [ ] **Step 3: apply**

Run: `npx ts-node --project scripts/tsconfig.json scripts/backfill-이력-투입실적.ts --apply backups/private/자동배분-미리보기-<Task 2 Step 3 시각>.json`
Expected: `대조: 넣을 행 48 / 건너뜀 0 / 미리보기에만 0`, `48건 넣음`, 적용 JSON 경로.

- [ ] **Step 4: 적용 후 검증 (select만)**
  - `measure-pr-b.cjs` 다시: **남은 = 직전 남은 − 배분건수**, 남은합 = 직전 − 배분합(원 단위 반올림 차 ±건수 이내), **입력 초과는 직전과 같음**, 완료 = 직전 + 배분건수.
  - 공사이력 `작업내용 = '투입실적 자동배분'` 행 수 = 넣은 행 수.
  - 매출 총액 불변: 운영 `/sales`의 2026년 성과 합계가 적용 전과 같음(해 사이 이동분 −129,437원 내외만 차이). 화면 숫자는 조성현이 확인.
  - 운영 `/progress?tab=missing` 요약 줄 = 위 측정값.
- [ ] **Step 5: 두 번 실행 방지 확인** — dry-run을 한 번 더 돌려 `배분 0건`, 보류에 `이미 자동배분됨` 0건(이미 0원이 됐으므로 대상 자체가 아님)인지 본다.

---

### Task 5: 마무리

- [ ] **Step 1: 게이트 3 리뷰**(엣지케이스·되돌리기·service_role) → 조성현 수용/반박
- [ ] **Step 2: 게이트 4** — 커밋당 1~2문항. 이 단계의 지뢰: 트랜잭션(insert 한 번이 원자적인 이유 / 무엇이 그 묶음을 여나), 같은 원본을 읽는 두 기록(판정 두 벌 일치 테스트가 보장하는 것과 못 잡는 것).
- [ ] **Step 3: 진행 문서 갱신** — §5 '입력 자동배분' 행(적용 여부·실측), '입력' 행(남은 = 투입실적 없는 공사), §6 결정 → **커밋 ③**(진행 문서 + 이 계획 문서 + PR-B 행 'ERP #61' 수정분). `docs/공사이력카드 자동화/`는 넣지 않는다.
- [ ] **Step 4: 푸시 → PR → 머지, 세션 보고서**(세션 규칙 4). 운영 배포는 없다(화면 코드 변경 없음 — 스크립트와 테스트만).

---

## 다음으로 넘길 것

1. **투입실적 없는 60건(1.81억):** 조성현이 '진짜 기록 없음'과 '투입 입력 누락'으로 가른다. 누락이면 투입실적을 입력한 뒤 이 스크립트를 다시 dry-run하면 그 공사만 새로 잡힌다(이미 넣은 공사는 남은 금액이 0이라 대상이 아님). 진짜 기록이 없으면 PR-C 기획에서 처리 방식을 정한다.
2. **보류 1건 MY26-006**(투입일이 전부 준공일 뒤): 사람이 본다.
3. **오늘 손입력 중 투입일과 다른 16행:** 확인 후 투입일로 옮길지 결정.
4. **입력 초과 56건 −1.86억**(기존 47 + 오늘 10 − 해소 1): 데이터 작업. 감액형(㉠)·오입력형(㉡)·오늘 생긴 ㉮㉯㉰로 나눠 본다.
5. **입력 화면의 함정(백로그):** `%` 모드 100% = 수주 기준이라 준공액이 다른 공사는 미입력 목표와 안 맞고, 기존 행보다 앞 날짜에 누적 %를 넣으면 이중으로 들어간다. 화면이 막아주지 않는다.
6. **PR-C 기획:** 위 1·4가 끝나 남은 ≈ 0, 초과 ≈ 0이 된 뒤. §7-C 3.5억 사장님 확인은 그대로 남아 있다.
