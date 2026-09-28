# 대시보드 실적 — 시공 실적 / 정산 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 총 공정률 도넛이 **시공 실적 ÷ 목표(시공분)**를 보여주고, 정산(기성·준공 계산서)은 캡션의 별도 줄과 상세 팝업으로 보여준다.

**Architecture:** 프로듀서(yjs_erp)의 `GET /api/kpi/monthly-performance` 응답에 `split` 칸을 **추가**한다(기존 칸은 그대로). 소비자(yjs_Dashboard)의 중계 `app/api/erp.py`가 허용목록에 `split`을 넣어 방어적으로 재포장하고, `web/home.js`가 그걸로 도넛·캡션·팝업을 그린다. `split.construction`이 없으면 옛 합계값으로 대신 채우지 않고 ERP 실패와 같은 대체값 경로로 보낸다.

**Tech Stack:** yjs_erp = Next.js 16 / TypeScript / Supabase(PostgREST) / vitest. yjs_Dashboard = FastAPI(Python 3.11) / pytest / 바닐라 JS + Bootstrap 모달.

**Spec:** `docs/superpowers/specs/2026-09-28-dashboard-construction-settlement-split-design.md`

---

## 규칙 (실행자 필독)

- **티어 A.** 회계 정합성·두 레포 API 계약·타임존.
- **운영 DB 쓰기 금지.** 이 계획의 모든 DB 접근은 읽기다.
- **커밋에 섞지 말 것:** yjs_erp의 `PROGRESS.md`, 루트의 회의록 xlsx·png·폴더, `backups/`, `docs/2026-q3-*`, `docs/erp-cost-*`, `docs/superpowers/specs/2026-08-10-*`, `scripts/register-path-alias.cjs`, `scripts/report-q3-operations.ts`, `yjs-erp-error-0.log`. yjs_Dashboard의 `.claude/settings.local.json`, 삭제된 `uploads/*.xlsx`. **항상 파일을 이름으로 `git add` 한다(`git add -A` / `git add .` 금지).**
- 작업 중 커밋은 아래 메시지로 한다. **PR 머지(squash) 메시지는 사용자가 게이트 5에서 직접 쓴다.**
- 날짜는 `'YYYY-MM-DD'` 문자열로만 비교한다. 새 코드에서 `new Date()`로 달력을 읽지 않는다.
- 브랜치: yjs_erp는 `feat/dashboard-construction-settlement-split`(이미 있음, 스펙 커밋 `4d250d1`). yjs_Dashboard는 Task 6에서 `main`에서 같은 이름으로 새로 딴다.

## 파일 구조

**yjs_erp**
| 파일 | 책임 |
|---|---|
| `src/app/(dashboard)/_lib/monthly-kpi.ts` (수정) | `getMonthlyPeriod`·`load투입원가재료` export. 계산은 그대로 |
| `src/app/(dashboard)/_lib/monthly-revenue-breakdown.ts` (수정) | `build월시공내역` 추가(야간 헬퍼를 `build월성과내역`과 공유) |
| `src/app/(dashboard)/_lib/monthly-revenue-breakdown.test.ts` (수정) | `build월시공내역` 테스트 |
| `src/app/(dashboard)/_lib/monthly-split.ts` (신규) | `build월정산내역`(순수) + `getMonthlySplit`(조회) |
| `src/app/(dashboard)/_lib/monthly-split.test.ts` (신규) | `build월정산내역` 테스트 |
| `src/app/api/kpi/monthly-performance/route.ts` (수정) | 재료 한 번 로드, 두 계산에 공유, 응답에 `split` |

**yjs_Dashboard**
| 파일 | 책임 |
|---|---|
| `app/api/erp.py` (수정) | `_normalize_section` 공통화, `_normalize_split`, 허용목록에 `split` |
| `tests/test_erp_kpi_split.py` (신규) | split 재포장 규칙 |
| `web/home.js` (수정) | 도넛=construction, 캡션 정산 줄, 정산 팝업 |
| `web/home.html` (수정) | 정산 모달 마크업, `.tp-kind` 스타일, `home.js?v=` 올리기 |

---

## Task 1: ERP — 기간·투입재료 로더 export (동작 변경 없음)

**Files:**
- Modify: `src/app/(dashboard)/_lib/monthly-kpi.ts`

- [ ] **Step 1: `getMonthlyPeriod`를 export한다**

`function getMonthlyPeriod(now: Date) {` 를 다음으로 바꾼다.

```ts
export function getMonthlyPeriod(now: Date) {
```

- [ ] **Step 2: 그 달 투입실적·단가 조회를 `load투입원가재료`로 뽑는다**

`getMonthlyKpiData` 위(= `getMonthlyPeriod` 함수 바로 아래)에 추가한다.

```ts
export type MonthlyPeriod = ReturnType<typeof getMonthlyPeriod>

/**
 * 그 달 투입실적(+상세)과 공사단가. getMonthlyKpiData 와 대시보드 split(야간 표기)이 같은 행을 쓰도록
 * route 가 한 번 불러 두 계산에 나눠 준다.
 */
export function load투입원가재료(
  supabase: SupabaseClient<Database>,
  period: Pick<MonthlyPeriod, 'year' | 'monthStart' | 'monthEnd'>,
): Promise<투입원가재료> {
  return Promise.all([
    supabase
      .from('투입실적')
      .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
      .gte('투입일', period.monthStart)
      .lt('투입일', period.monthEnd),
    supabase.from('공사단가').select('*').order('적용시작일'),
  ]).then(([투입실적결과, 단가결과]) => {
    const firstError = 투입실적결과.error ?? 단가결과.error
    if (firstError) throw firstError
    return {
      year: period.year,
      투입실적: (투입실적결과.data ?? []) as unknown as 투입실적With상세[],
      단가: (단가결과.data ?? []) as 공사단가Row[],
    }
  })
}
```

그리고 `getMonthlyKpiData` 안의 `const 자체투입재료Promise = 투입원가재료Promise ?? Promise.all([ ... ])` 블록 전체(현재 `.then(...)` 이 끝나는 `})` 까지)를 한 줄로 바꾼다.

```ts
  const 자체투입재료Promise = 투입원가재료Promise ?? load투입원가재료(supabase, period)
```

- [ ] **Step 3: 타입체크·기존 테스트**

Run: `npx tsc --noEmit` → 에러 0.
Run: `npm test` → 전부 PASS(기존 테스트 수 그대로).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/_lib/monthly-kpi.ts"
git commit -m "refactor(kpi): 기간 계산과 그 달 투입재료 조회를 export — split과 같은 달·같은 행을 쓰게"
```

---

## Task 2: ERP — `build월시공내역` (공사이력만, 행마다 반올림)

**Files:**
- Modify: `src/app/(dashboard)/_lib/monthly-revenue-breakdown.ts`
- Test: `src/app/(dashboard)/_lib/monthly-revenue-breakdown.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`monthly-revenue-breakdown.test.ts`의 import 줄을 바꾼다.

```ts
import { build월성과내역, build월시공내역, sum월성과내역 } from './monthly-revenue-breakdown'
```

파일 끝에 추가한다(헬퍼 `수주`, `이력`, `투입`, `이번달`은 파일 위쪽에 이미 있다).

```ts
describe('build월시공내역', () => {
  it('공사이력 행마다 천원으로 반올림한 뒤 공사별로 합친다 (공무 페이지와 같은 규칙)', () => {
    // 499원 행 2개: 행마다 반올림하면 0+0=0, 원 합계(998원)를 먼저 반올림하면 1천원 — 결과가 갈리는 사례
    const rows = build월시공내역(
      [이력(1, '2026-09-03', 499), 이력(1, '2026-09-04', 499), 이력(2, '2026-09-05', 1_500)],
      [수주({ id: 1 }), 수주({ id: 2 })],
      [],
      ...이번달,
    )
    // 공사 1은 0천원이라 감춰지고, 1,500원 행은 2천원(반올림)
    expect(rows).toEqual([
      expect.objectContaining({ 수주_id: 2, 금액천원: 2, 일자: [5] }),
    ])
  })

  it('준공 공사여도 준공 보정을 더하지 않는다 — 시공만', () => {
    const rows = build월시공내역(
      [이력(1, '2026-09-10', 3_000_000)],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-09-20', 준공액_공급가: 10_000_000 })],
      [],
      ...이번달,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ 수주_id: 1, 금액천원: 3000, 일자: [10] })
  })

  it('기간 경계: 말일은 넣고 다음 달 1일은 뺀다', () => {
    const rows = build월시공내역(
      [이력(1, '2026-08-31', 1_000_000), 이력(1, '2026-09-30', 2_000_000), 이력(1, '2026-10-01', 4_000_000)],
      [수주({ id: 1 })],
      [],
      ...이번달,
    )
    expect(rows[0]).toMatchObject({ 금액천원: 2000, 일자: [30] })
  })

  it('야간 표기는 build월성과내역과 같은 방식으로 붙는다', () => {
    const rows = build월시공내역(
      [이력(1, '2026-09-04', 1_000_000), 이력(1, '2026-09-05', 1_000_000)],
      [수주({ id: 1 })],
      [투입(1, '2026-09-04', false), 투입(1, '2026-09-05', true)],
      ...이번달,
    )
    expect(rows[0].야간일자).toEqual([5])
  })

  it('금액 큰 순, 같으면 지중no 순', () => {
    const rows = build월시공내역(
      [이력(3, '2026-09-01', 1_000_000), 이력(1, '2026-09-01', 1_000_000), 이력(2, '2026-09-01', 5_000_000)],
      [수주({ id: 1 }), 수주({ id: 2 }), 수주({ id: 3 })],
      [],
      ...이번달,
    )
    expect(rows.map((r) => r.수주_id)).toEqual([2, 1, 3])
  })

  it('합계는 sum월성과내역(행의 합)과 같다', () => {
    const rows = build월시공내역(
      [이력(1, '2026-09-01', 1_400), 이력(1, '2026-09-02', 1_400), 이력(2, '2026-09-03', -2_600)],
      [수주({ id: 1 }), 수주({ id: 2 })],
      [],
      ...이번달,
    )
    // 행마다: 1 + 1 = 2, -3 → 합 -1
    expect(sum월성과내역(rows)).toBe(-1)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/monthly-revenue-breakdown.test.ts"`
Expected: FAIL — `build월시공내역` is not exported / not a function.

- [ ] **Step 3: 구현한다**

`monthly-revenue-breakdown.ts` 상단 import에 추가한다.

```ts
// 반올림 규칙을 공무 페이지와 '같은 함수'로 맞춘다 — 규칙을 복사하면 한쪽만 바뀌는 날 두 화면이 갈라진다
import { 천원 } from '../gongmu/_lib/erp-실적'
```

`build월성과내역` 안의 야간 집합 만들기와 행 마무리를 모듈 함수로 뽑는다. `function has야간(...)` 아래에 추가한다.

```ts
/** [from, to) 투입실적 중 야간이 있었던 (수주_id|날짜) 집합 — 공사이력엔 야간 정보가 없어 여기서 빌려온다 */
function build야간날(투입실적: 투입실적With상세[], from: string, to: string): Set<string> {
  const 야간날 = new Set<string>()
  for (const row of 투입실적) {
    const 날짜 = String(row.투입일 ?? '')
    if (날짜 < from || 날짜 >= to) continue
    if (has야간(row)) 야간날.add(야간키(row.수주_id, 날짜))
  }
  return 야간날
}

/** 공사별 (천원, 날짜들) → 화면 행. 0천원 행은 감추고, 금액 큰 순 → 지중no 순으로 고정한다 */
function to내역Rows(
  집계: Iterable<[number, { 금액천원: number; 날짜: Set<string> }]>,
  수주맵: Map<number, 준공수주Row>,
  야간날: Set<string>,
): 월성과내역Row[] {
  const rows: 월성과내역Row[] = []
  for (const [수주_id, v] of 집계) {
    // 0천원 행은 감춘다 — 합계에 0을 보태던 행이라 총액은 바뀌지 않는다
    if (v.금액천원 === 0) continue
    const 수주 = 수주맵.get(수주_id)
    const 날짜목록 = [...v.날짜].sort()
    rows.push({
      수주_id,
      지중no: 수주?.지중no ?? '',
      공사명: 수주?.공사명 ?? '(공사명 없음)',
      금액천원: v.금액천원,
      일자: 날짜목록.map(일).filter(Number.isInteger),
      야간일자: 날짜목록.filter((d) => 야간날.has(야간키(수주_id, d))).map(일).filter(Number.isInteger),
    })
  }
  // 금액 큰 순. 같으면 지중no로 고정해 매 조회마다 순서가 흔들리지 않게 한다
  return rows.sort((a, b) => b.금액천원 - a.금액천원 || a.지중no.localeCompare(b.지중no, 'ko'))
}
```

`build월성과내역` 본문을 이 헬퍼로 다시 쓴다(결과는 같다 — 원 단위로 모은 뒤 **공사별로 한 번** 반올림하는 기존 규칙 유지).

```ts
export function build월성과내역(
  공사이력전체: 성과이력Row[],
  수주목록: 준공수주Row[],
  이력누계: Map<number, number>,
  투입실적: 투입실적With상세[],
  from: string,
  to: string,
): 월성과내역Row[] {
  const 수주맵 = new Map(수주목록.map((o) => [o.id, o]))
  // 투입 입력이 안 된 날은 야간이어도 표기가 안 붙는다 — 금액과 무관한 표기라 감수한다.
  const 야간날 = build야간날(투입실적, from, to)

  type 집계 = { 금액원: number; 날짜: Set<string> }
  const 집계맵 = new Map<number, 집계>()
  const get집계 = (수주_id: number): 집계 => {
    let v = 집계맵.get(수주_id)
    if (!v) {
      v = { 금액원: 0, 날짜: new Set<string>() }
      집계맵.set(수주_id, v)
    }
    return v
  }

  // ① 그 달 공사이력
  for (const row of 공사이력전체) {
    // 날짜는 문자열로만 비교한다 — new Date()를 쓰면 서버 시계(UTC)가 KST 달력을 밀어버린다
    if (row.작업일자 < from || row.작업일자 >= to) continue
    const v = get집계(row.수주_id)
    v.금액원 += row.성과금액 ?? 0
    v.날짜.add(row.작업일자)
  }

  // ② 준공 잔여성과 — 같은 공사면 ①과 한 줄로 합친다 (준공만 있는 공사는 날짜가 빈 채로 새 줄이 생김)
  for (const r of calc준공잔여성과(수주목록, 이력누계, from, to)) {
    get집계(r.수주_id).금액원 += r.금액
  }

  // 이 함수는 공사별 원 합계를 한 번 반올림한다(2026-09-11 규칙, 기존 breakdown 칸 그대로 유지)
  const 천원집계 = [...집계맵].map(
    ([id, v]) => [id, { 금액천원: Math.round(v.금액원 / 1000), 날짜: v.날짜 }] as [number, { 금액천원: number; 날짜: Set<string> }],
  )
  return to내역Rows(천원집계, 수주맵, 야간날)
}
```

`build월성과내역` 아래에 새 함수를 추가한다.

```ts
/**
 * [from, to) 공사별 **시공 실적** — 대시보드 도넛의 분자 (2026-09-28).
 *
 * build월성과내역과 두 가지가 다르다:
 *   1) 준공 보정(②)을 더하지 않는다. 월간 목표가 시공분만이라, 분자에 준공 보정이 섞이면 기준이 어긋난다.
 *   2) 공사이력 **행마다** 천원으로 반올림한다. 공무 페이지(gongmu/_lib/erp-실적.ts)와 같은 규칙이라
 *      두 화면의 9월 합계가 1천원까지 같아진다.
 */
export function build월시공내역(
  공사이력전체: 성과이력Row[],
  수주목록: 준공수주Row[],
  투입실적: 투입실적With상세[],
  from: string,
  to: string,
): 월성과내역Row[] {
  const 수주맵 = new Map(수주목록.map((o) => [o.id, o]))
  const 야간날 = build야간날(투입실적, from, to)

  const 집계맵 = new Map<number, { 금액천원: number; 날짜: Set<string> }>()
  for (const row of 공사이력전체) {
    // 날짜는 문자열로만 비교한다 — new Date()를 쓰면 서버 시계(UTC)가 KST 달력을 밀어버린다
    if (row.작업일자 < from || row.작업일자 >= to) continue
    let v = 집계맵.get(row.수주_id)
    if (!v) {
      v = { 금액천원: 0, 날짜: new Set<string>() }
      집계맵.set(row.수주_id, v)
    }
    v.금액천원 += 천원(row.성과금액)
    v.날짜.add(row.작업일자)
  }
  return to내역Rows(집계맵, 수주맵, 야간날)
}
```

파일 상단 주석 블록(`/** 월 성과 내역 — ...`)의 끝(`* ②만 있는 공사는 ...` 줄 다음)에 한 줄 추가한다.

```ts
 *
 * build월시공내역은 ①만(시공 실적) 행마다 반올림한 판본이다 — 대시보드 도넛용(2026-09-28).
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/monthly-revenue-breakdown.test.ts"`
Expected: PASS (기존 `build월성과내역` 테스트 포함 전부).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/_lib/monthly-revenue-breakdown.ts" "src/app/(dashboard)/_lib/monthly-revenue-breakdown.test.ts"
git commit -m "feat(kpi): 시공 실적만 공사별로 펼치는 build월시공내역 — 공무 페이지와 같은 행 단위 반올림"
```

---

## Task 3: ERP — `build월정산내역` (기성 + 준공 금회지불액)

**Files:**
- Create: `src/app/(dashboard)/_lib/monthly-split.ts`
- Test: `src/app/(dashboard)/_lib/monthly-split.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`monthly-split.test.ts` 전체:

```ts
import { describe, it, expect } from 'vitest'
import { build월정산내역, sum월정산내역, type 정산기성Row } from './monthly-split'
import type { 준공수주Row } from './junggong-seonggwa'

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

let 기성id = 0
const 기성 = (수주_id: number, 기성일: string | null, 금액: number | null, 차수: number | null = 1): 정산기성Row =>
  ({ id: ++기성id, 수주_id, 차수, 기성일, 기성액_공급가: 금액 })

const 이번달 = ['2026-09-01', '2026-10-01'] as const

describe('build월정산내역', () => {
  it('그 달 기성은 계산서 한 장당 한 줄, 구분은 "기성 N차"', () => {
    const rows = build월정산내역(
      [기성(1, '2026-09-23', 30_000_000, 2), 기성(1, '2026-08-20', 20_000_000, 1)],
      [수주({ id: 1 })],
      ...이번달,
    )
    expect(rows).toEqual([
      { 수주_id: 1, 지중no: 'JG26-001', 공사명: '테스트 공사 1', 구분: '기성 2차', 일: 23, 금액천원: 30000 },
    ])
  })

  it('준공은 금회지불액 = 준공액 − 기성 전 기간 누계 (5월 기성 + 9월 준공)', () => {
    const rows = build월정산내역(
      [기성(1, '2026-05-10', 60_000_000)],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-09-15', 준공액_공급가: 100_000_000 })],
      ...이번달,
    )
    expect(rows).toEqual([
      { 수주_id: 1, 지중no: 'JG26-001', 공사명: '테스트 공사 1', 구분: '준공', 일: 15, 금액천원: 40000 },
    ])
  })

  it('기성이 없는 준공은 준공액 그대로', () => {
    const rows = build월정산내역(
      [],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-09-02', 준공액_공급가: 5_000_000 })],
      ...이번달,
    )
    expect(rows[0]).toMatchObject({ 구분: '준공', 금액천원: 5000 })
  })

  it('환수(기성누계 > 준공액)는 음수 그대로 남고 합계에서 빠진다', () => {
    const rows = build월정산내역(
      [기성(1, '2026-06-01', 12_000_000), 기성(2, '2026-09-03', 3_000_000)],
      [
        수주({ id: 1, 준공여부: true, 준공일: '2026-09-10', 준공액_공급가: 10_000_000 }),
        수주({ id: 2 }),
      ],
      ...이번달,
    )
    expect(rows.map((r) => [r.수주_id, r.구분, r.금액천원])).toEqual([
      [2, '기성 1차', 3000],
      [1, '준공', -2000],
    ])
    expect(sum월정산내역(rows)).toBe(1000)
  })

  it('기성일이 빈 기성은 월 목록엔 없고 준공 차감에는 들어간다', () => {
    const rows = build월정산내역(
      [기성(1, null, 7_000_000)],
      [수주({ id: 1, 준공여부: true, 준공일: '2026-09-30', 준공액_공급가: 10_000_000 })],
      ...이번달,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ 구분: '준공', 금액천원: 3000 })
  })

  it('달 경계: 말일은 넣고 다음 달 1일·전달 말일은 뺀다', () => {
    const rows = build월정산내역(
      [기성(1, '2026-08-31', 1_000_000), 기성(1, '2026-09-30', 2_000_000), 기성(1, '2026-10-01', 4_000_000)],
      [수주({ id: 1 })],
      ...이번달,
    )
    expect(rows.map((r) => r.일)).toEqual([30])
  })

  it('준공액이 비었거나 준공여부가 false면 준공 줄이 없다', () => {
    const rows = build월정산내역(
      [],
      [
        수주({ id: 1, 준공여부: true, 준공일: '2026-09-05', 준공액_공급가: null }),
        수주({ id: 2, 준공여부: false, 준공일: '2026-09-05', 준공액_공급가: 5_000_000 }),
      ],
      ...이번달,
    )
    expect(rows).toEqual([])
  })

  it('차수가 비어 있으면 구분은 "기성"', () => {
    const rows = build월정산내역([기성(1, '2026-09-05', 1_000_000, null)], [수주({ id: 1 })], ...이번달)
    expect(rows[0].구분).toBe('기성')
  })

  it('계산서 행마다 천원 반올림, 0천원 행은 감춘다', () => {
    const rows = build월정산내역(
      [기성(1, '2026-09-01', 499), 기성(2, '2026-09-02', 1_500)],
      [수주({ id: 1 }), 수주({ id: 2 })],
      ...이번달,
    )
    expect(rows.map((r) => [r.수주_id, r.금액천원])).toEqual([[2, 2]])
  })

  it('정렬: 금액 큰 순 → 지중no → 구분 → 일 (조회마다 순서 고정)', () => {
    const rows = build월정산내역(
      [기성(2, '2026-09-09', 1_000_000, 1), 기성(1, '2026-09-08', 1_000_000, 1), 기성(1, '2026-09-01', 9_000_000, 2)],
      [수주({ id: 1 }), 수주({ id: 2 })],
      ...이번달,
    )
    expect(rows.map((r) => [r.지중no, r.구분])).toEqual([
      ['JG26-001', '기성 2차'],
      ['JG26-001', '기성 1차'],
      ['JG26-002', '기성 1차'],
    ])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/monthly-split.test.ts"`
Expected: FAIL — Cannot find module './monthly-split'.

- [ ] **Step 3: 구현한다**

`monthly-split.ts` 전체(`getMonthlySplit`은 Task 4에서 추가):

```ts
/**
 * 대시보드 실적 분리 — 시공 실적 / 정산 (2026-09-28 사장님 요구사항)
 *
 * 이 회사의 금액 기록은 두 축이다. 더하는 관계가 아니다(정산 대부분은 이미 시공으로 잡힌 일에 대한 청구).
 *   시공: 공무가 진행분을 금액으로 환산한 것 = 공사이력.성과금액            → build월시공내역 (monthly-revenue-breakdown.ts)
 *   정산: 실제로 끊은 계산서 = 그 달 기성 + 그 달 준공의 금회지불액         → build월정산내역 (여기)
 *
 * ⚠️ '준공 보정'(junggong-seonggwa.ts)과 '준공 정산'은 다른 숫자다.
 *    준공 보정 = 준공액 − 공사이력(시공) 누계 — 매출 인식 축의 중복 제거용
 *    준공 정산 = 준공액 − 기성 누계           — 새로 끊은 계산서 금액 (OrderForm 의 금회지불액)
 *    둘을 섞으면 기성을 두 번 세거나 시공을 빼게 된다.
 *
 * DB에 아무것도 쓰지 않는다(읽기 시점 파생).
 */
import { 천원 } from '../gongmu/_lib/erp-실적'
import type { 준공수주Row } from './junggong-seonggwa'

export type 정산기성Row = {
  id: number
  수주_id: number
  차수: number | null
  기성일: string | null
  기성액_공급가: number | null
}

export type 월정산내역Row = {
  수주_id: number
  지중no: string
  공사명: string
  /** '기성 N차' | '기성' | '준공' */
  구분: string
  /** 계산서 날짜의 '일' */
  일: number
  /** 천원, 음수 가능(환수) — 0으로 깎지 않는다 */
  금액천원: number
}

function 일(날짜: string): number {
  return parseInt(날짜.slice(8, 10), 10)
}

/**
 * [from, to) 에 끊은 계산서 목록. (from/to 는 'YYYY-MM-DD', to 는 미포함)
 *
 * @param 기성전체 기성 **전 행**(기성일이 빈 행 포함) — 준공 차감용 누계를 전 기간으로 만들어야 해서 자르지 않고 받는다.
 *                 기간으로 자른 목록을 넘기면 5월에 끊은 기성을 9월 준공에서 못 빼 이중 계상된다.
 */
export function build월정산내역(
  기성전체: 정산기성Row[],
  수주목록: 준공수주Row[],
  from: string,
  to: string,
): 월정산내역Row[] {
  const 수주맵 = new Map(수주목록.map((o) => [o.id, o]))
  const 이름 = (수주_id: number) => {
    const o = 수주맵.get(수주_id)
    return { 지중no: o?.지중no ?? '', 공사명: o?.공사명 ?? '(공사명 없음)' }
  }

  // 기성 누계는 기성일이 빈 행(2026-06 이관분)까지 포함한 전 기간 — 날짜가 없어도 돈은 이미 청구됐다
  const 기성누계 = new Map<number, number>()
  for (const g of 기성전체) {
    기성누계.set(g.수주_id, (기성누계.get(g.수주_id) ?? 0) + (g.기성액_공급가 ?? 0))
  }

  const rows: 월정산내역Row[] = []

  // 기성: 계산서 한 장 = 한 줄. 기성일이 빈 행은 귀속시킬 달이 없어 목록에서 빠진다
  for (const g of 기성전체) {
    // 날짜는 문자열로만 비교한다 — new Date()를 쓰면 서버 시계(UTC)가 KST 달력을 밀어버린다
    if (!g.기성일 || g.기성일 < from || g.기성일 >= to) continue
    rows.push({
      수주_id: g.수주_id,
      ...이름(g.수주_id),
      구분: g.차수 ? `기성 ${g.차수}차` : '기성',
      일: 일(g.기성일),
      금액천원: 천원(g.기성액_공급가),
    })
  }

  // 준공: 금회지불액 = 총 준공액 − 앞서 끊은 기성 전부. 준공액_공급가는 언제나 총액이다(2026-07-29)
  for (const o of 수주목록) {
    if (!o.준공여부 || !o.준공일 || o.준공액_공급가 == null) continue
    if (o.준공일 < from || o.준공일 >= to) continue
    rows.push({
      수주_id: o.id,
      ...이름(o.id),
      구분: '준공',
      일: 일(o.준공일),
      금액천원: 천원(o.준공액_공급가 - (기성누계.get(o.id) ?? 0)),
    })
  }

  return rows
    // 0천원 행은 감춘다 — 합계에 0을 보태던 행이라 총액은 바뀌지 않는다
    .filter((r) => r.금액천원 !== 0 && Number.isInteger(r.일))
    // 금액 큰 순. 같으면 지중no → 구분 → 일로 고정해 매 조회마다 순서가 흔들리지 않게 한다
    .sort(
      (a, b) =>
        b.금액천원 - a.금액천원 ||
        a.지중no.localeCompare(b.지중no, 'ko') ||
        a.구분.localeCompare(b.구분, 'ko') ||
        a.일 - b.일,
    )
}

/** 표에 보이는 행들의 합 — 캡션의 '정산'은 이 값이어야 한다 (따로 계산하지 않는다) */
export function sum월정산내역(rows: 월정산내역Row[]): number {
  return rows.reduce((sum, r) => sum + r.금액천원, 0)
}
```

주의: 정렬 테스트에서 `기성 2차`(9,000천원)가 금액 순으로 먼저 오고, 같은 1,000천원인 두 줄은 지중no로 갈린다. 테스트 기대값이 이 규칙과 맞는지 Step 4에서 확인한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/monthly-split.test.ts"`
Expected: PASS 10개.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/_lib/monthly-split.ts" "src/app/(dashboard)/_lib/monthly-split.test.ts"
git commit -m "feat(kpi): 그 달 끊은 계산서를 펼치는 build월정산내역 — 준공은 기성 전 기간 누계를 뺀 금회지불액"
```

---

## Task 4: ERP — `getMonthlySplit` + route 연결

**Files:**
- Modify: `src/app/(dashboard)/_lib/monthly-split.ts`
- Modify: `src/app/api/kpi/monthly-performance/route.ts`

- [ ] **Step 1: `getMonthlySplit`을 추가한다**

`monthly-split.ts` 상단 import를 다음으로 바꾼다.

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { 천원 } from '../gongmu/_lib/erp-실적'
import type { load성과재료, 준공수주Row } from './junggong-seonggwa'
import { build월시공내역, sum월성과내역, type 월성과내역Row } from './monthly-revenue-breakdown'
import type { MonthlyPeriod } from './monthly-kpi'
import type { 투입원가재료 } from './dashboard-data'
```

파일 끝에 추가한다.

```ts
export type MonthlySplit = {
  construction: { rows: 월성과내역Row[]; totalThousand: number }
  settlement: { rows: 월정산내역Row[]; totalThousand: number }
}

/**
 * 대시보드 API 응답의 split 칸.
 * period·성과재료·투입재료는 route 가 한 번 만들어 getMonthlyKpiData 와 나눠 쓴다 —
 * 같은 달, 같은 행을 봐야 기존 칸과 split 이 서로 다른 순간의 DB를 설명하는 일이 없다.
 */
export async function getMonthlySplit(
  supabase: SupabaseClient<Database>,
  period: Pick<MonthlyPeriod, 'monthStart' | 'monthEnd'>,
  성과재료Promise: ReturnType<typeof load성과재료>,
  투입재료Promise: Promise<투입원가재료>,
): Promise<MonthlySplit> {
  const [성과재료, 투입재료, 기성전체] = await Promise.all([
    성과재료Promise,
    투입재료Promise,
    // 준공 차감 누계가 전 기간이어야 해서 기간으로 자르지 않는다. 1000행에서 조용히 잘리지 않게 끝까지 받는다
    fetchAllRows('기성', (from, to) =>
      supabase
        .from('기성')
        .select('id, 수주_id, 차수, 기성일, 기성액_공급가')
        .order('id')
        .range(from, to),
    ),
  ])

  const 투입실적 = 투입재료.투입실적.filter(
    (row) => row.투입일 >= period.monthStart && row.투입일 < period.monthEnd,
  )
  const constructionRows = build월시공내역(
    성과재료.공사이력,
    성과재료.수주,
    투입실적,
    period.monthStart,
    period.monthEnd,
  )
  const settlementRows = build월정산내역(
    기성전체 as unknown as 정산기성Row[],
    성과재료.수주,
    period.monthStart,
    period.monthEnd,
  )
  return {
    construction: { rows: constructionRows, totalThousand: sum월성과내역(constructionRows) },
    settlement: { rows: settlementRows, totalThousand: sum월정산내역(settlementRows) },
  }
}
```

`import type { 준공수주Row }`가 이제 `import type { load성과재료, 준공수주Row }`로 합쳐졌는지 확인한다(중복 import 금지).

- [ ] **Step 2: route를 바꾼다**

`src/app/api/kpi/monthly-performance/route.ts` 전체:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMonthlyKpiData,
  getMonthlyPeriod,
  load투입원가재료,
} from '@/app/(dashboard)/_lib/monthly-kpi'
import { load성과재료 } from '@/app/(dashboard)/_lib/junggong-seonggwa'
import { getMonthlySplit } from '@/app/(dashboard)/_lib/monthly-split'

export async function GET(req: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // service_role 이라 RLS가 막아주지 않는다 — 이 한 줄이 이 라우트의 유일한 문지기다
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    // 기존 칸과 split 이 같은 달·같은 재료를 보도록 한 번만 정하고 한 번만 읽어 나눠 준다
    const now = new Date()
    const period = getMonthlyPeriod(now)
    const 성과재료Promise = load성과재료(supabase)
    const 투입재료Promise = load투입원가재료(supabase, period)

    const [data, split] = await Promise.all([
      getMonthlyKpiData(supabase, now, 성과재료Promise, 투입재료Promise),
      getMonthlySplit(supabase, period, 성과재료Promise, 투입재료Promise),
    ])
    // split 은 '추가'다 — 기존 칸(amounts·breakdown 등)의 값과 의미는 그대로 두어 옛 대시보드가 깨지지 않게 한다
    return NextResponse.json({ ...data, split })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load KPI data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: 타입체크·린트·테스트**

Run: `npx tsc --noEmit` → 에러 0.
Run: `npx eslint "src/app/(dashboard)/_lib/monthly-split.ts" "src/app/(dashboard)/_lib/monthly-kpi.ts" "src/app/(dashboard)/_lib/monthly-revenue-breakdown.ts" "src/app/api/kpi/monthly-performance/route.ts"` → 에러 0.
Run: `npm test` → 전부 PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/_lib/monthly-split.ts" "src/app/api/kpi/monthly-performance/route.ts"
git commit -m "feat(api): 대시보드 KPI 응답에 split(시공/정산) 칸 추가 — 기존 칸은 그대로"
```

---

## Task 5: ERP — 운영 데이터 실측 대조 (읽기 전용, 커밋 안 함)

**Files:**
- Create (임시, 끝나면 삭제): `scripts/.tmp/verify-split.ts`

- [ ] **Step 1: 대조 스크립트를 쓴다**

9월 기준으로 route와 같은 경로를 태운다. `now`는 KST 2026-09-28 정오로 고정한다.

```ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createAdminClient } from '../../src/lib/supabase/admin'
import { getMonthlyKpiData, getMonthlyPeriod, load투입원가재료 } from '../../src/app/(dashboard)/_lib/monthly-kpi'
import { load성과재료 } from '../../src/app/(dashboard)/_lib/junggong-seonggwa'
import { getMonthlySplit } from '../../src/app/(dashboard)/_lib/monthly-split'
import { 천원 } from '../../src/app/(dashboard)/gongmu/_lib/erp-실적'

async function main() {
  const db = createAdminClient()
  const now = new Date('2026-09-28T03:00:00Z') // KST 12:00
  const period = getMonthlyPeriod(now)
  const 성과P = load성과재료(db)
  const 투입P = load투입원가재료(db, period)
  const [kpi, split] = await Promise.all([
    getMonthlyKpiData(db, now, 성과P, 투입P),
    getMonthlySplit(db, period, 성과P, 투입P),
  ])
  // 공무 페이지 달력 기준을 독립적으로 재계산: 그 달 공사이력 행마다 천원() 후 합
  const 성과 = await 성과P
  const 공무달력 = 성과.공사이력
    .filter((r) => r.작업일자 >= period.monthStart && r.작업일자 < period.monthEnd)
    .reduce((s, r) => s + 천원(r.성과금액), 0)

  console.log('period', period.monthStart, period.monthEnd)
  console.log('construction.totalThousand', split.construction.totalThousand, '| 공무 달력(독립 재계산)', 공무달력)
  console.log('settlement.totalThousand', split.settlement.totalThousand, '행', split.settlement.rows.length,
    '음수', split.settlement.rows.filter((r) => r.금액천원 < 0).length)
  console.log('기존 monthlyRevenue(원)', Math.round(kpi.amounts.monthlyRevenue), '| 기존 breakdown.totalThousand', kpi.breakdown.totalThousand)
}
main()
```

- [ ] **Step 2: 실행**

Run: `mkdir -p scripts/.tmp` 후 `npx tsx -r ./scripts/register-path-alias.cjs scripts/.tmp/verify-split.ts`

Expected:
- `construction.totalThousand` == `공무 달력(독립 재계산)` == **232,432** (공무 페이지 9월 달력 기준). 오늘 이후 입력이 늘었으면 두 값이 서로 같기만 하면 된다 — 그 경우 공무 페이지 화면에서 같은 숫자를 확인한다.
- `settlement.totalThousand` ≈ 220,453 (설계 실측은 원 합산 후 반올림이라 행 반올림으로 몇 천원 차이 가능). 음수 1건.
- `기존 monthlyRevenue` ≈ 293,816천원, `breakdown.totalThousand` ≈ 293,816 — **변경 전과 같은 정의**여야 한다(Task 1·2가 기존 값을 안 건드렸다는 증거). 변경 전 값을 확인하려면 `git stash`가 아니라 `git worktree add ../yjs_erp_base main`에서 같은 스크립트의 `kpi` 부분만 돌려 비교한다.

- [ ] **Step 3: 임시 파일 삭제**

Run: `rm -rf scripts/.tmp` → `git status --short`에 `scripts/.tmp`가 없어야 한다.

- [ ] **Step 4: 결과를 사용자에게 보고한다**

세 숫자(construction, settlement, 기존 monthlyRevenue)와 공무 페이지 값의 일치 여부. 불일치면 **다음 Task로 가지 말고 멈춘다.**

---

## Task 6: Dashboard — 중계 `_normalize_split`

**Files:**
- Modify: `C:\Users\조성현\Documents\GitHub\yjs_Dashboard\app\api\erp.py`
- Test: `C:\Users\조성현\Documents\GitHub\yjs_Dashboard\tests\test_erp_kpi_split.py`

- [ ] **Step 0: 브랜치**

```bash
cd "C:/Users/조성현/Documents/GitHub/yjs_Dashboard"
git checkout main && git pull
git checkout -b feat/dashboard-construction-settlement-split
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/test_erp_kpi_split.py` 전체:

```python
"""
대시보드 실적 분리(split) — ERP 응답 재포장 규칙 (2026-09-28).

split.construction 은 도넛의 분자, split.settlement 는 캡션의 정산 줄이다.
둘 다 "표의 합계 == 화면의 숫자"라, 행이 하나라도 새면 그 섹션만 통째로 버린다(None).
split 이 없으면(옛 ERP) None — 화면은 monthlyRevenue 로 대신 채우지 않는다(home.js).
"""
from app.api.erp import _normalize_monthly_kpi


def _payload(split=None):
    body = {
        "label": "9월",
        "amounts": {"monthlyRevenue": 293_816_000},
        "formatted": {"monthlyRevenue": "2.94억"},
        "updatedAt": "2026-09-28T03:00:00Z",
    }
    if split is not None:
        body["split"] = split
    return body


def _c_row(no="JG26-041", amount=32450, days=None, nights=None):
    return {
        "지중no": no,
        "공사명": "안양 평촌대로 지중화",
        "금액천원": amount,
        "일자": days if days is not None else [1, 2],
        "야간일자": nights if nights is not None else [2],
    }


def _s_row(no="JG26-018", kind="기성 2차", day=23, amount=30000):
    return {"지중no": no, "공사명": "군포 산본로", "구분": kind, "일": day, "금액천원": amount}


def test_split이_없으면_None():
    assert _normalize_monthly_kpi(_payload())["split"] is None


def test_split이_객체가_아니면_None():
    assert _normalize_monthly_kpi(_payload(split=[1, 2]))["split"] is None


def test_정상_응답은_두_섹션을_영문_키로_넘긴다():
    out = _normalize_monthly_kpi(_payload({
        "construction": {"rows": [_c_row()], "totalThousand": 32450},
        "settlement": {"rows": [_s_row(), _s_row(no="JG26-020", kind="준공", day=10, amount=-1182)],
                       "totalThousand": 28818},
    }))["split"]

    c = out["construction"]
    assert c["rows"][0] == {
        "jijungNo": "JG26-041", "name": "안양 평촌대로 지중화",
        "amountThousand": 32450, "days": [1, 2], "nightDays": [2],
    }
    assert c["totalThousand"] == 32450

    s = out["settlement"]
    assert s["rows"][0] == {
        "jijungNo": "JG26-018", "name": "군포 산본로", "kind": "기성 2차", "day": 23, "amountThousand": 30000,
    }
    assert s["rows"][1]["amountThousand"] == -1182
    assert s["totalThousand"] == 28818


def test_construction_합계가_어긋나면_construction만_버리고_settlement는_유지():
    out = _normalize_monthly_kpi(_payload({
        "construction": {"rows": [_c_row(amount=100)], "totalThousand": 999},
        "settlement": {"rows": [_s_row(amount=500)], "totalThousand": 500},
    }))["split"]
    assert out["construction"] is None
    assert out["settlement"]["totalThousand"] == 500


def test_settlement_행이_하나라도_안_읽히면_settlement만_버린다():
    out = _normalize_monthly_kpi(_payload({
        "construction": {"rows": [_c_row(amount=100)], "totalThousand": 100},
        "settlement": {"rows": [_s_row(), "깨진 행"], "totalThousand": 30000},
    }))["split"]
    assert out["construction"]["totalThousand"] == 100
    assert out["settlement"] is None


def test_정산_일이_1에서_31_밖이면_None으로_둔다():
    out = _normalize_monthly_kpi(_payload({
        "construction": {"rows": [], "totalThousand": 0},
        "settlement": {"rows": [_s_row(day=45), _s_row(day="<b>")], "totalThousand": 60000},
    }))["split"]
    assert [r["day"] for r in out["settlement"]["rows"]] == [None, None]


def test_숫자가_문자열로_와도_정수로_강제한다():
    out = _normalize_monthly_kpi(_payload({
        "construction": {"rows": [_c_row(amount="1200")], "totalThousand": "1200"},
        "settlement": {"rows": [], "totalThousand": 0},
    }))["split"]
    assert out["construction"]["rows"][0]["amountThousand"] == 1200
    assert out["settlement"]["rows"] == []


def test_기존_breakdown_칸은_split과_무관하게_그대로():
    body = _payload({"construction": {"rows": [], "totalThousand": 0}, "settlement": {"rows": [], "totalThousand": 0}})
    body["breakdown"] = {"rows": [_c_row(amount=700)], "totalThousand": 700}
    out = _normalize_monthly_kpi(body)
    assert out["breakdown"]["totalThousand"] == 700
    assert out["amounts"]["monthlyRevenue"] == 293_816_000
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/Scripts/python -m pytest tests/test_erp_kpi_split.py -v`
Expected: FAIL — `KeyError: 'split'`.

- [ ] **Step 3: 구현한다**

`app/api/erp.py`에서 `_as_day_list` 아래에 추가한다.

```python
def _as_day(value: Any) -> Optional[int]:
    # 정산 행의 '일' 하나 — 1~31 밖이거나 숫자가 아니면 None(표기가 깨지느니 비워 둔다)
    days = _as_day_list([value])
    return days[0] if days else None
```

기존 `_normalize_breakdown` 함수 전체를 다음 세 함수로 바꾼다(`_normalize_breakdown`의 동작은 같다 — 기존 `tests/test_erp_kpi_breakdown.py`가 지킨다).

```python
def _construction_row(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "jijungNo": _as_str(item.get("지중no")),
        "name": _as_str(item.get("공사명")),
        "amountThousand": _as_int(item.get("금액천원")),
        "days": _as_day_list(item.get("일자")),
        "nightDays": _as_day_list(item.get("야간일자")),
    }


def _settlement_row(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "jijungNo": _as_str(item.get("지중no")),
        "name": _as_str(item.get("공사명")),
        "kind": _as_str(item.get("구분")),
        "day": _as_day(item.get("일")),
        "amountThousand": _as_int(item.get("금액천원")),
    }


def _normalize_section(raw: Any, to_row, label: str) -> Optional[Dict[str, Any]]:
    """
    '행 목록 + 합계' 한 섹션을 방어적으로 재포장한다 (breakdown · split.construction · split.settlement 공통).

    ⚠️ 이 섹션들의 존재 이유가 "표의 합계 == 화면의 숫자"이므로, 재포장 과정에서 행이
       한 줄이라도 유실되면 그 순간 표는 조용히 틀린 표가 된다. 그래서 총액을 ERP가
       보낸 값으로 믿지 않고 **재포장된 행들을 직접 더해서** 만들고, ERP가 말한 총액과
       다르면 섹션을 통째로 버린다(None). 모자란 표를 보여주느니 없는 게 낫다.
    """
    if not isinstance(raw, dict):
        return None
    rows_raw = _as_list(raw.get("rows"))
    rows = [to_row(item) for item in rows_raw if isinstance(item, dict)]
    if len(rows) != len(rows_raw):
        logger.warning("ERP KPI %s: %d개 행 중 %d개만 읽혀 버린다", label, len(rows_raw), len(rows))
        return None

    total = sum(row["amountThousand"] for row in rows)
    reported = raw.get("totalThousand")
    if reported is not None and _as_int(reported) != total:
        logger.warning("ERP KPI %s 합계 불일치(ERP %s / 행 합 %s) — 버린다", label, reported, total)
        return None
    return {"rows": rows, "totalThousand": total}


def _normalize_breakdown(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # 기존 칸(시공 + 준공 보정). 대시보드가 split 으로 옮겨간 뒤에도 옛 화면 호환을 위해 남겨 둔다
    return _normalize_section(payload.get("breakdown"), _construction_row, "breakdown")


def _normalize_split(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    시공 실적 / 정산 분리 (2026-09-28). 섹션마다 따로 판정한다 — 정산이 깨졌다고 시공(도넛)까지 버리지 않는다.
    split 자체가 없으면(옛 ERP) None. home.js 는 그때 monthlyRevenue 로 대신 채우지 않고 대체값 경로로 간다.
    """
    raw = payload.get("split")
    if not isinstance(raw, dict):
        return None
    return {
        "construction": _normalize_section(raw.get("construction"), _construction_row, "split.construction"),
        "settlement": _normalize_section(raw.get("settlement"), _settlement_row, "split.settlement"),
    }
```

`_normalize_monthly_kpi`의 반환 dict에서 `"breakdown": _normalize_breakdown(payload),` 다음 줄에 추가한다.

```python
        # 허용목록 방식이라 여기 적지 않은 칸은 브라우저에 도착하지 않는다 — split 을 추가하면 이 줄도 필요하다
        "split": _normalize_split(payload),
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/Scripts/python -m pytest tests/test_erp_kpi_split.py tests/test_erp_kpi_breakdown.py -v`
Expected: 전부 PASS (기존 breakdown 테스트 포함).

- [ ] **Step 5: Commit**

```bash
git add app/api/erp.py tests/test_erp_kpi_split.py
git commit -m "feat(erp): KPI 중계에 split(시공/정산) 재포장 추가 — 섹션마다 행 합계가 어긋나면 그 섹션만 버린다"
```

---

## Task 7: Dashboard — 도넛·캡션·정산 팝업

**Files:**
- Modify: `C:\Users\조성현\Documents\GitHub\yjs_Dashboard\web\home.js`
- Modify: `C:\Users\조성현\Documents\GitHub\yjs_Dashboard\web\home.html`

- [ ] **Step 1: 상태에 정산 칸을 추가한다**

`home.js`의 `totalProgressState` 안, `breakdown: null,` 다음에 추가한다.

```js
        // ERP split.settlement(그 달 끊은 계산서). null + settlementEnabled=true 면 "정산 불러오지 못함".
        settlement: null,
        // split.construction 을 받았을 때만 true — 대체값으로 그리는 중에는 정산 줄 자체를 안 그린다
        settlementEnabled: false,
```

- [ ] **Step 2: `applyErpMonthlyKpi`를 split 기준으로 바꾼다**

함수 전체를 다음으로 바꾼다.

```js
    function applyErpMonthlyKpi(data) {
        if (!data || typeof data !== 'object') return false;
        const split = data.split && typeof data.split === 'object' ? data.split : null;
        // 도넛의 분자는 시공 실적이다 — 월간 목표가 시공분만이라 준공 보정이 섞인 monthlyRevenue 와는 기준이 다르다.
        // split.construction 이 없으면(옛 ERP·합계 불일치) monthlyRevenue 로 대신 채우지 않는다:
        // 틀린 정의의 숫자가 화면에서 아무 티 없이 도넛이 되기 때문이다. ERP 실패와 같은 대체값 경로로 보낸다.
        const construction = normalizeBreakdown(split && split.construction);
        if (!construction) return false;

        totalProgressState.label = String(data.label || totalProgressState.label || '6월').trim();
        totalProgressState.actualAmountThousand = construction.totalThousand;
        totalProgressState.actualFromErp = true;
        totalProgressState.actualText = `${construction.totalThousand.toLocaleString('ko-KR')}천원`;
        totalProgressState.actualDetailText = '';
        totalProgressState.updatedAt = formatKpiUpdatedAt(data.updatedAt);
        totalProgressState.sourceLabel = '(ERP)';
        totalProgressState.breakdown = construction;
        totalProgressState.settlement = normalizeSettlement(split.settlement);
        totalProgressState.settlementEnabled = true;
        return true;
    }
```

- [ ] **Step 3: `normalizeSettlement`를 추가한다**

`normalizeBreakdown` 함수 바로 아래에 추가한다.

```js
    // 정산(끊은 계산서) 행. 총액은 여기서도 '행의 합'으로 다시 만든다 — 캡션 숫자와 팝업 합계가 같은 배열에서 나오게.
    function normalizeSettlement(raw) {
        // 0건('이번 달 계산서 없음')과 상세 없음('못 불러옴')을 구분한다 — normalizeBreakdown 과 같은 이유
        if (!raw || !Array.isArray(raw.rows)) return null;
        const rows = raw.rows.map((r) => {
            const day = toDayNumbers([r.day]);
            return {
                jijungNo: String(r.jijungNo || ''),
                name: String(r.name || ''),
                kind: String(r.kind || ''),
                // innerHTML 로 들어가는 값이라 숫자로 못 박는다(서버가 이미 걸렀어도 자리를 남기지 않는다)
                day: day.length ? day[0] : null,
                amountThousand: Number(r.amountThousand) || 0,
            };
        });
        return { rows, totalThousand: rows.reduce((sum, r) => sum + r.amountThousand, 0) };
    }
```

- [ ] **Step 4: 캡션에 시공 라벨과 정산 줄을 넣는다**

`renderTotalProgressChartHome`의 `if (amtEl) { ... }` 블록 전체를 다음으로 바꾼다.

```js
        if (amtEl) {
            const detailHtml = totalProgressState.actualDetailText
                ? `<br><span style="font-size:0.74rem;color:#7a8fa3;font-weight:500;white-space:nowrap;">${escapeHtml(totalProgressState.actualDetailText)}</span>`
                : '';
            const sourceText = totalProgressState.sourceLabel ? ` ${totalProgressState.sourceLabel}` : '';
            // ERP에서 시공 실적을 받았을 때만 '시공 실적'이라 부른다 — 대체값은 무엇의 합인지 보장할 수 없다
            const actualLabel = totalProgressState.actualFromErp ? '시공 실적' : '실적';
            // 정산은 시공과 더하는 숫자가 아니다(대부분 이미 시공으로 잡힌 일의 청구) — 별도 줄로만 보여준다
            let settlementHtml = '';
            if (totalProgressState.settlementEnabled) {
                const s = totalProgressState.settlement;
                settlementHtml = s
                    ? `<br><span class="tp-clickable" role="button" tabindex="0" data-tp-open="settlement">` +
                          `정산 <b>${s.totalThousand.toLocaleString('ko-KR')}천원</b></span>`
                    : `<br><span style="font-size:0.74rem;color:#aab8c6;white-space:nowrap;">정산 불러오지 못함</span>`;
            }
            amtEl.innerHTML =
                `<span class="tp-clickable" role="button" tabindex="0" data-tp-open="actual">` +
                    `${actualLabel} <b>${escapeHtml(totalProgressState.actualText)}</b></span>` +
                detailHtml +
                settlementHtml +
                `<br><span class="tp-clickable" role="button" tabindex="0" data-tp-open="target">` +
                    `목표 <b>${Number(totalProgressState.targetAmountThousand || 0).toLocaleString('ko-KR')}천원</b></span>` +
                `<br><span style="font-size:0.71rem;color:#aab8c6;white-space:nowrap;">최신화${sourceText} ${escapeHtml(totalProgressState.updatedAt)}</span>`;
        }
```

- [ ] **Step 5: 실적 팝업 제목을 바꾼다**

`renderProgressActualModal`에서

```js
        if (titleEl) titleEl.textContent = `${label} 실적 상세`;
```

를 다음으로 바꾼다.

```js
        if (titleEl) titleEl.textContent = totalProgressState.actualFromErp ? `${label} 시공 실적 상세` : `${label} 실적 상세`;
```

- [ ] **Step 6: 정산 팝업 렌더 함수를 추가한다**

`renderProgressTargetModal` 함수 바로 위에 추가한다.

```js
    function renderProgressSettlementModal() {
        const label = totalProgressState.label || '';
        const titleEl = document.getElementById('progressSettlementTitle');
        const subEl = document.getElementById('progressSettlementSub');
        const bodyEl = document.getElementById('progressSettlementBody');
        if (!bodyEl) return;
        if (titleEl) titleEl.textContent = `${label} 정산 상세`;
        if (subEl) subEl.textContent = `기성·준공 계산서 · ERP 최신화 ${totalProgressState.updatedAt || '-'}`;

        const s = totalProgressState.settlement;
        if (!s) {
            bodyEl.innerHTML = '<div class="tp-error">ERP에서 정산 상세를 불러오지 못했습니다.</div>';
            return;
        }
        // 진짜로 0건인 달은 그렇게 말한다 — 위 에러 문구를 재활용하면 없는 고장을 있다고 하는 것
        if (s.rows.length === 0) {
            bodyEl.innerHTML = `<div class="tp-empty">${escapeHtml(label)}에 끊은 계산서가 아직 없습니다.</div>`;
            return;
        }

        const rowsHtml = s.rows.map((r) => `<tr>` +
            `<td class="tp-no">${escapeHtml(r.jijungNo)}</td>` +
            `<td class="tp-name">${escapeHtml(r.name)}</td>` +
            `<td class="tp-kind">${escapeHtml(r.kind)}</td>` +
            `<td class="tp-kind" style="text-align:right;">${r.day === null ? '' : `${r.day}일`}</td>` +
            `<td class="tp-amt ${r.amountThousand < 0 ? 'minus' : ''}">` +
                `${r.amountThousand.toLocaleString('ko-KR')}</td>` +
            `</tr>`).join('');

        bodyEl.innerHTML =
            `<div class="tp-table-wrap"><table class="tp-table">` +
                `<thead><tr>` +
                    `<th style="width:110px;">지중No</th>` +
                    `<th>공사명</th>` +
                    `<th style="width:80px;">구분</th>` +
                    `<th style="width:50px;text-align:right;">일</th>` +
                    `<th style="width:120px;text-align:right;">금액 (천원)</th>` +
                `</tr></thead>` +
                `<tbody>${rowsHtml}</tbody>` +
            `</table></div>` +
            `<div class="tp-foot">` +
                `<span class="lb">합계 <span style="font-weight:500;color:#4a7ab5;">(${s.rows.length}건)</span>` +
                    `<span class="match">캡션의 '정산'과 같은 값</span></span>` +
                `<span class="v">${s.totalThousand.toLocaleString('ko-KR')} 천원</span>` +
            `</div>`;
    }
```

- [ ] **Step 7: 클릭 핸들러에 정산을 잇는다**

`openProgressDetail`에서 `if (which === 'target') { ... }` 블록 앞에 추가한다.

```js
        if (which === 'settlement') {
            renderProgressSettlementModal();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('progressSettlementModal')).show();
            return;
        }
```

(`bindProgressDetailHandlers`는 `data-tp-open` 속성으로 분기하므로 수정 불필요.)

- [ ] **Step 8: 모달 마크업·스타일·캐시 버전**

`home.html`에서 `.tp-name { color: #1f3045; }` 다음 줄에 추가한다.

```css
        .tp-kind { color: #45586e; white-space: nowrap; font-variant-numeric: tabular-nums; }
```

`<!-- 총 공정률 '실적' 캡션 클릭 시 뜨는 공사별 상세 -->` 모달 블록이 끝나는 `</div>`(바로 다음이 `<div class="modal fade" id="workerReturnTimeModal"`) 앞에 추가한다.

```html
    <!-- 총 공정률 '정산' 캡션 클릭 시 뜨는 계산서(기성·준공) 상세 -->
    <div class="modal fade" id="progressSettlementModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header py-2">
                    <div>
                        <h5 class="modal-title" id="progressSettlementTitle">정산 상세</h5>
                        <div class="tp-modal-sub" id="progressSettlementSub"></div>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="닫기"></button>
                </div>
                <div class="modal-body">
                    <div id="progressSettlementBody"></div>
                </div>
            </div>
        </div>
    </div>
```

`<script src="/home.js?v=20260618h"></script>`를 다음으로 바꾼다(브라우저가 옛 home.js를 캐시에서 계속 쓰지 않게 — 2026-09-14 이미지 캐시 사고와 같은 이유).

```html
    <script src="/home.js?v=20260928a"></script>
```

- [ ] **Step 9: 문법 확인**

Run: `node --check web/home.js` → 출력 없음(에러 0).
Run: `.venv/Scripts/python -m pytest tests -q` → 전부 PASS.

- [ ] **Step 10: Commit**

```bash
git add web/home.js web/home.html
git commit -m "feat(home): 총 공정률 도넛을 시공 실적 기준으로, 정산은 캡션 별도 줄과 상세 팝업으로"
```

---

## Task 8: 두 레포를 붙여 브라우저 확인

**Files:** 없음 (확인만)

- [ ] **Step 1: 로컬 ERP 실행**

yjs_erp에서 Run (background): `npm run dev` → `http://localhost:3000`.
확인: `curl -s -H "Authorization: Bearer <yjs_erp .env.local 의 DASHBOARD_API_KEY>" http://localhost:3000/api/kpi/monthly-performance`의 JSON에 `split.construction.totalThousand`, `split.settlement.totalThousand`가 있고 Task 5 값과 같다. 키 없이 호출하면 `401`.

- [ ] **Step 2: 로컬 대시보드를 로컬 ERP에 붙여 실행**

yjs_Dashboard에서 **환경변수로만** 덮어쓴다(`.env` 파일은 수정하지 않는다).

```powershell
$env:ERP_MONTHLY_KPI_URL = "http://localhost:3000/api/kpi/monthly-performance"
$env:ERP_DASHBOARD_API_KEY = "<yjs_erp .env.local 의 DASHBOARD_API_KEY>"
.venv\Scripts\python main.py
```

`http://localhost:8000/`은 로그인(`require_session`)이 필요하다. **사용자에게 브라우저에서 카카오 로그인을 요청**하고, 로그인 후 확인한다.

- [ ] **Step 3: 화면 확인 (claude-in-chrome 또는 사용자 확인)**

- 도넛 %: `construction.totalThousand ÷ 목표`와 같다.
- 캡션: "시공 실적 232,432천원"(또는 Task 5 값) / "정산 N천원" / "목표 …".
- "시공 실적" 클릭 → 제목 "9월 시공 실적 상세", 합계 = 캡션의 시공 실적.
- "정산" 클릭 → 제목 "9월 정산 상세", 음수 행 빨간색, 합계 = 캡션의 정산.
- 콘솔 에러 0.

- [ ] **Step 4: 옛 ERP 응답 경로 확인**

`yjs_erp/src/app/api/kpi/monthly-performance/route.ts`의 반환을 **임시로** `NextResponse.json(data)`로 바꿔 저장(dev 서버가 다시 읽는다) → 대시보드 새로고침.
Expected: 도넛은 대체값 경로(ERP 실패 때와 같은 화면), 캡션에 "시공 실적"·"정산" 줄이 없고, "실적" 클릭 시 "ERP에서 실적 상세를 불러오지 못했습니다." 콘솔 에러 0.
확인 후 **`git checkout -- "src/app/api/kpi/monthly-performance/route.ts"`로 되돌리고** `git diff`가 비었는지 확인한다.

- [ ] **Step 5: 서버 종료, 결과 보고**

두 dev 서버를 끄고, 스크린샷/관찰 결과를 사용자에게 보고한다.

---

## 이후 (이 계획 밖, 사용자 진행)

1. 게이트 3: `/code-review` (두 레포 각각).
2. 게이트 4: 질문 1~2개.
3. 게이트 5: 사용자가 PR(squash) 메시지 작성 → **ERP 먼저 머지·배포 → 대시보드 머지·배포.**
4. 배포 직후 사장님 공지: "도넛이 시공 실적 기준으로 바뀌어 %가 내려갑니다(9월 기준 약 21% 낮아짐). 정산(기성·준공 계산서)은 아래 줄에 따로 표시됩니다."
