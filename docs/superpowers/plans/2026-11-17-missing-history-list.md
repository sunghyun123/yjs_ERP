# 미입력 목록 + 재적재 스크립트 은퇴 (PR-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 준공된 공사마다 "작업일지로 아직 안 채운 공사이력 금액"을 공사이력 페이지의 새 탭 '미입력'에 읽기 전용으로 보여준다. 공사이력을 통째로 지우고 다시 적재하던 스크립트(`migrate-공사이력.ts`)는 삭제한다.

**Architecture:** 계산은 순수 함수 하나(`progress/_lib/미입력.ts`의 `build미입력목록`)에 모으고, 공사이력 페이지(`progress/page.tsx`)가 `tab=missing`일 때만 수주·공사이력·기성을 읽어 그 함수에 넘긴다. 화면(`미입력목록.tsx`)은 서버 컴포넌트이고 행마다 `/progress?수주_id=…` 링크만 단다(그 링크는 이미 입력 탭에서 그 공사를 골라 연다). 목표 금액은 **하도 기준 준공액**(준공액 × (1−보험료율) × 하도전용율)이다. 공사이력 성과가 원래 그 기준으로 입력되기 때문이다(`progress/_lib/percent.ts`). DB에 쓰는 코드는 0줄이다.

**Tech Stack:** TypeScript · Next.js 16 (App Router, 서버 컴포넌트) · Supabase(PostgREST, anon key + 세션 → RLS) · vitest

**진행 문서 (먼저 읽기):** `docs/superpowers/specs/2026-11-17-revenue-simplification-roadmap.md` — 세션 규칙 블록, §3-2·§3-3·§3-4, §7-B. 끝나면 §5·§6을 갱신한다.

**티어:** A (회계 정합성 — 매출 정의의 기준 금액을 정한다). 게이트 3~5는 Task 6.

---

## 게이트 1 결정 (2026-11-17)

| 질문 | 고른 안 | 근거 |
|---|---|---|
| 선결 — "다 입력했다"의 기준 | **(Y) 하도 기준 준공액** | (X) 준공액 전체는 작업일지대로 100% 입력해도 공사마다 ~21%가 영원히 남는다. 0으로 만들려면 달성률 127%로 넘치게 입력해야 한다(2026-07-08의 127.19% 사고). 단점(조성현): PR-C에서 보정을 끄면 매출이 구조적 몫 **약 3.5억** 줄어든다 → PR-C 전에 사장님 확인 필요(아래 '넘길 것') |
| ① 목록 위치 | **(a) 공사이력 페이지 새 탭 '미입력'** | 목록의 사용자는 입력하는 사람이다. 행을 누르면 그 공사가 선택된 입력 화면이 바로 열린다 |
| ② 준공 전 기성만 있는 공사 | **(b) 별도 칸 '기성만 있음'** (기성 누계는 참고, 남은 금액 합계에 안 넣음) | 매출에서 빠져 있는 건 같고, 작업일지를 넘길 때 한 번에 입력한다. 준공액이 없어 남은 금액은 정의하지 않는다 |
| ③ 음수(입력 초과) | **(a) '입력 초과' 칸으로 따로, 상계하지 않음** | 상계하면 오입력이 미입력을 지워 진척이 좋아 보인다. 단점(조성현): 초과분이 남는다 → 지금은 음수 잔여가 오입력분을 상쇄하고 있지만, 보정을 끄면 그 초과분(Y 기준 1.14억)이 매출에 그대로 남아 부풀려진다. 그래서 **PR-C를 켜는 조건은 '남은 금액 ≈ 0' 그리고 '입력 초과 ≈ 0'** |
| ④ `migrate-공사이력.ts` | **(a) 삭제** + 메모리 절차 문구 정리 + 로컬 실행 허용 줄 제거 | 이미 통째로 주석 처리된 보관본이고 원본 엑셀도 레포 밖에 있다. 근거용 코드는 git 이력에 남는다 |

**Claude가 정한 것 (이의 있으면 구현 세션 시작 때 말할 것):**
- 준공일 또는 준공액이 빈 준공 공사(구ERP 이관 77건, 이력 0행)는 목표를 정의할 수 없어 목록에서 뺀다. 대신 요약 줄에 **"준공일·준공액이 비어 빠진 준공 공사 N건"**을 찍는다. 빠졌다는 흔적 없이 사라지면 조용한 절단이 되기 때문이다.
- |남은 금액| < 1,000원은 '다 입력함'으로 보고 목록에 안 띄우고, 요약에 건수만 적는다(원 단위 반올림 잔차).
- 목표 계산은 `calc하도적용표시금액`(요율이 없으면 그 요율만 빼고 계산하는 쪽)을 쓴다. 엄격판(`calc하도적용금액`)은 요율이 하나라도 없으면 `null`이라 '0/1'·'null/null' 공사 4건이 목록에서 조용히 빠진다.
- 정렬: '남은 금액'과 '입력 초과'는 준공일 오름차순(작업일지를 넘기는 순서). '기성만 있음'은 지중no 순.

---

## 실측 근거 (2026-11-17 운영 DB, select만 사용)

- 공사이력 583행(준공정산 행 0), 수주 663, 기성 233행.
- 준공 370건 = 준공일·준공액 있음 **293** + 빈 칸 **77**.
- **(Y) 하도 기준:** 남은 금액 **224건 951,123,117원**(이력 0행 167건 781,915,437 / 이력 있음 57건 169,207,680) · 준공연도별 2025: 264,365,416 / 2026: 686,757,701 · |잔| < 1천원 22건 · 입력 초과 **47건 −113,646,776원**.
  - 초과 상위: JY26-012 −3,078만(누계/목표 148.6%, 이력 14행) · SG25-029 −1,749만(424%) · SG25-025 −1,726만(361%) · JG26-014 −955만(120%).
  - 초과의 두 모양: ㉠ 준공액이 수주보다 크게 줄어든 공사(SG25-029 준공액/수주 21%, JY25-244 30%, JY26-022 9%) — 이력은 수주 기준으로 맞게 들어갔는데 준공 때 감액됨 ㉡ 이력 1행에 100%를 크게 넘게 들어간 공사(JY25-183 546%, JY26-022 1,066%) — 오입력으로 추정. 둘 다 정정은 데이터 작업이고 이 PR의 코드 범위가 아니다.
- (X) 참고 — 준공액 전체 기준: 잔여 268건 1,335,472,918원 · 음수 21건 −61,705,769원.
- 구조적 몫 Σ(준공액 − 하도 기준 준공액), 준공 293건: **351,062,664원** = PR-C에서 매출에서 빠질 크기의 근사치.
- 준공 전 기성만 있고 이력 0행: **19건, 기성 246,933,983원**(7/31의 143건 중 148건은 그사이 준공돼 '남은 금액' 쪽으로 넘어갔다).

> 숫자는 입력이 진행되면 바뀐다. 구현 세션의 Task 5 검증은 그날 다시 측정한 값과 화면을 대조한다(스크립트: Task 5 Step 1).

---

## 파일 구조

| 파일 | 할 일 |
|---|---|
| Create `src/app/(dashboard)/progress/_lib/미입력.ts` | 순수 함수 `build미입력목록` + 행 타입 + 읽기 함수 `load미입력재료` |
| Create `src/app/(dashboard)/progress/_lib/미입력.test.ts` | 분류·경계·정렬·제외 건수 테스트 |
| Create `src/app/(dashboard)/progress/_components/미입력목록.tsx` | 서버 컴포넌트. 요약 줄 + 표 3개 |
| Modify `src/app/(dashboard)/progress/page.tsx` | 탭 '미입력' 추가, `tab=missing`일 때만 읽기 |
| Delete `scripts/migrate-공사이력.ts` | 재적재 스크립트 은퇴(§3-4) |
| (레포 밖) 메모리 `seonggwa-source-of-truth.md`, 로컬 `.claude/settings.local.json` | 절차 문구 정리, 실행 허용 2줄 제거. 커밋 대상 아님 |

`_lib/junggong-seonggwa.ts`의 `load성과재료`는 재사용하지 않는다. PR-C에서 그 모듈을 지우거나 줄이므로, 미입력 목록이 거기에 기대면 PR-C의 삭제 범위가 늘어난다. `build이력누계`도 같은 이유로 쓰지 않는다(세 줄짜리 합계라 복사 비용이 작다).

---

### Task 1: 분류 함수 `build미입력목록` (TDD)

**Files:**
- Create: `src/app/(dashboard)/progress/_lib/미입력.ts`
- Test: `src/app/(dashboard)/progress/_lib/미입력.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { build미입력목록, type 미입력수주Row } from './미입력'

const 수주 = (over: Partial<미입력수주Row> & { id: number }): 미입력수주Row => ({
  지중no: `JG26-${String(over.id).padStart(3, '0')}`,
  공사명: '테스트 공사',
  준공여부: true,
  준공일: '2026-03-15',
  준공액_공급가: 10_000_000,
  보험료율: 0.075,
  하도전용율: 0.85,
  ...over,
})
// 하도 기준 목표 = 10,000,000 × 0.925 × 0.85 = 7,862,500
const 목표 = 7_862_500

describe('build미입력목록', () => {
  it('목표는 하도 기준 준공액, 남은 금액 = 목표 − 공사이력 누계', () => {
    const r = build미입력목록(
      [수주({ id: 1 })],
      [{ 수주_id: 1, 성과금액: 2_000_000 }, { 수주_id: 1, 성과금액: null }],
      [],
    )
    expect(r.남은).toHaveLength(1)
    expect(r.남은[0]).toMatchObject({ 수주_id: 1, 목표, 누계: 2_000_000, 이력수: 2, 금액: 목표 - 2_000_000 })
    expect(r.남은합).toBe(목표 - 2_000_000)
  })

  it('이력이 0행인 준공 공사는 목표 전액이 남는다', () => {
    const r = build미입력목록([수주({ id: 1 })], [], [])
    expect(r.남은[0]).toMatchObject({ 누계: 0, 이력수: 0, 금액: 목표 })
  })

  it('누계가 목표를 넘으면 남은 금액이 아니라 입력 초과로 가고, 서로 상계하지 않는다', () => {
    const r = build미입력목록(
      [수주({ id: 1 }), 수주({ id: 2 })],
      [{ 수주_id: 1, 성과금액: 목표 + 500_000 }],
      [],
    )
    expect(r.초과.map(x => x.수주_id)).toEqual([1])
    expect(r.초과[0].금액).toBe(-500_000)
    expect(r.초과합).toBe(-500_000)
    expect(r.남은합).toBe(목표) // 2번 공사만. 1번의 초과가 깎지 않는다
  })

  it('|남은 금액| < 1,000원은 다 입력한 것으로 보고 건수만 센다', () => {
    const r = build미입력목록(
      [수주({ id: 1 }), 수주({ id: 2 })],
      [{ 수주_id: 1, 성과금액: 목표 - 999 }, { 수주_id: 2, 성과금액: 목표 + 999 }],
      [],
    )
    expect(r.남은).toHaveLength(0)
    expect(r.초과).toHaveLength(0)
    expect(r.완료수).toBe(2)
  })

  it('요율이 비어 있으면 그 요율만 빼고 계산한다(공사가 조용히 빠지지 않게)', () => {
    const r = build미입력목록([수주({ id: 1, 보험료율: null, 하도전용율: null })], [], [])
    expect(r.남은[0].목표).toBe(10_000_000)
  })

  it('준공일 또는 준공액이 빈 준공 공사는 목록에서 빼고 제외 건수로 센다', () => {
    const r = build미입력목록(
      [수주({ id: 1, 준공일: null }), 수주({ id: 2, 준공액_공급가: null }), 수주({ id: 3 })],
      [],
      [],
    )
    expect(r.남은.map(x => x.수주_id)).toEqual([3])
    expect(r.제외수).toBe(2)
  })

  it('준공 전 공사: 기성이 있고 이력이 0행이면 기성만 있음에 들어간다. 남은 합계에는 안 들어간다', () => {
    const r = build미입력목록(
      [
        수주({ id: 1, 준공여부: false, 준공일: null, 준공액_공급가: null }),
        수주({ id: 2, 준공여부: false, 준공일: null, 준공액_공급가: null }), // 기성 있고 이력 있음 → 제외
        수주({ id: 3, 준공여부: false, 준공일: null, 준공액_공급가: null }), // 기성 없음 → 제외
      ],
      [{ 수주_id: 2, 성과금액: 100 }],
      [{ 수주_id: 1, 기성액_공급가: 300 }, { 수주_id: 1, 기성액_공급가: 200 }, { 수주_id: 2, 기성액_공급가: 50 }],
    )
    expect(r.기성만).toEqual([{ 수주_id: 1, 지중no: 'JG26-001', 공사명: '테스트 공사', 기성누계: 500 }])
    expect(r.남은합).toBe(0)
    expect(r.제외수).toBe(0) // 제외수는 '준공인데 빈 칸'만 센다
  })

  it('남은·초과는 준공일 오름차순, 기성만은 지중no 순', () => {
    const r = build미입력목록(
      [
        수주({ id: 1, 준공일: '2026-05-01' }),
        수주({ id: 2, 준공일: '2025-12-01' }),
        수주({ id: 4, 지중no: 'JY26-002', 준공여부: false, 준공일: null, 준공액_공급가: null }),
        수주({ id: 3, 지중no: 'JY26-001', 준공여부: false, 준공일: null, 준공액_공급가: null }),
      ],
      [],
      [{ 수주_id: 3, 기성액_공급가: 1 }, { 수주_id: 4, 기성액_공급가: 1 }],
    )
    expect(r.남은.map(x => x.수주_id)).toEqual([2, 1])
    expect(r.기성만.map(x => x.지중no)).toEqual(['JY26-001', 'JY26-002'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/progress/_lib/미입력.test.ts"`
Expected: FAIL — `Failed to resolve import "./미입력"`

- [ ] **Step 3: 구현**

```ts
/**
 * 미입력 목록 — 준공된 공사마다 작업일지로 아직 안 채운 공사이력 금액 (2026-11-17 PR-B)
 *
 * 목표(다 입력했을 때의 누계) = 하도 기준 준공액 = 준공액_공급가 × (1−보험료율) × 하도전용율.
 * 왜 준공액 전체가 아닌가: 공사이력 성과는 원래 하도적용금액 기준으로 입력된다(percent.ts).
 *   준공액 전체를 목표로 잡으면 작업일지대로 100% 입력해도 ~21%가 영원히 남고, 0으로 만들려면
 *   달성률 127%로 넘치게 입력해야 한다(2026-07-08 127.19% 사고와 같은 원인).
 *
 * 남은 금액과 입력 초과는 상계하지 않는다. 상계하면 오입력이 미입력을 지워서 진척이 좋아 보이고,
 * 준공 보정을 끄는 순간(PR-C) 초과분이 매출에 그대로 남는다. PR-C 조건 = 두 합계가 모두 0 근처.
 *
 * DB에 쓰지 않는다. 읽기 전용 파생.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { calc하도적용표시금액 } from '@/app/(dashboard)/orders/_lib/completion'

export type 미입력수주Row = {
  id: number
  지중no: string
  공사명: string
  준공여부: boolean
  준공일: string | null
  준공액_공급가: number | null
  보험료율: number | null
  하도전용율: number | null
}

export type 이력금액Row = { 수주_id: number; 성과금액: number | null }
export type 기성금액Row = { 수주_id: number; 기성액_공급가: number | null }

export type 미입력행 = {
  수주_id: number
  지중no: string
  공사명: string
  준공일: string
  /** 하도 기준 준공액 */
  목표: number
  누계: number
  이력수: number
  /** 목표 − 누계. 남은 칸은 양수, 초과 칸은 음수 */
  금액: number
}

export type 기성만행 = { 수주_id: number; 지중no: string; 공사명: string; 기성누계: number }

export type 미입력목록 = {
  남은: 미입력행[]
  초과: 미입력행[]
  기성만: 기성만행[]
  남은합: number
  초과합: number
  /** |목표 − 누계| < 1,000원 — 다 입력한 준공 공사 */
  완료수: number
  /** 준공인데 준공일 또는 준공액이 비어 목표를 못 정한 건(구ERP 이관분). 조용히 사라지지 않게 센다 */
  제외수: number
}

/** 원 단위 반올림 잔차를 '다 입력함'으로 보는 폭 */
const 완료폭 = 1_000

export function build미입력목록(
  수주목록: 미입력수주Row[],
  이력: 이력금액Row[],
  기성: 기성금액Row[],
): 미입력목록 {
  const 누계 = new Map<number, number>()
  const 이력수 = new Map<number, number>()
  for (const r of 이력) {
    누계.set(r.수주_id, (누계.get(r.수주_id) ?? 0) + (r.성과금액 ?? 0))
    이력수.set(r.수주_id, (이력수.get(r.수주_id) ?? 0) + 1)
  }
  const 기성누계 = new Map<number, number>()
  for (const g of 기성) 기성누계.set(g.수주_id, (기성누계.get(g.수주_id) ?? 0) + (g.기성액_공급가 ?? 0))

  const 남은: 미입력행[] = []
  const 초과: 미입력행[] = []
  const 기성만: 기성만행[] = []
  let 완료수 = 0
  let 제외수 = 0

  for (const o of 수주목록) {
    if (!o.준공여부) {
      // 준공 전: 준공액이 없어 남은 금액을 정의할 수 없다. 기성은 있는데 이력이 0행인 것만 참고로 띄운다.
      const g = 기성누계.get(o.id) ?? 0
      if (g > 0 && !이력수.has(o.id)) 기성만.push({ 수주_id: o.id, 지중no: o.지중no, 공사명: o.공사명, 기성누계: g })
      continue
    }
    if (!o.준공일 || o.준공액_공급가 == null) {
      제외수++
      continue
    }
    const 목표 = calc하도적용표시금액(o.준공액_공급가, o.보험료율, o.하도전용율)
    const 합 = 누계.get(o.id) ?? 0
    const 행: 미입력행 = {
      수주_id: o.id,
      지중no: o.지중no,
      공사명: o.공사명,
      준공일: o.준공일,
      목표,
      누계: 합,
      이력수: 이력수.get(o.id) ?? 0,
      금액: 목표 - 합,
    }
    if (Math.abs(행.금액) < 완료폭) 완료수++
    else if (행.금액 > 0) 남은.push(행)
    else 초과.push(행)
  }

  // 날짜는 'YYYY-MM-DD' 문자열 비교 — new Date()를 거치지 않는다(서버 시계 UTC 문제 회피)
  const 준공일순 = (a: 미입력행, b: 미입력행) => a.준공일.localeCompare(b.준공일) || a.지중no.localeCompare(b.지중no)
  남은.sort(준공일순)
  초과.sort(준공일순)
  기성만.sort((a, b) => a.지중no.localeCompare(b.지중no))

  return {
    남은,
    초과,
    기성만,
    남은합: 남은.reduce((s, r) => s + r.금액, 0),
    초과합: 초과.reduce((s, r) => s + r.금액, 0),
    완료수,
    제외수,
  }
}
```

(`load미입력재료`는 Task 2에서 같은 파일에 추가한다. import 세 줄 중 `SupabaseClient`·`Database`·`fetchAllRows`는 그때 쓰이므로, Task 1만 끝낸 시점에 lint가 미사용 import를 지적하면 Task 2까지 한 번에 진행한다.)

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/progress/_lib/미입력.test.ts"`
Expected: PASS (8 tests)

---

### Task 2: 읽기 함수 `load미입력재료`

**Files:**
- Modify: `src/app/(dashboard)/progress/_lib/미입력.ts` (파일 끝에 추가)

- [ ] **Step 1: 구현**

```ts
/**
 * 미입력 목록 재료를 읽는다. 세 표 모두 fetchAllRows — 1000행 캡에 조용히 잘리면
 * 누계가 모자라 '남은 금액'이 부풀고, 그 숫자로 입력 진척을 판단하게 된다.
 * 준공정산 행은 2026-07-08에 없앴지만 load성과재료와 같은 방어 필터를 둔다.
 *
 * RLS: 서버 클라이언트(anon key + 세션). 화이트리스트 밖이면 에러 없이 빈 배열이 오므로
 * 수주 0행은 실패로 본다(빈 목록을 '다 입력함'으로 보이게 하지 않는다).
 */
export async function load미입력재료(
  supabase: SupabaseClient<Database>,
): Promise<{ 수주: 미입력수주Row[]; 이력: 이력금액Row[]; 기성: 기성금액Row[] }> {
  const [수주, 이력, 기성] = await Promise.all([
    fetchAllRows('수주', (from, to) =>
      supabase
        .from('수주')
        .select('id, 지중no, 공사명, 준공여부, 준공일, 준공액_공급가, 보험료율, 하도전용율')
        .order('id')
        .range(from, to),
    ),
    fetchAllRows('공사이력', (from, to) =>
      supabase.from('공사이력').select('수주_id, 성과금액').eq('준공정산', false).order('id').range(from, to),
    ),
    fetchAllRows('기성', (from, to) =>
      supabase.from('기성').select('수주_id, 기성액_공급가').order('id').range(from, to),
    ),
  ])
  if (수주.length === 0) throw new Error('수주 조회 결과가 0행입니다(권한 또는 연결 문제). 빈 목록을 정상처럼 보여주지 않으려고 중단합니다.')
  return {
    수주: 수주 as unknown as 미입력수주Row[],
    이력: 이력 as unknown as 이력금액Row[],
    기성: 기성 as unknown as 기성금액Row[],
  }
}
```

⚠️ `as unknown as`가 있으므로 select 문자열과 타입의 칸 이름은 tsc가 대조하지 않는다. 칸을 고칠 땐 두 곳을 손으로 맞춘다.

- [ ] **Step 2: 타입·테스트 확인**

Run: `npx tsc --noEmit -p . && npx vitest run "src/app/(dashboard)/progress/_lib/미입력.test.ts"`
Expected: 타입 에러 0, PASS

---

### Task 3: 화면 `미입력목록.tsx`

**Files:**
- Create: `src/app/(dashboard)/progress/_components/미입력목록.tsx`

- [ ] **Step 1: 구현** (서버 컴포넌트 — 클릭은 `Link`뿐이라 `'use client'` 불필요)

```tsx
import Link from 'next/link'
import { formatEok, formatKRW, formatPercent } from '@/lib/format'
import type { 미입력목록 as 목록, 미입력행 } from '../_lib/미입력'

function 입력링크(수주_id: number) {
  // 입력 탭(기본 탭)이 이 공사를 골라 연다 — page.tsx의 default수주Id
  return `/progress?수주_id=${수주_id}`
}

function 이력표({ rows, 금액머리 }: { rows: 미입력행[]; 금액머리: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">지중No</th>
            <th className="px-3 py-2 text-left">공사명</th>
            <th className="px-3 py-2 text-left">준공일</th>
            <th className="px-3 py-2 text-right">목표(하도 기준)</th>
            <th className="px-3 py-2 text-right">이력 누계</th>
            <th className="px-3 py-2 text-right">이력 행</th>
            <th className="px-3 py-2 text-right">{금액머리}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.수주_id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2">
                <Link href={입력링크(r.수주_id)} className="text-blue-600 hover:underline">{r.지중no}</Link>
              </td>
              <td className="px-3 py-2">{r.공사명}</td>
              <td className="px-3 py-2">{r.준공일}</td>
              <td className="px-3 py-2 text-right">{formatKRW(r.목표)}</td>
              <td className="px-3 py-2 text-right">
                {formatKRW(r.누계)}
                {r.목표 > 0 && <span className="ml-1 text-gray-400">({formatPercent((r.누계 / r.목표) * 100)})</span>}
              </td>
              <td className="px-3 py-2 text-right">{r.이력수}</td>
              <td className="px-3 py-2 text-right font-medium">{formatKRW(r.금액)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function 미입력목록({ data }: { data: 목록 }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 space-y-1">
        <p>
          남은 입력 금액 <b>{formatEok(data.남은합)}</b> ({data.남은.length}건) · 입력 초과{' '}
          <b className="text-red-600">{formatEok(data.초과합)}</b> ({data.초과.length}건) · 다 입력함 {data.완료수}건
        </p>
        <p className="text-gray-500">
          목표 = 준공액 × (1 − 보험료율) × 하도전용율. 입력 초과는 남은 금액과 상계하지 않습니다.
          {data.제외수 > 0 && ` 준공일·준공액이 비어 빠진 준공 공사 ${data.제외수}건.`}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">남은 입력 ({data.남은.length}건)</h2>
        {data.남은.length > 0 ? <이력표 rows={data.남은} 금액머리="남은 금액" /> : <p className="text-sm text-gray-500">없음</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">입력 초과 ({data.초과.length}건)</h2>
        <p className="text-sm text-gray-500">이력 누계가 목표보다 큽니다. 준공액이 줄었거나 이력이 잘못 들어간 경우입니다.</p>
        {data.초과.length > 0 ? <이력표 rows={data.초과} 금액머리="초과 금액" /> : <p className="text-sm text-gray-500">없음</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">기성만 있음 — 준공 전 ({data.기성만.length}건)</h2>
        <p className="text-sm text-gray-500">기성은 있는데 공사이력이 한 줄도 없는 공사입니다. 기성 누계는 참고값이고 위 합계에 들어가지 않습니다.</p>
        {data.기성만.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">지중No</th>
                  <th className="px-3 py-2 text-left">공사명</th>
                  <th className="px-3 py-2 text-right">기성 누계(참고)</th>
                </tr>
              </thead>
              <tbody>
                {data.기성만.map(r => (
                  <tr key={r.수주_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={입력링크(r.수주_id)} className="text-blue-600 hover:underline">{r.지중no}</Link>
                    </td>
                    <td className="px-3 py-2">{r.공사명}</td>
                    <td className="px-3 py-2 text-right">{formatKRW(r.기성누계)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">없음</p>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit -p .`
Expected: 에러 0

---

### Task 4: 공사이력 페이지에 탭 연결

**Files:**
- Modify: `src/app/(dashboard)/progress/page.tsx`

- [ ] **Step 1: import 추가** (파일 위쪽 import 묶음 끝)

```tsx
import { 미입력목록 } from './_components/미입력목록'
import { build미입력목록, load미입력재료 } from './_lib/미입력'
```

- [ ] **Step 2: 탭 판정을 세 갈래로** — 지금 `입력` 링크의 활성 조건은 `tab !== 'history'`라서 `missing`일 때 입력 탭도 켜진다. 활성 조건을 명시적으로 바꾼다.

`<div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">` 블록을 아래로 교체:

```tsx
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'input', href: '/progress', label: '입력' },
          { key: 'history', href: historyHref, label: '현황' },
          { key: 'missing', href: '/progress?tab=missing', label: '미입력' },
        ].map(t => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              활성탭 === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
```

그리고 `const tab = params.tab ?? 'input'` 바로 아래에:

```tsx
  // 모르는 tab 값은 입력 탭으로 본다(기존 동작과 같음)
  const 활성탭 = tab === 'history' || tab === 'missing' ? tab : 'input'
```

- [ ] **Step 3: 미입력 탭일 때만 읽기** — `const historyHref = …` 줄 아래에:

```tsx
  // 미입력 탭에서만 수주·공사이력·기성 전체를 읽는다(다른 탭 진입 비용을 늘리지 않으려고)
  let 미입력: ReturnType<typeof build미입력목록> | null = null
  if (활성탭 === 'missing') {
    const 재료 = await load미입력재료(supabase)
    미입력 = build미입력목록(재료.수주, 재료.이력, 재료.기성)
  }
```

- [ ] **Step 4: 렌더 분기 교체** — `{tab === 'history' ? (…) : (…)}` 블록을 아래로:

```tsx
      {활성탭 === 'missing' && 미입력 ? (
        <미입력목록 data={미입력} />
      ) : 활성탭 === 'history' ? (
        <ProgressHistoryTable date_from={date_from} date_to={date_to} 공무담당자목록={공무담당자목록} />
      ) : (
        <ProgressInputForm
          수주목록={수주목록}
          공무담당자목록={공무담당자목록}
          default수주Id={params.수주_id && Number.isFinite(Number(params.수주_id)) ? Number(params.수주_id) : null}
          default날짜={params.날짜 && dateRe.test(params.날짜) ? params.날짜 : null}
        />
      )}
```

`load미입력재료`가 throw하면 `(dashboard)` 레이아웃의 에러 화면으로 간다 — 빈 목록을 '다 입력함'처럼 보여주는 것보다 낫다(조용한 절단 처방).

- [ ] **Step 5: 확인**

Run: `npx tsc --noEmit -p . && npm run lint && npm test`
Expected: 전부 통과

- [ ] **Step 6: 커밋 ①** — 메시지는 조성현이 쓴다. 대상: `미입력.ts`, `미입력.test.ts`, `미입력목록.tsx`, `progress/page.tsx`

---

### Task 5: 브라우저·실측 대조

- [ ] **Step 1: 그날 운영 DB 값 다시 측정 (select만)** — 이 계획을 쓸 때 쓴 스크립트와 같은 식을 scratchpad에 두고 돌린다. 기대값의 출처는 화면이 아니라 이 스크립트다(같은 함수를 두 번 부르는 대조는 함수의 옳음을 검사하지 못한다 — 그래서 스크립트는 `build미입력목록`을 import하지 않고 독립적으로 쓴다).

```js
// scratchpad/measure-pr-b.cjs — node measure-pr-b.cjs <repo 경로>
const path = require('path'); const repo = process.argv[2]
const { createClient } = require(path.join(repo, 'node_modules/@supabase/supabase-js'))
require(path.join(repo, 'node_modules/dotenv')).config({ path: path.join(repo, '.env.local'), quiet: true })
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function all(t, c, f = q => q) { const o = []; for (let i = 0; ; i += 1000) { const { data, error } = await f(sb.from(t).select(c)).order('id').range(i, i + 999); if (error) throw error; o.push(...data); if (data.length < 1000) return o } }
;(async () => {
  const 수주 = await all('수주', 'id,준공여부,준공일,준공액_공급가,보험료율,하도전용율')
  const 이력 = await all('공사이력', '수주_id,성과금액', q => q.eq('준공정산', false))
  const 기성 = await all('기성', '수주_id,기성액_공급가')
  const 누 = new Map(), n = new Map(), g = new Map()
  for (const r of 이력) { 누.set(r.수주_id, (누.get(r.수주_id) ?? 0) + (r.성과금액 ?? 0)); n.set(r.수주_id, 1) }
  for (const r of 기성) g.set(r.수주_id, (g.get(r.수주_id) ?? 0) + (r.기성액_공급가 ?? 0))
  let 남=0,남합=0,초=0,초합=0,완=0,제=0,기=0
  for (const o of 수주) {
    if (!o.준공여부) { if ((g.get(o.id) ?? 0) > 0 && !n.has(o.id)) 기++; continue }
    if (!o.준공일 || o.준공액_공급가 == null) { 제++; continue }
    let t = o.준공액_공급가; if (o.보험료율 != null) t *= 1 - o.보험료율; if (o.하도전용율 != null) t *= o.하도전용율
    const d = t - (누.get(o.id) ?? 0)
    if (Math.abs(d) < 1000) 완++; else if (d > 0) { 남++; 남합 += d } else { 초++; 초합 += d }
  }
  console.log({ 남, 남합: Math.round(남합), 초, 초합: Math.round(초합), 완, 제, 기 })
})()
```

Expected (2026-11-17 기준, 입력이 진행됐으면 달라짐): `남 224, 남합 ≈ 951,123,117, 초 47, 초합 ≈ −113,646,776, 완 22, 제 77, 기 19`

- [ ] **Step 2: 로컬 화면** — `npm run dev` → 로그인 → `/progress?tab=missing`
  - 요약 줄의 건수·합계가 Step 1과 같은지(억 단위 표시 반올림 차이만 허용)
  - 탭 세 개의 활성 표시가 각각 맞는지(미입력일 때 입력 탭이 켜지지 않는지)
  - 남은 목록 첫 행 지중No 클릭 → 입력 탭에 그 공사가 선택돼 열리는지
  - 입력 초과 칸에 JY26-012·SG25-029가 있는지

---

### Task 6: 재적재 스크립트 은퇴 + 게이트 3~5 + 문서

**Files:**
- Delete: `scripts/migrate-공사이력.ts`

- [ ] **Step 1: 삭제** — `git rm "scripts/migrate-공사이력.ts"`. 다른 참조가 없는지 확인:

Run: `git grep -n "migrate-공사이력" -- . ":!docs"`
Expected: 출력 없음

- [ ] **Step 2: 레포 밖 정리 (커밋 대상 아님)**
  - 메모리 `seonggwa-source-of-truth.md`: "재적재가 필요하면: 전체 삭제 후 `migrate-공사이력.ts` 단독 재실행" 문장을 지우고, 스크립트가 2026-11-17 PR-B에서 삭제됐다고 적는다(맨 아래 '재적재 절차 은퇴' 단락과 합친다).
  - `.claude/settings.local.json`의 `migrate-공사이력.ts` 실행 허용 2줄 제거(추적되지 않는 로컬 파일).

- [ ] **Step 3: 커밋 ②** — 메시지는 조성현이 쓴다. 대상: 스크립트 삭제만(기능 커밋과 분리 — 되돌릴 때 따로 되돌릴 수 있게)

- [ ] **Step 4: 게이트 3** — 리뷰 관점: 1000행 캡(세 표 모두 fetchAllRows인지), RLS 0행 처리(수주 0행 throw), 탭 활성 조건, 목표 계산이 `percent.ts`의 기준과 같은지, 링크가 입력 탭으로 가는지, `as unknown as` 칸 이름 대조.

- [ ] **Step 5: 게이트 4 (질문 1~2개, 보강 로그 바닥 개념으로)** — 후보:
  - [조용한 절단·RLS] 화이트리스트 밖 사람이 이 탭을 열면 `load미입력재료`에서 무엇이 오고, 수주 0행 가드가 없다면 화면에 뭐가 보이나(응답 모양 + 화면 묘사를 1차 답에 붙이는지).
  - [같은 원본을 읽는 두 기록] Task 5의 대조(스크립트 vs 화면)가 보장하는 것과 못 잡는 것 — 두 쪽이 공유하는 것(원본 표·목표 공식)과 다른 것(코드)을 나눠서.

- [ ] **Step 6: 진행 문서 갱신** — §5 PR-B 기획·구현 행, §6 PR-B 구현 결정, §7-C에 아래 '넘길 것' 반영 확인 → **커밋 ③**(진행 문서 + 이 계획 문서. PR-A 배포 확인분 §5 수정도 이 커밋에 함께). `docs/공사이력카드 자동화/`는 넣지 않는다.

- [ ] **Step 7: 푸시 → PR → 머지, 세션 보고서** (세션 규칙 4). 운영 배포는 조성현이 따로 한다. 배포 뒤 확인: 운영 `/progress?tab=missing` 요약 줄 = Task 5 Step 1을 배포일에 다시 돌린 값.

---

## PR-C로 넘길 것 (진행 문서 §7-C에 추가)

1. **매출 정의 변경 사장님 확인 (PR-C 전 필수):** 보정을 끄면 준공 공사의 매출이 준공액 전체가 아니라 하도 기준이 된다. 구조적 몫 약 3.51억(준공 293건, 2025·2026에 나뉨)이 빠진다. §3-3의 "매출 총액은 변하지 않는다"는 미입력분에만 맞고 이 몫에는 거짓이다. 확인 문장 초안: "준공한 공사도 진행 중인 공사와 같은 기준(하도 적용)으로 매출을 세면, 2025·2026년 매출이 합쳐서 약 3.5억 줄어듭니다."
2. **끄는 조건:** 미입력 목록의 '남은 금액' ≈ 0 **그리고** '입력 초과' ≈ 0. 초과가 남은 채로 끄면 오입력분이 매출에 남는다.
3. 입력 초과 47건 정정은 데이터 작업(조성현) — 준공액 감액형(㉠)과 오입력형(㉡)을 나눠서 본다.
