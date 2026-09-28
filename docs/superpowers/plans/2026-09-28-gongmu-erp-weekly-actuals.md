# 공무 페이지 — ERP 담당자별 주간 실적 조회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/gongmu`를 ERP `공사이력.담당공무_id` 기반 담당자별 주간·월 누적 공사 진행 실적 조회 화면으로 바꾸고, 미지정 이력을 모아 그 자리에서 담당을 지정할 수 있게 한다. 이력 수정 시트에도 담당공무 칸을 추가한다.

**Architecture:** 주차 규칙(금요일 기준 소속 월)과 집계는 DB를 모르는 순수 함수 두 파일에 둔다. 서버 컴포넌트는 조회 1회로 행을 받아 순수 함수에 넘기고, 클라이언트 컴포넌트는 그 결과를 그리기만 한다. 쓰기는 단일 함수 `update공사이력`을 거치며, 돌려받은 행이 1행이 아니면 실패로 본다(RLS 0행 침묵 방지).

**Tech Stack:** Next.js 16 (App Router, 서버 컴포넌트) · Supabase (PostgREST, 세션 클라이언트 + RLS) · TypeScript · vitest · Tailwind

**Spec:** `docs/superpowers/specs/2026-09-28-gongmu-erp-weekly-actuals-design.md`

**게이트 5 (사용자 규칙):** 작업 단위 커밋은 아래 초안 메시지로 한다. PR 머지 전 최종 커밋 메시지는 사용자가 직접 작성한다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| Create `src/app/(dashboard)/gongmu/_lib/주차.ts` | 날짜 문자열 산술, 금요일 기준 소속 월, 달의 주 목록, URL 파라미터 → 선택 상태 |
| Create `src/app/(dashboard)/gongmu/_lib/주차.test.ts` | 위 규칙 테스트 |
| Create `src/app/(dashboard)/gongmu/_lib/erp-실적.ts` | 행 → 담당자별 묶음, 달력 기준 비교, 설명 줄 문자열 |
| Create `src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts` | 집계 테스트 |
| Create `src/app/(dashboard)/progress/_lib/update-공사이력.ts` | 공사이력 부분 업데이트·삭제 + 0행 판정 + 실패 메시지 |
| Create `src/app/(dashboard)/progress/_lib/update-공사이력.test.ts` | 저장 함수 테스트 (가짜 클라이언트) |
| Modify `src/app/(dashboard)/progress/_types.ts` | `공사이력행`에 `담당공무_id` |
| Modify `src/app/(dashboard)/progress/_components/이력수정Sheet.tsx` | 담당공무 드롭다운, 저장·삭제를 새 함수로 |
| Modify `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx` | select에 `담당공무_id`, 담당자 목록 prop 전달 |
| Modify `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` | 이력 select에 `담당공무_id`, 시트에 담당자 목록 전달 |
| Modify `src/app/(dashboard)/progress/page.tsx` | 현황 탭에 담당자 목록 전달 |
| Rewrite `src/app/(dashboard)/gongmu/page.tsx` | 조회 + 순수 함수 호출 + 에러 화면 |
| Create `src/app/(dashboard)/gongmu/_components/GongmuActualsView.tsx` | 헤더·주 칩·요약 카드·카드 그리드 (클라이언트) |
| Create `src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx` | 카드 클릭 패널 + 미지정 행 담당 지정 (클라이언트) |

유지(수정 없음): `gongmu/[id]/**`, `gongmu/_lib/actions.ts`, `gongmu/_lib/excel.ts`, `gongmu/_lib/calc.ts`(구 양식이 계속 사용).

---

### Task 1: 주차 규칙 (`주차.ts`)

**Files:**
- Create: `src/app/(dashboard)/gongmu/_lib/주차.ts`
- Test: `src/app/(dashboard)/gongmu/_lib/주차.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/(dashboard)/gongmu/_lib/주차.test.ts
import { describe, expect, it } from 'vitest'
import { formatKST } from '@/lib/kst'
import { addDays, 월요일Of, 소속월Of, 달의주목록, resolve선택 } from './주차'

describe('날짜 산술', () => {
  it('addDays는 월·연 경계를 넘는다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })
  it('월요일Of는 그 주 월요일을 준다 (일요일은 앞 주 월요일)', () => {
    expect(월요일Of('2026-09-28')).toBe('2026-09-28') // 월
    expect(월요일Of('2026-10-04')).toBe('2026-09-28') // 일
    expect(월요일Of('2026-09-01')).toBe('2026-08-31') // 화
  })
})

describe('소속월Of — 금요일의 달', () => {
  it('9/28 주는 금요일 10/2 → 10월', () => expect(소속월Of('2026-09-28')).toBe('2026-10'))
  it('8/31 주는 금요일 9/4 → 9월', () => expect(소속월Of('2026-08-31')).toBe('2026-09'))
  it('4/27 주는 금요일 5/1 → 5월 (ISO 목요일 규칙이면 4월 — 갈리는 사례)', () =>
    expect(소속월Of('2026-04-27')).toBe('2026-05'))
  it('12/28 주는 금요일 2027-01-01 → 2027년 1월', () => expect(소속월Of('2026-12-28')).toBe('2027-01'))
})

describe('달의주목록', () => {
  it('9월 = 8/31, 9/7, 9/14, 9/21 (9/28 주는 10월)', () => {
    const 주 = 달의주목록('2026-09')
    expect(주.map((w) => w.월요일)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'])
    expect(주[0].label).toBe('1주차 8/31~9/6')
    expect(주[0].일요일).toBe('2026-09-06')
  })
  it('10월 = 9/28부터 10/26까지 5주', () => {
    const 주 = 달의주목록('2026-10')
    expect(주.map((w) => w.월요일)).toEqual([
      '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26',
    ])
    expect(주[0].label).toBe('1주차 9/28~10/4')
  })
  it('토요일에 시작하는 달은 첫 월요일 주가 전달 소속이면 건너뛴다 (2026-08: 7/27 주는 7월)', () => {
    expect(달의주목록('2026-08')[0].월요일).toBe('2026-08-03')
  })
})

describe('resolve선택', () => {
  it('KST 9/28 월 01:00 (= UTC 9/27 16:00) → 10월 1주차', () => {
    const 오늘 = formatKST(new Date('2026-09-27T16:00:00Z'))
    expect(오늘).toBe('2026-09-28')
    const s = resolve선택(오늘)
    expect(s.월).toBe('2026-10')
    expect(s.선택주.월요일).toBe('2026-09-28')
    expect(s.금주월요일).toBe('2026-09-28')
  })
  it('지난달을 고르면 그 달 마지막 주가 기본 선택', () => {
    const s = resolve선택('2026-09-28', '2026-09')
    expect(s.월).toBe('2026-09')
    expect(s.선택주.월요일).toBe('2026-09-21')
    expect(s.이전가능).toBe(false) // 9월이 하한
    expect(s.다음가능).toBe(true)
  })
  it('week 파라미터가 그 달의 주면 그 주를 고른다', () => {
    expect(resolve선택('2026-09-28', '2026-09', '2026-09-07').선택주.월요일).toBe('2026-09-07')
  })
  it('week 파라미터가 그 달의 주가 아니면 무시한다', () => {
    expect(resolve선택('2026-09-28', '2026-09', '2026-09-28').선택주.월요일).toBe('2026-09-21')
  })
  it('하한(2026-09) 이전·금주 달 이후·형식 오류 month는 기본(금주 달)로', () => {
    expect(resolve선택('2026-09-28', '2026-08').월).toBe('2026-10')
    expect(resolve선택('2026-09-28', '2026-11').월).toBe('2026-10')
    expect(resolve선택('2026-09-28', '2026-9').월).toBe('2026-10')
    expect(resolve선택('2026-09-28', '2026-10').다음가능).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: FAIL — `Failed to resolve import "./주차"`

- [ ] **Step 3: 구현**

```ts
// src/app/(dashboard)/gongmu/_lib/주차.ts
/**
 * 공무 주간 보고서의 주차 규칙 (2026-09-28 사용자 확정)
 *
 * - 한 주 = 월~일.
 * - 한 주는 통째로 한 달에 속하고, 소속 월은 그 주 '금요일'의 달이다.
 *   보고서를 그 주의 마지막 평일에 쓰기 때문이다. (예: 9/28~10/4 → 10월 1주차)
 *   ISO 8601(목요일 기준)과는 달이 목요일에 끝날 때 갈린다 — 2026-04-27 주는 ISO로 4월, 여기선 5월.
 *   그래서 src/lib/week.ts(ISO, 달에 걸친 주를 양쪽 달에 넣음)를 쓰지 않는다.
 *
 * 날짜는 전부 'YYYY-MM-DD' 문자열로 다루고, 산술은 명시적 UTC 자정('...T00:00:00Z')에서만 한다.
 * 로컬 시계(서버=UTC, 브라우저=KST)에 따라 날짜가 밀리지 않게 하려는 것.
 * '오늘'은 이 파일이 정하지 않는다 — 호출부가 todayKST()로 넘긴다.
 */

/** 9월 1주차(2026-08-31~)부터만 본다. 그 이전 이력은 담당 지정할 이유가 없다(과거 보고서를 다시 안 씀). */
export const 최소월 = '2026-09'

/** 'YYYY-MM' */
export type 연월 = string

export type 주정보 = {
  월요일: string
  일요일: string
  소속월: 연월
  /** 그 달 안에서 1부터 */
  주차: number
  /** '1주차 9/28~10/4' */
  label: string
}

function toUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`)
}

export function addDays(ymd: string, n: number): string {
  const d = toUTC(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function 월요일Of(ymd: string): string {
  const dow = toUTC(ymd).getUTCDay() // 0=일 … 6=토
  return addDays(ymd, -((dow + 6) % 7))
}

export function 소속월Of(월요일: string): 연월 {
  return addDays(월요일, 4).slice(0, 7)
}

export function 다음달(ym: 연월): 연월 {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function 이전달(ym: 연월): 연월 {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function md(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

export function 달의주목록(ym: 연월): 주정보[] {
  let 월요일 = 월요일Of(`${ym}-01`)
  if (소속월Of(월요일) !== ym) 월요일 = addDays(월요일, 7)
  const out: 주정보[] = []
  while (소속월Of(월요일) === ym) {
    const 일요일 = addDays(월요일, 6)
    const 주차 = out.length + 1
    out.push({ 월요일, 일요일, 소속월: ym, 주차, label: `${주차}주차 ${md(월요일)}~${md(일요일)}` })
    월요일 = addDays(월요일, 7)
  }
  return out
}

export type 선택상태 = {
  월: 연월
  주목록: 주정보[]
  선택주: 주정보
  금주월요일: string
  이전가능: boolean
  다음가능: boolean
}

/**
 * URL 파라미터 → 화면 상태. 잘못됐거나 범위 밖이면 조용히 기본(금주)으로 돌린다.
 * 범위 = [최소월, 금주가 속한 달]. 미래 달은 실적이 없으므로 막는다.
 */
export function resolve선택(오늘: string, monthParam?: string, weekParam?: string): 선택상태 {
  const 금주월요일 = 월요일Of(오늘)
  const 금주월 = 소속월Of(금주월요일)
  const m = monthParam ?? ''
  const 유효 = /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m >= 최소월 && m <= 금주월
  const 월 = 유효 ? m : 금주월
  const 주목록 = 달의주목록(월)
  const 선택주 =
    주목록.find((w) => w.월요일 === weekParam) ??
    주목록.find((w) => w.월요일 === 금주월요일) ??
    주목록[주목록.length - 1]
  return { 월, 주목록, 선택주, 금주월요일, 이전가능: 월 > 최소월, 다음가능: 월 < 금주월 }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: PASS (14 tests)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/gongmu/_lib/주차.ts" "src/app/(dashboard)/gongmu/_lib/주차.test.ts"
git commit -m "feat(gongmu): 금요일 기준으로 주의 소속 월을 정하는 주차 규칙"
```

---

### Task 2: 담당자별 집계 (`erp-실적.ts`)

**Files:**
- Create: `src/app/(dashboard)/gongmu/_lib/erp-실적.ts`
- Test: `src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts
import { describe, expect, it } from 'vitest'
import { 달의주목록 } from './주차'
import {
  build담당자별실적, build달력비교, 설명줄, 조회기간, 천원, type 원이력행,
} from './erp-실적'

const 담당자 = [{ id: 7, 이름: '김무선' }, { id: 9, 이름: '김상훈' }]
const 주9월 = 달의주목록('2026-09') // 8/31 ~ 9/27

let seq = 0
function 행(작업일자: string, 원: number | null, 담당공무_id: number | null): 원이력행 {
  seq += 1
  return { id: seq, 수주_id: 100 + seq, 작업일자, 성과금액: 원, 담당공무_id, 지중no: `J${seq}`, 공사명: `공사${seq}` }
}

describe('천원', () => {
  it('반올림, null은 0', () => {
    expect(천원(1_499)).toBe(1)
    expect(천원(1_500)).toBe(2)
    expect(천원(null)).toBe(0)
    expect(천원(-2_600)).toBe(-3)
  })
})

describe('조회기간', () => {
  it('9월 = 주 기준 [8/31, 9/28)과 달력 [9/1, 10/1)의 합집합 → [8/31, 10/1)', () => {
    expect(조회기간('2026-09', 주9월)).toEqual({ from: '2026-08-31', to: '2026-10-01' })
  })
})

describe('build담당자별실적', () => {
  const 행들 = [
    행('2026-08-31', 1_627_000, 7),   // 9월 1주차
    행('2026-09-22', 9_687_400, 7),   // 4주차
    행('2026-09-23', 2_404_600, 9),   // 4주차
    행('2026-09-23', 530_000, null),  // 미지정
    행('2026-09-24', -200_000, 7),    // 음수 유지
    행('2026-09-10', null, 9),        // null = 0
    행('2026-09-15', 3_000_000, 42),  // 목록에 없는 담당자
    행('2026-09-29', 5_000_000, 7),   // 10월 소속 → 제외
  ]
  const r = build담당자별실적(행들, 담당자, 주9월, '2026-09-21')

  it('순서: 담당자(목록 순) → 삭제된 담당자 → 미지정', () => {
    expect(r.묶음.map((g) => g.key)).toEqual(['p7', 'p9', 'x42', 'none'])
  })
  it('김무선: 월누적 = 1,627 + 9,687 − 200, 선택 주(9/21) = 9,687 − 200', () => {
    const g = r.묶음.find((x) => x.key === 'p7')!
    expect(g.월누적천원).toBe(1_627 + 9_687 - 200)
    expect(g.선택주천원).toBe(9_687 - 200)
    expect(g.건수).toBe(3)
    expect(g.행.map((x) => x.작업일자)).toEqual(['2026-08-31', '2026-09-22', '2026-09-24'])
  })
  it('null 금액 행은 0천원으로 건수에만 잡힌다', () => {
    const g = r.묶음.find((x) => x.key === 'p9')!
    expect(g.건수).toBe(2)
    expect(g.월누적천원).toBe(2_405)
  })
  it('목록에 없는 담당자는 미지정이 아니라 삭제된 담당자 묶음', () => {
    const g = r.묶음.find((x) => x.key === 'x42')!
    expect(g.종류).toBe('삭제됨')
    expect(g.이름).toBe('삭제된 담당자 #42')
    expect(g.월누적천원).toBe(3_000)
  })
  it('미지정 묶음은 행이 0개여도 항상 있다', () => {
    const 빈 = build담당자별실적([], 담당자, 주9월, '2026-09-21')
    expect(빈.묶음.find((x) => x.key === 'none')?.건수).toBe(0)
    expect(빈.묶음.some((x) => x.종류 === '삭제됨')).toBe(false)
  })
  it('검산: 묶음 합 = 주 기준 기간 행들의 천원 합 (10월 소속 9/29 행 제외)', () => {
    const 직접합 = 행들
      .filter((x) => x.작업일자 >= '2026-08-31' && x.작업일자 < '2026-09-28')
      .reduce((s, x) => s + 천원(x.성과금액), 0)
    expect(r.월누적합천원).toBe(직접합)
    expect(r.월누적합천원).toBe(r.묶음.reduce((s, g) => s + g.월누적천원, 0))
    expect(r.선택주합천원).toBe(9_687 - 200 + 2_405 + 530)
  })
})

describe('build달력비교 / 설명줄', () => {
  it('9월: 8/31 행만큼 주 기준이 크다', () => {
    const 행들 = [행('2026-08-31', 1_627_000, 7), 행('2026-09-10', 232_431_000, 7)]
    const b = build달력비교(행들, '2026-09', 주9월)
    expect(b).toEqual({
      달력천원: 232_431,
      주기준천원: 234_058,
      차이천원: 1_627,
      포함된날: [{ 날짜: '2026-08-31', 천원: 1_627 }],
      빠진날: [],
    })
    expect(설명줄(b, '2026-09')).toBe(
      '달력 기준 9월: 232,431천원 · 차이 +1,627천원 = 8/31 실적 포함(9월 주차 소속)',
    )
  })
  it('달력엔 있고 주 기준엔 없는 날(9/28~)은 다른 달 주차로', () => {
    const 행들 = [행('2026-09-10', 100_000, 7), 행('2026-09-29', 5_000_000, 7), 행('2026-09-30', 1_000_000, 9)]
    const b = build달력비교(행들, '2026-09', 주9월)
    expect(b.차이천원).toBe(-6_000)
    expect(b.빠진날).toEqual([{ 날짜: '2026-09-29', 천원: 5_000 }, { 날짜: '2026-09-30', 천원: 1_000 }])
    expect(설명줄(b, '2026-09')).toBe(
      '달력 기준 9월: 6,100천원 · 차이 -6,000천원 = 9/29, 9/30 실적 제외(다른 달 주차 소속)',
    )
  })
  it('경계 날짜에 실적이 없으면 같음', () => {
    const b = build달력비교([행('2026-09-10', 100_000, 7)], '2026-09', 주9월)
    expect(설명줄(b, '2026-09')).toBe('달력 기준 9월과 같음')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts"`
Expected: FAIL — `Failed to resolve import "./erp-실적"`

- [ ] **Step 3: 구현**

```ts
// src/app/(dashboard)/gongmu/_lib/erp-실적.ts
/**
 * 공무 페이지 — 공사이력을 담당공무별로 집계 (2026-09-28)
 *
 * ⚠️ 모든 합계는 행에서 파생한다. 카드·소계·요약이 같은 행 배열을 더하므로 서로 어긋날 수 없다.
 * ⚠️ 단위는 천원. 행마다 반올림하고 합계는 반올림된 행의 합이다 — 목록을 손으로 더한 값과
 *    카드 숫자가 1천원이라도 다르면 보는 사람에게 그건 '틀린 표'다(대시보드 실적 팝업과 같은 원칙).
 * 검산식: 담당자 합 + 삭제된 담당자 + 미지정 = 주 기준 기간의 공사 진행 합계.
 */
import { addDays, 월요일Of, 다음달, type 연월, type 주정보 } from './주차'

export type 담당자 = { id: number; 이름: string }

export type 원이력행 = {
  id: number
  수주_id: number
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
  지중no: string
  공사명: string
}

export type 실적행 = 원이력행 & { 천원: number; 월요일: string }

export type 담당묶음 = {
  /** 'p{id}' 담당 · 'x{id}' 삭제된 담당자 · 'none' 미지정 */
  key: string
  종류: '담당' | '삭제됨' | '미지정'
  담당공무_id: number | null
  이름: string
  선택주천원: number
  월누적천원: number
  건수: number
  /** 작업일자 오름차순 */
  행: 실적행[]
}

export type 담당자별실적 = { 묶음: 담당묶음[]; 선택주합천원: number; 월누적합천원: number }

export function 천원(원: number | null): number {
  return Math.round((원 ?? 0) / 1000)
}

function 주기준기간(주목록: 주정보[]): { from: string; to: string } {
  return { from: 주목록[0].월요일, to: addDays(주목록[주목록.length - 1].월요일, 7) }
}

function 달력기간(월: 연월): { from: string; to: string } {
  return { from: `${월}-01`, to: `${다음달(월)}-01` }
}

/** 주 기준 집계와 달력 기준 비교를 한 번의 조회로 하려고 두 기간의 합집합을 준다. to는 미포함. */
export function 조회기간(월: 연월, 주목록: 주정보[]): { from: string; to: string } {
  const w = 주기준기간(주목록)
  const c = 달력기간(월)
  return { from: w.from < c.from ? w.from : c.from, to: w.to > c.to ? w.to : c.to }
}

function 빈묶음(key: string, 종류: 담당묶음['종류'], 담당공무_id: number | null, 이름: string): 담당묶음 {
  return { key, 종류, 담당공무_id, 이름, 선택주천원: 0, 월누적천원: 0, 건수: 0, 행: [] }
}

export function build담당자별실적(
  행들: 원이력행[],
  담당자목록: 담당자[],
  주목록: 주정보[],
  선택월요일: string,
): 담당자별실적 {
  const { from, to } = 주기준기간(주목록)
  const 대상: 실적행[] = 행들
    .filter((r) => r.작업일자 >= from && r.작업일자 < to)
    .map((r) => ({ ...r, 천원: 천원(r.성과금액), 월요일: 월요일Of(r.작업일자) }))
    .sort((a, b) => a.작업일자.localeCompare(b.작업일자) || a.id - b.id)

  const 담당 = new Map<number, 담당묶음>(
    담당자목록.map((d) => [d.id, 빈묶음(`p${d.id}`, '담당', d.id, d.이름)]),
  )
  const 삭제됨 = new Map<number, 담당묶음>()
  const 미지정 = 빈묶음('none', '미지정', null, '미지정')

  for (const r of 대상) {
    let g: 담당묶음
    if (r.담당공무_id == null) {
      g = 미지정
    } else if (담당.has(r.담당공무_id)) {
      g = 담당.get(r.담당공무_id)!
    } else {
      // 담당자가 목록에서 지워진 행 — 미지정으로 치면 "지정했는데 미지정"이라는 거짓이 된다
      if (!삭제됨.has(r.담당공무_id)) {
        삭제됨.set(r.담당공무_id, 빈묶음(`x${r.담당공무_id}`, '삭제됨', r.담당공무_id, `삭제된 담당자 #${r.담당공무_id}`))
      }
      g = 삭제됨.get(r.담당공무_id)!
    }
    g.행.push(r)
    g.건수 += 1
    g.월누적천원 += r.천원
    if (r.월요일 === 선택월요일) g.선택주천원 += r.천원
  }

  const 묶음 = [...담당.values(), ...[...삭제됨.values()].sort((a, b) => a.key.localeCompare(b.key)), 미지정]
  return {
    묶음,
    선택주합천원: 묶음.reduce((s, g) => s + g.선택주천원, 0),
    월누적합천원: 묶음.reduce((s, g) => s + g.월누적천원, 0),
  }
}

export type 날짜금액 = { 날짜: string; 천원: number }

export type 달력비교 = {
  달력천원: number
  주기준천원: number
  /** 주기준 − 달력 */
  차이천원: number
  /** 주 기준엔 있고 달력엔 없는 날 (예: 9월의 8/31) */
  포함된날: 날짜금액[]
  /** 달력엔 있고 주 기준엔 없는 날 (예: 9월의 9/28~9/30) */
  빠진날: 날짜금액[]
}

export function build달력비교(행들: 원이력행[], 월: 연월, 주목록: 주정보[]): 달력비교 {
  const w = 주기준기간(주목록)
  const c = 달력기간(월)
  let 달력천원 = 0
  let 주기준천원 = 0
  const 포함 = new Map<string, number>()
  const 빠짐 = new Map<string, number>()
  for (const r of 행들) {
    const k = 천원(r.성과금액)
    const in주 = r.작업일자 >= w.from && r.작업일자 < w.to
    const in달 = r.작업일자 >= c.from && r.작업일자 < c.to
    if (in주) 주기준천원 += k
    if (in달) 달력천원 += k
    if (in주 && !in달) 포함.set(r.작업일자, (포함.get(r.작업일자) ?? 0) + k)
    if (in달 && !in주) 빠짐.set(r.작업일자, (빠짐.get(r.작업일자) ?? 0) + k)
  }
  const 목록 = (m: Map<string, number>) =>
    [...m].sort(([a], [b]) => a.localeCompare(b)).map(([날짜, 천원]) => ({ 날짜, 천원 }))
  return { 달력천원, 주기준천원, 차이천원: 주기준천원 - 달력천원, 포함된날: 목록(포함), 빠진날: 목록(빠짐) }
}

function md(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

/**
 * 요약 카드의 설명 줄. 두 숫자가 다른 게 오류가 아니라 주차 규칙 때문임을 그 자리에서 말한다.
 * '대시보드'라고 쓰지 않는다 — 대시보드 실적은 지금 준공분까지 합친 값이라 이 숫자와 다르다.
 */
export function 설명줄(b: 달력비교, 월: 연월): string {
  const m = Number(월.slice(5, 7))
  if (b.포함된날.length === 0 && b.빠진날.length === 0) return `달력 기준 ${m}월과 같음`
  const sign = b.차이천원 > 0 ? '+' : b.차이천원 < 0 ? '-' : ''
  const 사유: string[] = []
  if (b.포함된날.length > 0) 사유.push(`${b.포함된날.map((d) => md(d.날짜)).join(', ')} 실적 포함(${m}월 주차 소속)`)
  if (b.빠진날.length > 0) 사유.push(`${b.빠진날.map((d) => md(d.날짜)).join(', ')} 실적 제외(다른 달 주차 소속)`)
  return (
    `달력 기준 ${m}월: ${b.달력천원.toLocaleString('ko-KR')}천원 · ` +
    `차이 ${sign}${Math.abs(b.차이천원).toLocaleString('ko-KR')}천원 = ${사유.join(', ')}`
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts"`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/gongmu/_lib/erp-실적.ts" "src/app/(dashboard)/gongmu/_lib/erp-실적.test.ts"
git commit -m "feat(gongmu): 공사이력을 담당공무별로 집계하고 달력 기준과의 차이를 설명"
```

---

### Task 3: 공사이력 저장 함수 (`update-공사이력.ts`)

**Files:**
- Create: `src/app/(dashboard)/progress/_lib/update-공사이력.ts`
- Test: `src/app/(dashboard)/progress/_lib/update-공사이력.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/(dashboard)/progress/_lib/update-공사이력.test.ts
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { delete공사이력, update공사이력, 저장실패메시지 } from './update-공사이력'

type 호출기록 = { table?: string; update?: unknown; delete?: boolean; eq?: [string, unknown]; select?: string }

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: 호출기록 = {}
  const chain = {
    update(p: unknown) { calls.update = p; return chain },
    delete() { calls.delete = true; return chain },
    eq(c: string, v: unknown) { calls.eq = [c, v]; return chain },
    select(s: string) { calls.select = s; return Promise.resolve(result) },
  }
  const client = { from(t: string) { calls.table = t; return chain } } as unknown as SupabaseClient<Database>
  return { client, calls }
}

describe('update공사이력', () => {
  it('1행이 돌아오면 성공, 넘긴 칸만 보낸다(부분 업데이트)', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 5 }], error: null })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: true })
    expect(calls).toEqual({ table: '공사이력', update: { 담당공무_id: 7 }, eq: ['id', 5], select: 'id' })
  })
  it('0행이면 not-updated — RLS에 막히거나 이미 삭제된 행은 에러 없이 0행으로 온다', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('data가 null이어도 not-updated', async () => {
    const { client } = fakeClient({ data: null, error: null })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('에러면 error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    await expect(update공사이력(client, 5, { 담당공무_id: 7 })).resolves.toEqual({ ok: false, reason: 'error' })
  })
})

describe('delete공사이력', () => {
  it('1행이면 성공', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 5 }], error: null })
    await expect(delete공사이력(client, 5)).resolves.toEqual({ ok: true })
    expect(calls).toEqual({ table: '공사이력', delete: true, eq: ['id', 5], select: 'id' })
  })
  it('0행이면 not-updated', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(delete공사이력(client, 5)).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
})

describe('저장실패메시지', () => {
  it('사유별 문구', () => {
    expect(저장실패메시지('error')).toBe('저장에 실패했습니다.')
    expect(저장실패메시지('not-updated')).toBe('저장되지 않았습니다 (권한이 없거나 이미 삭제된 이력).')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/progress/_lib/update-공사이력.test.ts"`
Expected: FAIL — `Failed to resolve import "./update-공사이력"`

- [ ] **Step 3: 구현**

```ts
// src/app/(dashboard)/progress/_lib/update-공사이력.ts
/**
 * 공사이력 쓰기의 단일 통로 (이력 수정 시트 · 공무 페이지 미지정 담당 지정)
 *
 * ⚠️ RLS(is_whitelisted)에 막히거나 그 사이 삭제된 행은 에러가 아니라 "0행 수정 = 성공"으로 온다.
 *    .select('id')로 실제로 바뀐 행을 돌려받아 1행이 아니면 실패로 본다 — 안 그러면 화면이
 *    "저장됐습니다"라고 거짓말한다.
 * ⚠️ 바꿀 칸만 보낸다(부분 업데이트). 폼 전체를 덮어쓰지 않는다.
 * 클라이언트는 호출부가 넘긴다 — 테스트에서 가짜를 꽂으려는 것.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type 공사이력Patch = Partial<{
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
}>

export type 실패사유 = 'error' | 'not-updated'
export type 저장결과 = { ok: true } | { ok: false; reason: 실패사유 }

type 결과 = { data: { id: number }[] | null; error: unknown }

function 판정({ data, error }: 결과): 저장결과 {
  if (error) return { ok: false, reason: 'error' }
  if (!data || data.length !== 1) return { ok: false, reason: 'not-updated' }
  return { ok: true }
}

export async function update공사이력(
  supabase: SupabaseClient<Database>,
  id: number,
  patch: 공사이력Patch,
): Promise<저장결과> {
  const res = await supabase.from('공사이력').update(patch).eq('id', id).select('id')
  return 판정(res as unknown as 결과)
}

export async function delete공사이력(supabase: SupabaseClient<Database>, id: number): Promise<저장결과> {
  const res = await supabase.from('공사이력').delete().eq('id', id).select('id')
  return 판정(res as unknown as 결과)
}

export function 저장실패메시지(reason: 실패사유): string {
  return reason === 'not-updated'
    ? '저장되지 않았습니다 (권한이 없거나 이미 삭제된 이력).'
    : '저장에 실패했습니다.'
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/progress/_lib/update-공사이력.test.ts"`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/progress/_lib/update-공사이력.ts" "src/app/(dashboard)/progress/_lib/update-공사이력.test.ts"
git commit -m "feat(progress): 공사이력 저장을 한 함수로 모으고 0행 수정을 실패로 판정"
```

---

### Task 4: 이력 수정 시트에 담당공무 칸

**Files:**
- Modify: `src/app/(dashboard)/progress/_types.ts`
- Modify: `src/app/(dashboard)/progress/_components/이력수정Sheet.tsx`
- Modify: `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx`
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`
- Modify: `src/app/(dashboard)/progress/page.tsx`

⚠️ **이 태스크의 핵심 위험:** 시트는 저장할 때 `담당공무_id`를 항상 보낸다. 시트에 들어오는 행에 **DB의 실제 `담당공무_id`가 실려 있지 않으면**, 드롭다운이 "미지정"으로 출발하고 저장 한 번에 **기존 담당이 `null`로 지워진다.** 사용자는 날짜만 고쳤는데 담당이 사라지는 사고다. 그래서 `공사이력행`과 `이력레코드`에 `담당공무_id`를 **필수** 칸으로 넣는다. 그러면 행을 만드는 곳 중 하나라도 이 값을 빠뜨렸을 때 tsc가 빌드 단계에서 잡는다.

- [ ] **Step 1: 타입에 `담당공무_id` 추가**

`src/app/(dashboard)/progress/_types.ts`의 8번째 줄:

```ts
export type 공사이력행 = Pick<공사이력Row, 'id' | '작업일자' | '성과금액' | '수주_id' | '담당공무_id'> & {
```

`src/app/(dashboard)/progress/_components/이력수정Sheet.tsx`의 `이력레코드`:

```ts
export type 이력레코드 = { id: number; 작업일자: string; 성과금액: number | null; 담당공무_id: number | null }
```

- [ ] **Step 2: tsc로 빠진 곳 확인 (실패해야 정상)**

Run: `npx tsc --noEmit -p .`
Expected: FAIL. `ProgressHistoryTable.tsx`, `ProgressInputForm.tsx`의 `openRow`에서 `담당공무_id` 누락 에러가 나야 한다. 에러가 안 나면 타입이 연결되지 않은 것이므로 멈추고 원인을 확인한다.

- [ ] **Step 3: 이력수정Sheet 수정**

`이력수정Sheet.tsx` 전체를 다음으로 바꾼다.

```tsx
'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Trash2 } from 'lucide-react'
import type { 공사이력행 } from '../_types'
import { PerformanceInput } from './성과Input'
import { 직전누계 } from '../_lib/percent'
import { delete공사이력, update공사이력, 저장실패메시지 } from '../_lib/update-공사이력'

export type 이력레코드 = { id: number; 작업일자: string; 성과금액: number | null; 담당공무_id: number | null }

// 이력수정 시트 (컴포넌트 함수명은 ASCII 대문자 시작 — react-hooks 린트가 훅 검사를 하는 조건)
export function HistoryEditSheet({
  open,
  onOpenChange,
  row,
  records,
  loading,
  공무담당자목록,
  onSaved,
  onDeleted,
  showToast,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: 공사이력행 | null
  records: 이력레코드[]          // 그 공사 전체 이력(직전누계 계산용). 호출부가 준비해 넘긴다.
  loading: boolean               // records 불러오는 중이면 % 입력 자리에 스피너
  공무담당자목록: { id: number; 이름: string }[]
  onSaved: () => void            // 저장 성공 → 호출부가 재조회/닫기
  onDeleted: () => void          // 삭제 성공 → 호출부가 재조회/닫기
  showToast: (ok: boolean, msg: string) => void
}) {
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [edit담당공무Id, setEdit담당공무Id] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // row 변경 감지용 기억. effect 동기화는 이전 행 값이 한 프레임 그려진 뒤 재렌더되므로
  // (틀린 프레임 + 낭비 렌더), 렌더 중 조정으로 커밋 전에 새 값으로 바로잡는다.
  const [prevRow, setPrevRow] = useState(row)
  if (row !== prevRow) {
    setPrevRow(row)
    if (row) {
      setEditDate(row.작업일자)
      setEditAmount(row.성과금액)
      // DB 값으로 출발해야 한다 — 저장이 담당공무_id를 항상 보내므로, 여기서 null로 출발하면
      // 날짜만 고친 저장이 기존 담당을 지운다.
      setEdit담당공무Id(row.담당공무_id)
    }
  }

  // 수정 대상 수주의 하도적용금액(=환산 base). 조인된 원자료로 계산.
  const editBase = useMemo(() => {
    const s = row?.수주
    if (!s || s.수주금액_공급가 == null || s.보험료율 == null || s.하도전용율 == null) return null
    return s.수주금액_공급가 * (1 - s.보험료율) * s.하도전용율
  }, [row])

  // 수정 중 레코드의 % 기준: 자기 자신을 뺀 "그 작업일자 직전" 누계.
  // strict <(직전누계) + id 필터 이중안전. editDate(작업일자 변경)를 바꿔도 자기 자신은 빠진다.
  const edit직전누계 = useMemo(
    () => 직전누계(records.filter((r) => r.id !== row?.id), editDate),
    [records, editDate, row],
  )

  // 목록에 없는 담당(삭제된 담당자)이 걸린 행이면 드롭다운에 그 값을 따로 보여준다 —
  // 안 보여주면 select가 "미지정"처럼 보이는데 저장은 옛 id를 그대로 보내 화면과 저장값이 어긋난다.
  const 목록에없는담당 =
    edit담당공무Id != null && !공무담당자목록.some((g) => g.id === edit담당공무Id) ? edit담당공무Id : null

  const handleSave = async () => {
    if (!row) return
    setSaving(true)
    const 결과 = await update공사이력(createClient(), row.id, {
      작업일자: editDate,
      성과금액: editAmount,
      담당공무_id: edit담당공무Id,
    })
    setSaving(false)
    if (!결과.ok) { showToast(false, 저장실패메시지(결과.reason)); return }
    showToast(true, '수정되었습니다.')
    onSaved()
  }

  const handleDelete = async () => {
    if (!row) return
    setDeleting(true)
    const 결과 = await delete공사이력(createClient(), row.id)
    setDeleting(false)
    if (!결과.ok) {
      showToast(false, 결과.reason === 'not-updated' ? '삭제되지 않았습니다 (권한이 없거나 이미 삭제된 이력).' : '삭제에 실패했습니다.')
      return
    }
    showToast(true, '삭제되었습니다.')
    onDeleted()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start gap-2 pr-8">
            <span className="font-mono text-xs text-gray-400 mt-0.5 shrink-0">{row?.수주?.지중no}</span>
            <SheetTitle className="text-base font-semibold text-left leading-snug">{row?.수주?.공사명}</SheetTitle>
          </div>
          <SheetDescription className="text-left">공사이력 수정</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
            <Input type="date" className="h-9 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="size-4 animate-spin" /> 이력 불러오는 중...
              </div>
            ) : (
              <PerformanceInput
                value={editAmount}
                onChange={setEditAmount}
                하도적용금액={records.length > 0 ? editBase : null}
                직전누계={edit직전누계}
              />
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">담당 공무</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background text-sm px-3 outline-none focus:border-ring"
              value={edit담당공무Id ?? ''}
              onChange={(e) => setEdit담당공무Id(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">미지정</option>
              {목록에없는담당 != null && (
                <option value={목록에없는담당}>삭제된 담당자 #{목록에없는담당}</option>
              )}
              {공무담당자목록.map((g) => (
                <option key={g.id} value={g.id}>{g.이름}</option>
              ))}
            </select>
          </div>
          <Button className="w-full bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            저장
          </Button>
          <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
            삭제
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: ProgressHistoryTable 수정**

`ProgressHistoryTable.tsx`에서 세 군데를 고친다.

Props (14줄):

```tsx
type Props = { date_from: string; date_to: string; 공무담당자목록: { id: number; 이름: string }[] }

export function ProgressHistoryTable({ date_from: initFrom, date_to: initTo, 공무담당자목록 }: Props) {
```

목록 조회 select (38줄):

```tsx
      .select('id, 작업일자, 성과금액, 수주_id, 담당공무_id, 수주!수주_id(지중no, 공사명, 수주금액_공급가, 보험료율, 하도전용율, 준공여부)')
```

`openEdit`의 select (73줄):

```tsx
      .select('id, 작업일자, 성과금액, 담당공무_id')
```

`<HistoryEditSheet`에 prop 추가 (`loading={editLoading}` 다음 줄):

```tsx
        공무담당자목록={공무담당자목록}
```

- [ ] **Step 5: progress/page.tsx 수정**

`<ProgressHistoryTable ... />` 한 줄을:

```tsx
        <ProgressHistoryTable date_from={date_from} date_to={date_to} 공무담당자목록={공무담당자목록} />
```

- [ ] **Step 6: ProgressInputForm 수정**

1) `이력목록` state와 두 조회의 캐스트에서 `Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>`를 모두 `이력레코드`로 바꾼다(3곳: `useState`, `reload이력목록`의 캐스트, `load수주데이터`의 캐스트).
2) 두 조회의 `.select('id, 작업일자, 성과금액')`를 `.select('id, 작업일자, 성과금액, 담당공무_id')`로 바꾼다(`reload이력목록`, `load수주데이터`).
3) `openRow`의 `setEditRow({ ... })`에서 `수주_id: 선택수주Id,` 다음 줄에 추가한다.

```tsx
      담당공무_id: rec.담당공무_id,
```

4) 파일 끝 `<HistoryEditSheet`에서 `loading={false}` 다음 줄에 추가한다.

```tsx
        공무담당자목록={공무담당자목록}
```

5) `공사이력Row` import가 더 이상 쓰이지 않으면 import에서 뺀다(lint가 알려준다).

- [ ] **Step 7: 타입·테스트·린트 통과 확인**

Run: `npx tsc --noEmit -p . && npx vitest run && npx eslint "src/app/(dashboard)/progress"`
Expected: 전부 통과. tsc 에러 0, vitest 전체 PASS, eslint 경고 없음.

- [ ] **Step 8: 커밋**

```bash
git add "src/app/(dashboard)/progress"
git commit -m "feat(progress): 이력 수정 시트에서 담당 공무를 고칠 수 있게 한다"
```

---

### Task 5: 공무 페이지 교체

**Files:**
- Rewrite: `src/app/(dashboard)/gongmu/page.tsx`
- Create: `src/app/(dashboard)/gongmu/_components/GongmuActualsView.tsx`
- Create: `src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx`

- [ ] **Step 1: 패널 컴포넌트 작성**

```tsx
// src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { update공사이력, 저장실패메시지 } from '@/app/(dashboard)/progress/_lib/update-공사이력'
import type { 담당묶음, 담당자, 실적행 } from '../_lib/erp-실적'
import type { 연월, 주정보 } from '../_lib/주차'

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`

function AssignRow({ 행, 담당자목록 }: { 행: 실적행; 담당자목록: 담당자[] }) {
  const router = useRouter()
  const [선택, set선택] = useState<number | null>(null)
  const [저장중, set저장중] = useState(false)
  const [에러, set에러] = useState<string | null>(null)

  const save = async () => {
    if (선택 == null) return
    set저장중(true)
    set에러(null)
    const 결과 = await update공사이력(createClient(), 행.id, { 담당공무_id: 선택 })
    set저장중(false)
    if (!결과.ok) { set에러(저장실패메시지(결과.reason)); return }
    // 서버 컴포넌트를 다시 그려 집계를 새로 받는다 — 이 행은 담당자 카드로 옮겨간다
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      <div className="flex gap-2">
        <select
          className="h-8 flex-1 rounded-lg border border-input bg-background text-xs px-2 outline-none focus:border-ring"
          value={선택 ?? ''}
          onChange={(e) => set선택(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">담당 선택</option>
          {담당자목록.map((g) => <option key={g.id} value={g.id}>{g.이름}</option>)}
        </select>
        <Button size="sm" className="h-8 bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={save} disabled={선택 == null || 저장중}>
          {저장중 ? <Loader2 className="size-3.5 animate-spin" /> : '저장'}
        </Button>
      </div>
      {에러 && <p className="text-xs text-red-600">{에러}</p>}
    </div>
  )
}

export function ActualsSheet({
  묶음, 주목록, 선택월요일, 월, 담당자목록, onClose,
}: {
  묶음: 담당묶음 | null
  주목록: 주정보[]
  선택월요일: string
  월: 연월
  담당자목록: 담당자[]
  onClose: () => void
}) {
  // 선택한 주가 맨 위, 나머지는 시간순
  const 주순서 = 묶음
    ? [...주목록].sort((a, b) =>
        a.월요일 === 선택월요일 ? -1 : b.월요일 === 선택월요일 ? 1 : a.월요일.localeCompare(b.월요일))
    : []

  return (
    <Sheet open={묶음 != null} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold text-left">{묶음?.이름}</SheetTitle>
          <SheetDescription className="text-left">
            {Number(월.slice(5, 7))}월 누적 {천원표기(묶음?.월누적천원 ?? 0)} · {묶음?.건수 ?? 0}건
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-5">
          {묶음 && 묶음.건수 === 0 && (
            <p className="text-sm text-gray-400">
              {묶음.종류 === '미지정' ? '미지정 이력이 없습니다 ✓' : '이 달에 등록된 실적이 없습니다.'}
            </p>
          )}
          {주순서.map((w) => {
            const 행들 = 묶음!.행.filter((r) => r.월요일 === w.월요일)
            if (행들.length === 0) return null
            const 소계 = 행들.reduce((s, r) => s + r.천원, 0)
            return (
              <section key={w.월요일}>
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-1 mb-2">
                  <h3 className="text-sm font-semibold text-[#1e2d5a]">
                    {w.label}{w.월요일 === 선택월요일 && <span className="ml-1.5 text-xs text-blue-600">선택</span>}
                  </h3>
                  <span className="text-sm font-bold text-[#1e2d5a] tabular-nums">{천원표기(소계)}</span>
                </div>
                <ul className="space-y-2">
                  {행들.map((r) => (
                    <li key={r.id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{r.공사명}</p>
                          <p className="text-xs text-gray-400">
                            <span className="font-mono">{r.지중no}</span> · {r.작업일자.slice(5).replace('-', '/')}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-800">{천원표기(r.천원)}</span>
                      </div>
                      {묶음!.종류 === '미지정' && <AssignRow 행={r} 담당자목록={담당자목록} />}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {묶음?.종류 === '담당' && 묶음.담당공무_id != null && (
            <Link
              href={`/gongmu/${묶음.담당공무_id}?month=${월}`}
              className="block text-xs text-gray-400 hover:text-gray-600 pt-2"
            >
              주간 보고서 직접 작성(구 양식) →
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: 화면 컴포넌트 작성**

```tsx
// src/app/(dashboard)/gongmu/_components/GongmuActualsView.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { 다음달, 이전달, type 선택상태 } from '../_lib/주차'
import type { 담당자, 담당자별실적 } from '../_lib/erp-실적'
import { ActualsSheet } from './ActualsSheet'

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`

export function GongmuActualsView({
  선택, 실적, 설명, 담당자목록,
}: {
  선택: 선택상태
  실적: 담당자별실적
  설명: string
  담당자목록: 담당자[]
}) {
  // 열린 패널은 key만 기억하고 묶음은 매 렌더 props에서 찾는다 —
  // 담당 지정 후 router.refresh()로 새 집계가 오면 패널 내용도 따라 바뀐다.
  const [열린key, set열린key] = useState<string | null>(null)
  const 열린묶음 = 실적.묶음.find((g) => g.key === 열린key) ?? null

  const [yy, mm] = 선택.월.split('-').map(Number)
  const 월숫자 = (ym: string) => Number(ym.slice(5, 7))
  const navCls = 'border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50'
  const navOff = 'border border-gray-100 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-300 cursor-not-allowed'

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 헤더 · 월 이동 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">공무</h1>
          <p className="text-sm text-gray-500 mt-0.5">{yy}년 {mm}월 · ERP 공사 진행 실적</p>
        </div>
        <div className="flex gap-2">
          {선택.이전가능
            ? <Link href={`/gongmu?month=${이전달(선택.월)}`} className={navCls}>◀ {월숫자(이전달(선택.월))}월</Link>
            : <span className={navOff}>◀ {월숫자(이전달(선택.월))}월</span>}
          <span className="border border-[#1e2d5a] bg-[#1e2d5a] text-white rounded-lg px-3 py-1.5 text-sm font-semibold">{mm}월</span>
          {선택.다음가능
            ? <Link href={`/gongmu?month=${다음달(선택.월)}`} className={navCls}>{월숫자(다음달(선택.월))}월 ▶</Link>
            : <span className={navOff}>{월숫자(다음달(선택.월))}월 ▶</span>}
        </div>
      </div>

      {/* 주 칩 */}
      <div className="flex flex-wrap gap-2 mb-5">
        {선택.주목록.map((w) => (
          <Link
            key={w.월요일}
            href={`/gongmu?month=${선택.월}&week=${w.월요일}`}
            className={cn(
              'rounded-full px-3 py-1 text-xs border',
              w.월요일 === 선택.선택주.월요일
                ? 'bg-[#1e2d5a] border-[#1e2d5a] text-white font-semibold'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {w.label}{w.월요일 === 선택.금주월요일 && ' · 금주'}
          </Link>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">{선택.선택주.label} 실적</p>
            <p className="text-2xl font-bold text-[#1e2d5a] tabular-nums">{천원표기(실적.선택주합천원)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">{mm}월 누적</p>
            <p className="text-2xl font-bold text-[#1e2d5a] tabular-nums">{천원표기(실적.월누적합천원)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">{설명}</p>
      </div>

      {/* 담당자 카드 */}
      <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">
        담당자별 실적 · 누르면 이력 목록
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {실적.묶음.map((g) => {
          const 미지정 = g.종류 === '미지정'
          const 경고 = g.종류 !== '담당' && g.건수 > 0
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => set열린key(g.key)}
              className={cn(
                'text-left rounded-2xl p-5 shadow-sm border-[1.5px] transition-all hover:shadow-md',
                경고 ? 'bg-amber-50 border-amber-300 hover:border-amber-400' : 'bg-white border-transparent hover:border-blue-400',
              )}
            >
              <p className={cn('font-bold mb-2', 경고 ? 'text-amber-800' : 'text-[#1e2d5a]')}>{g.이름}</p>
              {미지정 && g.건수 === 0 ? (
                <p className="text-sm text-green-600 font-semibold">미지정 없음 ✓</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{선택.선택주.주차}주차</p>
                  <p className="text-xl font-bold text-[#1e2d5a] tabular-nums mb-2">{천원표기(g.선택주천원)}</p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    월 누적 {천원표기(g.월누적천원)} · {g.건수}건
                  </p>
                </>
              )}
            </button>
          )
        })}
      </div>

      <ActualsSheet
        묶음={열린묶음}
        주목록={선택.주목록}
        선택월요일={선택.선택주.월요일}
        월={선택.월}
        담당자목록={담당자목록}
        onClose={() => set열린key(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: page.tsx 교체**

`src/app/(dashboard)/gongmu/page.tsx` 전체를 다음으로 바꾼다.

```tsx
// src/app/(dashboard)/gongmu/page.tsx
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { todayKST } from '@/lib/kst'
import { resolve선택 } from './_lib/주차'
import {
  build담당자별실적, build달력비교, 설명줄, 조회기간, type 담당자, type 원이력행,
} from './_lib/erp-실적'
import { GongmuActualsView } from './_components/GongmuActualsView'

export const metadata = { title: '공무 | 영전사 ERP' }

type 조회행 = {
  id: number
  수주_id: number
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
  수주: { 지중no: string; 공사명: string } | null
}

type 페이지결과 = PromiseLike<{ data: 조회행[] | null; error: { message: string } | null }>

/** 실패하면 null — 호출부가 0이 아니라 에러 화면을 그리게 한다. JSX를 try 안에서 만들지 않으려고 분리했다. */
async function load(기간: { from: string; to: string }): Promise<{ 담당자목록: 담당자[]; 행들: 원이력행[] } | null> {
  try {
    const supabase = await createClient()
    const [담당결과, 이력] = await Promise.all([
      supabase.from('공무담당자').select('id, 이름').order('id'),
      // 1000행에서 조용히 잘리지 않게 페이지 단위로 끝까지 받는다(.order 필수)
      fetchAllRows<조회행>('공사이력', (from, to) =>
        supabase
          .from('공사이력')
          .select('id, 수주_id, 작업일자, 성과금액, 담당공무_id, 수주!수주_id(지중no, 공사명)')
          .eq('준공정산', false)
          .gte('작업일자', 기간.from)
          .lt('작업일자', 기간.to)
          .order('id')
          .range(from, to) as unknown as 페이지결과,
      ),
    ])
    if (담당결과.error) throw new Error(`공무담당자 조회 실패: ${담당결과.error.message}`)
    return {
      담당자목록: (담당결과.data ?? []) as unknown as 담당자[],
      행들: 이력.map((r) => ({
        id: r.id,
        수주_id: r.수주_id,
        작업일자: r.작업일자,
        성과금액: r.성과금액,
        담당공무_id: r.담당공무_id,
        지중no: r.수주?.지중no ?? '',
        공사명: r.수주?.공사명 ?? '(공사명 없음)',
      })),
    }
  } catch (e) {
    console.error('[gongmu] ERP 실적 조회 실패', e)
    return null
  }
}

export default async function GongmuPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; week?: string }>
}) {
  const sp = await searchParams
  // '오늘'은 KST로 못 박는다. 서버 시계는 UTC라 new Date().getDate()로 읽으면
  // 월요일 KST 00:00~09:00 동안 '금주'가 지난주로 잡힌다.
  const 선택 = resolve선택(todayKST(), sp.month, sp.week)
  const 데이터 = await load(조회기간(선택.월, 선택.주목록))

  if (!데이터) {
    // 0으로 그리면 "이번 주 실적 없음"과 화면상 구별이 안 된다 — 못 불러왔다고 말한다
    return (
      <div className="p-4 md:p-6" style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">공무</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          ERP 실적을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      </div>
    )
  }

  const { 담당자목록, 행들 } = 데이터
  const 실적 = build담당자별실적(행들, 담당자목록, 선택.주목록, 선택.선택주.월요일)
  const 설명 = 설명줄(build달력비교(행들, 선택.월, 선택.주목록), 선택.월)

  return <GongmuActualsView 선택={선택} 실적={실적} 설명={설명} 담당자목록={담당자목록} />
}
```

- [ ] **Step 4: 타입·린트·테스트 통과 확인**

Run: `npx tsc --noEmit -p . && npx eslint "src/app/(dashboard)/gongmu" "src/app/(dashboard)/progress" && npx vitest run`
Expected: 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/gongmu"
git commit -m "feat(gongmu): 공무 페이지를 ERP 담당자별 주간 실적 조회로 교체"
```

---

### Task 6: 검증

- [ ] **Step 1: 빌드**

Run: `npm run build`
Expected: 성공. `/gongmu` 경로가 동적(ƒ)으로 표시된다.

- [ ] **Step 2: 운영 데이터로 숫자 대조 (읽기 전용 스크립트, 커밋하지 않음)**

`scripts/_tmp-verify-gongmu.ts`를 만든다.

```ts
import 'dotenv/config'
import { createAdminClient } from '../src/lib/supabase/admin'
import { fetchAllRows } from '../src/lib/supabase/fetch-all'
import { resolve선택 } from '../src/app/(dashboard)/gongmu/_lib/주차'
import { build담당자별실적, build달력비교, 설명줄, 조회기간 } from '../src/app/(dashboard)/gongmu/_lib/erp-실적'

async function main() {
  const db = createAdminClient()
  const 선택 = resolve선택('2026-09-28', '2026-09', '2026-09-21')
  const 기간 = 조회기간(선택.월, 선택.주목록)
  const { data: 담당자 } = await db.from('공무담당자').select('id, 이름').order('id')
  const raw = (await fetchAllRows('공사이력', (f, t) => db.from('공사이력')
    .select('id, 수주_id, 작업일자, 성과금액, 담당공무_id, 수주!수주_id(지중no, 공사명)')
    .eq('준공정산', false).gte('작업일자', 기간.from).lt('작업일자', 기간.to).order('id').range(f, t))) as any[]
  const 행들 = raw.map((r) => ({ ...r, 지중no: r.수주?.지중no ?? '', 공사명: r.수주?.공사명 ?? '' }))
  const 실적 = build담당자별실적(행들, 담당자 as any, 선택.주목록, 선택.선택주.월요일)
  console.log('월누적', 실적.월누적합천원, '선택주', 실적.선택주합천원)
  for (const g of 실적.묶음) console.log(g.이름, '4주차', g.선택주천원, '누적', g.월누적천원, g.건수 + '건')
  console.log(설명줄(build달력비교(행들, 선택.월, 선택.주목록), 선택.월))
}
main()
```

Run: `DOTENV_CONFIG_PATH=.env.local npx ts-node --transpile-only --project scripts/tsconfig.json -r ./scripts/register-path-alias.cjs scripts/_tmp-verify-gongmu.ts`

Expected:
- 월누적 ≈ 234,058 (행 단위 반올림이라 원 합계 반올림과 몇 천원 다를 수 있다 — 실제 값을 기록한다)
- 김무선 4주차 = 9,687
- 설명 줄에 `8/31 실적 포함(9월 주차 소속)`

확인 후 `rm scripts/_tmp-verify-gongmu.ts`.

- [ ] **Step 3: 화면 확인 (개발 서버)**

Run: `npm run dev` 후 로그인한 브라우저에서 확인한다.
- `/gongmu` → 10월 1주차 기본 선택, ◀ 9월 활성, 10월 ▶ 비활성
- `/gongmu?month=2026-09&week=2026-09-21` → 김무선 카드 4주차 9,687천원, 설명 줄 표시
- `/gongmu?month=2026-08` → 10월로 돌아감
- 미지정 카드 → 패널에 미지정 행과 담당 선택 칸. **실제 운영 데이터를 바꾸므로 저장은 사용자가 직접 하거나 동의를 받은 뒤에 한다.**
- `/progress?tab=history` → 행 수정 시트에 담당 공무 드롭다운, 기존 담당이 선택된 채로 열림

- [ ] **Step 4: 게이트 3·4 (사용자 규칙)**

- 게이트 3: `/code-review`로 변경분 리뷰 → 항목별 수용/반박
- 게이트 4: 커밋 전 이해 질문 1~2개 (예: 이력 수정 시트가 `담당공무_id`를 필수 타입으로 받는 이유 / 0행 저장이 왜 에러가 아닌가)
- 게이트 5: PR 최종 커밋 메시지는 사용자가 작성
