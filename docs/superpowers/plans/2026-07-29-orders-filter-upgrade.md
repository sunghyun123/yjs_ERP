# 수주대장 조회 필터 고도화 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수주대장에 연도·원청사·상태('진행전' 신설) 필터를 추가하고, 공사구분에 '총가'를 넣어 조회 축 4개를 갖춘다.

**Architecture:** 조회 축 판정 규칙(연도·상태·유형)을 도넛 전용 파일에서 `_lib/수주분류.ts`로 뽑아 도넛과 수주대장이 **같은 함수**를 호출하게 한다. 필터 자체는 `orders/_lib/filters.ts`의 순수 함수로 분리해 vitest로 못 박고, `OrdersTable`은 그 함수를 호출만 한다. '진행전' 판정에 필요한 이력건수는 `공사이력!수주_id(count)` 임베드로 쿼리 1방을 유지한 채 받는다.

**Tech Stack:** Next.js 16 (App Router, 서버 컴포넌트) · Supabase(PostgREST) · TanStack Table v8 · vitest · Tailwind

**Spec:** `docs/superpowers/specs/2026-07-29-orders-filter-upgrade-design.md`

**Branch:** `feat/orders-filter-upgrade`

---

## 파일 구조

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `src/app/(dashboard)/_lib/수주분류.ts` | 수주 1행을 조회 축(연도·상태·유형)으로 분류하는 규칙의 **정본**. 도넛·수주대장 공용 | 신규 |
| `src/app/(dashboard)/_lib/수주분류.test.ts` | 위 규칙의 테스트 | 신규 |
| `src/app/(dashboard)/_lib/type-status.ts` | 도넛 전용 로직만 남긴다(집계·연도필터·기본연도). 분류 규칙은 위 파일에서 import | 수정 |
| `src/app/(dashboard)/_lib/type-status.test.ts` | 이사한 함수의 테스트를 덜어낸다 | 수정 |
| `src/app/(dashboard)/_components/TypeStatusDonut.tsx` | import 경로 갱신 + 중복 헬퍼 제거 | 수정 |
| `src/app/(dashboard)/orders/_types.ts` | `수주행`에 `이력건수` 추가 | 수정 |
| `src/app/(dashboard)/orders/page.tsx` | 이력건수 임베드·평평화 + 1000행 가드 | 수정 |
| `src/app/(dashboard)/orders/_lib/filters.ts` | 수주대장 필터 순수 함수 + 드롭다운 옵션 파생 | 신규 |
| `src/app/(dashboard)/orders/_lib/filters.test.ts` | 필터 테스트 | 신규 |
| `src/app/(dashboard)/orders/_components/SearchableSelect.tsx` | `OrderForm`에서 추출한 검색형 선택 — 폼·필터 공용 | 신규 |
| `src/app/(dashboard)/orders/_components/OrderForm.tsx` | 위 컴포넌트를 import로 교체(약 130줄 삭제) | 수정 |
| `src/app/(dashboard)/orders/_components/OrdersTable.tsx` | 필터 바 2줄 + 필터 상태를 순수 함수에 위임 | 수정 |

**테스트 인프라 주의:** `vitest.config.ts`의 include가 `src/**/*.test.ts`다 — 테스트 파일은 반드시 `.ts`(`.tsx` 아님). jsdom·testing-library가 없으므로 **React 컴포넌트 테스트는 이 레포에 존재하지 않는다.** UI는 타입체크·lint·실화면 대조로 검증한다(Task 7).

---

## Task 1: 조회 축 분류 규칙을 공용 파일로 추출

동작을 하나도 바꾸지 않는 순수 이사다. 기존 `type-status.test.ts`가 그대로 통과하는 것이 안전망이다.

**Files:**
- Create: `src/app/(dashboard)/_lib/수주분류.ts`
- Create: `src/app/(dashboard)/_lib/수주분류.test.ts`
- Modify: `src/app/(dashboard)/_lib/type-status.ts`
- Modify: `src/app/(dashboard)/_lib/type-status.test.ts`
- Modify: `src/app/(dashboard)/_components/TypeStatusDonut.tsx`

- [ ] **Step 1: 기존 테스트가 지금 통과하는지 확인 (기준선)**

Run: `npm test`
Expected: PASS. `type-status.test.ts`·`whitelist.test.ts`·`whitelist-sync.test.ts` 전부 초록. 이 상태를 Task 1 끝에서 그대로 재현해야 한다.

- [ ] **Step 2: 공용 파일 생성**

Create `src/app/(dashboard)/_lib/수주분류.ts`:

```ts
// 수주 1행을 조회 축(연도·상태·유형)으로 분류하는 규칙의 정본.
// 도넛(TypeStatusDonut)과 수주대장(OrdersTable)이 같은 함수를 호출한다 —
// 규칙이 두 곳에 복사돼 있으면 한쪽만 고쳐져 두 화면의 숫자가 조용히 어긋난다.

// ── 연도 축 ────────────────────────────────────────────────────────────────
// 지중no 명명 규칙: 영문 2글자 + 2자리 연도 + '-' + 일련번호 (예: JY25-018 → 2025)
// 수주 테이블엔 수주일/계약일 컬럼이 없고 착공일은 45%가 NULL이라 연도로 쓸 수 없다.
// 지중no는 564건 중 1건만 규칙에서 벗어나 유일하게 쓸 수 있는 연도 소스다.

// 지중no에서 연도를 못 읽은 행이 모이는 자리. 조용히 버리면 "전체 ≠ 연도별 합"이 되므로
// 하나의 선택지로 노출해 티가 나게 한다.
export const 연도미상 = '연도미상'
export type 연도 = number | typeof 연도미상
export type 연도선택 = 연도 | '전체'

const 지중no연도 = /^[A-Za-z]{2}(\d{2})-/

export function 연도추출(지중no: string): number | null {
  const m = 지중no연도.exec(지중no ?? '')
  return m ? 2000 + parseInt(m[1], 10) : null
}

// 드롭다운에 띄울 연도 — 최신 연도가 위, 연도미상은 (있을 때만) 맨 뒤.
export function 연도목록(rows: { 연도: 연도 }[]): 연도[] {
  const 연도들 = [...new Set(rows.map((r) => r.연도))]
  const 숫자 = 연도들.filter((y): y is number => typeof y === 'number').sort((a, b) => b - a)
  return 연도들.includes(연도미상) ? [...숫자, 연도미상] : 숫자
}

// <select>의 value는 무조건 문자열로 돌아온다 — 숫자 연도로 되돌려야 rows의 연도와 === 로 맞는다.
export function 연도파싱(v: string): 연도선택 {
  return v === '전체' || v === 연도미상 ? v : Number(v)
}

// ── 상태 축 ────────────────────────────────────────────────────────────────
// 규칙(2026-07-15 재정의): 준공여부=true → 완료, 공사이력 1건 이상 → 진행중, 0건 → 미진행.
// `시공상태` 컬럼은 쓰지 않는다 — 실 DB 564건 중 NULL이 196건(35%)이고 모순 조합도 있어,
// 이 컬럼으로 판정하면 155건이 어느 필터에도 안 걸리는 유령이 된다.
// 수주만 하고 공사는 나중에 하는 게 정상 흐름이라 이력 0건의 디폴트는 미분류가 아니라 '미진행'.
// '완료'는 준공 기준이지 달성률 100% 기준이 아니다(준공+이력 0건도 완료 — 하루짜리 공사가 흔하다).
export type 상태 = '완료' | '진행중' | '미진행'

export function 공사상태(준공여부: boolean, 이력건수: number): 상태 {
  if (준공여부) return '완료'
  return 이력건수 > 0 ? '진행중' : '미진행'
}

// ── 유형 축 (공사구분) ─────────────────────────────────────────────────────
// 관급은 건수가 적어 민수로 합산한다 — 회사 내 규정이고 사장님 피드백(2026-07-09)과도 일치.
const 유형병합: Record<string, string> = { 관급: '민수' }

// 공사구분 NULL은 버리지 않고 '미분류'로 남긴다(안 보이는 것과 분류 안 된 것은 다른 메시지).
export function 공사구분정규화(공사구분: string | null): string {
  const 원유형 = 공사구분 ?? '미분류'
  return 유형병합[원유형] ?? 원유형
}
```

- [ ] **Step 3: 이사한 함수의 테스트를 새 파일로**

Create `src/app/(dashboard)/_lib/수주분류.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  공사구분정규화,
  공사상태,
  연도목록,
  연도미상,
  연도추출,
  연도파싱,
} from './수주분류'

describe('연도추출', () => {
  it('지중no 접두어 2글자 뒤 2자리를 2000년대 연도로 읽는다', () => {
    expect(연도추출('JY25-018')).toBe(2025)
    expect(연도추출('SG26-011')).toBe(2026)
    expect(연도추출('my26-004')).toBe(2026) // 소문자도 허용
  })

  it('명명 규칙에서 벗어나면 null (억지로 숫자를 짜내지 않는다)', () => {
    expect(연도추출('2025-001')).toBeNull() // 앞 2글자가 영문이 아님
    expect(연도추출('JY-018')).toBeNull() // 연도 자리 없음
    expect(연도추출('JYY25-1')).toBeNull() // 접두어 3글자
    expect(연도추출('')).toBeNull()
  })
})

describe('연도목록', () => {
  it('최신 연도부터 내림차순으로 준다 (드롭다운 순서)', () => {
    expect(연도목록([{ 연도: 2025 }, { 연도: 2026 }, { 연도: 2024 }])).toEqual([2026, 2025, 2024])
  })

  it('연도를 못 읽은 행이 있으면 연도미상을 맨 뒤에 붙인다 (조용히 사라지지 않게)', () => {
    expect(연도목록([{ 연도: 2025 }, { 연도: 연도미상 }])).toEqual([2025, 연도미상])
  })

  it('연도미상 행이 없으면 그 옵션도 없다', () => {
    expect(연도목록([{ 연도: 2025 }])).toEqual([2025])
  })
})

describe('연도파싱', () => {
  it('select의 문자열 value를 숫자 연도로 되돌린다', () => {
    expect(연도파싱('2026')).toBe(2026)
  })

  it("'전체'와 '연도미상'은 문자열 그대로 둔다", () => {
    expect(연도파싱('전체')).toBe('전체')
    expect(연도파싱(연도미상)).toBe(연도미상)
  })
})

describe('공사상태', () => {
  it('준공여부=true면 이력이 있든 없든 완료 (완료 = 준공 기준, 달성률 100% 아님)', () => {
    expect(공사상태(true, 0)).toBe('완료')
    expect(공사상태(true, 5)).toBe('완료')
  })

  it('준공 전이라도 공사이력이 1건 이상이면 진행중', () => {
    expect(공사상태(false, 1)).toBe('진행중')
    expect(공사상태(false, 12)).toBe('진행중')
  })

  it('수주만 있고 공사이력이 0건이면 미진행 (수주 후 공사는 나중이 정상 흐름 — 디폴트 상태)', () => {
    expect(공사상태(false, 0)).toBe('미진행')
  })
})

describe('공사구분정규화', () => {
  it('관급은 민수로 합산된다 (회사 규정)', () => {
    expect(공사구분정규화('관급')).toBe('민수')
  })

  it('총가·단가·민수는 그대로 둔다', () => {
    expect(공사구분정규화('총가')).toBe('총가')
    expect(공사구분정규화('단가')).toBe('단가')
    expect(공사구분정규화('민수')).toBe('민수')
  })

  it('NULL은 미분류로 남긴다 (조용히 버리지 않음)', () => {
    expect(공사구분정규화(null)).toBe('미분류')
  })

  it('목록에 없는 값도 버리지 않고 그대로 통과시킨다', () => {
    expect(공사구분정규화('신규유형')).toBe('신규유형')
  })
})
```

- [ ] **Step 4: 테스트 실행 — 새 테스트만 통과, 기존은 아직 그대로**

Run: `npx vitest run "src/app/(dashboard)/_lib/수주분류.test.ts"`
Expected: PASS (20개 안팎). 실패하면 Step 2의 코드 오타.

- [ ] **Step 5: `type-status.ts`에서 이사한 코드 삭제하고 import로 교체**

`src/app/(dashboard)/_lib/type-status.ts`의 상단 주석부터 `연도추출` 정의까지를 아래로 바꾼다.
**삭제 대상:** `연도미상`·`연도`·`연도선택` 선언, `지중no연도` 정규식, `연도추출` 함수, `연도목록` 함수, `유형병합` 상수, `export type 상태` 선언.
**남기는 것:** `DonutRow`, `공사도넛행`, `수주도넛입력`, `공사행변환`, `유형상태집계`, `연도필터`, `기본연도`.

파일 앞부분을 이렇게 만든다:

```ts
// 유형별 프로젝트 현황 도넛의 데이터 로직 — 렌더와 분리해 단위 테스트 가능하게 유지.
// 파이프라인: 공사행변환(서버, 공사 1건=1행) → 연도필터(클라) → 유형상태집계(클라, 렌더 중 파생).
// 공사 단위 행을 그대로 내려보내는 이유: 조각 클릭 팝업(공사 목록)이 원본 행을 요구하고,
// 도넛 합계와 팝업 목록이 같은 원본에서 파생돼야 어긋날 수 없다.
// 연도·상태·유형 판정 규칙은 수주대장과 공유한다 → ./수주분류.ts (정본)

import { calc하도적용표시금액 } from '../orders/_lib/completion'
import {
  공사구분정규화,
  공사상태,
  연도미상,
  연도목록,
  연도추출,
  type 상태,
  type 연도,
  type 연도선택,
} from './수주분류'

export type DonutRow = { 유형: string; 상태: 상태; 금액: number; 건수: number }

// 공사 1건 = 1행. 서버가 만들어 내려주고, 클라는 이걸로 도넛 집계와 클릭 팝업 목록을 모두 파생한다.
export type 공사도넛행 = {
  지중no: string
  공사명: string
  유형: string
  상태: 상태
  연도: 연도
  금액: number
}

// 수주 테이블에서 도넛에 필요한 컬럼만 (select 목록과 1:1).
// 이력건수는 공사이력(count) 임베드에서 서버가 풀어서 넣는다.
export type 수주도넛입력 = {
  지중no: string
  공사명: string
  공사구분: string | null
  준공여부: boolean
  이력건수: number
  수주금액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}

export function 공사행변환(수주목록: 수주도넛입력[]): 공사도넛행[] {
  return 수주목록.map((r) => ({
    지중no: r.지중no,
    공사명: r.공사명,
    유형: 공사구분정규화(r.공사구분),
    상태: 공사상태(r.준공여부, r.이력건수),
    연도: 연도추출(r.지중no) ?? 연도미상,
    // 금액 = 수주대장과 같은 관대 하도적용(요율 없으면 공급가 폴백) → 합계가 수주대장과 일치
    금액: calc하도적용표시금액(r.수주금액_공급가, r.보험료율, r.하도전용율),
  }))
}
```

그 아래의 `연도필터`·`유형상태집계`·`기본연도` 3개 함수는 **손대지 않는다.** `기본연도`가 쓰는 `연도목록`은 위 import로 들어온다.

- [ ] **Step 6: 도넛 테스트의 import를 갈라 준다**

`src/app/(dashboard)/_lib/type-status.test.ts` 상단 import를 이렇게 바꾼다:

```ts
import { describe, it, expect } from 'vitest'
import {
  공사행변환,
  유형상태집계,
  연도필터,
  기본연도,
  type 수주도넛입력,
} from './type-status'
import { 연도목록, 연도미상 } from './수주분류'
```

그리고 이사한 함수의 테스트 블록 2개를 **삭제**한다(같은 케이스가 `수주분류.test.ts`에 이미 있다):
- `describe('연도추출', ...)` 전체 (원본 79~92행)
- `describe('연도목록', ...)` 전체 (원본 94~113행)

나머지 `describe`(공사행변환·유형상태집계·연도필터·기본연도)는 그대로 둔다.

- [ ] **Step 7: 도넛 컴포넌트 import 갱신 + 중복 헬퍼 제거**

`src/app/(dashboard)/_components/TypeStatusDonut.tsx`에서 import 블록(원본 16~24행)을 둘로 가른다:

```ts
import {
  연도필터,
  유형상태집계,
  type DonutRow,
  type 공사도넛행,
} from '../_lib/type-status'
import {
  연도목록,
  연도미상,
  연도파싱,
  type 연도선택,
  type 상태,
} from '../_lib/수주분류'
```

그리고 로컬 헬퍼 `파싱된연도`(원본 35~37행, 주석 포함)를 **삭제**한다 — 같은 로직이 `수주분류.연도파싱`으로 옮겨졌다. 사용처(원본 118행)를 바꾼다:

```tsx
            onChange={(e) => set선택연도(연도파싱(e.target.value))}
```

- [ ] **Step 8: 전체 검증 — 동작 불변 확인**

Run: `npm test`
Expected: PASS 전부. (Step 1의 기준선과 같은 결과 + `수주분류.test.ts` 추가분)

Run: `npx tsc --noEmit`
Expected: 에러 0. 여기서 에러가 나면 대개 지우지 않은 옛 import 잔재다.

Run: `npm run lint`
Expected: 경고·에러 0.

- [ ] **Step 9: 커밋**

```bash
git add "src/app/(dashboard)/_lib/수주분류.ts" "src/app/(dashboard)/_lib/수주분류.test.ts" "src/app/(dashboard)/_lib/type-status.ts" "src/app/(dashboard)/_lib/type-status.test.ts" "src/app/(dashboard)/_components/TypeStatusDonut.tsx"
git commit -m "refactor(orders): 연도·상태·유형 판정 규칙을 공용 _lib/수주분류로 추출

수주대장에도 같은 축의 필터가 생기는데, 판정이 도넛 전용 파일에만 있으면
규칙이 복사되고 한쪽만 고쳐져 두 화면 숫자가 어긋난다. 정본을 하나 두고
도넛·수주대장이 같은 함수를 호출하게 한다. 동작 변화 없음(기존 테스트 통과)."
```

---

## Task 2: 이력건수 조회 + 1000행 가드

'진행전'(이력 0건) 판정에 필요한 재료를 수주대장 쿼리에 넣는다.

**Files:**
- Modify: `src/app/(dashboard)/orders/_types.ts:39-43`
- Modify: `src/app/(dashboard)/orders/page.tsx:8-40`

- [ ] **Step 1: `수주행`에 이력건수 추가**

`src/app/(dashboard)/orders/_types.ts`의 마지막 교차 타입에 한 줄 넣는다:

```ts
> & {
  발주자: 발주자정보 | null
  원청사: 발주자정보 | null
  기성: 기성항목[]
  // 공사이력 행수 — 상태 판정('진행전' = 0건)에만 쓴다. 이력 본문은 받지 않는다.
  이력건수: number
}
```

- [ ] **Step 2: 쿼리에 count 임베드 + 평평화 + 가드**

`src/app/(dashboard)/orders/page.tsx`의 select 문자열 마지막 줄(원본 20행) 뒤에 임베드를 추가한다:

```ts
        기성(id, 차수, 기성일, 기성액_공급가, 작업내용, 담당공무_id),
        공사이력!수주_id(count)
      `)
```

그리고 `orders` 만드는 부분(원본 37행)을 아래로 교체한다:

```ts
  // 카운트 임베드는 [{ count: n }] 모양으로 온다 — 평평한 이력건수로 풀어서 표에 넘긴다.
  // DB가 세서 붙여주므로 쿼리는 여전히 1방이고, 이력 행을 직접 받지 않으니
  // 1000행 캡은 수주 행에만 걸린다.
  type 수주조회행 = Omit<수주행, '이력건수'> & { 공사이력: { count: number }[] }
  const raw = (data ?? []) as unknown as 수주조회행[]

  // PostgREST는 1000행에서 조용히 자른다 — 잘린 대장을 맞는 것처럼 보여주면
  // 합계 푸터 숫자까지 틀려진다. 티 나게 실패시킨다.
  if (raw.length >= 1000) {
    throw new Error('수주 조회가 1000행 캡에 도달 — 대장 합계가 잘릴 수 있어 중단(페이지네이션 필요)')
  }

  const orders: 수주행[] = raw.map(({ 공사이력, ...r }) => ({
    ...r,
    이력건수: 공사이력?.[0]?.count ?? 0,
  }))
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: 실화면으로 이력건수가 실제로 들어오는지 확인**

Run: `npm run dev` 후 브라우저에서 `/orders` 열기
Expected: 표가 이전과 똑같이 564건 렌더된다(아직 UI 변화 없음). 에러 화면이 뜨면 임베드 문법(`공사이력!수주_id(count)`)이 틀렸거나 FK 이름이 다르다 — 도넛의 같은 임베드(`TypeStatusDonutSection.tsx:18`)와 대조한다.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/orders/_types.ts" "src/app/(dashboard)/orders/page.tsx"
git commit -m "feat(orders): 수주대장에 공사이력 건수 조회 + 1000행 fail-loud 가드

'진행전' 판정이 이력 0건 기준이라 건수가 필요하다. count 임베드라
왕복은 늘지 않고 이력 본문도 받지 않는다. 1000행에서 조용히 잘리면
합계 푸터까지 틀려지므로 도넛과 같은 가드를 세운다."
```

---

## Task 3: 필터 순수 함수 (TDD)

**Files:**
- Create: `src/app/(dashboard)/orders/_lib/filters.test.ts`
- Create: `src/app/(dashboard)/orders/_lib/filters.ts`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

Create `src/app/(dashboard)/orders/_lib/filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  수주필터,
  연도선택목록,
  원청사ID,
  원청사값,
  원청사목록,
  원청사없음ID,
  원청사없음존재,
  초기필터,
  필터적용중,
  type 수주필터조건,
} from './filters'
import { 연도미상 } from '../../_lib/수주분류'
import type { 수주행 } from '../_types'

// 수주행은 필드가 많다 — 필터가 읽는 것만 의미 있게 두고 나머지는 기본값으로 채운다.
const 행 = (over: Partial<수주행>): 수주행 => ({
  id: 1,
  지중no: 'JY25-001',
  공사번호: null,
  공사명: '시청 앞 지중화',
  공사구분: '단가',
  공사종류: null,
  공사현장: null,
  작업구분: null,
  시공상태: null,
  준공여부: false,
  착공일: null,
  준공일: null,
  수주금액_공급가: 1_000_000,
  준공액_공급가: null,
  달성율: null,
  참고사항: null,
  보험료율: null,
  하도전용율: null,
  발주자_id: null,
  원청사_id: 10,
  공사담당: null,
  감독자: null,
  정산상태: null,
  포장여부: false,
  자재청구여부: false,
  공무담당자_id: null,
  발주자: null,
  원청사: { 거래처명: '정우전설' },
  기성: [],
  이력건수: 0,
  ...over,
})

const 조건 = (over: Partial<수주필터조건> = {}): 수주필터조건 => ({ ...초기필터, ...over })

describe('수주필터 — 연도', () => {
  const rows = [
    행({ 지중no: 'JY25-001' }),
    행({ 지중no: 'SG25-002' }),
    행({ 지중no: 'JY26-003' }),
    행({ 지중no: '???' }),
  ]

  it('연도를 고르면 그 연도 행만 남는다', () => {
    expect(수주필터(rows, 조건({ 연도: 2025 })).map((r) => r.지중no)).toEqual(['JY25-001', 'SG25-002'])
  })

  it("'전체'는 행을 하나도 잃지 않는다 — 전체 건수 = 각 연도 건수의 합", () => {
    const 전체 = 수주필터(rows, 조건()).length
    const 연도별합 = 연도선택목록(rows)
      .filter((y) => y !== '전체')
      .reduce((s, y) => s + 수주필터(rows, 조건({ 연도: y })).length, 0)
    expect(전체).toBe(4)
    expect(연도별합).toBe(전체)
  })

  it('연도미상을 고르면 지중no 규칙에서 벗어난 행만 나온다', () => {
    expect(수주필터(rows, 조건({ 연도: 연도미상 })).map((r) => r.지중no)).toEqual(['???'])
  })
})

describe('수주필터 — 상태', () => {
  const rows = [
    행({ 지중no: 'A25-001', 준공여부: true, 이력건수: 0 }),
    행({ 지중no: 'A25-002', 준공여부: false, 이력건수: 3 }),
    행({ 지중no: 'A25-003', 준공여부: false, 이력건수: 0 }),
  ]

  it("'진행전'은 이력 0건·미준공만 (시공상태 컬럼이 아니라 이력 기준)", () => {
    expect(수주필터(rows, 조건({ 상태: '진행전' })).map((r) => r.지중no)).toEqual(['A25-003'])
  })

  it("'진행중'은 미준공 + 이력 1건 이상", () => {
    expect(수주필터(rows, 조건({ 상태: '진행중' })).map((r) => r.지중no)).toEqual(['A25-002'])
  })

  it("'준공완료'는 준공여부=true (이력 0건이어도 완료)", () => {
    expect(수주필터(rows, 조건({ 상태: '준공완료' })).map((r) => r.지중no)).toEqual(['A25-001'])
  })

  it('세 상태는 서로 배타적이고 합이 전체와 같다 (유령 행이 없다)', () => {
    const 합 = (['진행전', '진행중', '준공완료'] as const).reduce(
      (s, 상태) => s + 수주필터(rows, 조건({ 상태 })).length,
      0,
    )
    expect(합).toBe(rows.length)
  })

  it('시공상태 컬럼이 NULL이어도 어느 한 상태에는 반드시 걸린다', () => {
    const rows = [행({ 시공상태: null, 준공여부: false, 이력건수: 0 })]
    expect(수주필터(rows, 조건({ 상태: '진행전' }))).toHaveLength(1)
  })
})

describe('수주필터 — 공사구분', () => {
  const rows = [
    행({ 지중no: 'A25-001', 공사구분: '단가' }),
    행({ 지중no: 'A25-002', 공사구분: '총가' }),
    행({ 지중no: 'A25-003', 공사구분: '민수' }),
    행({ 지중no: 'A25-004', 공사구분: '관급' }),
    행({ 지중no: 'A25-005', 공사구분: null }),
  ]

  it('관급은 민수 필터에 걸린다 (회사 규정 — 민수로 통합)', () => {
    expect(수주필터(rows, 조건({ 공사구분: '민수' })).map((r) => r.지중no)).toEqual(['A25-003', 'A25-004'])
  })

  it('총가 필터가 총가만 잡는다', () => {
    expect(수주필터(rows, 조건({ 공사구분: '총가' })).map((r) => r.지중no)).toEqual(['A25-002'])
  })

  it('공사구분 NULL 행은 어떤 구분 필터에도 안 걸리고 전체에서만 보인다', () => {
    for (const 공사구분 of ['총가', '단가', '민수'] as const) {
      expect(수주필터(rows, 조건({ 공사구분 })).map((r) => r.지중no)).not.toContain('A25-005')
    }
    expect(수주필터(rows, 조건()).map((r) => r.지중no)).toContain('A25-005')
  })
})

describe('수주필터 — 원청사', () => {
  const rows = [
    행({ 지중no: 'A25-001', 원청사_id: 10, 원청사: { 거래처명: '정우전설' } }),
    행({ 지중no: 'A25-002', 원청사_id: 20, 원청사: { 거래처명: '에스제이이' } }),
    행({ 지중no: 'A25-003', 원청사_id: null, 원청사: null }),
  ]

  it('특정 원청사를 고르면 그 원청사 건만 나온다', () => {
    expect(수주필터(rows, 조건({ 원청사: 10 })).map((r) => r.지중no)).toEqual(['A25-001'])
  })

  it("'없음'은 원청사 미지정 건만 나온다", () => {
    expect(수주필터(rows, 조건({ 원청사: '없음' })).map((r) => r.지중no)).toEqual(['A25-003'])
  })

  it('특정 원청사를 고르면 미지정 건은 빠진다', () => {
    expect(수주필터(rows, 조건({ 원청사: 10 })).map((r) => r.지중no)).not.toContain('A25-003')
  })
})

describe('수주필터 — 검색어 (기존 동작 보존)', () => {
  const rows = [
    행({ 지중no: 'JY25-001', 공사명: '시청 앞 지중화' }),
    행({ 지중no: 'SG26-002', 공사명: '한전 인입공사' }),
  ]

  it('공사명으로 걸린다', () => {
    expect(수주필터(rows, 조건({ 검색어: '인입' })).map((r) => r.지중no)).toEqual(['SG26-002'])
  })

  it('지중No로도 걸리고 대소문자를 무시한다', () => {
    expect(수주필터(rows, 조건({ 검색어: 'jy25' })).map((r) => r.지중no)).toEqual(['JY25-001'])
  })

  it('공백만 있는 검색어는 필터로 취급하지 않는다', () => {
    expect(수주필터(rows, 조건({ 검색어: '   ' }))).toHaveLength(2)
  })
})

describe('수주필터 — 조건 조합', () => {
  it('여러 축은 AND로 걸린다', () => {
    const rows = [
      행({ 지중no: 'A25-001', 공사구분: '단가', 준공여부: true }),
      행({ 지중no: 'A26-002', 공사구분: '단가', 준공여부: true }),
      행({ 지중no: 'A26-003', 공사구분: '민수', 준공여부: true }),
      행({ 지중no: 'A26-004', 공사구분: '단가', 준공여부: false, 이력건수: 0 }),
    ]
    const out = 수주필터(rows, 조건({ 연도: 2026, 공사구분: '단가', 상태: '준공완료' }))
    expect(out.map((r) => r.지중no)).toEqual(['A26-002'])
  })
})

describe('드롭다운 옵션 파생', () => {
  const rows = [
    행({ 지중no: 'A25-001', 원청사_id: 20, 원청사: { 거래처명: '에스제이이' } }),
    행({ 지중no: 'A26-002', 원청사_id: 10, 원청사: { 거래처명: '정우전설' } }),
    행({ 지중no: 'A26-003', 원청사_id: 10, 원청사: { 거래처명: '정우전설' } }),
    행({ 지중no: '???', 원청사_id: null, 원청사: null }),
  ]

  it('원청사목록은 중복 없이 거래처명 오름차순', () => {
    expect(원청사목록(rows)).toEqual([
      { id: 20, 거래처명: '에스제이이' },
      { id: 10, 거래처명: '정우전설' },
    ])
  })

  it('원청사목록에 미지정 건은 들어가지 않는다 (별도 선택지로 다룬다)', () => {
    expect(원청사목록(rows).map((o) => o.id)).not.toContain(null)
    expect(원청사없음존재(rows)).toBe(true)
    expect(원청사없음존재([행({ 원청사_id: 10 })])).toBe(false)
  })

  it("연도선택목록은 '전체' 다음에 최신 연도 내림차순, 연도미상은 맨 뒤", () => {
    expect(연도선택목록(rows)).toEqual(['전체', 2026, 2025, 연도미상])
  })
})

describe('원청사 선택값 ↔ 드롭다운 id 왕복', () => {
  it('null은 전체, 자리표 음수는 없음, 나머지는 그대로', () => {
    expect(원청사값(null)).toBe('전체')
    expect(원청사값(원청사없음ID)).toBe('없음')
    expect(원청사값(10)).toBe(10)
  })

  it('되돌려도 같은 값이 나온다 (왕복 보존)', () => {
    for (const 선택 of ['전체', '없음', 10] as const) {
      expect(원청사값(원청사ID(선택))).toBe(선택)
    }
  })
})

describe('필터적용중', () => {
  it('초기 상태에서는 false — 푸터에 "전체 N건 중"을 띄우지 않는다', () => {
    expect(필터적용중(초기필터)).toBe(false)
  })

  it('축이 하나라도 움직이면 true', () => {
    expect(필터적용중(조건({ 연도: 2026 }))).toBe(true)
    expect(필터적용중(조건({ 상태: '진행전' }))).toBe(true)
    expect(필터적용중(조건({ 원청사: '없음' }))).toBe(true)
    expect(필터적용중(조건({ 공사구분: '총가' }))).toBe(true)
    expect(필터적용중(조건({ 검색어: '지중' }))).toBe(true)
  })

  it('공백뿐인 검색어는 적용으로 보지 않는다', () => {
    expect(필터적용중(조건({ 검색어: '  ' }))).toBe(false)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run "src/app/(dashboard)/orders/_lib/filters.test.ts"`
Expected: FAIL — `Failed to resolve import "./filters"`. 아직 구현이 없다.

- [ ] **Step 3: 구현**

Create `src/app/(dashboard)/orders/_lib/filters.ts`:

```ts
// 수주대장 조회 필터 — 렌더와 분리한 순수 함수. 조건이 5개라 인라인으로 두면
// 눈으로 검증이 안 되고, 축이 늘 때마다 조용히 어긋난다.
// 연도·상태·유형 판정은 도넛과 공유하는 정본(../../_lib/수주분류)을 호출만 한다.

import {
  공사구분정규화,
  공사상태,
  연도목록,
  연도미상,
  연도추출,
  type 상태,
  type 연도,
  type 연도선택,
} from '../../_lib/수주분류'
import type { 수주행 } from '../_types'

export type 상태선택 = '전체' | '진행전' | '진행중' | '준공완료'
export type 원청사선택 = '전체' | '없음' | number
export type 공사구분선택 = '전체' | '총가' | '단가' | '민수'

export type 수주필터조건 = {
  연도: 연도선택
  상태: 상태선택
  원청사: 원청사선택
  공사구분: 공사구분선택
  검색어: string
}

export const 초기필터: 수주필터조건 = {
  연도: '전체', // 수주대장은 '대장 전체'를 보는 화면 — 올해로 시작하면 열자마자 대부분이 사라진 것처럼 보인다
  상태: '전체',
  원청사: '전체',
  공사구분: '전체',
  검색어: '',
}

export const 상태옵션: 상태선택[] = ['전체', '진행전', '진행중', '준공완료']
export const 공사구분옵션: 공사구분선택[] = ['전체', '총가', '단가', '민수']

// 화면 라벨 → 판정 함수 반환값. 도넛은 '미진행'이라 쓰고 수주대장은 '진행전'이라 부른다 —
// 판정은 한 곳(공사상태), 표기만 화면마다 다르다. 이 표가 그 대응의 유일한 정본이다.
const 상태매핑: Record<Exclude<상태선택, '전체'>, 상태> = {
  진행전: '미진행',
  진행중: '진행중',
  준공완료: '완료',
}

export function 수주연도(row: 수주행): 연도 {
  return 연도추출(row.지중no) ?? 연도미상
}

export function 수주필터(rows: 수주행[], 조건: 수주필터조건): 수주행[] {
  const q = 조건.검색어.trim().toLowerCase()
  return rows.filter((row) => {
    if (조건.연도 !== '전체' && 수주연도(row) !== 조건.연도) return false
    if (조건.상태 !== '전체' && 공사상태(row.준공여부, row.이력건수) !== 상태매핑[조건.상태]) return false
    if (조건.원청사 === '없음') {
      if (row.원청사_id != null) return false
    } else if (조건.원청사 !== '전체' && row.원청사_id !== 조건.원청사) {
      return false
    }
    if (조건.공사구분 !== '전체' && 공사구분정규화(row.공사구분) !== 조건.공사구분) return false
    if (q && !row.공사명.toLowerCase().includes(q) && !row.지중no.toLowerCase().includes(q)) return false
    return true
  })
}

// 드롭다운 옵션은 전체 data에서 파생시킨다(필터 결과가 아니라) — 필터를 걸수록
// 선택지가 사라져 되돌릴 수 없게 되는 걸 막는다.
// 건수는 붙이지 않는다: 원청사 편중이 심해(한 곳이 426건, 나머지 대부분 1건) 숫자가 잡음이 된다.
export function 원청사목록(rows: 수주행[]): { id: number; 거래처명: string }[] {
  const m = new Map<number, string>()
  for (const r of rows) {
    if (r.원청사_id == null) continue
    // 이름을 못 받은 경우에도 선택지를 잃지 않게 id를 표시값으로 쓴다
    m.set(r.원청사_id, r.원청사?.거래처명 ?? `#${r.원청사_id}`)
  }
  return [...m]
    .map(([id, 거래처명]) => ({ id, 거래처명 }))
    .sort((a, b) => a.거래처명.localeCompare(b.거래처명, 'ko'))
}

export function 원청사없음존재(rows: 수주행[]): boolean {
  return rows.some((r) => r.원청사_id == null)
}

export function 연도선택목록(rows: 수주행[]): 연도선택[] {
  return ['전체', ...연도목록(rows.map((r) => ({ 연도: 수주연도(r) })))]
}

// 검색형 선택 컴포넌트는 값을 숫자 id 하나로만 다룬다(null = 미선택 = 전체).
// '원청사 없음'을 같은 통로로 태우려고, 실제 거래처 id에 없는 음수 하나를 자리표로 쓴다.
export const 원청사없음ID = -1

export function 원청사값(id: number | null): 원청사선택 {
  if (id === null) return '전체'
  return id === 원청사없음ID ? '없음' : id
}

export function 원청사ID(선택: 원청사선택): number | null {
  if (선택 === '전체') return null
  return 선택 === '없음' ? 원청사없음ID : 선택
}

// 푸터에 "/ 전체 N건"을 띄울지 판단 — 축 하나라도 움직였을 때만.
export function 필터적용중(조건: 수주필터조건): boolean {
  return (
    조건.연도 !== '전체' ||
    조건.상태 !== '전체' ||
    조건.원청사 !== '전체' ||
    조건.공사구분 !== '전체' ||
    조건.검색어.trim() !== ''
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/orders/_lib/filters.test.ts"`
Expected: PASS 전부(30개 안팎).

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/orders/_lib/filters.ts" "src/app/(dashboard)/orders/_lib/filters.test.ts"
git commit -m "feat(orders): 수주대장 필터를 순수 함수로 분리 + 테스트

조건이 3개에서 5개로 늘면 useMemo 안 인라인 필터는 눈으로 검증이 안 된다.
테스트로 못 박은 것: 관급이 민수에 걸리는지, 상태 3분류의 합이 전체와 같은지
(= 유령 행이 없는지), 전체 건수가 연도별 합과 일치하는지."
```

---

## Task 4: SearchableSelect 공용 컴포넌트로 추출

**Files:**
- Create: `src/app/(dashboard)/orders/_components/SearchableSelect.tsx`
- Modify: `src/app/(dashboard)/orders/_components/OrderForm.tsx` (74~208행 삭제, import 정리)

- [ ] **Step 1: 새 파일로 그대로 옮긴다 (옵션 타입만 넓힘)**

Create `src/app/(dashboard)/orders/_components/SearchableSelect.tsx`. 아래는 `OrderForm.tsx:74-208`의 본문을 옮긴 것이고, **바뀐 곳은 옵션 타입 하나뿐**이다 — `거래처목록항목`(보험료제외율·하도전용율까지 요구)에서 `{ id, 거래처명 }`으로 넓혀 필터의 원청사목록도 태울 수 있게 한다. 구조적 타이핑이라 `거래처목록항목`은 그대로 들어맞는다.

```tsx
'use client'

import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { useRef, useState, useEffect, useDeferredValue } from 'react'
import { Search, ChevronDown, X as XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useComboboxKeyboard } from '@/hooks/useComboboxKeyboard'

// 이름으로 검색해 하나 고르는 선택 컨트롤. 수주 폼(발주자·원청사)과
// 수주대장 필터(원청사)가 공용한다.
// 옵션 타입은 { id, 거래처명 }까지만 요구한다 — 거래처목록항목도 그대로 들어맞고,
// 필터가 파생시킨 { id, 거래처명 } 목록도 태울 수 있다.
export type 검색옵션 = { id: number; 거래처명: string }

// 핵심: 각 아이템 onMouseDown에서 e.preventDefault() → input blur 차단
// 그 다음 onClick에서 실제 선택 처리 (mousedown → mouseup → click 순서)
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '거래처명으로 검색...',
}: {
  options: 검색옵션[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = options.find((o) => o.id === value)
  const deferredQuery = useDeferredValue(query)
  const filtered = deferredQuery
    ? options.filter((o) => o.거래처명.toLowerCase().includes(deferredQuery.toLowerCase()))
    : options

  // 위치 계산만 분리 — onFocus(query 초기화)와 onChange(query 보존) 양쪽에서 재사용
  const positionDrop = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const openDrop = () => {
    positionDrop()
    setOpen(true)
    setQuery('')
  }

  // 키보드 ↑↓/Enter/Esc 선택 — 항목은 index로만 다루므로 filtered에서 꺼내 호출부가 선택한다
  const { activeIndex, setActiveIndex, onKeyDown } = useComboboxKeyboard({
    open,
    itemCount: filtered.length,
    onSelect: (i) => { onChange(filtered[i].id); setOpen(false) },
    onClose: () => setOpen(false),
    onOpen: openDrop,
    listRef: dropRef,
  })

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('scroll', close, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [open])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected?.거래처명 ?? '')}
          onChange={(e) => {
            setQuery(e.target.value)
            // 선택 직후엔 포커스가 남은 채 open=false라 onFocus가 다시 안 터진다.
            // 타이핑이 곧 "편집 시작"이므로 닫혀 있으면 드롭다운을 되살린다(query는 보존).
            if (!open) { positionDrop(); setOpen(true) }
          }}
          onKeyDown={onKeyDown}
          onFocus={openDrop}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-background text-sm pl-8 pr-8 outline-none',
            'focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors',
            open && 'border-ring ring-3 ring-ring/50',
          )}
        />
        {value != null ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); inputRef.current?.focus() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <DismissableLayerBranch>
            <div
              ref={dropRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, pointerEvents: 'auto' }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
              ) : (
                filtered.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    data-combobox-item
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)} // 마우스와 키보드 하이라이트를 한 상태로 동기화
                    onClick={() => { onChange(o.id); setOpen(false) }}
                    className={cn(
                      'w-full px-3 py-1.5 text-sm text-left transition-colors',
                      i === activeIndex && 'bg-blue-50',                       // 키보드 커서
                      o.id === value && 'bg-blue-50 text-blue-700 font-medium', // 현재 선택값
                    )}
                  >
                    {o.거래처명}
                  </button>
                ))
              )}
            </div>
          </DismissableLayerBranch>,
          document.body,
        )}
    </div>
  )
}
```

- [ ] **Step 2: `OrderForm.tsx`에서 원본 삭제 + import**

`src/app/(dashboard)/orders/_components/OrderForm.tsx`에서:

1. 74~208행(`// ── 검색형 거래처 선택 ──` 주석부터 `SearchableSelect` 함수 닫는 `}`까지) **삭제**
2. import 블록에 한 줄 추가:

```ts
import { SearchableSelect } from './SearchableSelect'
```

3. 삭제로 안 쓰이게 된 import를 정리한다. `SearchableSelect`만 쓰던 것들이라 아래를 지운다:

```ts
// 삭제
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { useComboboxKeyboard } from '@/hooks/useComboboxKeyboard'
```

그리고 react·lucide import에서 안 쓰는 이름을 뺀다:

```ts
import { useRef, useState, useEffect } from 'react'   // useDeferredValue 제거
import {
  Save, Loader2, Trash2, CheckCircle2, AlertCircle, AlertTriangle,
  Plus,
} from 'lucide-react'                                  // Search, ChevronDown, XIcon 제거
```

**주의:** 위 세 아이콘(`Search`·`ChevronDown`·`XIcon`)과 `useRef`·`useEffect`가 파일의 다른 곳에서도 쓰이는지 반드시 확인하고 지운다. lint가 잡아주므로 Step 3에서 확인한다.

```bash
grep -n "Search\|ChevronDown\|XIcon\|useDeferredValue\|useRef\|useEffect\|createPortal\|DismissableLayerBranch\|useComboboxKeyboard" "src/app/(dashboard)/orders/_components/OrderForm.tsx"
```

- [ ] **Step 3: 검증**

Run: `npm run lint`
Expected: 에러 0. `'Search' is defined but never used` 류가 뜨면 Step 2에서 덜 지웠거나 더 지웠다.

Run: `npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: 실화면으로 폼 동작 확인 (컴포넌트 테스트가 없으므로 필수)**

Run: `npm run dev` → `/orders` → 아무 행 클릭 → 수주 수정 폼
Expected:
1. 발주자·원청사 칸에 기존 거래처명이 표시된다
2. 칸을 클릭하면 드롭다운이 열리고, 타이핑하면 목록이 좁혀진다
3. ↑↓ 키로 이동, Enter로 선택된다
4. 원청사를 바꾸면 보험료율·하도전용율이 자동으로 채워진다 (`handleClientChange`)
5. X 버튼으로 선택이 지워진다

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/orders/_components/SearchableSelect.tsx" "src/app/(dashboard)/orders/_components/OrderForm.tsx"
git commit -m "refactor(orders): SearchableSelect를 공용 컴포넌트로 추출

수주대장 원청사 필터가 같은 검색형 선택을 쓴다. 옵션 타입을
{ id, 거래처명 }으로 넓혀 필터가 파생시킨 목록도 태울 수 있게 했다.
동작 변화 없음."
```

---

## Task 5: 필터 바 2줄 + OrdersTable 배선

**Files:**
- Modify: `src/app/(dashboard)/orders/_components/OrdersTable.tsx`

- [ ] **Step 1: import·필터 타입 정리**

`OrdersTable.tsx` 상단에서 로컬 필터 타입 선언(원본 124~131행)을 **삭제**한다:

```ts
// 삭제 — filters.ts로 옮겨졌다
type 준공필터타입 = 'all' | 'active' | 'done'
const 준공필터옵션: { value: 준공필터타입; label: string }[] = [ ... ]
const 공사구분옵션 = ['전체', '단가', '민수']
```

import를 추가한다 (기존 `import { calc하도적용표시금액 } from '../_lib/completion'` 아래):

```ts
import {
  수주필터,
  연도선택목록,
  원청사ID,
  원청사값,
  원청사목록,
  원청사없음ID,
  원청사없음존재,
  초기필터,
  필터적용중,
  공사구분옵션,
  상태옵션,
  type 수주필터조건,
} from '../_lib/filters'
import { 연도미상, 연도파싱 } from '../../_lib/수주분류'
import { SearchableSelect } from './SearchableSelect'
```

- [ ] **Step 2: 상태를 필터 객체 하나로 교체**

원본 150~178행(`const [준공필터, ...]` ~ `filteredData` useMemo)을 아래로 바꾼다:

```tsx
  // 필터 5축을 객체 하나로 묶는다 — 어느 축이 바뀌어도 같은 경로(필터변경)를 타므로
  // 페이지 리셋을 빠뜨릴 수 없다.
  const [필터, set필터] = useState<수주필터조건>(초기필터)
  // 금액기준은 필터가 아니라 '표시 전환'이다 — 행을 걸러내지 않으므로 따로 둔다.
  const [금액기준, set금액기준] = useState<금액기준타입>('하도적용')
  const [formState, setFormState] = useState<FormState | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  // 필터가 바뀌면 3페이지에 머문 채 결과가 2페이지로 줄어드는 빈 화면을 막는다.
  const 필터변경 = <K extends keyof 수주필터조건>(key: K, value: 수주필터조건[K]) => {
    set필터((p) => ({ ...p, [key]: value }))
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  const filteredData = useMemo(() => 수주필터(data, 필터), [data, 필터])

  // 드롭다운 옵션은 필터 결과가 아니라 전체 data에서 파생시킨다 —
  // 필터를 걸수록 선택지가 사라져 되돌릴 수 없게 되는 걸 막는다.
  const 연도옵션 = useMemo(() => 연도선택목록(data), [data])
  const 원청사옵션 = useMemo(() => {
    const 목록 = 원청사목록(data)
    // '원청사 없음' 건이 있을 때만 그 선택지를 만든다(없으면 결과 0건인 옵션이 된다)
    return 원청사없음존재(data)
      ? [...목록, { id: 원청사없음ID, 거래처명: '(원청사 없음)' }]
      : 목록
  }, [data])
```

기존 `resetPage` 선언(원본 161행)은 `필터변경`이 대신하므로 **삭제**한다.

- [ ] **Step 3: 필터 바 JSX 교체**

원본 322~415행의 필터 바 `<div>` 전체를 아래로 바꾼다:

```tsx
      {/* 필터 바 — 윗줄: 무엇을 조회할지 / 아랫줄: 어떻게 볼지 + 검색 */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-3 space-y-2.5">
        {/* ── 윗줄: 조회 축 ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 연도 — 옵션은 데이터에서 파생(2027년 수주가 들어오면 자동으로 생긴다) */}
          <Select
            value={String(필터.연도)}
            onValueChange={(v) => 필터변경('연도', 연도파싱(v))}
          >
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {연도옵션.map((y) => (
                <SelectItem key={String(y)} value={String(y)}>
                  {y === '전체' ? '전체 연도' : y === 연도미상 ? 연도미상 : `${y}년`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 상태 — 진행전(이력 0건) / 진행중(이력 1건 이상) / 준공완료(준공여부) */}
          <div className="flex items-center rounded-lg border border-gray-200 divide-x divide-gray-200 overflow-hidden">
            {상태옵션.map((v) => (
              <button
                key={v}
                type="button"
                className={cn(
                  'px-3 h-8 text-sm transition-colors whitespace-nowrap',
                  필터.상태 === v
                    ? 'bg-[#1e2d5a] text-white font-medium'
                    : 'bg-white text-gray-600 hover:bg-gray-50',
                )}
                onClick={() => 필터변경('상태', v)}
              >
                {v}
              </button>
            ))}
          </div>

          {/* 원청사 — 수주에 실제 등장하는 곳만(결과 0건인 선택지를 만들지 않는다) */}
          <div className="w-52">
            <SearchableSelect
              options={원청사옵션}
              value={원청사ID(필터.원청사)}
              onChange={(id) => 필터변경('원청사', 원청사값(id))}
              placeholder="원청사 전체"
            />
          </div>

          {/* 공사구분 — '민수'는 관급까지 포함(회사 규정) */}
          <Select
            value={필터.공사구분}
            onValueChange={(v) => 필터변경('공사구분', v as 수주필터조건['공사구분'])}
          >
            <SelectTrigger className="h-8 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {공사구분옵션.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── 아랫줄: 표시 기준 + 검색 ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 금액 기준 토글 — 서류 대조(공급가) vs 실수령 조망(하도적용). 행을 걸러내지 않으므로 페이지 리셋 없음 */}
          <div className="flex items-center rounded-lg border border-gray-200 divide-x divide-gray-200 overflow-hidden">
            {(['하도적용', '공급가'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={cn(
                  'px-3 h-8 text-sm transition-colors whitespace-nowrap',
                  금액기준 === v
                    ? 'bg-[#1e2d5a] text-white font-medium'
                    : 'bg-white text-gray-600 hover:bg-gray-50',
                )}
                onClick={() => set금액기준(v)}
              >
                {v}
              </button>
            ))}
          </div>

          {/* 검색어 */}
          <div className="relative flex-1 min-w-44 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="지중No 또는 공사명으로 검색..."
              value={필터.검색어}
              onChange={(e) => 필터변경('검색어', e.target.value)}
            />
          </div>

          {/* 건수 */}
          <span className="text-sm text-gray-500 tabular-nums shrink-0">
            {total.toLocaleString('ko-KR')}건
          </span>

          {/* 새 수주 버튼 */}
          <Button
            size="sm"
            className="ml-auto h-8 bg-[#1e2d5a] hover:bg-[#2d45a8] shrink-0"
            onClick={() => setFormState({ mode: 'new' })}
          >
            <Plus className="size-3.5 mr-1" />
            새 수주
          </Button>
        </div>
      </div>
```

- [ ] **Step 4: 푸터의 "전체 N건" 조건을 넓힌다**

원본 473행의 `검색어.trim()` 조건을 `필터적용중(필터)`로 바꾼다. 연도로 걸러도 "전체 몇 건 중"이 보여야 한다.

```tsx
                <TableCell colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-600">
                  합계 ({total.toLocaleString('ko-KR')}건)
                  {필터적용중(필터) && data.length !== total && (
                    <span className="font-normal text-gray-400 ml-1">/ 전체 {data.length.toLocaleString('ko-KR')}건</span>
                  )}
                </TableCell>
```

- [ ] **Step 5: 검증**

Run: `npm run lint`
Expected: 에러 0. (삭제한 `준공필터`·`resetPage`의 잔재가 있으면 여기서 잡힌다)

Run: `npx tsc --noEmit`
Expected: 에러 0.

Run: `npm test`
Expected: PASS 전부.

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(dashboard)/orders/_components/OrdersTable.tsx"
git commit -m "feat(orders): 수주대장 필터 바를 조회축·표시축 2줄로 재편

연도·원청사·진행전을 추가하고 공사구분에 총가를 넣었다.
금액기준은 행을 걸러내지 않는 '표시 전환'이라 조회 축과 줄을 갈랐다.
필터 판정은 _lib/filters.ts 순수 함수에 위임 — 컴포넌트는 호출만 한다."
```

---

## Task 6: 실화면 대조 검증

컴포넌트 테스트 인프라가 없으므로 이 단계가 UI의 유일한 검증이다. 숫자는 2026-07-29 실 DB 기준.

**Files:** 없음 (검증만)

- [ ] **Step 1: 개발 서버 실행**

Run: `npm run dev` → `http://localhost:3000/orders`

- [ ] **Step 2: 상태 3분류의 합이 전체와 같은지 (유령 행 없음)**

기대: 진행전 **202건** · 진행중 **104건** · 준공완료 **258건**, 합 **564건** = 전체 건수.
어긋나면 `이력건수`가 안 들어오고 있다 — 전부 0으로 오면 **진행중이 0건**, 진행전이 306건(564−258)으로 부푼다. 이 두 숫자가 Task 2의 임베드가 실패했다는 신호다.

- [ ] **Step 3: 연도별 합이 전체와 같은지**

기대: 2025년 **389건** · 2026년 **173건** · 2024년 **1건** · 연도미상 **1건**, 합 564건.

- [ ] **Step 4: 공사구분 — 민수가 관급을 포함하는지**

기대: 총가 **9건** · 단가 **536건** · 민수 **18건**(민수 16 + 관급 2).
민수가 16건으로 나오면 병합이 안 걸린 것이다.

- [ ] **Step 5: 원청사 필터**

기대: 드롭다운에 13곳 + `(원청사 없음)`. 정우전설 **426건**, 에스제이이 **110건**, `(원청사 없음)` **1건**.
타이핑으로 검색되고, X로 지우면 전체로 돌아온다.

- [ ] **Step 6: 페이지 리셋·합계 표시**

1. 3페이지로 이동 → 아무 필터를 바꾼다 → **1페이지로 돌아온다**
2. 필터를 걸면 푸터에 "합계 (N건) / 전체 564건"이 뜬다
3. 필터를 다 풀면 "/ 전체 564건"이 사라진다
4. 금액기준을 토글하면 세 금액 컬럼이 **같이** 전환된다(하도적용↔공급가) — 기존 캐시 버그 회귀 확인

- [ ] **Step 7: 조합 확인**

`2026년 + 진행전 + 정우전설`을 걸고 건수가 각 단독 필터보다 작거나 같은지 본다. 결과 0건이면 "조건에 맞는 공사가 없습니다."가 뜬다.

- [ ] **Step 8: 도넛 회귀 확인 (Task 1의 리팩터 대상)**

`/` (대시보드) 열기
Expected: 유형별 도넛이 이전과 똑같이 그려지고, 연도 드롭다운·조각 클릭 팝업이 동작한다. 라벨은 여전히 '미진행'(수주대장만 '진행전').

- [ ] **Step 9: 검증 결과를 PROGRESS.md에 기록하고 커밋**

`PROGRESS.md`에 이번 작업 항목을 레포 기존 형식에 맞춰 추가한다(피드백 출처·판정 규칙 변경·실측 건수). 그리고:

```bash
git add PROGRESS.md
git commit -m "docs(progress): 수주대장 조회 필터 고도화 실화면 검증 기록"
```

---

## 완료 조건

- [ ] `npm test` 전부 통과 (`수주분류.test.ts`·`filters.test.ts` 포함)
- [ ] `npx tsc --noEmit` 에러 0
- [ ] `npm run lint` 에러 0
- [ ] Task 6의 실측 숫자가 전부 일치 (상태 202/104/258, 민수 18)
- [ ] 도넛이 회귀 없이 동작
- [ ] PR 생성 (main 대상)

## 이 플랜이 건드리지 않는 것

- 작업구분 폼 입력 → 별도 플랜 `2026-07-29-orders-work-type-field.md`
- 거래처 중복(`에스제이이`/`에스제이이2`) 정리
- 관급 2건을 민수로 데이터 정정 (필터가 병합하므로 조회에 지장 없음)
- 도넛의 '미진행' 라벨 변경 (사장님 컨펌 대기 중)
