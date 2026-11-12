# 연간 응답 (12개월 split 한 번에) Implementation Plan — 연간 표 PR-2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 1~12월 표(대시보드 PR-4)가 요청 한 번으로 그 해 12개월의 시공·정산 split을 받게 `/api/kpi/monthly-performance?year=YYYY`를 추가한다.

**Architecture:** `getMonthlySplit`을 "재료 읽기(`loadSplit재료`)"와 "재료 + 기간 → split(`buildMonthlySplit`, 순수)"으로 쪼갠다. 연간 경로는 재료를 **한 번** 읽어 12개 기간에 순수 함수를 돌린다. 기간은 `주차.ts`의 기존 함수(`달의주목록`·`주목록기간`·`소속월Of`·`다음달`)를 엮어 만들고 새 날짜 규칙은 만들지 않는다. 기존 두 경로(month 없음 / `?month=`)는 응답·동작이 그대로다.

**Tech Stack:** Next.js 16 route handler, supabase-js(service_role), vitest

- 설계: `docs/superpowers/specs/2026-11-12-dashboard-yearly-plan-actual-design.md` §5-5 → 이 문서 "게이트 1 결정"으로 확정(설계 §7에 같은 내용 추가)
- 브랜치(예정): `feat/kpi-year-param`
- 티어 A — 구현 세션에서 게이트 2~5

---

## 게이트 1 결정 (2026-11-12 기획 세션, 조성현)

| # | 질문 | 결정 | 근거(조성현) / 기각 |
|---|---|---|---|
| ② | 계산 방식 | **A. 원본 한 번 읽고 월별로 나누기** (`loadSplit재료` + `buildMonthlySplit`) | "하나의 원본이어야 나중에 파생할 때 원본 불일치 문제가 안 생김" — 12개월이 같은 순간의 DB를 설명한다. 기각 B(`getMonthlySplit` 12번): 쿼리 약 40개, 기성 233행을 12번 읽고, 달마다 읽은 순간이 달라 사이에 저장이 끼면 1월과 2월이 다른 DB를 설명 |
| ③ | 실패한 달 | **전체 500** | "②가 A이므로" — 실패는 읽기에서 나고 읽기는 한 번이라 12달이 같이 성패한다. 달별 실패 표시는 B에서만 의미. `split: null + 200` 금지(11/10과 같은 이유: 성공처럼 생긴 빈 응답) |
| ① | 응답 모양 | **가. `{ year, months: [ {month, 상태, split} × 12 ] }`** — 원소는 기존 `?month=` 응답 `{month, split}`에 `상태`만 더한 모양 | "재사용이 가능해서" — 대시보드 중계가 기존 `_normalize_month_kpi`를 원소마다 쓸 수 있다. 순서 = 1~12월. 기각 나(월→split 맵): 빠진 키가 '미래'인지 '실수'인지 구분 불가 |
| ④ | 미래 달 | **12개 항상 실음, `상태: '완료' \| '진행중' \| '미래'`, 미래는 `split: null`** | "헷갈리지 않기 때문" — null 이 실패가 아니라 상태가 이름 붙인 값. 진행중 = 금주월. 기각: 미래 달 빼기(배열 길이가 달마다 변해 소비자가 빈칸을 채워야 함) |
| ⑤ | 1000행 캡 | **a. 투입실적 읽기를 `fetchAllRows`(`.order('id')`)로** — `load투입원가재료` 한 곳이라 기존 두 경로도 같이 바뀜 | "위험이 없어서". 실측 아래. 기각 b(≥1000 throw 가드): 연간 표 전체가 500이 되는 날을 예약해 두는 셈 |

> **구현 세션 보정(2026-11-12, 게이트 3 리뷰 2번 수용):** ②의 "12개월이 같은 순간의 DB를 설명한다"는 실제보다 크다. `loadSplit재료`는 표마다(페이지마다) 따로 요청해 DB 스냅샷이 아니다 — 보장하는 건 **12달이 같은 사본 한 벌을 나눠 쓴다**까지(달끼리는 어긋날 수 없고, 읽는 도중의 저장은 표 사이에 갈릴 수 있다). A안의 근거(달끼리 다른 DB를 보지 않는다)는 그대로 성립. 코드 주석도 이 범위로 고침.

**진입:** 같은 라우트 `?year=YYYY`(새 라우트 아님 — PR #52와 같은 판단). `month`와 `year`가 같이 오면 400. 검증 순서는 기존과 같다: 인증(401) → 형식·범위(400) → DB.

**범위 규칙(새 규칙 아님 — 기존 함수 조합):** 그 해 12달 중 `월 > 금주월`은 '미래', `월 === 금주월`은 '진행중', 나머지 '완료'. `${year}-01 < 최소월`(2025 이전) 또는 `${year}-01 > 금주월`(아직 안 온 해)이면 400. ⚠️ `최소월`이 1월이 아니게 바뀌면 이 검사가 해 중간을 못 다룬다 → `최소월`이 `-01`로 끝나는지 테스트로 못 박는다.

**담당 정의 불변:** 시공 = `공사이력.담당공무_id`(행마다), 정산 = `수주.정산담당자_id`. 이 PR은 둘 다 읽기만 한다.

### 실측 (운영 DB, 2026-11-12, 행 수만 — 쓰기 없음)

| 테이블 | 행 수 | 기존 읽기 | 1000행 |
|---|---|---|---|
| 공사이력(준공정산=false) | 573 (2026년 546) | `fetchAllRows` | 안전 |
| 수주 | 662 | `fetchAllRows` | 안전 |
| 기성 | 233 | `fetchAllRows` | 안전 |
| 투입실적 | 2026-01~11월 **631**, 한 달 약 60(10월 금요일 기간 69) | **페이지 없는 단일 요청** | 연말 예상 약 690 — 여유 30%뿐 → ⑤a |
| 투입실적상세 | 7,143 (임베드, 부모 행 수에 안 셈) | | |

연간 임베드 단일 요청 실측: 631행 전부 도착, 286ms.

---

## File Structure

| 파일 | 변경 | 책임 |
|---|---|---|
| `src/app/(dashboard)/gongmu/_lib/주차.ts` | 수정 | `연간조회월목록(yearParam, 오늘)` 추가 — 기존 함수만 엮어 12달의 상태·기간을 만든다 |
| `src/app/(dashboard)/gongmu/_lib/주차.test.ts` | 수정 | 위 함수 테스트 + 12달 기간 이어짐 |
| `src/app/(dashboard)/_lib/monthly-split.ts` | 수정 | `getMonthlySplit` → `loadSplit재료` + `buildMonthlySplit` 쪼개기. `getMonthlySplit`은 둘의 조합으로 남김(기존 호출부·테스트 불변) |
| `src/app/(dashboard)/_lib/monthly-split.test.ts` | 수정 | `buildMonthlySplit` 테스트(해 경계·같은 재료로 달마다) |
| `src/app/(dashboard)/_lib/monthly-kpi.ts` | 수정 | `load투입원가재료`의 투입실적 읽기를 `fetchAllRows`로 |
| `src/app/api/kpi/monthly-performance/route.ts` | 수정 | `?year=` 분기 |
| `src/app/api/kpi/monthly-performance/route.test.ts` | 수정 | `?year=` 테스트 |

`src/lib/supabase/fetch-all.ts`는 그대로 쓴다.

---

### Task 1: `주차.ts` — 연간 조회 달 목록

**Files:**
- Modify: `src/app/(dashboard)/gongmu/_lib/주차.ts` (`조회월기간` 아래, `선택상태` 위)
- Test: `src/app/(dashboard)/gongmu/_lib/주차.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `주차.test.ts` 맨 아래에 추가하고, 파일 위 import 줄에 `연간조회월목록`, `최소월`, `다음달`이 없으면 추가한다.

```ts
describe('연간조회월목록 (연간 응답 ?year=, 2026-11-12)', () => {
  it('12달을 1~12월 순서로, 금주월 기준 완료/진행중/미래로 나눈다', () => {
    const r = 연간조회월목록('2026', '2026-11-12')
    if (!r.ok) throw new Error(r.error)
    expect(r.연도).toBe(2026)
    expect(r.월목록.map((x) => x.월)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ])
    expect(r.월목록.slice(0, 10).every((x) => x.상태 === '완료')).toBe(true)
    expect(r.월목록[10].상태).toBe('진행중')
    expect(r.월목록[11]).toEqual({ 월: '2026-12', 상태: '미래', 기간: null })
  })

  it('달 기간은 조회월기간(?month=)과 똑같다 — 규칙을 새로 만들지 않는다', () => {
    const r = 연간조회월목록('2026', '2026-11-12')
    if (!r.ok) throw new Error(r.error)
    for (const x of r.월목록) {
      if (x.기간 === null) continue
      const 한달 = 조회월기간(x.월, '2026-11-12')
      if (!한달.ok) throw new Error(한달.error)
      expect(x.기간).toEqual(한달.기간)
    }
  })

  it('미래가 아닌 달들의 기간은 빈틈·겹침 없이 이어진다 (12달 합 = 한 해)', () => {
    const r = 연간조회월목록('2026', '2026-12-30') // 12월도 진행중이 되는 날
    if (!r.ok) throw new Error(r.error)
    const 기간들 = r.월목록.map((x) => x.기간!)
    expect(기간들[0].from).toBe('2026-01-01')
    for (let i = 1; i < 기간들.length; i++) expect(기간들[i].from).toBe(기간들[i - 1].to)
    expect(기간들[11].to).toBe('2027-01-01') // 해 경계 자르기(PR-1) 덕에 12/28~31이 12월에 남는다
  })

  it('전체기간 = 첫 달 from ~ 마지막 비-미래 달 to — 투입실적을 이 범위로 한 번 읽는다', () => {
    const r = 연간조회월목록('2026', '2026-11-12')
    if (!r.ok) throw new Error(r.error)
    expect(r.전체기간).toEqual({ from: '2026-01-01', to: r.월목록[10].기간!.to })
  })

  it('형식 오류·최소월 이전 해·아직 안 온 해는 오류(→ 400)', () => {
    expect(연간조회월목록('26', '2026-11-12').ok).toBe(false)
    expect(연간조회월목록('2026-01', '2026-11-12').ok).toBe(false)
    expect(연간조회월목록('', '2026-11-12').ok).toBe(false)
    expect(연간조회월목록('2025', '2026-11-12').ok).toBe(false)
    expect(연간조회월목록('2027', '2026-11-12').ok).toBe(false)
  })

  it('해 경계: 2027-01-01이면 2027년이 열리고 1월이 진행중', () => {
    const r = 연간조회월목록('2027', '2027-01-01')
    if (!r.ok) throw new Error(r.error)
    expect(r.월목록[0]).toMatchObject({ 월: '2027-01', 상태: '진행중' })
    expect(r.월목록[0].기간!.from).toBe('2027-01-01')
  })

  it('최소월은 1월이어야 한다 — 아니면 연간조회월목록의 해 단위 범위 검사를 다시 설계할 것', () => {
    expect(최소월.endsWith('-01')).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: FAIL — `연간조회월목록` is not exported

- [ ] **Step 3: 구현** — `주차.ts`의 `조회월기간` 함수 바로 아래에 추가.

```ts
export type 연간월상태 = '완료' | '진행중' | '미래'

export type 연간조회결과 =
  | {
      ok: true
      연도: number
      /** 항상 12개, 1~12월 순서. 미래 달은 기간 null(실적이 없다 — 0이 아니다) */
      월목록: { 월: 연월; 상태: 연간월상태; 기간: { 월: 연월; from: string; to: string } | null }[]
      /** 첫 달 from ~ 마지막 비-미래 달 to — 기간 재료(투입실적)를 이 범위로 한 번 읽는다 */
      전체기간: { from: string; to: string }
    }
  | { ok: false; error: string }

/**
 * 대시보드 API ?year= → 그 해 12달의 상태와 금요일 기준 기간.
 * 새 날짜 규칙이 아니다 — 달 기간은 조회월기간(?month=)과 같은 달의주목록·주목록기간에서, 금주월은 소속월Of에서 온다.
 * PR-1(해 경계 자르기) 덕에 1월은 1/1부터, 12월은 12/31까지라 12달 합 = 한 해다.
 * 범위: 그 해 1월이 [최소월, 금주월] 안이어야 한다. 최소월이 1월이라 해 단위로만 검사한다(테스트로 못 박음).
 */
export function 연간조회월목록(yearParam: string, 오늘: string): 연간조회결과 {
  if (!/^\d{4}$/.test(yearParam)) {
    return { ok: false, error: `year는 YYYY 형식이어야 합니다: '${yearParam}'` }
  }
  const 금주월 = 소속월Of(오늘)
  const 첫달 = `${yearParam}-01`
  if (!조회가능월(첫달, 금주월)) {
    return {
      ok: false,
      error: `year는 ${최소월.slice(0, 4)}~${금주월.slice(0, 4)} 사이여야 합니다: '${yearParam}'`,
    }
  }
  const 월목록: Extract<연간조회결과, { ok: true }>['월목록'] = []
  for (let 월 = 첫달; 월.startsWith(yearParam); 월 = 다음달(월)) {
    const 상태: 연간월상태 = 월 > 금주월 ? '미래' : 월 === 금주월 ? '진행중' : '완료'
    월목록.push({ 월, 상태, 기간: 상태 === '미래' ? null : { 월, ...주목록기간(달의주목록(월)) } })
  }
  const 열린 = 월목록.filter((x) => x.기간 !== null)
  return {
    ok: true,
    연도: Number(yearParam),
    월목록,
    // 첫달이 조회가능월이라 열린 달은 최소 1개
    전체기간: { from: 열린[0].기간!.from, to: 열린[열린.length - 1].기간!.to },
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/gongmu/_lib/주차.test.ts"`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: 커밋하지 않는다** — 이 PR은 Task 5 뒤에 커밋 2개로 묶는다(아래 "커밋").

---

### Task 2: `monthly-split.ts` — 읽기와 계산 쪼개기

**Files:**
- Modify: `src/app/(dashboard)/_lib/monthly-split.ts:145-208`
- Test: `src/app/(dashboard)/_lib/monthly-split.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `monthly-split.test.ts` 맨 아래에 추가. import 줄을 `import { build월정산내역, sum월정산내역, buildMonthlySplit, type 정산기성Row, type Split재료 } from './monthly-split'`로 바꾼다.

```ts
describe('buildMonthlySplit — 재료 한 벌을 달마다 나눈다 (연간 응답, 2026-11-12)', () => {
  // 해 경계 양쪽에 한 행씩: 12/31은 12월, 1/1은 다음 해 1월
  const 수주 = [
    { id: 1, 지중no: 'A-1', 공사명: '갑', 공사구분: null, 준공여부: false, 준공일: null, 준공액_공급가: null,
      수주금액_공급가: 0, 보험료율: null, 하도전용율: null, 정산담당자_id: 7 },
  ] as unknown as 준공수주Row[]
  const 재료: Split재료 = {
    성과재료: {
      공사이력: [
        { 작업일자: '2026-12-31', 수주_id: 1, 성과금액: 1_000_000, 담당공무_id: 7 },
        { 작업일자: '2027-01-01', 수주_id: 1, 성과금액: 2_000_000, 담당공무_id: 7 },
      ],
      수주,
    },
    투입재료: { year: 2026, 투입실적: [], 단가: [] },
    기성전체: [{ id: 1, 수주_id: 1, 차수: 1, 기성일: '2026-12-31', 기성액_공급가: 500_000 }],
    담당이름: new Map([[7, '김무선']]),
  }

  it('같은 재료로 두 달을 계산하면 경계 행이 정확히 한 달에만 들어간다', () => {
    const 십이월 = buildMonthlySplit(재료, { 월: '2026-12', from: '2026-11-30', to: '2027-01-01' })
    const 일월 = buildMonthlySplit(재료, { 월: '2027-01', from: '2027-01-01', to: '2027-02-01' })
    expect(십이월.construction.totalThousand).toBe(1000)
    expect(일월.construction.totalThousand).toBe(2000)
    expect(십이월.settlement.totalThousand).toBe(500)
    expect(일월.settlement.totalThousand).toBe(0)
  })

  it('기간 칸과 담당 이름을 그대로 싣는다', () => {
    const s = buildMonthlySplit(재료, { 월: '2026-12', from: '2026-11-30', to: '2027-01-01' })
    expect(s).toMatchObject({ month: '2026-12', from: '2026-11-30', to: '2027-01-01' })
    expect(s.construction.rows[0].담당별[0].담당).toBe('김무선') // 시공 담당은 이력 행마다 → 담당별 배열
    expect(s.settlement.rows[0].담당).toBe('김무선')
  })

  it('재료를 바꾸지 않는다 — 12번 불러도 같은 원본을 본다', () => {
    const 전 = JSON.stringify({ ...재료, 담당이름: [...재료.담당이름] })
    buildMonthlySplit(재료, { 월: '2026-12', from: '2026-11-30', to: '2027-01-01' })
    buildMonthlySplit(재료, { 월: '2027-01', from: '2027-01-01', to: '2027-02-01' })
    expect(JSON.stringify({ ...재료, 담당이름: [...재료.담당이름] })).toBe(전)
  })
})
```

> 구현자 메모: 공사이력 행 모양은 `junggong-seonggwa.ts:43` `공사이력Row`(작업일자·수주_id·성과금액·담당공무_id?) 그대로다. 시공 행의 담당은 `월시공내역Row.담당별[]`(`monthly-revenue-breakdown.ts:45`)에, 정산 행의 담당은 `월정산내역Row.담당`에 있다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/monthly-split.test.ts"`
Expected: FAIL — `buildMonthlySplit` is not exported

- [ ] **Step 3: 구현** — `monthly-split.ts`의 `getMonthlySplit` 함수 전체(문서 주석 포함, 현재 145~208줄)를 아래로 바꾼다. `MonthlySplit` 타입은 그대로.

```ts
/** split 계산에 드는 원본 전부 — 한 번 읽어 여러 기간에 나눠 쓴다(연간 응답은 12번) */
export type Split재료 = {
  성과재료: Awaited<ReturnType<typeof load성과재료>>
  투입재료: 투입원가재료
  /** 기성 전 행 — 준공 차감 누계가 전 기간이어야 해서 기간으로 자르지 않는다 */
  기성전체: 정산기성Row[]
  담당이름: Map<number, string>
}

/**
 * split 원본을 읽는다. 성과재료·투입재료는 route 가 이미 시작한 Promise 를 받아 다른 계산과 나눠 쓴다.
 * 하나라도 실패하면 전체가 실패한다 — 이름표 없이 보내면 전원이 '삭제된 담당자'로 그려진다.
 */
export async function loadSplit재료(
  supabase: SupabaseClient<Database>,
  성과재료Promise: ReturnType<typeof load성과재료>,
  투입재료Promise: Promise<투입원가재료>,
): Promise<Split재료> {
  const [성과재료, 투입재료, 기성전체, 담당자] = await Promise.all([
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
    // select('id, 이름') 은 supabase-js 가 한글 칸 이름을 못 풀어 타입이 깨진다 — 작은 표라 '*' 로 받아 캐스트 없이 쓴다
    supabase
      .from('공무담당자')
      .select('*')
      .then(({ data, error }) => {
        if (error) throw error
        return data ?? []
      }),
  ])
  return {
    성과재료,
    투입재료,
    // supabase-js 가 이 select 문자열의 타입을 못 풀어 ParserError 를 낸다 —
    // 필드가 바뀌면 위 .select() 문자열과 정산기성Row 를 손으로 맞춰야 한다
    기성전체: 기성전체 as unknown as 정산기성Row[],
    담당이름: new Map(담당자.map((d) => [d.id, d.이름])),
  }
}

/**
 * 재료 + 기간 → split. DB를 읽지 않는 순수 함수라 같은 재료로 몇 번을 불러도 같은 원본을 설명한다.
 * 기간은 달력 월이 아니라 금요일 기준 주차의 달이다(gongmu/_lib/주차.ts) — 사장님이 대시보드·공무 화면·
 * 주간업무 보고서를 나란히 맞춰 보시므로. 시공·정산 둘 다 같은 기간이라 카드 하나에 기준이 하나다.
 */
export function buildMonthlySplit(
  재료: Split재료,
  기간: { 월: string; from: string; to: string },
): MonthlySplit {
  // 원본 배열을 자르지 않고 새 배열로 거른다 — 재료는 12달이 같이 쓴다
  const 투입실적 = 재료.투입재료.투입실적.filter(
    (row) => row.투입일 >= 기간.from && row.투입일 < 기간.to,
  )
  const constructionRows = build월시공내역(
    재료.성과재료.공사이력,
    재료.성과재료.수주,
    투입실적,
    기간.from,
    기간.to,
    재료.담당이름,
  )
  const settlementRows = build월정산내역(
    재료.기성전체,
    재료.성과재료.수주,
    기간.from,
    기간.to,
    재료.담당이름,
  )
  return {
    month: 기간.월,
    from: 기간.from,
    to: 기간.to,
    construction: { rows: constructionRows, totalThousand: sum월성과내역(constructionRows) },
    settlement: { rows: settlementRows, totalThousand: sum월정산내역(settlementRows) },
  }
}

/**
 * 대시보드 API 응답의 split 칸 — 한 달짜리(month 없음 / ?month=) 경로용. 읽기 + 계산을 한 번에.
 * 연간(?year=)은 loadSplit재료 를 한 번 부르고 buildMonthlySplit 을 달마다 부른다.
 */
export async function getMonthlySplit(
  supabase: SupabaseClient<Database>,
  기간: { 월: string; from: string; to: string },
  성과재료Promise: ReturnType<typeof load성과재료>,
  투입재료Promise: Promise<투입원가재료>,
): Promise<MonthlySplit> {
  return buildMonthlySplit(await loadSplit재료(supabase, 성과재료Promise, 투입재료Promise), 기간)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/_lib/monthly-split.test.ts" src/app/api/kpi/monthly-performance/route.test.ts`
Expected: PASS (기존 route 테스트도 그대로 — `getMonthlySplit` 시그니처 불변)

---

### Task 3: `load투입원가재료` — 투입실적 페이지 읽기 (⑤a)

**Files:**
- Modify: `src/app/(dashboard)/_lib/monthly-kpi.ts:91-112`

순수 읽기 변경이라 단위 테스트는 없다(가짜 supabase로는 페이지 경계를 의미 있게 못 본다). 검증은 Task 5의 운영 DB 대조(연간 631행 이상 = 월별 합)로 한다.

- [ ] **Step 1: 구현** — 파일 위 import에 `import { fetchAllRows } from '@/lib/supabase/fetch-all'`가 없으면 추가하고, `load투입원가재료`를 아래로 바꾼다.

```ts
/**
 * 투입실적(+상세)과 공사단가. getMonthlyKpiData 와 대시보드 split(야간 표기)이 같은 행을 쓰도록
 * route 가 한 번 불러 두 계산에 나눠 준다.
 * 투입실적은 fetchAllRows 로 끝까지 받는다(2026-11-12) — 연간 응답은 1년치(2026년 약 690행 예상)를
 * 한 번에 읽어 PostgREST 1000행 캡이 가깝다. 캡에 걸리면 에러 없이 1000행만 와서 야간 표기가 조용히 빠진다.
 * 정렬은 페이지 경계에서 행이 중복·누락되지 않게 거는 것 — 소비자(합계·야간 날짜 집합)는 순서를 안 본다.
 */
export function load투입원가재료(
  supabase: SupabaseClient<Database>,
  period: Pick<MonthlyPeriod, 'year' | 'monthStart' | 'monthEnd'>,
): Promise<투입원가재료> {
  return Promise.all([
    fetchAllRows('투입실적', (from, to) =>
      supabase
        .from('투입실적')
        .select('*, 투입실적상세(투입구분, 주간수량, 야간수량)')
        .gte('투입일', period.monthStart)
        .lt('투입일', period.monthEnd)
        .order('id')
        .range(from, to),
    ),
    supabase.from('공사단가').select('*').order('적용시작일'),
  ]).then(([투입실적, 단가결과]) => {
    if (단가결과.error) throw 단가결과.error
    return {
      year: period.year,
      투입실적: 투입실적 as unknown as 투입실적With상세[],
      단가: (단가결과.data ?? []) as 공사단가Row[],
    }
  })
}
```

- [ ] **Step 2: 타입·기존 테스트 확인**

Run: `npx tsc --noEmit; npx vitest run "src/app/(dashboard)/_lib"`
Expected: tsc 0 errors, PASS

---

### Task 4: route — `?year=` 분기

**Files:**
- Modify: `src/app/api/kpi/monthly-performance/route.ts`
- Test: `src/app/api/kpi/monthly-performance/route.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `route.test.ts`의 `vi.hoisted` 객체에 `loadSplit재료: vi.fn(),`을 추가하고, `monthly-split` mock을 아래로 바꾼다(`buildMonthlySplit`은 진짜를 쓴다).

```ts
vi.mock('@/app/(dashboard)/_lib/monthly-split', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/(dashboard)/_lib/monthly-split')>()),
  getMonthlySplit: m.getMonthlySplit,
  loadSplit재료: m.loadSplit재료,
}))
```

`beforeEach`에 추가:

```ts
  m.loadSplit재료.mockReset().mockResolvedValue({
    성과재료: { 공사이력: [], 수주: [] },
    투입재료: { year: 2026, 투입실적: [], 단가: [] },
    기성전체: [],
    담당이름: new Map(),
  })
```

파일 맨 아래에 추가:

```ts
describe('?year= — 12개월 split 한 번에 (연간 표 PR-2, 2026-11-12)', () => {
  it('12개 원소, 원소 = ?month= 응답 모양 + 상태, 미래 달은 split null', async () => {
    const res = await GET(요청('?year=2026'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['months', 'year'])
    expect(body.year).toBe(2026)
    expect(body.months).toHaveLength(12)
    expect(body.months[0]).toMatchObject({ month: '2026-01', 상태: '완료', split: { month: '2026-01', from: '2026-01-01' } })
    expect(body.months[10]).toMatchObject({ month: '2026-11', 상태: '진행중' })
    expect(body.months[11]).toEqual({ month: '2026-12', 상태: '미래', split: null })
  })

  it('원본은 한 번만 읽는다 — 12달이 같은 순간의 DB를 설명', async () => {
    await GET(요청('?year=2026'))
    expect(m.loadSplit재료).toHaveBeenCalledTimes(1)
    expect(m.load성과재료).toHaveBeenCalledTimes(1)
    expect(m.load투입원가재료).toHaveBeenCalledTimes(1)
    expect(m.getMonthlySplit).not.toHaveBeenCalled()
    expect(m.getMonthlyKpiData).not.toHaveBeenCalled()
  })

  it('투입실적은 1월 1일 ~ 진행중 달 끝까지 한 번에 읽는다', async () => {
    await GET(요청('?year=2026'))
    const [, period] = m.load투입원가재료.mock.calls[0]
    expect(period).toEqual({ year: 2026, monthStart: '2026-01-01', monthEnd: '2026-11-30' })
  })

  it('재료 읽기가 실패하면 500 — 달별 null + 200 으로 감싸지 않는다', async () => {
    m.loadSplit재료.mockRejectedValue(new Error('기성 조회 실패: boom'))
    const res = await GET(요청('?year=2026'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '기성 조회 실패: boom' })
  })

  it.each([['?year=26'], ['?year='], ['?year=2025'], ['?year=2027'], ['?year=2026&month=2026-10']])(
    '%s → 400, DB를 안 읽는다',
    async (q) => {
      const res = await GET(요청(q))
      expect(res.status).toBe(400)
      expect(m.createAdminClient).not.toHaveBeenCalled()
    },
  )

  it('인증이 먼저 — 키 없이 잘못된 year 는 401', async () => {
    const res = await GET(요청('?year=abc', null))
    expect(res.status).toBe(401)
  })

  it('KST 2027-01-01 03:00(UTC 12/31 18:00)이면 2027이 열린다 — 서버 시계로 정하면 400', async () => {
    지금은('2026-12-31T18:00:00Z')
    const res = await GET(요청('?year=2027'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.months[0]).toMatchObject({ month: '2027-01', 상태: '진행중' })
  })
})
```

> 구현자 메모: 세 번째 테스트의 `monthEnd: '2026-11-30'`은 2026-11 금요일 기준 기간의 `to`다(11월 마지막 주 11/23~11/29 → to 11/30). 실제 값은 `조회월기간('2026-11', '2026-11-10')`으로 확인하고 다르면 그 값으로 고친다 — 규칙이 아니라 테스트 숫자의 문제다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/kpi/monthly-performance/route.test.ts`
Expected: FAIL — ?year 분기가 없어 month 없는 응답(KPI 칸)이 온다

- [ ] **Step 3: 구현** — `route.ts` 파일 머리 주석의 "응답 모양은 두 가지다" 블록에 줄을 더하고, import와 분기를 추가한다.

머리 주석에 추가:

```ts
 *   ?year=YYYY       → { year, months: [{ month, 상태, split | null } × 12] } — 원소는 ?month= 응답 + 상태.
 *                      상태 '미래'만 split: null(실적이 없다 — 0이 아니다). 원본은 한 번 읽어 12달에 나눈다.
 *                      재료 읽기 실패는 500(달별로 감싸지 않음). 형식 오류·범위 밖·month 와 함께 오면 400
```

import 바꾸기:

```ts
import { getMonthlySplit, loadSplit재료, buildMonthlySplit } from '@/app/(dashboard)/_lib/monthly-split'
import { 금주소속월기간, 조회월기간, 연간조회월목록 } from '@/app/(dashboard)/gongmu/_lib/주차'
```

`const now = new Date()` 바로 아래, `const monthParam = ...` 줄을 `yearParam`과 함께 읽고 `if (monthParam !== null)` 앞에 year 분기를 둔다.

```ts
  const monthParam = req.nextUrl.searchParams.get('month')
  const yearParam = req.nextUrl.searchParams.get('year')

  if (yearParam !== null) {
    // 두 단위를 같이 받으면 어느 쪽 응답 모양인지 모호하다 — 고르지 않고 거절한다
    if (monthParam !== null) {
      return NextResponse.json({ error: 'month와 year는 함께 쓸 수 없습니다' }, { status: 400 })
    }
    // 오늘은 KST 로 못 박는다 — 서버 시계(UTC)면 1/1 00~09시에 새해가 400 이 된다
    const 연간 = 연간조회월목록(yearParam, formatKST(now))
    if (!연간.ok) {
      return NextResponse.json({ error: 연간.error }, { status: 400 })
    }
    try {
      const supabase = createAdminClient()
      // 원본을 한 번만 읽는다 — 12달이 같은 순간의 DB를 설명하게(달마다 읽으면 사이에 저장이 끼면 1월과 2월이 다른 DB를 본다)
      const 재료 = await loadSplit재료(
        supabase,
        load성과재료(supabase),
        // 야간 표기용 투입실적 — 1월 1일 ~ 진행중 달 끝을 한 번에. year 는 split 이 읽지 않는다
        load투입원가재료(supabase, {
          year: 연간.연도,
          monthStart: 연간.전체기간.from,
          monthEnd: 연간.전체기간.to,
        }),
      )
      const months = 연간.월목록.map(({ 월, 상태, 기간 }) => ({
        month: 월,
        상태,
        split: 기간 === null ? null : buildMonthlySplit(재료, 기간),
      }))
      return NextResponse.json({ year: 연간.연도, months })
    } catch (error) {
      // 읽기는 한 번이라 12달이 같이 성패한다 — 달별 null + 200 은 성공처럼 생긴 빈 표가 된다
      return 실패응답(error)
    }
  }

  if (monthParam !== null) {
```

(이어지는 기존 `if (monthParam !== null) {` 블록 본문은 그대로 — 위 마지막 줄이 기존 줄을 대신한다.)

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/api/kpi/monthly-performance/route.test.ts`
Expected: PASS (기존 month 없음·?month= 테스트 포함)

---

### Task 5: 전체 검증 + 운영 DB 대조 (로컬 dev, 읽기만)

- [ ] **Step 1: 전체 테스트·타입·린트·빌드**

Run: `npx vitest run; npx tsc --noEmit; npx eslint src; npm run build`
Expected: 테스트 전부 통과(기존 447 + 새 테스트), tsc 0, eslint 0, build 성공

- [ ] **Step 2: 로컬 dev(운영 DB)로 대조** — `npm run dev` 후 PowerShell에서(키는 `.env.local`의 `DASHBOARD_API_KEY`):

```powershell
$h = @{ Authorization = "Bearer $env:DASHBOARD_API_KEY" }
$y = Invoke-RestMethod "http://localhost:3000/api/kpi/monthly-performance?year=2026" -Headers $h
$y.months | ForEach-Object { "{0} {1} 시공 {2} 정산 {3}" -f $_.month, $_.상태, $_.split.construction.totalThousand, $_.split.settlement.totalThousand }
foreach ($m in '2026-01','2026-09','2026-10','2026-11') {
  $one = Invoke-RestMethod "http://localhost:3000/api/kpi/monthly-performance?month=$m" -Headers $h
  "{0} ?month= 시공 {1} 정산 {2}" -f $m, $one.split.construction.totalThousand, $one.split.settlement.totalThousand
}
(Invoke-WebRequest "http://localhost:3000/api/kpi/monthly-performance?year=2026" -Headers $h).RawContentLength
```

Expected:
- 연간 원소 1·9·10·11월의 시공·정산 = 같은 달 `?month=` 응답과 천원까지 같다(같은 순수 함수·같은 기간). 참고 기준: 1월 시공 311,383 · 9월 250,773 · 10월 494,834(11월 이후 입력이 늘었으면 바뀔 수 있음 — 두 응답이 서로 같으면 된다)
- 12월 `상태: 미래`, `split: null`
- 응답 크기 기록(계획 시점 미측정 — 대시보드 PR-4가 60초마다 받을지 판단 재료)

- [ ] **Step 3: 연간 합 = 한 해 대조(읽기 전용 스크립트, scratchpad)** — 공사이력 `작업일자` 2026-01-01 ≤ d < 11월 기간 `to` 행의 `성과금액` 원 단위 합과, 연간 응답 시공 1~11월 합(천원)이 행별 반올림 차 범위 안인지 확인. 차이가 공사 수 × 1천원을 넘으면 기간 빈틈·겹침을 의심.

---

### 커밋 (게이트 5 — 메시지는 조성현이 작성)

- 커밋 1: `주차.ts`·`주차.test.ts`·`monthly-split.ts`·`monthly-split.test.ts`·`monthly-kpi.ts` — 읽기/계산 쪼개기 + 연간 달 목록 + 투입실적 페이지 읽기
- 커밋 2: `route.ts`·`route.test.ts` + 이 계획 문서 + 설계 §7 결정
- 커밋 뒤 `git status`로 빠진 파일이 없는지 확인(PowerShell에서 한글 경로 `git add`가 잘린 적 있음)

## 범위 밖

- 대시보드 PR-3~5(중계 `?year=` 전달·정규화, 표, 그래프)
- 끝난 달 캐시 — 응답 크기·시간 실측(Task 5) 뒤 PR-4 기획에서 판단
- 연도 선택 ‹ 2026 › (설계 §5-4)
- OrderForm 전체 덮어쓰기 문제

## 대시보드 PR-4에 넘길 것

- 원소가 `?month=` 응답 + `상태`라 중계는 원소마다 기존 `_normalize_month_kpi`를 쓰고, `상태`·`year`를 허용목록에 더해야 한다(허용목록이 모르는 칸은 조용히 버려진다 — 2026-09-28).
- `상태 === '미래'`의 `split: null`은 `—`, 실패는 응답 전체 500 → '못 불러옴'. 둘을 같은 모양으로 그리지 말 것.
- 진행중 달 = 금주월 — 대시보드가 따로 계산하지 않는다(11/10 `split.month` 원칙과 같음).
