# 매출손익 금요일 표 공사별 상세 팝업 (PR-4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매출손익 금요일 화면(시공 기록 / 준공 반영 / 성과 세 줄)의 숫자를 누르면 그 달 공사별 목록 팝업이 뜨게 한다. 팝업 합계 = 표 숫자, 시공 팝업 = 대시보드 시공 실적 팝업(천원까지).

**Architecture:** `_lib/금요일성과.ts`의 `build금요일성과`가 지금은 공사별 목록(`build월시공내역`, `calc준공잔여성과`)을 만들었다가 합계만 남기고 버린다. 이 목록을 반환값에 싣고, **표의 세 숫자를 이 목록들의 합에서 파생**하게 바꾼다(팝업과 표가 어긋날 자리를 구조로 없앰). 화면은 `FridayPerformanceTable`을 클라이언트 컴포넌트로 바꿔 열린 팝업을 state로 들고, 팝업은 새 파일 `FridayDetailDialog.tsx`(`components/ui/dialog`)가 그린다. `page.tsx`는 바꾸지 않는다.

**Tech Stack:** Next.js 16 (App Router) · React · TypeScript · shadcn Dialog(base-ui) · vitest

**설계 문서:** `docs/superpowers/specs/2026-11-09-plan-actual-table-and-data-alignment-design.md` §7-8 (게이트 1 결정 전부), §2-3, §4

**목업:** https://claude.ai/artifact/HTE7FSG9enE5cLdBDLunzB (10월 운영 실데이터)

**티어:** A (회계 정합성 — 팝업 합계 = 표 숫자). 게이트 2~5는 Task 4 참고.

---

## 게이트 1 결정 요약 (§7-8, 다시 묻지 말 것)

1. 정산은 넣지 않는다(A안). 각주 한 구절로만 "정산은 공무 화면·대시보드에서" 안내.
2. 세 줄 모두 클릭. 성과 줄 = 공사별로 합친 목록 한 장.
3. 시공 팝업 열 = `지중No · 공사명(+날짜) · 실적` — 대시보드 실적 팝업과 같게.
4. 준공 반영 팝업 열 = `지중No · 공사명 · 준공일 · 준공액 · 시공 누계 · 준공 반영`.
5. **시공 누계 칸 = 준공액천원 − 반영천원** (줄마다 식이 맞게). '시공 입력 없음' 강조는 **원 단위 누계 = 0**으로 판정한다(표시값 0으로 판정하지 않는다 — 실제 누계 600원인 공사가 표시상 0이 될 수 있다).
6. 반영 0천원 줄 숨김, 음수 줄은 빨간색으로 그대로.
7. 말일 화면·KPI·차트·`page.tsx`·대시보드는 손대지 않는다.

## 계획에서 정한 것

- **정렬은 금액 내림차순 고정, 같으면 지중No 순.** 정렬 버튼은 넣지 않는다(목업의 ↕ 표시는 무시). 시공 목록은 `build월시공내역`이 이미 이 순서다.
- **성과 목록의 성과 0천원 줄은 남긴다.** 시공 +10, 반영 −10처럼 상쇄된 공사는 0이어도 두 칸이 왜 0이 됐는지 보여준다. 합계는 변하지 않는다.
- **팝업 기간 표시는 `from ~ to 전날`**(예: `9/28 ~ 11/1`). 전날은 `주차.ts`의 `addDays(to, -1)`로 구한다(문자열 날짜 연산, 서버·브라우저 시계와 무관).
- **팝업 합계 칸은 표의 숫자(`r.시공기록천원` 등)를 그대로 쓴다.** 그 숫자가 곧 목록의 합이라는 것은 Task 1의 테스트가 지킨다.

## 함정 (구현 중 바꾸지 말 것)

- **`build월성과내역`을 성과 목록에 쓰지 않는다.** 이름은 "공사별 성과"라 맞아 보이지만, 공사별 원 합계를 한 번 반올림하는 규칙(2026-09-11)이라 표의 성과(시공은 행마다 반올림 + 반영은 공사마다 반올림)와 합이 몇 천원 어긋난다. 성과 목록은 Task 1의 `build성과내역`처럼 **이미 반올림된 시공·반영 목록을 공사별로 더해** 만든다.
- 시공 목록은 `build월시공내역` 결과를 **그대로** 싣는다. 다시 집계하지 않는다(대시보드 팝업과 같은 목록이어야 한다).
- `금요일성과.ts`는 시계를 읽지 않는다(`new Date()` 금지).
- 클라이언트 컴포넌트에서 `_lib/금요일성과`는 **`import type`으로만** 가져온다. 이 파일은 `junggong-seonggwa.ts`(supabase 조회 함수 포함)를 값으로 import하므로, 값 import하면 서버 코드가 브라우저 번들로 끌려온다. `주차.ts`의 `addDays`는 순수 함수라 값 import해도 된다.

---

## 파일 구조

| 파일 | 할 일 | 책임 |
|---|---|---|
| `src/app/(dashboard)/_lib/금요일성과.ts` | 수정 | 표시 달마다 시공·준공 반영·성과 목록을 싣고, 표 숫자를 목록 합에서 파생 |
| `src/app/(dashboard)/_lib/금요일성과.test.ts` | 수정 | 목록 테스트 추가 (기존 테스트는 그대로 통과해야 함) |
| `src/app/(dashboard)/sales/_components/FridayDetailDialog.tsx` | 생성 | 한 달 × 한 줄의 공사별 목록 팝업 (클라이언트) |
| `src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx` | 수정 | 클라이언트 컴포넌트로 전환, 숫자 = 버튼, 열린 팝업 state, 각주 한 구절 |

---

### Task 1: `build금요일성과`가 공사별 목록을 싣는다

**Files:**
- Modify: `src/app/(dashboard)/_lib/금요일성과.ts`
- Test: `src/app/(dashboard)/_lib/금요일성과.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가** — `금요일성과.test.ts` 맨 끝에 붙인다(위쪽 `수주`·`이력`·`월` 헬퍼 재사용).

```ts
describe('build금요일성과 — 공사별 목록 (PR-4 팝업)', () => {
  // 10월(9/28~11/2 미포함) 한 달에 세 종류를 섞는다:
  //   1번: 시공만(10월 4,000천원)
  //   2번: 시공 0원으로 준공(준공액 2,000천원)
  //   3번: 5월 시공 6,000 + 10월 시공 1,000, 10월 준공 10,000 → 반영 3,000 (두 목록 모두에 나옴)
  //   4번: 시공 12,000, 10월 준공 10,000 → 반영 −2,000 (음수)
  //   5번: 시공 = 준공액 → 반영 0 (반영 목록에서 숨김)
  const 이력목록 = [
    이력(1, '2026-10-05', 4_000_000),
    이력(3, '2026-05-10', 6_000_000),
    이력(3, '2026-10-06', 1_000_000),
    이력(4, '2026-06-01', 12_000_000),
    이력(5, '2026-06-02', 3_000_000),
  ]
  const 수주목록 = [
    수주({ id: 1 }),
    수주({ id: 2, 준공여부: true, 준공일: '2026-10-20', 준공액_공급가: 2_000_000 }),
    수주({ id: 3, 준공여부: true, 준공일: '2026-10-21', 준공액_공급가: 10_000_000 }),
    수주({ id: 4, 준공여부: true, 준공일: '2026-10-22', 준공액_공급가: 10_000_000 }),
    수주({ id: 5, 준공여부: true, 준공일: '2026-10-23', 준공액_공급가: 3_000_000 }),
  ]
  const r = () => 월(build금요일성과(이력목록, 수주목록, 2026, '2026-11'), '2026-10')

  it('표 숫자 세 개는 각 목록의 합과 같다 (팝업 합계 = 표 숫자)', () => {
    const x = r()
    expect(x.시공내역.reduce((s, v) => s + v.금액천원, 0)).toBe(x.시공기록천원)
    expect(x.준공반영내역.reduce((s, v) => s + v.반영천원, 0)).toBe(x.준공반영천원)
    expect(x.성과내역.reduce((s, v) => s + v.성과천원, 0)).toBe(x.성과천원)
    expect(x.시공기록천원).toBe(5_000) // 1번 4,000 + 3번 1,000
    expect(x.준공반영천원).toBe(3_000) // 2번 2,000 + 3번 3,000 + 4번 −2,000
    expect(x.성과천원).toBe(8_000)
  })

  it('준공 반영 목록: 반영 0 공사는 빼고, 금액 내림차순, 음수도 남긴다', () => {
    expect(r().준공반영내역.map((v) => [v.수주_id, v.반영천원])).toEqual([
      [3, 3_000],
      [2, 2_000],
      [4, -2_000],
    ])
  })

  it('준공 반영 줄마다 준공액 − 시공 누계 = 반영 (칸끼리 식이 맞는다)', () => {
    for (const v of r().준공반영내역) {
      expect(v.준공액천원 - v.시공누계천원).toBe(v.반영천원)
    }
    const 셋 = r().준공반영내역.find((v) => v.수주_id === 3)!
    expect([셋.준공일, 셋.준공액천원, 셋.시공누계천원]).toEqual(['2026-10-21', 10_000, 7_000])
    expect(셋.지중no).toBe('JG26-003')
  })

  it('시공 입력 없음은 원 단위 누계 0으로만 판정한다', () => {
    const 표시 = r().준공반영내역
    expect(표시.find((v) => v.수주_id === 2)!.시공없음).toBe(true)
    expect(표시.find((v) => v.수주_id === 3)!.시공없음).toBe(false)
  })

  it('누계 600원 공사는 표시 누계가 0이어도 시공없음이 아니다', () => {
    // 준공액 1,400원(1천원) − 누계 600원 = 반영 800원(1천원) → 표시 누계 = 1 − 1 = 0
    const x = 월(
      build금요일성과(
        [이력(9, '2026-06-01', 600)],
        [수주({ id: 9, 준공여부: true, 준공일: '2026-10-20', 준공액_공급가: 1_400 })],
        2026,
        '2026-11',
      ),
      '2026-10',
    )
    const v = x.준공반영내역[0]
    expect(v.시공누계천원).toBe(0)
    expect(v.시공없음).toBe(false)
  })

  it('성과 목록: 같은 공사는 한 줄로 합치고, 한쪽만 있으면 다른 쪽은 0', () => {
    expect(r().성과내역.map((v) => [v.수주_id, v.시공천원, v.반영천원, v.성과천원])).toEqual([
      [1, 4_000, 0, 4_000],
      [3, 1_000, 3_000, 4_000],
      [2, 0, 2_000, 2_000],
      [4, 0, -2_000, -2_000],
    ])
  })

  it('시공 목록은 build월시공내역 결과 그대로다 (대시보드 팝업과 같은 목록)', () => {
    expect(r().시공내역.map((v) => [v.수주_id, v.금액천원, v.날짜])).toEqual([
      [1, 4_000, ['2026-10-05']],
      [3, 1_000, ['2026-10-06']],
    ])
  })
})
```

성과 목록의 정렬: 성과 내림차순, 같으면 지중No 순(`JG26-001` < `JG26-003`) — 위 기대값의 1번과 3번이 그 경우다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/금요일성과.test.ts"`
Expected: 새 describe의 테스트가 FAIL (`시공내역`·`준공반영내역`·`성과내역`이 없음 — TypeScript 타입 에러 또는 `undefined.reduce`). 기존 테스트는 PASS.

- [ ] **Step 3: 구현** — `금요일성과.ts`의 import·타입·함수를 아래로 바꾼다(머리 주석은 유지하고 끝에 PR-4 한 단락을 덧붙인다).

머리 주석 끝(`DB에 아무것도 쓰지 않는다(읽기 시점 파생).` 줄 바로 뒤, `*/` 앞)에 추가:

```ts
 *
 * PR-4(2026-11-10): 표시 달마다 공사별 목록 세 개(시공·준공 반영·성과)를 함께 싣는다 — 숫자를 누르면 뜨는 팝업의 재료.
 * 표의 세 숫자는 이 목록들의 합에서 파생한다. 목록과 숫자를 따로 계산하면 둘이 어긋날 자리가 생긴다.
 * ⚠️ 성과 목록에 build월성과내역 을 쓰지 않는다 — 공사별 원 합계를 한 번 반올림하는 규칙이라 표 숫자와 몇 천원 어긋난다.
```

import를 아래로 교체:

```ts
import { 달의주목록, 주목록기간, 최소월, type 연월 } from '../gongmu/_lib/주차'
import { 천원 } from '../gongmu/_lib/erp-실적'
import {
  build이력누계,
  calc준공잔여성과,
  type 공사이력Row,
  type 준공수주Row,
  type 준공잔여성과,
} from './junggong-seonggwa'
import { build월시공내역, sum월성과내역, type 월시공내역Row } from './monthly-revenue-breakdown'
```

타입 교체(`금요일월성과` 전체 + 새 타입 둘):

```ts
/** 준공 반영 팝업 한 줄 — 천원 단위. 칸끼리 식이 맞게: 준공액천원 − 시공누계천원 = 반영천원 */
export type 준공반영내역Row = {
  수주_id: number
  지중no: string
  공사명: string
  준공일: string
  준공액천원: number
  /**
   * = 준공액천원 − 반영천원. 실제 누계를 따로 반올림하면 줄마다 식이 1천원 어긋나서(10월 42줄 중 8줄)
   * 표시용 누계는 식에서 거꾸로 구한다. 실제 누계와 최대 1천원 다를 수 있다(설계 §7-8).
   */
  시공누계천원: number
  반영천원: number
  /** 원 단위 시공 누계가 정확히 0 — 시공 입력 없이 준공. 표시값(시공누계천원 0)으로 판정하지 않는다 */
  시공없음: boolean
}

/** 성과 팝업 한 줄 — 한 공사의 시공과 준공 반영을 합친 것 */
export type 성과내역Row = {
  수주_id: number
  지중no: string
  공사명: string
  시공천원: number
  반영천원: number
  /** = 시공천원 + 반영천원 */
  성과천원: number
}

export type 금요일월성과 =
  /** 최소월 앞이거나 금주 소속월 뒤 — 화면에 '—' */
  | { 월: 연월; 표시: false }
  | {
      월: 연월
      표시: true
      /** 금요일 기준 기간 [from, to), to 미포함 */
      from: string
      to: string
      /** = sum(시공내역.금액천원) */
      시공기록천원: number
      /** = sum(준공반영내역.반영천원) */
      준공반영천원: number
      /** = 시공기록천원 + 준공반영천원 = sum(성과내역.성과천원) */
      성과천원: number
      /** 대시보드 split 과 같은 함수(build월시공내역)의 결과 그대로 */
      시공내역: 월시공내역Row[]
      준공반영내역: 준공반영내역Row[]
      성과내역: 성과내역Row[]
    }
```

목록 함수 둘 추가(`build금요일성과` 위에):

```ts
/**
 * calc준공잔여성과(원 단위) → 팝업 줄(천원). 반영 0천원은 뺀다(시공 목록의 0천원 숨김과 같은 규칙 — 합계 불변).
 * 반영 대상은 수주목록에서 나온 것이라 수주맵에 반드시 있다.
 */
function build준공반영내역(잔여: 준공잔여성과[], 수주맵: Map<number, 준공수주Row>): 준공반영내역Row[] {
  const rows: 준공반영내역Row[] = []
  for (const r of 잔여) {
    const 반영천원 = 천원(r.금액)
    if (반영천원 === 0) continue
    const 수주 = 수주맵.get(r.수주_id)!
    // calc준공잔여성과 가 준공액 null 을 이미 걸렀다
    const 준공액원 = 수주.준공액_공급가 ?? 0
    const 준공액천원 = 천원(준공액원)
    rows.push({
      수주_id: r.수주_id,
      지중no: 수주.지중no,
      공사명: 수주.공사명,
      준공일: r.준공일,
      준공액천원,
      시공누계천원: 준공액천원 - 반영천원,
      반영천원,
      // 금액 = 준공액 − 누계 이므로 누계(원) = 준공액 − 금액. 정확히 0일 때만 '시공 입력 없음'
      시공없음: 준공액원 - r.금액 === 0,
    })
  }
  return rows.sort((a, b) => b.반영천원 - a.반영천원 || a.지중no.localeCompare(b.지중no, 'ko'))
}

/** 이미 천원으로 반올림된 두 목록을 공사별로 더한다 — 다시 반올림하지 않아 합이 표 숫자와 같다 */
function build성과내역(시공: 월시공내역Row[], 반영: 준공반영내역Row[]): 성과내역Row[] {
  const map = new Map<number, 성과내역Row>()
  for (const s of 시공) {
    map.set(s.수주_id, {
      수주_id: s.수주_id,
      지중no: s.지중no,
      공사명: s.공사명,
      시공천원: s.금액천원,
      반영천원: 0,
      성과천원: 0,
    })
  }
  for (const b of 반영) {
    const e = map.get(b.수주_id) ?? {
      수주_id: b.수주_id,
      지중no: b.지중no,
      공사명: b.공사명,
      시공천원: 0,
      반영천원: 0,
      성과천원: 0,
    }
    e.반영천원 += b.반영천원
    map.set(b.수주_id, e)
  }
  // 성과 0천원 줄(시공과 반영이 상쇄)도 남긴다 — 두 칸이 왜 0이 됐는지 보여준다
  return [...map.values()]
    .map((e) => ({ ...e, 성과천원: e.시공천원 + e.반영천원 }))
    .sort((a, b) => b.성과천원 - a.성과천원 || a.지중no.localeCompare(b.지중no, 'ko'))
}
```

`build금요일성과` 본문 교체:

```ts
export function build금요일성과(
  공사이력전체: 공사이력Row[],
  수주목록: 준공수주Row[],
  year: number,
  금주월: 연월,
): 금요일월성과[] {
  // 전 기간 누계·수주맵은 한 번만 만든다 — 달마다 같은 값이다
  const 누계 = build이력누계(공사이력전체)
  const 수주맵 = new Map(수주목록.map((o) => [o.id, o]))

  return Array.from({ length: 12 }, (_, i): 금요일월성과 => {
    const 월 = `${year}-${String(i + 1).padStart(2, '0')}`
    // 'YYYY-MM' 문자열 비교 = 날짜 비교(0 채움 고정폭이라). new Date() 를 쓰지 않는다
    if (월 < 최소월 || 월 > 금주월) return { 월, 표시: false }

    const { from, to } = 주목록기간(달의주목록(월))
    // 대시보드 split.construction 과 같은 함수 — 투입실적은 야간 표시용이라 합계에 영향 없음([] 로 충분)
    const 시공내역 = build월시공내역(공사이력전체, 수주목록, [], from, to)
    const 준공반영내역 = build준공반영내역(calc준공잔여성과(수주목록, 누계, from, to), 수주맵)
    const 성과내역 = build성과내역(시공내역, 준공반영내역)

    // 표 숫자는 목록의 합에서 파생한다 — 팝업 합계와 어긋날 자리를 없앤다
    const 시공기록천원 = sum월성과내역(시공내역)
    const 준공반영천원 = 준공반영내역.reduce((s, r) => s + r.반영천원, 0)
    return {
      월,
      표시: true,
      from,
      to,
      시공기록천원,
      준공반영천원,
      성과천원: 시공기록천원 + 준공반영천원,
      시공내역,
      준공반영내역,
      성과내역,
    }
  })
}
```

`junggong-seonggwa.ts`가 `준공잔여성과` 타입을 이미 export 하는지 확인한다(`export type 준공잔여성과` — 2026-11-10 기준 있음).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/금요일성과.test.ts"`
Expected: 전부 PASS (기존 13개 + 새 7개). 기존 '준공 반영은 공사마다 천원으로 반올림' 테스트(1,400원 두 건 → 2)도 통과해야 한다 — 반영 0천원 줄을 빼도 합은 같다.

- [ ] **Step 5: 전체 테스트·타입 확인**

Run: `npm test` 그리고 `npx tsc --noEmit`
Expected: 테스트 전부 PASS(기준 408개 + 7), tsc 에러 0. `FridayPerformanceTable`은 아직 새 칸을 안 쓰므로 영향 없음.

- [ ] **Step 6: 커밋** — 게이트 5: 메시지는 사용자가 직접 쓴다. Claude는 아래 초안을 보여주고 사용자 메시지로 커밋한다.

```bash
git add "src/app/(dashboard)/_lib/금요일성과.ts" "src/app/(dashboard)/_lib/금요일성과.test.ts"
git status   # 두 파일이 모두 staged 인지 확인 (PowerShell 에서 경로가 잘려 빠진 적 있음)
git commit -m "<사용자 메시지>"
```

초안: `금요일 성과가 공사별 목록을 싣고 표 숫자를 목록 합에서 파생하게 함 — 팝업 합계와 표 숫자가 어긋날 자리를 없애기 위해`

---

### Task 2: 팝업 컴포넌트 `FridayDetailDialog`

**Files:**
- Create: `src/app/(dashboard)/sales/_components/FridayDetailDialog.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/app/(dashboard)/sales/_components/FridayDetailDialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { addDays } from '../../gongmu/_lib/주차'
// ⚠️ type 으로만 — 값 import 하면 supabase 조회 코드(junggong-seonggwa)가 브라우저 번들로 끌려온다
import type { 금요일월성과 } from '../../_lib/금요일성과'

export type 표시월 = Extract<금요일월성과, { 표시: true }>
export type 줄키 = '시공' | '반영' | '성과'

const 제목: Record<줄키, string> = { 시공: '시공 기록', 반영: '준공 반영', 성과: '성과' }
const 설명: Record<줄키, string> = {
  시공: '공사이력 성과금액 · 대시보드 시공 실적 팝업과 같은 목록',
  반영: '이 기간에 준공한 공사 · 준공액 − 시공 누계(전 기간)',
  성과: '시공 기록 + 준공 반영 · 두 줄 모두에 나오는 공사는 한 줄로 합침',
}

const 숫자 = (v: number) => v.toLocaleString('ko-KR')
/** 'YYYY-MM-DD' → 'M/D' (문자열만 자른다 — 시계를 읽지 않는다) */
const 짧은날 = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
const 금액색 = (v: number) => (v < 0 ? 'text-red-600' : undefined)

const th = 'px-3 py-2 text-xs font-medium text-gray-500'
const td = 'px-3 py-2 align-top'

export function FridayDetailDialog({
  월,
  줄,
  onClose,
}: {
  월: 표시월 | null
  줄: 줄키 | null
  onClose: () => void
}) {
  // open 을 따로 boolean 으로 두면 TS 가 월·줄을 좁히지 못한다 — 조건을 매번 `월 && 줄` 로 직접 쓴다
  const open = 월 !== null && 줄 !== null
  // 합계 칸은 표 숫자 그대로 — 그 숫자가 곧 목록의 합이다(금요일성과.test.ts 가 지킨다)
  const 합계 = !월 || !줄 ? 0 : 줄 === '시공' ? 월.시공기록천원 : 줄 === '반영' ? 월.준공반영천원 : 월.성과천원
  const 건수 = !월 || !줄
    ? 0
    : 줄 === '시공'
      ? 월.시공내역.length
      : 줄 === '반영'
        ? 월.준공반영내역.length
        : 월.성과내역.length
  const 시공없음수 = 월 && 줄 === '반영' ? 월.준공반영내역.filter((r) => r.시공없음).length : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
        {월 && 줄 && (
          <>
            <DialogHeader className="border-b border-gray-100 px-5 py-4">
              <DialogTitle>
                {Number(월.월.slice(5, 7))}월 {제목[줄]} — 공사별
              </DialogTitle>
              <DialogDescription>
                {짧은날(월.from)} ~ {짧은날(addDays(월.to, -1))} · {설명[줄]} · 단위 천원
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm tabular-nums">
                {줄 === '시공' && (
                  <>
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className={`${th} w-28 text-left`}>지중No</th>
                        <th className={`${th} text-left`}>공사명</th>
                        <th className={`${th} w-32 text-right`}>실적</th>
                      </tr>
                    </thead>
                    <tbody>
                      {월.시공내역.map((r) => (
                        <tr key={r.수주_id} className="border-t border-gray-100">
                          <td className={`${td} text-gray-600`}>{r.지중no}</td>
                          <td className={td}>
                            {r.공사명}
                            <div className="text-[11px] text-gray-500">{r.날짜.map(짧은날).join(' · ')}</div>
                          </td>
                          <td className={`${td} text-right ${금액색(r.금액천원) ?? ''}`}>{숫자(r.금액천원)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {줄 === '반영' && (
                  <>
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className={`${th} w-28 text-left`}>지중No</th>
                        <th className={`${th} text-left`}>공사명</th>
                        <th className={`${th} w-20 text-left`}>준공일</th>
                        <th className={`${th} w-24 text-right`}>준공액</th>
                        <th className={`${th} w-24 text-right`}>시공 누계</th>
                        <th className={`${th} w-28 text-right`}>준공 반영</th>
                      </tr>
                    </thead>
                    <tbody>
                      {월.준공반영내역.map((r) => (
                        <tr key={r.수주_id} className="border-t border-gray-100">
                          <td className={`${td} text-gray-600`}>{r.지중no}</td>
                          <td className={td}>{r.공사명}</td>
                          <td className={`${td} text-gray-600`}>{짧은날(r.준공일)}</td>
                          <td className={`${td} text-right`}>{숫자(r.준공액천원)}</td>
                          <td
                            className={`${td} text-right ${r.시공없음 ? 'bg-orange-50 font-semibold text-orange-700' : ''}`}
                            title={r.시공없음 ? '시공 입력 없이 준공한 공사' : undefined}
                          >
                            {숫자(r.시공누계천원)}
                          </td>
                          <td className={`${td} text-right font-semibold ${금액색(r.반영천원) ?? ''}`}>
                            {숫자(r.반영천원)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {줄 === '성과' && (
                  <>
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className={`${th} w-28 text-left`}>지중No</th>
                        <th className={`${th} text-left`}>공사명</th>
                        <th className={`${th} w-24 text-right`}>시공 기록</th>
                        <th className={`${th} w-24 text-right`}>준공 반영</th>
                        <th className={`${th} w-28 text-right`}>성과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {월.성과내역.map((r) => (
                        <tr key={r.수주_id} className="border-t border-gray-100">
                          <td className={`${td} text-gray-600`}>{r.지중no}</td>
                          <td className={td}>{r.공사명}</td>
                          {/* 0 은 '이 공사엔 그 몫이 없다' — 진짜 0 과 헷갈리지 않게 '—' */}
                          <td className={`${td} text-right text-gray-600`}>{r.시공천원 ? 숫자(r.시공천원) : '—'}</td>
                          <td className={`${td} text-right ${금액색(r.반영천원) ?? 'text-gray-600'}`}>
                            {r.반영천원 ? 숫자(r.반영천원) : '—'}
                          </td>
                          <td className={`${td} text-right font-semibold ${금액색(r.성과천원) ?? ''}`}>
                            {숫자(r.성과천원)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
              {건수 === 0 && <p className="py-8 text-center text-sm text-gray-400">해당하는 공사가 없습니다.</p>}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-3 tabular-nums">
              <span className="text-gray-600">
                합계 <span className="text-blue-600">({숫자(건수)}건)</span>
                {줄 === '반영' && (
                  <span className="ml-2 text-[11px] text-gray-500">
                    시공 입력 없이 준공 {숫자(시공없음수)}건
                  </span>
                )}
              </span>
              <strong className={`text-base ${금액색(합계) ?? ''}`}>{숫자(합계)} 천원</strong>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: 커밋 안 함** — Task 3과 한 커밋(화면 변경 한 묶음).

---

### Task 3: `FridayPerformanceTable`을 클릭 가능하게

**Files:**
- Modify: `src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx` (전체 교체)

- [ ] **Step 1: 파일 교체**

```tsx
// src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx
'use client'

import { useState } from 'react'
// ⚠️ type 으로만 — 값 import 하면 supabase 조회 코드가 브라우저 번들로 끌려온다
import type { 금요일월성과 } from '../../_lib/금요일성과'
import { FridayDetailDialog, type 줄키, type 표시월 } from './FridayDetailDialog'

/**
 * 금요일 기준 월별 성과 — 시공 기록 / 준공 반영 / 성과 세 줄.
 * 숫자를 누르면 그 달 그 줄의 공사별 목록 팝업(PR-4, 설계 §7-8). 열린 팝업을 state 로 들어야 해서 클라이언트 컴포넌트다.
 * 숫자는 받은 그대로 그리고 여기서 다시 계산하지 않는다 — 표 숫자 = 목록의 합은 _lib 이 보장한다.
 */

const 줄: { 키: 줄키; key: '시공기록천원' | '준공반영천원' | '성과천원'; label: string; hint: string }[] = [
  { 키: '시공', key: '시공기록천원', label: '시공 기록', hint: '공무 화면 월 누적과 같은 숫자' },
  { 키: '반영', key: '준공반영천원', label: '준공 반영', hint: '준공액 − 시공 누계. 시공 기록에 없던 몫' },
  { 키: '성과', key: '성과천원', label: '성과', hint: '시공 기록 + 준공 반영' },
]

function 칸(v: number): string {
  // 0도 숫자로 보인다 — 표시 달의 0은 '기록 없음'이 아니라 '정말 0'이다('—'는 표시 안 하는 달 전용)
  return v.toLocaleString('ko-KR')
}

export function FridayPerformanceTable({ rows }: { rows: 금요일월성과[] }) {
  const [열림, set열림] = useState<{ 월: string; 줄: 줄키 } | null>(null)
  // rows 가 바뀌어(연도 이동) 그 달이 사라지면 자연히 null — 팝업이 닫힌다
  const 열린월 =
    (열림 && rows.find((r): r is 표시월 => r.표시 && r.월 === 열림.월)) || null

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
          {줄.map(({ 키, key, label, hint }) => (
            <tr
              key={key}
              className={key === '성과천원' ? 'border-t border-gray-200 font-semibold' : 'border-b border-gray-50'}
            >
              <th className="sticky left-0 bg-white py-2 pr-3 text-left font-medium text-gray-700" title={hint}>
                {label}
              </th>
              {rows.map((r) => (
                <td key={r.월} className="py-1 px-1 text-right">
                  {r.표시 ? (
                    <button
                      type="button"
                      onClick={() => set열림({ 월: r.월, 줄: 키 })}
                      aria-label={`${Number(r.월.slice(5, 7))}월 ${label} 공사별 상세`}
                      className="rounded px-1.5 py-1 underline decoration-gray-300 decoration-dotted underline-offset-4 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
                      style={{ color: r[key] < 0 ? '#dc2626' : '#374151' }}
                    >
                      {칸(r[key])}
                    </button>
                  ) : (
                    <span className="px-1.5" style={{ color: '#d1d5db' }}>—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-400">
        단위 천원 · 한 주(월~일)는 금요일이 속한 달로 센다 · 2026년 9월 앞 달과 아직 오지 않은 달은 &apos;—&apos;
        · 숫자를 누르면 공사별 상세 · 정산(청구 금액)은 성과가 아니라 공무 화면·대시보드에서 본다
      </p>
      <FridayDetailDialog
        월={열린월}
        줄={열린월 ? 열림!.줄 : null}
        onClose={() => set열림(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: 타입·린트·테스트**

Run: `npx tsc --noEmit` → 에러 0
Run: `npx eslint "src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx" "src/app/(dashboard)/sales/_components/FridayDetailDialog.tsx"` → 에러 0
Run: `npm test` → 전부 PASS

- [ ] **Step 3: 브라우저 확인 (로컬 dev, 운영 DB 읽기)** — `npm run dev` 후 `/sales?basis=friday&year=2026`.
  - [ ] 9·10·11월 각 세 줄, 총 9개 팝업의 합계 = 표 숫자. 기대값(2026-11-10 실측, 그 뒤 입력이 늘면 달라질 수 있음 — 그때는 표 숫자와 같기만 하면 된다): 9월 250,773 / 46,418 / 297,191 · 10월 494,834 / 209,394 / 704,228 · 11월 77,241 / 8,060 / 85,301.
  - [ ] 10월 건수: 시공 39 / 반영 42(시공 입력 없이 준공 16건, 주황 칸) / 성과 79.
  - [ ] 10월 반영 팝업 맨 위 SY26-010: 준공액 89,475 · 시공 누계 11,238 · 반영 78,237 (식이 맞는다). 음수 JY25-147 −5,064 빨간색.
  - [ ] 10월 시공 팝업 = 대시보드 홈 10월 시공 실적 팝업(운영)과 줄 수·합계·상위 공사 일치.
  - [ ] '—' 달은 클릭이 안 된다. Esc·바깥 클릭·X로 닫힌다. 연도 선택(2025)으로 이동하면 표가 전부 '—'이고 콘솔 에러 0.
  - [ ] 말일 화면(`basis` 없음)은 바뀐 게 없다.

- [ ] **Step 4: 커밋** — 사용자 메시지. 초안: `매출손익 금요일 표 숫자를 누르면 공사별 상세 팝업 — 사장님이 숫자가 어떤 공사로 이루어졌는지 보게`

```bash
git add "src/app/(dashboard)/sales/_components/FridayPerformanceTable.tsx" "src/app/(dashboard)/sales/_components/FridayDetailDialog.tsx"
git status   # 두 파일 모두 staged 확인
git commit -m "<사용자 메시지>"
```

---

### Task 4: 게이트 3·4, PR

- [ ] **게이트 3 (리뷰)** — Claude가 diff를 비판적으로 검토하고 사용자가 항목마다 수용/반박. 최소 확인: 클라이언트 번들에 `junggong-seonggwa`의 값 코드가 안 들어갔나(`import type`), 9·10·11 합계 대조, 빈 달(목록 0건) 화면, 긴 공사명 줄바꿈, 모바일 폭(PR-1 결정상 확인 생략 가능).
- [ ] **게이트 4 (이해)** — 질문 1~2개, 바닥 개념으로. 후보:
  1. ([[같은 원본을 읽는 두 기록]]) "표의 10월 성과 704,228과 성과 팝업 합계가 같다는 걸 무엇이 보장하나 / `build월성과내역`으로 목록을 만들었다면 무엇이 어긋나고 경고는 뜨나" — '각각 계산했는데 마침 같다' vs '하나가 다른 하나에서 파생'을 1차 답에서 가르는지.
  2. (서버 vs 클라이언트 경계) "`FridayDetailDialog`가 `금요일성과`를 `import type`이 아니라 보통 import로 가져오면 무엇이 브라우저로 가나 / 빌드 후 `import type`은 어디 남나" — [[컴파일타임 vs 런타임]] 소거 칸.
- [ ] **PR 생성** — 브랜치 `feat/sales-friday-detail-popups`, 대상 `main`. 본문에 완료 기준 대조표(9·10·11 × 3줄) 첨부. 머지·배포는 사용자가 한다.
- [ ] 배포 후 사장님 확인 항목은 설계 §7-8 마지막 줄(시공 입력 없이 준공 공사가 이름으로 보임) — 7-1·7-6과 함께.
