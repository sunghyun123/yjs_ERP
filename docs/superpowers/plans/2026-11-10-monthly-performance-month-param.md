# `/api/kpi/monthly-performance?month=YYYY-MM` (PR-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 계획/실적 표(PR-3)가 지난 달로 ‹ › 넘길 수 있도록, ERP 대시보드 API가 `?month=YYYY-MM`을 받아 그 달(금요일 기준 주차의 달)의 시공·정산 실적(`split`)을 내려준다. `month`가 없으면 지금과 똑같이 동작한다.

**Architecture:** 계산은 새로 만들지 않는다. 지금 응답의 `split`(= `getMonthlySplit`)이 이미 금요일 기준 기간·`build월시공내역`·행별 `천원()` 반올림으로 공무 화면과 같은 숫자를 낸다. 바뀌는 것은 **그 기간을 어디서 받느냐** 하나다. 기간은 `주차.ts`의 새 순수 함수 `조회월기간(monthParam, 오늘)`이 정하고, 범위 판정은 공무 화면(`resolve선택`)과 같은 함수 `조회가능월`을 함께 쓴다. `month`가 있으면 응답은 `{ month, split }`만 담는다(게이트 1, B안).

**Tech Stack:** Next.js 16 (App Router route handler) · TypeScript · Supabase(service_role) · vitest

**설계 문서:** `docs/superpowers/specs/2026-11-09-plan-actual-table-and-data-alignment-design.md` §5-1, §6 PR-2, §7-4

**티어:** A (회계 정합성 + 타임존 지뢰 + 다른 레포(yjs_Dashboard)가 소비하는 API). 게이트 3~5는 Task 4.

---

## 게이트 1 결정 (2026-11-10)

**B. `month`가 있으면 `{ month, split }`만 응답한다.** 고른 이유(사용자): "한 응답에 두 달이 섞이면 안 되니까."

| 안 | 내용 | 기각 이유 |
|---|---|---|
| A | 전체 응답 그대로, `split`만 그 달로 | `?month=2026-09`인데 `label:"11월"`·`amounts`=11월 달력 월이 같이 온다. 소비자가 실수로 `amounts`를 읽으면 에러 없이 다른 달 숫자가 찍힌다 |
| C | 새 라우트 `/api/kpi/monthly-split?month=` | 설계가 정한 경로와 다르고, 유일한 문지기(`Bearer` 비교)가 두 파일로 갈라진다 |

## 결정 사항 (이 계획에서 정함 — 설계에 명시 안 된 것)

1. **응답 모양 두 가지.**
   - `month` 없음 → 지금과 **바이트 단위로 같은 모양**: `{ ...MonthlyKpiData, split: MonthlySplit | null }`. split만 실패하면 `split: null` + 200(기존 동작 유지).
   - `month` 있음 → `{ month: 'YYYY-MM', split: MonthlySplit }`. `split`의 모양은 위와 똑같다(`month`·`from`·`to`·`construction`·`settlement`). **split 실패는 500**이다 — 내용이 split 하나뿐이라 `null`로 감싸 200을 주면 '성공처럼 생긴 빈 응답'이 된다.
2. **검증 순서: 인증(401/500) → month 형식·범위(400) → DB.** 잘못된 month로는 DB를 한 번도 읽지 않는다. 인증이 먼저인 이유: 키 없는 요청에게 "어느 달까지 열려 있나"(400 문구)조차 알려주지 않는다.
3. **400이 되는 경우:** 형식이 `YYYY-MM`이 아님(`2026-9`, `2026-13`, `2026-10-01`, `current`), **빈 문자열(`?month=`)**, `최소월(2026-09)`보다 앞, 금주 소속월보다 뒤. 빈 문자열을 '없음'으로 보지 않는 것은 MCP `parse월`과 같은 규칙이다(없음 = 이번 달 전체 응답, 빈 값 = 잘못 만든 요청).
4. **범위 규칙은 한 함수.** 지금 `resolve선택` 안에 인라인으로 적힌 정규식 + `[최소월, 금주월]` 판정을 `조회가능월(m, 금주월)`로 꺼내 화면과 API가 같이 쓴다. 범위 밖일 때의 **반응**만 다르다: 화면은 지금처럼 조용히 금주 달로, API는 400.
5. **`month` = 금주 소속월이어도 `{ month, split }` 모양이다.** 그 split은 month 없는 응답의 split과 같은 기간·같은 숫자다(테스트로 고정).
6. **`load투입원가재료`의 `year`는 `Number(월.slice(0,4))`.** split은 이 값을 읽지 않는다(투입실적은 야간 표기용, 기간 필터는 from/to). 2027-01처럼 기간이 전년 12/28부터 시작해도 결과에 영향 없음.

## 범위에서 뺀 것

- **`month`가 있을 때 `amounts`·`breakdown`(달력 월 KPI)을 그 달로 다시 계산하는 것.** 그 값은 '오늘까지 누적 + 전월 동기간 비교'라 지난 달에는 의미가 없고, 대시보드 표(PR-3)는 split만 쓴다.
- **yjs_Dashboard 쪽 변경**(중계 `erp.py`의 month 전달, 표 UI) — PR-3.
- **대시보드 중계의 허용목록.** `_normalize_monthly_kpi`는 칸 허용목록이라 `{ month, split }`을 그대로 통과시키지 않을 수 있다. 그건 PR-3 기획에서 다룬다(이 PR의 응답 계약만 PR-3에 넘긴다).
- **목표(`monthly_target_rows`)** — 대시보드 DB에 있음. PR-3.
- **응답 캐시 헤더.** 지금 응답도 캐시 헤더를 안 보낸다. 바꾸지 않는다.

---

## 파일 구조

| 파일 | 할 일 | 책임 |
|---|---|---|
| `src/app/(dashboard)/gongmu/_lib/주차.ts` | 수정 | `조회가능월`(범위 판정 한 곳), `조회월기간`(month 문자열 → 기간 또는 오류). `resolve선택`이 `조회가능월`을 쓰게 |
| `src/app/(dashboard)/gongmu/_lib/주차.test.ts` | 수정 | 위 두 함수 테스트(KST 경계 포함). 기존 `resolve선택` 테스트는 그대로 통과해야 함 |
| `src/app/api/kpi/monthly-performance/route.ts` | 수정 | `month` 분기 추가. month 없는 경로는 손대지 않음 |
| `src/app/api/kpi/monthly-performance/route.test.ts` | 생성 | DB 로더를 `vi.mock`으로 바꿔 ①하위호환 모양 ②넘어간 기간 ③400/401/500 ④KST 경계를 검사 |

새 함수를 `주차.ts`에 두는 이유: "어느 달을 볼 수 있나 / 그 달의 기간은 언제부터 언제까지"는 공무 화면·매출손익 금요일 화면·대시보드 API가 공유하는 **기간 규칙**이고, 이 파일이 그 규칙의 정본이다. 라우트 파일에 두면 화면과 API의 범위가 따로 적힌다.

---

## 시작 전 (브랜치)

PR #51(PR-1)은 2026-11-10 main에 머지됐다(`9b683df`). main에서 딴다. 이 계획 문서는 아직 커밋 전이라 브랜치를 옮겨도 따라온다.

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c feat/kpi-month-param
git status   # docs/superpowers/plans/2026-11-10-monthly-performance-month-param.md 가 untracked 로 보여야 한다
```

`AGENTS.md` 수정분과 `docs/공사이력카드 자동화/`는 이 작업과 무관하다. 커밋에 넣지 않는다(지우지도 않는다).

---

### Task 1: 조회 가능한 달과 그 기간 (`조회가능월`, `조회월기간`)

**Files:**
- Modify: `src/app/(dashboard)/gongmu/_lib/주차.ts` (`resolve선택` 위에 추가, `resolve선택`의 `유효` 줄 교체)
- Test: `src/app/(dashboard)/gongmu/_lib/주차.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`주차.test.ts` 맨 위 import 줄을 바꾼다.

```ts
import { addDays, 월요일Of, 소속월Of, 달의주목록, resolve선택, 금주소속월기간, 조회가능월, 조회월기간 } from './주차'
```

파일 끝에 추가한다.

```ts
describe('조회가능월 — 화면과 API가 같이 쓰는 범위 [최소월, 금주월]', () => {
  it('하한·상한 포함', () => {
    expect(조회가능월('2026-09', '2026-11')).toBe(true)
    expect(조회가능월('2026-11', '2026-11')).toBe(true)
  })
  it('하한 앞·상한 뒤는 거절', () => {
    expect(조회가능월('2026-08', '2026-11')).toBe(false)
    expect(조회가능월('2026-12', '2026-11')).toBe(false)
  })
  it('YYYY-MM 형식이 아니면 거절 (문자열 비교가 날짜 비교가 되려면 0 채움 고정폭이어야 한다)', () => {
    for (const m of ['2026-9', '2026-13', '2026-00', '2026-10-01', 'current', '', ' 2026-10']) {
      expect(조회가능월(m, '2027-12')).toBe(false)
    }
  })
})

describe('조회월기간 — ?month= 해석', () => {
  it('지난 달: 2026-10 → 금요일 기준 기간 9/28~11/1 (to 미포함 11/2)', () => {
    expect(조회월기간('2026-10', '2026-11-10')).toEqual({
      ok: true,
      기간: { 월: '2026-10', from: '2026-09-28', to: '2026-11-02' },
    })
  })
  it('하한 달: 2026-09 → 8/31~9/27 (to 미포함 9/28)', () => {
    expect(조회월기간('2026-09', '2026-11-10')).toEqual({
      ok: true,
      기간: { 월: '2026-09', from: '2026-08-31', to: '2026-09-28' },
    })
  })
  it('금주 달을 고르면 month 없는 응답의 split 과 같은 기간 (금주소속월기간과 같은 값)', () => {
    const r = 조회월기간('2026-11', '2026-11-10')
    expect(r).toEqual({ ok: true, 기간: 금주소속월기간('2026-11-10') })
  })
  it('KST 경계: 2026-11-30(월) 00:30 KST = UTC 11/29 15:30 → 12월이 허용된다', () => {
    const 오늘 = formatKST(new Date('2026-11-29T15:30:00Z'))
    expect(오늘).toBe('2026-11-30')
    expect(조회월기간('2026-12', 오늘)).toEqual({
      ok: true,
      기간: { 월: '2026-12', from: '2026-11-30', to: '2026-12-28' },
    })
  })
  it('같은 순간을 UTC 날짜(toISOString)로 읽으면 11/29 → 12월이 거절된다 — 호출부가 KST를 넘겨야 하는 이유', () => {
    const utc날짜 = new Date('2026-11-29T15:30:00Z').toISOString().slice(0, 10)
    expect(utc날짜).toBe('2026-11-29')
    expect(조회월기간('2026-12', utc날짜).ok).toBe(false)
  })
  it('상한 뒤(금주 달 다음 달)는 오류, 문구에 허용 범위가 들어간다', () => {
    const r = 조회월기간('2026-12', '2026-11-10')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('2026-09~2026-11')
  })
  it('하한 앞은 오류', () => {
    expect(조회월기간('2026-08', '2026-11-10').ok).toBe(false)
  })
  it('형식 오류·빈 문자열은 오류, 문구가 범위 오류와 다르다', () => {
    for (const m of ['2026-9', '2026-13', '', 'current', '2026-10-01']) {
      const r = 조회월기간(m, '2026-11-10')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('YYYY-MM')
    }
  })
  it('연 경계: 2026-12-28(월)이면 금주 달은 2027-01 → 2027-01 허용, 기간 12/28~1/31 (to 미포함 2/1)', () => {
    expect(조회월기간('2027-01', '2026-12-28')).toEqual({
      ok: true,
      기간: { 월: '2027-01', from: '2026-12-28', to: '2027-02-01' },
    })
  })
})
```

> 기간 기대값 검산(사람이 확인할 것): 10월 마지막 주 10/26(금 10/30), 11/2 주는 금 11/6 → 11월이라 to = 11/2. 12월 첫 주 11/30(금 12/4), 12/28 주는 금 2027-01-01 → 1월이라 to = 12/28. 2027-01 마지막 주 1/25(금 1/29), 2/1 주는 금 2/5 → 2월이라 to = 2/1.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: FAIL — `조회가능월`/`조회월기간`이 export 되지 않음(`is not a function` 또는 import 오류)

- [ ] **Step 3: 구현**

`주차.ts`에서 `export type 선택상태 = {` 바로 **위**에 추가한다.

```ts
const 연월형식 = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * 볼 수 있는 달 = [최소월, 금주가 속한 달]. 미래 달은 실적이 없고, 9월 앞은 금요일 기준 숫자를 쓰지 않는다(설계 §5-1).
 * 공무 화면(resolve선택)과 대시보드 API(조회월기간)가 이 한 함수를 같이 쓴다 — 둘의 범위가 갈라지지 않게.
 * 'YYYY-MM' 문자열 비교 = 날짜 비교(0 채움 고정폭이라). 그래서 형식 검사가 먼저다.
 */
export function 조회가능월(m: string, 금주월: 연월): boolean {
  return 연월형식.test(m) && m >= 최소월 && m <= 금주월
}

export type 조회월결과 =
  | { ok: true; 기간: { 월: 연월; from: string; to: string } }
  | { ok: false; error: string }

/**
 * 대시보드 API ?month= → 그 달의 금요일 기준 기간 [from, to).
 * 화면(resolve선택)과 달리 잘못된 값을 금주 달로 바꾸지 않고 오류로 돌려준다(→ 400).
 * "9월을 달라"고 했는데 11월을 9월 칸에 그리는 사고를 막는다.
 * @param 오늘 KST 'YYYY-MM-DD' — 호출부가 formatKST(now)로 넘긴다. 서버 시계(UTC) 날짜를 넘기면
 *             새 달 첫 주 월요일 00~09시에 금주 달이 지난달로 잡혀 이번 달이 거절된다.
 */
export function 조회월기간(monthParam: string, 오늘: string): 조회월결과 {
  const 금주월 = 소속월Of(월요일Of(오늘))
  if (!연월형식.test(monthParam)) {
    return { ok: false, error: `month는 YYYY-MM 형식이어야 합니다: '${monthParam}'` }
  }
  if (!조회가능월(monthParam, 금주월)) {
    return {
      ok: false,
      error: `month는 ${최소월}~${금주월} 사이여야 합니다: '${monthParam}'`,
    }
  }
  return { ok: true, 기간: { 월: monthParam, ...주목록기간(달의주목록(monthParam)) } }
}
```

`resolve선택` 안의 이 줄을

```ts
  const 유효 = /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m >= 최소월 && m <= 금주월
```

이렇게 바꾼다.

```ts
  const 유효 = 조회가능월(m, 금주월)
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: PASS — 새 테스트 전부 + 기존 `resolve선택` 테스트 6개도 그대로 PASS(범위 규칙을 옮겼지 바꾸지 않았다는 증거)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/gongmu/_lib/주차.ts" "src/app/(dashboard)/gongmu/_lib/주차.test.ts"
git status   # 두 파일이 staged 에 있는지 확인 (PowerShell 에서 경로가 잘려 빠진 적이 있다)
git commit -m "주차: 조회 가능한 달 판정을 화면·API 공용 함수로"
```

---

### Task 2: 라우트 테스트 (먼저 실패시킨다)

**Files:**
- Create: `src/app/api/kpi/monthly-performance/route.test.ts`

DB에 붙지 않는다. `createAdminClient`·로더·`getMonthlyKpiData`·`getMonthlySplit`을 `vi.mock`으로 바꿔 **라우트가 무엇을 누구에게 어떤 기간으로 넘기고, 받은 것을 어떤 모양으로 내보내는지**만 본다. 숫자가 맞는지는 Task 1(기간)과 기존 `monthly-split`/`monthly-revenue-breakdown` 테스트(계산), Task 3 Step 4(운영 데이터 대조)가 맡는다.

`NextRequest`/`NextResponse`는 vitest(node)에서 그대로 동작한다(2026-11-10 node로 확인: `nextUrl.searchParams`, `NextResponse.json().json()` 정상).

- [ ] **Step 1: 테스트 작성**

```ts
// src/app/api/kpi/monthly-performance/route.test.ts
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 은 파일 맨 위로 끌어올려지므로 가짜 함수도 vi.hoisted 로 같이 끌어올린다
const m = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({ 가짜: 'supabase' })),
  getMonthlyKpiData: vi.fn(),
  load투입원가재료: vi.fn(),
  load성과재료: vi.fn(),
  getMonthlySplit: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: m.createAdminClient }))
// 나머지 export(getMonthlyPeriod 등 순수 함수)는 진짜를 쓴다 — 바꾸는 건 DB를 읽는 함수뿐
vi.mock('@/app/(dashboard)/_lib/monthly-kpi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/monthly-kpi')>()),
  getMonthlyKpiData: m.getMonthlyKpiData,
  load투입원가재료: m.load투입원가재료,
}))
vi.mock('@/app/(dashboard)/_lib/junggong-seonggwa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/junggong-seonggwa')>()),
  load성과재료: m.load성과재료,
}))
vi.mock('@/app/(dashboard)/_lib/monthly-split', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/monthly-split')>()),
  getMonthlySplit: m.getMonthlySplit,
}))

import { GET } from './route'

const KEY = 'test-key'
const 요청 = (query = '', auth: string | null = `Bearer ${KEY}`) =>
  new NextRequest(`http://localhost/api/kpi/monthly-performance${query}`, {
    headers: auth === null ? {} : { authorization: auth },
  })

// 기존 응답(MonthlyKpiData)의 칸 이름 전부 — 값은 가짜, 모양만 본다
const 가짜KPI = {
  year: 2026,
  month: 11,
  label: '11월',
  period: { monthStart: '2026-11-01', monthEnd: '2026-12-01', prevMonthStart: '2026-10-01', comparisonDay: 10, prevMonthDays: 31 },
  amounts: { monthlyRevenue: 1, prevMonthRevenue: 2, prevMonthComparableRevenue: 3, revenueDelta: 4, monthlyInput: 5, monthlyProfit: 6 },
  formatted: { monthlyRevenue: 'a', revenueDelta: 'b', monthlyInput: 'c', monthlyProfit: 'd' },
  breakdown: { rows: [], totalThousand: 0 },
  updatedAt: '2026-11-10T03:00:00.000Z',
}
const 가짜split = (월: string, from: string, to: string) => ({
  month: 월,
  from,
  to,
  construction: { rows: [], totalThousand: 494834 },
  settlement: { rows: [], totalThousand: 0 },
})

/** KST 시각을 서버 시계(UTC)로 고정한다. Date 만 가짜로 — 타이머까지 멈추면 await 가 안 풀린다 */
function 지금은(utcIso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(utcIso))
}

beforeEach(() => {
  vi.stubEnv('DASHBOARD_API_KEY', KEY)
  m.createAdminClient.mockClear()
  m.getMonthlyKpiData.mockReset().mockResolvedValue(가짜KPI)
  m.load투입원가재료.mockReset().mockResolvedValue({ year: 2026, 투입실적: [], 단가: [] })
  m.load성과재료.mockReset().mockResolvedValue({ 공사이력: [], 수주: [] })
  m.getMonthlySplit
    .mockReset()
    .mockImplementation(async (_s: unknown, 기간: { 월: string; from: string; to: string }) =>
      가짜split(기간.월, 기간.from, 기간.to),
    )
  지금은('2026-11-10T03:00:00Z') // KST 11/10(화) 12:00 — 금주 달 11월
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('month 없음 — 대시보드 하위호환 (지금과 같은 모양)', () => {
  it('응답 = 기존 KPI 칸 전부 + split, 칸이 하나도 빠지거나 늘지 않는다', async () => {
    const res = await GET(요청())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ...가짜KPI, split: 가짜split('2026-11', '2026-11-02', '2026-11-30') })
    expect(Object.keys(body).sort()).toEqual([...Object.keys(가짜KPI), 'split'].sort())
  })

  it('split 은 금주 소속월 기간, 투입재료도 그 기간으로 따로 읽는다', async () => {
    await GET(요청())
    expect(m.getMonthlySplit).toHaveBeenCalledTimes(1)
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-11', from: '2026-11-02', to: '2026-11-30' })
    expect(m.load투입원가재료).toHaveBeenCalledWith(expect.anything(), {
      year: 2026,
      monthStart: '2026-11-02',
      monthEnd: '2026-11-30',
    })
  })

  it('split 만 실패하면 지금처럼 split: null + 200 (기존 칸은 살린다)', async () => {
    m.getMonthlySplit.mockRejectedValue(new Error('기성 조회 실패'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(요청())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...가짜KPI, split: null })
  })
})

describe('month 있음 — { month, split } 만', () => {
  it('?month=2026-10 → 10월 금요일 기준 기간(9/28~11/1), 달력 월 KPI 는 계산하지 않는다', async () => {
    const res = await GET(요청('?month=2026-10'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      month: '2026-10',
      split: 가짜split('2026-10', '2026-09-28', '2026-11-02'),
    })
    expect(m.getMonthlyKpiData).not.toHaveBeenCalled()
    expect(m.getMonthlySplit.mock.calls[0][1]).toEqual({ 월: '2026-10', from: '2026-09-28', to: '2026-11-02' })
    expect(m.load투입원가재료).toHaveBeenCalledTimes(1)
    expect(m.load투입원가재료).toHaveBeenCalledWith(expect.anything(), {
      year: 2026,
      monthStart: '2026-09-28',
      monthEnd: '2026-11-02',
    })
  })

  it('금주 달을 month 로 주면 split 은 month 없는 응답의 split 과 같다', async () => {
    const 없음 = await (await GET(요청())).json()
    const 있음 = await (await GET(요청('?month=2026-11'))).json()
    expect(있음.split).toEqual(없음.split)
  })

  it('KST 경계: 2026-11-30(월) 00:30 KST(= UTC 11/29 15:30)에 ?month=2026-12 는 200', async () => {
    지금은('2026-11-29T15:30:00Z')
    const res = await GET(요청('?month=2026-12'))
    expect(res.status).toBe(200)
    expect((await res.json()).split).toEqual(가짜split('2026-12', '2026-11-30', '2026-12-28'))
  })

  it('split 실패는 null 로 감싸지 않고 500', async () => {
    m.getMonthlySplit.mockRejectedValue(new Error('기성 조회 실패'))
    const res = await GET(요청('?month=2026-10'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '기성 조회 실패' })
  })
})

describe('400 — 요청한 쪽이 고칠 것, DB 는 읽지 않는다', () => {
  it.each([
    ['형식 오류', '?month=2026-9'],
    ['없는 달', '?month=2026-13'],
    ['날짜까지', '?month=2026-10-01'],
    ['빈 값', '?month='],
    ['최소월 앞', '?month=2026-08'],
    ['금주 달 뒤', '?month=2026-12'],
  ])('%s (%s) → 400', async (_이름, query) => {
    const res = await GET(요청(query))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toEqual(expect.any(String))
    expect(m.createAdminClient).not.toHaveBeenCalled()
    expect(m.getMonthlySplit).not.toHaveBeenCalled()
  })
})

describe('인증이 month 검사보다 먼저', () => {
  it('키가 틀리면 month 가 잘못돼도 401', async () => {
    const res = await GET(요청('?month=2026-13', 'Bearer wrong'))
    expect(res.status).toBe(401)
  })
  it('서버 키가 없으면 500', async () => {
    vi.stubEnv('DASHBOARD_API_KEY', '')
    const res = await GET(요청('?month=2026-10'))
    expect(res.status).toBe(500)
  })
})
```

> 기대값 검산: 11월 첫 주 11/2(금 11/6), 11/30 주는 금 12/4 → 12월이라 금주(11/10) 기준 split 기간은 11/2~11/29(to 미포함 11/30).
> `vi.stubEnv('DASHBOARD_API_KEY', '')`: 라우트는 `if (!apiKey)`로 검사하므로 빈 문자열도 '없음'이다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/kpi/monthly-performance/route.test.ts`
Expected: 'month 없음' 3개와 '인증' 2개는 **PASS**(지금 동작을 고정하는 테스트라 지금도 통과해야 한다 — 실패하면 테스트가 틀린 것이니 Task 3 전에 고친다). 'month 있음'·'400'은 **FAIL**(지금 라우트는 month를 무시하고 전체 응답 200을 준다).

- [ ] **Step 3: 커밋하지 않는다** — Task 3과 함께 커밋한다(실패하는 테스트만 main 이력에 남기지 않기 위해).

---

### Task 3: 라우트에 `month` 분기

**Files:**
- Modify: `src/app/api/kpi/monthly-performance/route.ts` (전체 교체 — month 없는 경로의 본문은 그대로 옮긴다)

- [ ] **Step 1: 구현**

```ts
/**
 * 대시보드(yjs_Dashboard)가 읽는 실적 API. service_role 로 RLS 를 우회하므로 아래 Bearer 비교가 유일한 문지기다.
 *
 * 응답 모양은 두 가지다 (2026-11-10, 설계 §6 PR-2 · 게이트 1 B안)
 *   ?month 없음      → { ...MonthlyKpiData(달력 월), split(금요일 기준 금주 달) | null }  — 지금까지와 같다
 *   ?month=YYYY-MM   → { month, split }  — 그 달의 split 만. 범위 [최소월, 금주 소속월] 밖·형식 오류는 400
 * month 가 있을 때 달력 월 칸(amounts·breakdown)을 같이 보내지 않는 이유: 그 칸은 '이번 달'이라
 * 한 응답에 두 달이 섞이고, 소비자가 잘못 읽으면 에러 없이 다른 달 숫자가 그려진다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMonthlyKpiData,
  getMonthlyPeriod,
  load투입원가재료,
} from '@/app/(dashboard)/_lib/monthly-kpi'
import { load성과재료 } from '@/app/(dashboard)/_lib/junggong-seonggwa'
import { getMonthlySplit } from '@/app/(dashboard)/_lib/monthly-split'
import { 금주소속월기간, 조회월기간 } from '@/app/(dashboard)/gongmu/_lib/주차'
import { formatKST } from '@/lib/kst'

function 실패응답(error: unknown) {
  const message = error instanceof Error ? error.message : 'Failed to load KPI data'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 같은 순간(now)에서 모든 기간을 정한다
  const now = new Date()

  const monthParam = req.nextUrl.searchParams.get('month')
  if (monthParam !== null) {
    // 오늘은 KST 로 못 박는다 — 서버 시계(UTC) 날짜로 정하면 새 달 첫 주 월요일 00~09시에
    // 금주 달이 지난달로 잡혀 이번 달 조회가 400 이 된다. 검사는 DB 를 읽기 전에 끝낸다
    const 조회 = 조회월기간(monthParam, formatKST(now))
    if (!조회.ok) {
      return NextResponse.json({ error: 조회.error }, { status: 400 })
    }
    try {
      const supabase = createAdminClient()
      const { 월, from, to } = 조회.기간
      const split = await getMonthlySplit(
        supabase,
        조회.기간,
        load성과재료(supabase),
        // 야간 표기용 투입실적 — 그 달 금요일 기준 기간으로 읽는다. year 는 split 이 읽지 않는다
        load투입원가재료(supabase, { year: Number(월.slice(0, 4)), monthStart: from, monthEnd: to }),
      )
      // split 실패를 null 로 감싸지 않는다 — 내용이 split 하나뿐이라 null + 200 이면 성공처럼 생긴 빈 응답이 된다
      return NextResponse.json({ month: 월, split })
    } catch (error) {
      return 실패응답(error)
    }
  }

  try {
    const supabase = createAdminClient()
    // 기존 칸(amounts·breakdown)은 ERP 홈 KPI와 같은 달력 월 그대로
    const period = getMonthlyPeriod(now)
    // split(대시보드 도넛·담당자별 진척)은 금요일 기준 주차의 달 — 공무 화면·주간업무 보고서와 같은 숫자가 나오게.
    // 오늘은 KST로 못 박는다(서버 시계는 UTC라 월요일 00~09시에 금주가 지난주로 잡힌다)
    const 주기간 = 금주소속월기간(formatKST(now))
    const 성과재료Promise = load성과재료(supabase)
    const 투입재료Promise = load투입원가재료(supabase, period)
    // split 의 야간 표기용 — 달력 월로 읽은 위 재료를 쓰면 9월 주차의 8/31 야간이 빠진다
    const 주투입재료Promise = load투입원가재료(supabase, {
      year: period.year,
      monthStart: 주기간.from,
      monthEnd: 주기간.to,
    })

    const [data, split] = await Promise.all([
      getMonthlyKpiData(supabase, now, 성과재료Promise, 투입재료Promise),
      // split 만의 실패(기성 전 테이블 조회 등)는 기존 칸까지 끌고 내려가지 않는다 — split: null 로 보내면
      // 새 대시보드는 대체값 경로로 가고, split 을 모르는 옛 대시보드는 아무 영향이 없다.
      // (공유 재료가 실패하면 getMonthlyKpiData 도 실패하므로 그때는 예전처럼 500)
      getMonthlySplit(supabase, 주기간, 성과재료Promise, 주투입재료Promise).catch((error: unknown) => {
        console.error('[kpi/monthly-performance] split 계산 실패 — split: null 로 응답', error)
        return null
      }),
    ])
    // split 은 '추가'다 — 기존 칸(amounts·breakdown 등)의 값과 의미는 그대로 두어 옛 대시보드가 깨지지 않게 한다
    return NextResponse.json({ ...data, split })
  } catch (error) {
    return 실패응답(error)
  }
}
```

> month 없는 경로에서 바뀐 것은 두 가지뿐이다: `now`가 `try` 위로 올라갔고(`new Date()`는 던지지 않음), `catch` 본문이 같은 내용의 `실패응답()`으로 바뀌었다. 리뷰 때 `git diff`로 이 두 군데 말고는 차이가 없는지 확인한다.

- [ ] **Step 2: 테스트 통과**

Run: `npx vitest run src/app/api/kpi/monthly-performance/route.test.ts "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: 전부 PASS

- [ ] **Step 3: 타입·린트·전체 테스트**

Run: `npx tsc --noEmit; npm run lint; npm test`
Expected: 오류 0, 전부 PASS

- [ ] **Step 4: 완료 기준 — 세 화면 천원까지 대조** (운영 Supabase에 붙은 로컬 dev 서버, 읽기만 함)

Run: `npm run dev` (다른 터미널)

API 호출(Git Bash). 키는 `.env.local`에서 읽고 화면·로그에 찍지 않는다.

```bash
KEY=$(grep '^DASHBOARD_API_KEY=' .env.local | cut -d= -f2- | tr -d '\r"')
for q in "" "?month=2026-09" "?month=2026-10" "?month=2026-11" "?month=2026-12" "?month=2026-08" "?month=2026-9" "?month="; do
  printf '%-18s ' "${q:-(없음)}"
  curl -s -o .r.json -w '%{http_code} ' -H "Authorization: Bearer $KEY" "http://localhost:3000/api/kpi/monthly-performance$q"
  node -e "const b=require('./.r.json');console.log(b.error??JSON.stringify({keys:Object.keys(b),month:b.split?.month,from:b.split?.from,to:b.split?.to,시공:b.split?.construction?.totalThousand,정산:b.split?.settlement?.totalThousand}))"
done; rm -f .r.json
```


| 확인 | 기대 |
|---|---|
| (없음) | 200, keys = `year, month, label, period, amounts, formatted, breakdown, updatedAt, split` (지금 운영과 같은 칸) |
| `?month=2026-09` | 200, keys = `month, split`, from `2026-08-31` to `2026-09-28` |
| `?month=2026-10` | 200, from `2026-09-28` to `2026-11-02` |
| `?month=2026-11` | 200, 시공·정산이 (없음)의 split 과 **같음** |
| `?month=2026-12` · `2026-08` · `2026-9` · 빈 값 | 400 + 오류 문구 (오늘이 11/30 이후면 `2026-12`는 200이 정상) |

그다음 화면 두 개와 대조한다.

| 확인 | 주소 | 볼 숫자 | 기대 |
|---|---|---|---|
| ① | API `?month=2026-10` | `split.construction.totalThousand` | — |
| ② | `/gongmu?month=2026-10` | 요약 카드 월 누적(시공) | ①과 **같음** |
| ③ | `/sales?year=2026&basis=friday` | 10월 "시공 기록" | ①과 **같음** |
| ④ | API `?month=2026-09` / `/gongmu?month=2026-09` / 금요일 표 9월 | 같은 칸 | 셋 다 **같음** |

참고값(2026-11-10 PR-1 화면 대조): 9월 250,773 / 10월 494,834. 그 뒤 공사이력이 고쳐졌으면 달라질 수 있으므로 **①②③이 서로 같은지**가 기준이다. 하나라도 다르면 커밋하지 않고 원인부터 찾는다(superpowers:systematic-debugging).

- [ ] **Step 5: 커밋** (게이트 5 — 메시지는 사용자가 작성)

```bash
git add src/app/api/kpi/monthly-performance/route.ts src/app/api/kpi/monthly-performance/route.test.ts
git status   # 두 파일이 staged 인지 확인
git commit   # 사용자가 "왜"를 담아 작성
```

---

### Task 4: 게이트 3·4 (구현 뒤, PR 전)

코드가 아니라 사용자와 하는 단계다. 생략하지 않는다.

- [ ] **게이트 3 리뷰:** Claude가 비판적 리뷰어로 diff 전체를 본다. 최소한 아래를 짚는다.
  - month 없는 경로의 diff가 `now` 위치와 `실패응답()` 두 군데뿐인가(하위호환)
  - 400 문구에 허용 범위(`2026-09~2026-11`)가 그대로 나간다 — 인증 뒤라 키 가진 쪽만 보지만, 문구가 내부 규칙(최소월)을 드러내는 게 괜찮은가
  - month 경로는 `getMonthlyKpiData`를 안 부르므로 공사이력을 한 번만 읽는다 — 다만 `load성과재료`는 여전히 **전 기간**을 읽는다(준공 차감 누계 때문). 지난 달을 ‹ ›로 넘길 때마다 전체 공사이력을 다시 읽는 비용이 대시보드 60초 재조회와 겹치면 문제인가
  - 응답 모양이 두 가지라는 것을 소비자(PR-3)가 어떻게 알게 되나 — 라우트 머리말 외에 PR 설명에 계약을 적는다
- [ ] **게이트 4 질문 (1~2개, 바닥 개념):** 후보
  - (HTTP 상태코드) `?month=2026-12`를 11/10에 보내면 400이다. 그런데 같은 요청을 11/30 00:30 KST에 보내면 200이다. 요청은 한 글자도 안 바뀌었는데 답이 바뀌었다 — 그래도 400이 맞나(4xx는 '요청한 쪽 잘못')? 대시보드는 이 400을 받으면 무엇을 고쳐야 하나?
  - (조용한 절단 / fail-open) month 경로에서 split 실패를 기존 경로처럼 `.catch(() => null)` + 200으로 처리했다면, 대시보드 표의 9월 칸에는 무엇이 어떤 모양으로 보이나? 경고는 어디에 남나?
  - (타임존) 라우트가 `formatKST(now)` 대신 `now.toISOString().slice(0,10)`을 넘겼다면, 2026-11-30(월) KST 08:00에 대시보드가 `?month=2026-12`를 요청하면 무엇이 오나? 그 시각에 대시보드가 month 없이 부르면 split.month 는 무엇인가 — 두 답이 서로 모순되나?
- [ ] **PR 생성** — 사용자 승인 후. PR 설명에 응답 계약(두 모양, 400 조건, month 경로의 500)을 적는다. 배포 순서: ERP(이 PR) → 대시보드(PR-3).
- [ ] **배포 후 확인:** 운영에서 month 없는 호출의 응답 칸이 그대로인지(대시보드 홈 도넛이 정상으로 그려지는지) 먼저 본다.

---

## Self-review 결과

- **요구 대응:** ①범위 밖·형식 오류 400 — Task 1(`조회월기간`) + Task 2 '400' describe(빈 값 포함). ②금주 소속월 KST — 라우트가 `formatKST(now)`를 넘김(Task 3), 테스트는 순수 함수(Task 1 'KST 경계'·'UTC로 읽으면 거절')와 라우트(Task 2 가짜 시계 2026-11-29T15:30Z) 두 층. ③month 없음 하위호환 — Task 2 'month 없음' 3개(칸 목록·기간·split 실패 시 null+200), Task 3 Step 4 (없음) 행. ④규칙 재사용 — 기간 `주차.ts`(`달의주목록`+`주목록기간`), 범위 `조회가능월`을 `resolve선택`과 공유, 시공 합계·반올림은 `getMonthlySplit` 그대로(새 계산 0줄). ⑤완료 기준 — Task 3 Step 4 ①②③.
- **준공 반영:** 요구 4의 "준공 반영은 PR-1 함수 재사용"은 이 API에 해당 칸이 없어 쓰지 않는다. split 은 시공 기록(공무 화면과 같은 축)과 정산만 담고, 준공 반영은 매출손익 금요일 표에만 있다(설계 §3·§4 — 준공 반영을 정산에 넣으면 이중 계상). 대시보드 표(PR-3)도 시공·정산 두 줄이라 필요 없다.
- **이름 일관성:** `조회가능월`·`조회월기간`·`조회월결과`·`실패응답`이 Task 1~3에서 같은 이름이다. `조회월기간`의 성공값 `기간`은 `getMonthlySplit`의 두 번째 인자 모양(`{ 월, from, to }`)과 같다.
