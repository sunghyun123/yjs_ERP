# 매출손익 `말일 / 금요일` 스왑 (PR-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매출손익 화면에 `말일 / 금요일` 기준 스왑 버튼을 두고, 금요일 화면에서는 월별 성과를 "시공 기록"과 "준공 반영" 두 줄로 보여준다. "시공 기록"은 공무 화면 합계와 천원 단위까지 같아야 한다.

**Architecture:** 계산은 순수 함수 하나(`_lib/금요일성과.ts`)에 둔다. 이 함수는 기간 규칙(`주차.ts`), 시공 합계(대시보드 split과 같은 `build월시공내역` + `sum월성과내역`), 반올림(`천원()`), 준공 반영(`calc준공잔여성과`)을 **전부 기존 함수에서 가져오고 새로 만들지 않는다.** 화면은 서버 컴포넌트 그대로 두고, `?basis=friday` 쿼리 파라미터에 따라 공사별 피벗 표 카드만 금요일 월별 표로 바뀐다. KPI·차트는 말일 기준 그대로 둔다(설계 §5-3 "표만 바뀜").

**Tech Stack:** Next.js 16 (App Router, 서버 컴포넌트) · TypeScript · Supabase · vitest

**설계 문서:** `docs/superpowers/specs/2026-11-09-plan-actual-table-and-data-alignment-design.md` §5-3·4·5, §6 PR-1, §7-1(두 줄)

**티어:** A (회계 정합성 + 타임존 지뢰). 게이트 2~5는 Task 단위로 적용한다(Task 5 참고).

---

## 범위에서 뺀 것 (YAGNI — 설계에 없음)

- 금요일 화면의 **공사별 피벗 표.** 설계는 월 합계를 공무 화면과 맞추는 것이 목적이다. 공사별 금요일 피벗은 요청된 적이 없다.
- 금요일 화면의 **연간 합계 칸.** 9월 앞 달이 '—'라서 연간 합계는 말일 KPI의 연간 합계와 다른 범위가 되고, 둘을 비교하는 오해를 낳는다. 칸을 두지 않는다.
- 엑셀 내보내기의 금요일 판. 엑셀은 말일 그대로.

## 결정 사항 (이 계획에서 정함 — 설계에 명시 안 된 것)

1. **단위는 천원.** 공무 화면·대시보드와 같은 단위로 대조하기 위해서다. 말일 피벗(원 단위)과 단위가 다르므로 표 제목에 `(천원)`을 붙인다.
2. **준공 반영은 공사마다 `천원()`으로 반올림한 뒤 더한다.** "합계 = 보이는 행의 합" 원칙(`monthly-revenue-breakdown.ts` 머리말)을 따른다. 원 단위로 더한 설계 문서 실측값(10월 209,393)과 몇 천원 다를 수 있다. 완료 기준은 시공 기록에만 걸려 있다.
3. **'금주 소속월'은 KST로 정한다.** 페이지가 `금주소속월기간(todayKST()).월`을 계산해 순수 함수에 넘긴다. 순수 함수는 시계를 읽지 않는다. KST 경계 동작은 이미 `주차.test.ts`의 `금주소속월기간`·`resolve선택` 테스트가 지킨다.
4. **표시하는 달 = `[최소월(2026-09), 금주 소속월]`.** 그 밖의 달은 '—'(설계 §5-4). 금주 소속월이 다음 해 1월이면(12/28~ 주), 올해 12월까지는 전부 숫자로 나온다.

---

## 파일 구조

| 파일 | 할 일 | 책임 |
|---|---|---|
| `src/app/(dashboard)/_lib/금요일성과.ts` | 생성 | 연도 → 12개월 금요일 기준 성과(시공 기록·준공 반영·합). DB·시계를 모른다 |
| `src/app/(dashboard)/_lib/금요일성과.test.ts` | 생성 | 위 함수의 경계·반올림·누계 테스트 |
| `src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx` | 생성 | 12개월 × 3줄 표(서버 컴포넌트, 상태 없음) |
| `src/app/(dashboard)/sales/_components/BasisToggle.tsx` | 생성 | `말일 / 금요일` 버튼 두 개(클라이언트, URL만 바꿈) |
| `src/app/(dashboard)/sales/_components/YearSelector.tsx` | 수정 | 연도를 바꿔도 `basis`가 유지되게 |
| `src/app/(dashboard)/sales/page.tsx` | 수정 | `basis` 파싱, 금요일이면 표 카드 교체 |

새 계산 파일을 `sales/_lib`가 아니라 `(dashboard)/_lib`에 두는 이유: 같은 폴더의 `공사별손익.ts`·`monthly-split.ts`처럼 여러 화면이 함께 쓰는 집계가 사는 곳이고, PR-2(`/api/kpi/monthly-performance?month=`)도 같은 기간 규칙을 쓴다.

---

## 시작 전 (브랜치)

현재 브랜치 `feat/history-card-generator`는 PR #50로 머지가 끝났다. main에서 새 브랜치를 딴다. 설계 문서·이 계획 문서는 아직 커밋되지 않은 파일이라 브랜치를 옮겨도 그대로 따라온다.

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c feat/sales-friday-basis
git status   # docs/superpowers/specs/2026-11-09-… 와 plans/2026-11-10-… 가 untracked 로 보여야 한다
```

`AGENTS.md`의 수정분은 이 작업과 무관하다. 브랜치 전환이 막히면 `git stash push AGENTS.md`로 따로 보관한다(지우지 않는다).

---

### Task 1: 금요일 기준 월별 성과 계산 (`build금요일성과`)

**Files:**
- Create: `src/app/(dashboard)/_lib/금요일성과.ts`
- Test: `src/app/(dashboard)/_lib/금요일성과.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/(dashboard)/_lib/금요일성과.test.ts
import { describe, expect, it } from 'vitest'
import { build금요일성과, type 금요일월성과 } from './금요일성과'
import type { 공사이력Row, 준공수주Row } from './junggong-seonggwa'

const 수주 = (over: Partial<준공수주Row> & { id: number }): 준공수주Row => ({
  지중no: `JG26-${String(over.id).padStart(3, '0')}`,
  공사명: `테스트 공사 ${over.id}`,
  공사구분: '지중',
  준공여부: false,
  준공일: null,
  준공액_공급가: null,
  수주금액_공급가: 10_000_000,
  보험료율: null,
  하도전용율: null,
  ...over,
})

const 이력 = (수주_id: number, 작업일자: string, 성과금액: number): 공사이력Row => ({
  수주_id,
  작업일자,
  성과금액,
  담당공무_id: null,
})

/** 표시되는 달만 골라 꺼낸다 — 테스트가 '—' 달을 숫자로 착각하지 않게 */
function 월(rows: 금요일월성과[], ym: string) {
  const r = rows.find((x) => x.월 === ym)
  if (!r || !r.표시) throw new Error(`${ym} 은 표시되지 않는 달`)
  return r
}

describe('build금요일성과 — 표시 범위', () => {
  it('12개월을 모두 돌려주고, 최소월(2026-09) 앞 달은 표시하지 않는다', () => {
    const rows = build금요일성과([], [], 2026, '2026-11')
    expect(rows.map((r) => r.월)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ])
    expect(rows.filter((r) => r.표시).map((r) => r.월)).toEqual(['2026-09', '2026-10', '2026-11'])
  })

  it('금주 소속월보다 뒤의 달은 표시하지 않는다 (미래 달)', () => {
    const rows = build금요일성과([], [], 2026, '2026-10')
    expect(rows.find((r) => r.월 === '2026-11')!.표시).toBe(false)
  })

  it('2025년은 전부 최소월 앞이라 하나도 표시하지 않는다', () => {
    expect(build금요일성과([], [], 2025, '2026-11').some((r) => r.표시)).toBe(false)
  })

  it('금주 소속월이 다음 해 1월이면 올해 12월까지 표시한다 (12/28 주 = 2027-01)', () => {
    const rows = build금요일성과([], [], 2026, '2027-01')
    expect(rows.find((r) => r.월 === '2026-12')!.표시).toBe(true)
  })

  it('표시하는 달에는 주차.ts 의 기간을 그대로 싣는다 (10월 = 9/28 ~ 11/2 미포함)', () => {
    const r = 월(build금요일성과([], [], 2026, '2026-11'), '2026-10')
    expect(r.from).toBe('2026-09-28')
    expect(r.to).toBe('2026-11-02')
  })
})

describe('build금요일성과 — 시공 기록', () => {
  it('달력 월이 아니라 금요일 기준 기간으로 자른다', () => {
    const rows = build금요일성과(
      [
        이력(1, '2026-09-28', 5_000_000), // 달력 9월이지만 10월 1주차 → 10월
        이력(1, '2026-11-01', 3_000_000), // 달력 11월이지만 10월 마지막 주(10/26~11/1) → 10월
        이력(1, '2026-11-02', 7_000_000), // 11월 1주차 → 10월 아님
      ],
      [수주({ id: 1 })],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-10').시공기록천원).toBe(8_000)
    expect(월(rows, '2026-09').시공기록천원).toBe(0)
  })

  it('행마다 천원으로 반올림한 뒤 더한다 (공무 화면과 같은 규칙)', () => {
    // 1,400원 행 두 개: 행마다 반올림 → 1 + 1 = 2천원 / 원 단위 합 후 반올림이면 2,800원 → 3천원
    const rows = build금요일성과(
      [이력(1, '2026-10-05', 1_400), 이력(2, '2026-10-06', 1_400)],
      [수주({ id: 1 }), 수주({ id: 2 })],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-10').시공기록천원).toBe(2)
  })

  it('수주 목록에 없는 공사의 이력도 빠뜨리지 않는다 (공무 화면은 수주 유무와 무관하게 더한다)', () => {
    const rows = build금요일성과([이력(99, '2026-10-05', 4_000_000)], [], 2026, '2026-11')
    expect(월(rows, '2026-10').시공기록천원).toBe(4_000)
  })
})

describe('build금요일성과 — 준공 반영', () => {
  it('준공일이 금요일 기준 기간에 들면 그 달에 얹는다 (9/29 준공 → 10월)', () => {
    const rows = build금요일성과(
      [],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-09-29', 준공액_공급가: 10_000_000 })],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-10').준공반영천원).toBe(10_000)
    expect(월(rows, '2026-09').준공반영천원).toBe(0)
  })

  it('차감하는 시공 누계는 전 기간이다 (5월 시공도 10월 준공에서 뺀다)', () => {
    const rows = build금요일성과(
      [이력(1, '2026-05-10', 6_000_000), 이력(1, '2026-10-05', 1_000_000)],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-10-20', 준공액_공급가: 10_000_000 })],
      2026,
      '2026-11',
    )
    const r = 월(rows, '2026-10')
    expect(r.준공반영천원).toBe(3_000) // 10,000 − (6,000 + 1,000)
    expect(r.시공기록천원).toBe(1_000)
  })

  it('음수 준공 반영(시공 누계 > 준공액)은 0으로 깎지 않는다', () => {
    const rows = build금요일성과(
      [이력(1, '2026-10-05', 12_000_000)],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-10-20', 준공액_공급가: 10_000_000 })],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-10').준공반영천원).toBe(-2_000)
  })

  it('준공 반영은 공사마다 천원으로 반올림한 뒤 더한다', () => {
    const rows = build금요일성과(
      [],
      [
        수주({ id: 1, 준공여부: true, 준공일: '2026-10-20', 준공액_공급가: 1_400 }),
        수주({ id: 2, 준공여부: true, 준공일: '2026-10-21', 준공액_공급가: 1_400 }),
      ],
      2026,
      '2026-11',
    )
    expect(월(rows, '2026-10').준공반영천원).toBe(2)
  })

  it('성과 = 시공 기록 + 준공 반영 (같은 천원 값의 합)', () => {
    const rows = build금요일성과(
      [이력(1, '2026-10-05', 4_000_000)],
      [수주({ id: 2, 준공여부: true, 준공일: '2026-10-20', 준공액_공급가: 2_000_000 })],
      2026,
      '2026-11',
    )
    const r = 월(rows, '2026-10')
    expect(r.성과천원).toBe(r.시공기록천원 + r.준공반영천원)
    expect(r.성과천원).toBe(6_000)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/금요일성과.test.ts"`
Expected: FAIL — `Failed to resolve import "./금요일성과"`

- [ ] **Step 3: 구현**

```ts
// src/app/(dashboard)/_lib/금요일성과.ts
/**
 * 매출손익 '금요일' 화면 — 월별 성과를 공무·대시보드와 같은 기간·같은 반올림으로 다시 센다 (2026-11-10)
 *
 * 목적은 하나, "매출손익과 공무 화면 숫자가 왜 다른가"를 표에서 보이게 하는 것.
 *   시공 기록 = 공사이력.성과금액만, 금요일 기준 주차 기간, 행마다 천원 반올림 → 공무 화면 월 누적과 천원까지 같다
 *   준공 반영 = 그 기간에 준공한 공사의 (준공액 − 시공 전 기간 누계) → 매출손익에만 있는 몫
 * 두 줄을 합치지 않고 나눠 보여주는 이유는 설계 문서 §7-1. 준공 반영의 크기가 곧 '시공 기록 누락'의 크기다.
 *
 * ⚠️ 규칙을 여기서 새로 만들지 않는다. 기간(주차.ts)·시공 합계(build월시공내역, 대시보드 split 과 같은 함수)·
 *    반올림(천원)·준공 반영(calc준공잔여성과)을 전부 기존 함수에서 가져온다. 복사하면 한쪽만 바뀌는 날 화면이 갈라진다.
 * ⚠️ 시계를 읽지 않는다. '금주 소속월'은 호출부가 KST(todayKST)로 정해서 넘긴다 — 서버 시계는 UTC다.
 * DB에 아무것도 쓰지 않는다(읽기 시점 파생).
 */
import { 달의주목록, 주목록기간, 최소월, type 연월 } from '../gongmu/_lib/주차'
import { 천원 } from '../gongmu/_lib/erp-실적'
import {
  build이력누계,
  calc준공잔여성과,
  type 공사이력Row,
  type 준공수주Row,
} from './junggong-seonggwa'
import { build월시공내역, sum월성과내역 } from './monthly-revenue-breakdown'

export type 금요일월성과 =
  /** 최소월 앞이거나 금주 소속월 뒤 — 화면에 '—' */
  | { 월: 연월; 표시: false }
  | {
      월: 연월
      표시: true
      /** 금요일 기준 기간 [from, to), to 미포함 */
      from: string
      to: string
      시공기록천원: number
      준공반영천원: number
      /** = 시공기록천원 + 준공반영천원 */
      성과천원: number
    }

/**
 * @param 공사이력전체 준공정산 제외, **전 기간** — 준공 반영의 차감 누계가 전 기간이어야 한다(load성과재료 결과 그대로)
 * @param 금주월 오늘(KST)이 속한 주의 소속월. 이 달보다 뒤는 표시하지 않는다
 */
export function build금요일성과(
  공사이력전체: 공사이력Row[],
  수주목록: 준공수주Row[],
  year: number,
  금주월: 연월,
): 금요일월성과[] {
  // 전 기간 누계는 한 번만 만든다 — 달마다 같은 값이다
  const 누계 = build이력누계(공사이력전체)

  return Array.from({ length: 12 }, (_, i): 금요일월성과 => {
    const 월 = `${year}-${String(i + 1).padStart(2, '0')}`
    // 'YYYY-MM' 문자열 비교 = 날짜 비교(0 채움 고정폭이라). new Date() 를 쓰지 않는다
    if (월 < 최소월 || 월 > 금주월) return { 월, 표시: false }

    const { from, to } = 주목록기간(달의주목록(월))
    // 대시보드 split.construction.totalThousand 와 같은 함수 — 투입실적은 야간 표시용이라 합계에 영향 없음([] 로 충분)
    const 시공기록천원 = sum월성과내역(build월시공내역(공사이력전체, 수주목록, [], from, to))
    const 준공반영천원 = calc준공잔여성과(수주목록, 누계, from, to).reduce(
      (s, r) => s + 천원(r.금액),
      0,
    )
    return {
      월,
      표시: true,
      from,
      to,
      시공기록천원,
      준공반영천원,
      성과천원: 시공기록천원 + 준공반영천원,
    }
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/금요일성과.test.ts"`
Expected: PASS (13 tests)

- [ ] **Step 5: 기존 테스트가 깨지지 않았는지 확인**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋** (게이트 5 — 메시지는 사용자가 직접 쓴다. 아래는 형식 예시일 뿐)

```bash
git add "src/app/(dashboard)/_lib/금요일성과.ts" "src/app/(dashboard)/_lib/금요일성과.test.ts"
git commit   # 사용자가 "왜"를 담아 작성
```

---

### Task 2: 금요일 월별 표 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx`

화면 컴포넌트는 이 레포에 렌더 테스트가 없다(sales/_components 전부). 검증은 Task 4의 브라우저 확인으로 한다.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx
import type { 금요일월성과 } from '../../_lib/금요일성과'

/**
 * 금요일 기준 월별 성과 — 시공 기록 / 준공 반영 / 성과 세 줄.
 * 상태가 없어 서버 컴포넌트로 둔다. 숫자는 받은 그대로 그리고 여기서 다시 계산하지 않는다.
 */

const 줄: { key: '시공기록천원' | '준공반영천원' | '성과천원'; label: string; hint: string }[] = [
  { key: '시공기록천원', label: '시공 기록', hint: '공무 화면 월 누적과 같은 숫자' },
  { key: '준공반영천원', label: '준공 반영', hint: '준공액 − 시공 누계. 시공 기록에 없던 몫' },
  { key: '성과천원', label: '성과', hint: '시공 기록 + 준공 반영' },
]

function 칸(v: number): string {
  // 0도 숫자로 보인다 — 표시 달의 0은 '기록 없음'이 아니라 '정말 0'이다('—'는 표시 안 하는 달 전용)
  return v.toLocaleString('ko-KR')
}

export function FridayPerformanceTable({ rows }: { rows: 금요일월성과[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500">
            <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium">구분</th>
            {rows.map((r) => (
              <th key={r.월} className="py-2 px-2 text-right font-medium">
                {Number(r.월.slice(5, 7))}월
                {r.표시 && (
                  <div className="text-[10px] font-normal text-gray-400">
                    {Number(r.from.slice(5, 7))}/{Number(r.from.slice(8, 10))}~
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {줄.map(({ key, label, hint }) => (
            <tr
              key={key}
              className={key === '성과천원' ? 'border-t border-gray-200 font-semibold' : 'border-b border-gray-50'}
            >
              <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium text-gray-700" title={hint}>
                {label}
              </th>
              {rows.map((r) => (
                <td
                  key={r.월}
                  className="py-2 px-2 text-right"
                  style={{ color: r.표시 ? (r[key] < 0 ? '#dc2626' : '#374151') : '#d1d5db' }}
                >
                  {r.표시 ? 칸(r[key]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-400">
        단위 천원 · 한 주(월~일)는 금요일이 속한 달로 센다 · 2026년 9월 앞 달과 아직 오지 않은 달은 &apos;—&apos;
      </p>
    </div>
  )
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 오류 0

(커밋은 Task 4에서 화면과 함께 — 이 컴포넌트는 아직 어디서도 쓰이지 않는다)

---

### Task 3: `말일 / 금요일` 토글 + 연도 선택이 기준을 유지

**Files:**
- Create: `src/app/(dashboard)/sales/_components/BasisToggle.tsx`
- Modify: `src/app/(dashboard)/sales/_components/YearSelector.tsx`

- [ ] **Step 1: 토글 작성**

```tsx
// src/app/(dashboard)/sales/_components/BasisToggle.tsx
'use client'

import { useRouter } from 'next/navigation'

export type SalesBasis = 'month-end' | 'friday'

/**
 * 표만 바꾸는 스왑 버튼. 상태는 URL(?basis=friday)에 둔다 — 새로고침·링크 공유에도 같은 화면이 나오고,
 * 서버 컴포넌트가 그 값으로 다시 그린다(클라이언트 state 를 따로 두면 서버가 그린 표와 어긋날 수 있다).
 */
export function BasisToggle({ year, basis }: { year: number; basis: SalesBasis }) {
  const router = useRouter()
  const go = (next: SalesBasis) =>
    router.push(next === 'friday' ? `/sales?year=${year}&basis=friday` : `/sales?year=${year}`)

  const btn = (value: SalesBasis, label: string) => (
    <button
      type="button"
      onClick={() => go(value)}
      aria-pressed={basis === value}
      className={
        basis === value
          ? 'px-3 h-9 text-sm bg-blue-600 text-white'
          : 'px-3 h-9 text-sm bg-white text-gray-600 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  )

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200 shadow-sm">
      {btn('month-end', '말일 기준')}
      {btn('friday', '금요일 기준')}
    </div>
  )
}
```

- [ ] **Step 2: 연도 선택이 basis 를 유지하게 수정**

`src/app/(dashboard)/sales/_components/YearSelector.tsx` 전체를 아래로 바꾼다.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { partsKST } from '@/lib/kst'
import type { SalesBasis } from './BasisToggle'

export function YearSelector({ currentYear, basis }: { currentYear: number; basis: SalesBasis }) {
  const router = useRouter()
  // 브라우저 시계라도 KST 로 못 박는다 — 해외·시간대 오설정 기기에서 연초에 목록이 한 해 밀리지 않게
  const now = partsKST().year
  const years = Array.from({ length: 5 }, (_, i) => now - 2 + i)
  // 연도를 바꿔도 보던 기준(금요일)을 유지한다 — 안 그러면 연도만 바꿨는데 표가 말일로 돌아간다
  const suffix = basis === 'friday' ? '&basis=friday' : ''

  return (
    <select
      value={currentYear}
      onChange={(e) => router.push(`/sales?year=${e.target.value}${suffix}`)}
      className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  )
}
```

`partsKST`는 클라이언트에서 써도 된다. `src/lib/kst.ts`는 import가 하나도 없는 `Intl` 함수 모음이고, 이미 `InputForm.tsx`·`RatesClient.tsx` 같은 클라이언트 컴포넌트가 쓰고 있다(2026-11-10 확인).

- [ ] **Step 3: 타입 확인**

Run: `npx tsc --noEmit`
Expected: `page.tsx`에서 `YearSelector`에 `basis` prop이 없다는 오류 1건 (Task 4에서 해결). 그 외 오류 0

---

### Task 4: 매출손익 화면에 연결

**Files:**
- Modify: `src/app/(dashboard)/sales/page.tsx`

- [ ] **Step 1: import 추가** (`page.tsx` 맨 위 import 묶음 끝에)

```tsx
import { todayKST } from '@/lib/kst'
import { BasisToggle, type SalesBasis } from './_components/BasisToggle'
import { FridayPerformanceTable } from './_components/FridayPerformanceTable'
import { build금요일성과 } from '../_lib/금요일성과'
import { 금주소속월기간 } from '../gongmu/_lib/주차'
```

기존 `import { partsKST } from '@/lib/kst'`는 `import { partsKST, todayKST } from '@/lib/kst'`로 합친다(위의 별도 줄은 쓰지 않는다).

- [ ] **Step 2: searchParams 에 basis 추가, 재료를 한 번 읽어 두 판에 쓴다**

`SalesPage` 시그니처와 집계 부분을 아래처럼 바꾼다.

```tsx
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; basis?: string }>
}) {
  const { year: yearParam, basis: basisParam } = await searchParams
  // 모르는 값은 조용히 말일로 — 말일이 기본 규칙이다(설계 §5-3)
  const basis: SalesBasis = basisParam === 'friday' ? 'friday' : 'month-end'
  const parsedYear = parseInt(yearParam ?? '', 10)
  // ?year=abc 같은 잘못된 입력이면 NaN → 날짜 범위가 깨지므로 올해로 폴백.
  // 서버 시계는 UTC라 new Date().getFullYear()는 KST 1/1 00~09시에 전년을 준다 → partsKST 사용
  const year =
    Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : partsKST().year

  const supabase = await createClient()

  // 공사별 손익 집계는 _lib/공사별손익 한 곳 — ERP MCP(get_profit)도 같은 함수를 거친다
  // 금요일 판도 같은 재료(공사이력 전 기간·수주)를 쓴다 — 두 판이 다른 순간의 DB를 보지 않게 한 번만 읽는다
  const 재료 = await load공사별손익재료(supabase, year)
  const { pivotData, monthly, 준공잔여목록, 총준공반영액 } = aggregate공사별손익(재료, year)

  // '금주 소속월'은 KST 로 정한다 — 서버 시계(UTC)로 정하면 새 달 첫 주 월요일 00~09시에 한 달 밀린다
  const 금요일rows =
    basis === 'friday'
      ? build금요일성과(재료.공사이력전체, 재료.수주, year, 금주소속월기간(todayKST()).월)
      : null
```

(아래 `총성과`·`chartData` 등은 그대로 둔다.)

- [ ] **Step 3: 헤더에 토글 추가, YearSelector 에 basis 전달**

```tsx
        <div className="flex items-center gap-2">
          <BasisToggle year={year} basis={basis} />
          <ExcelExportButton pivotData={pivotData} chartData={chartData} year={year} />
          <YearSelector currentYear={year} basis={basis} />
        </div>
```

- [ ] **Step 4: 피벗 표 카드를 basis 에 따라 교체**

기존 `{/* 피벗 테이블 (메인) */}` 카드 전체를 아래로 바꾼다.

```tsx
      {/* 표 — 스왑 버튼은 이 카드만 바꾼다. KPI·차트는 말일 기준 그대로(설계 §5-3) */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-sm font-medium text-gray-600">
            {금요일rows
              ? `${year}년 월별 성과 — 금요일 기준 (천원)`
              : `${year}년 공사별 성과`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-5">
          {금요일rows ? (
            <FridayPerformanceTable rows={금요일rows} />
          ) : (
            <PivotProjectTable data={pivotData} />
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 5: 타입·린트·테스트**

Run: `npx tsc --noEmit; npm run lint; npm test`
Expected: 오류 0, 전부 PASS

- [ ] **Step 6: 완료 기준 확인 — 공무 화면과 천원까지 대조** (운영 Supabase에 붙은 로컬 dev 서버, 읽기만 함)

Run: `npm run dev`

브라우저에서 아래를 차례로 열고 숫자를 적는다.

| 확인 | 주소 | 볼 숫자 | 기대 |
|---|---|---|---|
| ① | `/sales?year=2026&basis=friday` | 9월·10월 "시공 기록" | — |
| ② | `/gongmu?month=2026-09` | 담당자 카드 월 누적의 합(요약 카드) | ①의 9월과 **같음** (재측정 참고값 250,773) |
| ③ | `/gongmu?month=2026-10` | 같은 칸 | ①의 10월과 **같음** (참고값 494,834) |
| ④ | `/sales?year=2026&basis=friday` | 1~8월 | 전부 '—' |
| ⑤ | `/sales?year=2026&basis=friday` | 12월 | '—' (오늘 KST 기준 금주 소속월 = 11월) |
| ⑥ | 연도를 2025로 바꿈 | 주소 | `basis=friday` 유지, 12칸 전부 '—' |
| ⑦ | `말일 기준` 클릭 | 표 | 기존 공사별 피벗으로 복귀, KPI·차트 숫자는 스왑 전후 동일 |

참고값은 2026-11-10 재측정 스크립트 값이다. 그 뒤 공사이력이 수정됐으면 달라질 수 있으므로 **①과 ②·③이 서로 같은지**가 기준이고 참고값과의 일치는 기준이 아니다.

하나라도 다르면 커밋하지 않고 원인부터 찾는다(superpowers:systematic-debugging).

- [ ] **Step 7: 커밋** (게이트 5 — 메시지는 사용자가 작성)

```bash
git add "src/app/(dashboard)/sales/page.tsx" "src/app/(dashboard)/sales/_components/BasisToggle.tsx" "src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx" "src/app/(dashboard)/sales/_components/YearSelector.tsx"
git commit   # 사용자가 "왜"를 담아 작성
```

---

### Task 5: 게이트 3·4 (구현 뒤, PR 전)

코드가 아니라 사용자와 하는 단계다. 생략하지 않는다.

- [ ] **게이트 3 리뷰:** Claude가 비판적 리뷰어로 diff 전체를 본다. 최소한 아래를 짚는다.
  - 금요일 판이 KPI·차트와 다른 기준이라는 것이 화면에서 충분히 드러나나(표 제목·각주)
  - `build월시공내역`에 `[]`를 넘긴 것이 나중에 합계에 영향을 줄 수 있는 변경에 취약한가
  - `basis` 이외의 쿼리 파라미터가 생길 때 `YearSelector`·`BasisToggle`의 URL 조립이 다른 값을 지우는가
- [ ] **게이트 4 질문 (1~2개, 바닥 개념):** 후보
  - (타임존) 페이지가 `금주소속월기간(todayKST())` 대신 `금주소속월기간(new Date().toISOString().slice(0,10))`을 썼다면, 2026-11-30(월) KST 08:00에 이 표의 11월 칸과 12월 칸은 각각 어떻게 보이나? 에러가 나나?
  - (같은 원본을 읽는 두 기록) Step 6에서 ①과 ③이 같다는 것은 무엇을 보장하고 무엇을 못 잡나 — 원본·함수·기간 세 칸으로 나눠서.
- [ ] **PR 생성** — 사용자 승인 후. 배포 순서는 설계 §6: ERP(PR-1·PR-2) → 대시보드(PR-3).
- [ ] **PR-1 배포 전 사장님 확인** (설계 §7-1·§7-6): 두 줄 표 화면을 보여드리고, 9월 담당 미지정이 대시보드에서 어떻게 보일지도 함께 말씀드린다.

---

## Self-review 결과

- **설계 대응:** §5-3 스왑(Task 3·4), §5-4 9월부터만 숫자(Task 1 표시 범위), §5-5 성과만(Task 2 — 투입·손익 줄 없음), §6 PR-1 기간은 `주차.ts`에서(Task 1 import), 반올림은 공무와 같게(Task 1 `천원`·`build월시공내역`), 완료 기준(Task 4 Step 6), §7-1 두 줄(Task 2, 합계 줄 포함 세 줄).
- **설계에 없어서 이 계획이 정한 것:** 단위 천원, 준공 반영의 공사별 반올림, 연간 합계 칸 없음, 엑셀 제외 — 위 "결정 사항"·"범위에서 뺀 것"에 적었다. 사용자 확인 대상.
- **타입 이름 일관성:** `금요일월성과`·`build금요일성과`·`SalesBasis`·`시공기록천원`/`준공반영천원`/`성과천원`이 Task 1~4에서 같은 이름으로 쓰인다.
