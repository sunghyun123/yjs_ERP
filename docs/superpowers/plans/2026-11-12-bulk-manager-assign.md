# PR-1.5 공사 단위 일괄 담당 지정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공무 화면 미지정 팝업에서 여러 공사를 체크해 담당 한 명을 한 번에 지정(시공·정산 모두)하고, 방금 지정한 것을 되돌릴 수 있게 한다 — 1~8월 미지정 298행을 행 단위 298번 저장 없이 채우기 위해.

**Architecture:** 쓰기는 새 파일 `gongmu/_lib/일괄지정.ts` 한 곳 — 한 문장 `.update().in('id', ids).is(칸, null).select('id')`로 쓰고, 돌아온 id 수를 요청 id 수와 비교해 성공/0행/부분을 가른다(기존 `update-공사이력.ts`의 "기대한 행 수만큼 정확히 돌아와야 성공" 판정의 여러 행판). 화면은 새 클라이언트 컴포넌트 `BulkAssignPanel.tsx`를 `ActualsSheet`의 미지정 보기에 시공·정산 두 개 꽂는다. 공무 집계(`erp-실적.ts`)는 바꾸지 않는다 — 팝업 목록은 이미 받은 `묶음.행`/`묶음.정산.행`을 공사별로 다시 묶을 뿐.

**Tech Stack:** Next.js 16 (App Router, 클라이언트 컴포넌트) · supabase-js(anon + 세션, RLS `is_whitelisted()`) · vitest

**티어:** A (데이터 정합성 + RLS 쓰기 경로). 구현 세션에서 게이트 3(리뷰)·4(이해)·5(커밋) 진행.

---

## 0. 실측 (2026-11-12, 운영 DB 읽기 전용 — service_role 스크립트, 쓰기 없음)

**PR-1 운영 확인:** 조성현 확인 완료 — 정상 (1월 311,383천원·1주차 1/1~1/4·◀ 꺼짐 / 금요일 표 1~8월 / 9월 250,773·10월 494,834 유지).

**시공 미지정 (1~8월 = 2026-01-01 ≤ 작업일자 < 2026-08-31, 준공정산=false)**
- **298행 · 공사 134개** (설계 문서의 297은 1행 차 — 천원 반올림 0인 행 1건으로 추정, 미확정)
- 공사당 미지정 행: **1행 94개** · 2행 16 · 3행 9 · 4행 4 · 5~8행 7 · 10행 이상 4 (최대 TY25-004 30행, 1~7월)
  → 공사 하나씩 저장하면 134번 — 줄어드는 폭이 작다. **여러 공사를 한 번에** 지정해야 한다(Q1 B)
- 달력월 기준 여러 달에 걸친 공사 25개 (→ Q2 가: 달마다 다시 지정)
- 이미 지정된 행이 섞인 공사 18개 — **전부 담당 한 명**(두 명 이상 0개). 1~8월 안에서 섞인 공사 15개
  → 한 공사 안에서 담당이 갈리는 사례가 없어 '행 체크박스'(Q1 C)의 유연성은 불필요
- 1~8월 밖에도 미지정이 있는 공사 12개(12행). 전 기간 미지정 327행 = 2025-10~12월 22행 + 1~8월 298 + 2026-11월 2 (+ 나머지)
- 준공정산=true 이면서 담당 null: 0행
- 자동 채움 근거 없음: `수주.공무담당자_id`는 지정된 이력과 142건 일치·0건 불일치(정확)지만 미지정 공사 134개 중 2개에만 있음. `수주.정산담당자_id`는 이력 담당과 141건 다름(시공 ≠ 정산 사람)

**정산 미지정 (16행 · 공사 12개)**
- 이력 행이 아니라 **`수주.정산담당자_id`가 null인 공사**의 계산서: 1~8월 기성 7행(공사 4) + 준공 9건
- 수주 전체 662개 중 정산담당 null 25개
- 칸이 **공사 단위 하나**라 '이 달만 지정'이 성립하지 않는다 — 지정하면 그 공사의 모든 달(과 앞으로의) 정산이 그 사람 몫이 된다. 2026-10-29 결정("정산 담당은 수주 한 곳에서")의 정의 그대로라 문제 아님. 화면에 명시한다

**쓰기 권한:** `수주`·`공사이력` 모두 `20260622090100_rls_whitelist_policies.sql`의 `is_whitelisted()` update 정책(관리자 전용 아님). 막히면 에러가 아니라 `200 + []`(0행).

**담당의 정의:** 바뀌지 않음 — 시공 = 이력 행마다 `공사이력.담당공무_id`, 정산 = `수주.정산담당자_id`. 이번 PR은 같은 칸에 여러 행을 한 번에 쓸 뿐이라 PR-2 설계 재검토 불필요.

---

## 1. 게이트 1 결정 (2026-11-12, 조성현)

| 질문 | 결정 | 근거 / 기각 |
|---|---|---|
| Q1 지정 단위 | **B. 공사 체크박스 여러 개 + 담당 하나 → 저장 한 번** (공사 안의 행은 통째) | 저장 횟수가 적다(약 '달 수 × 담당자 수' ≈ 30번). 기각 A(공사마다 버튼 = 134번), C(행 체크박스 — 한 공사 안 담당 갈림 0건이라 불필요, 298개 체크) |
| Q2 범위 | **가. 지금 보는 달(주 기준 기간) 화면에 보이는 미지정만** | 바뀌는 행 = 보이는 행 → 기대 행 수를 화면에서 정할 수 있다(정합성). 대가: 여러 달 공사 25개는 달마다 다시. 기각 나(전 기간 — 화면에 없는 2025-11·2026-11 행까지 바뀌고, 기대 수를 알려면 쓰기 전 재조회 → 조회와 쓰기 사이 틈). **정산은 예외**: 칸이 공사 단위라 '이 달만'이 없다(§0) |
| Q3 쓰기·판정 | **a. 한 문장 `.in('id', ids).is(칸, null).select('id')`, 성공 = 돌아온 수 === 요청 수** | 빈 칸만 채우므로(`is null`) 기존 담당을 덮어쓰지 않는다 = 데이터 보존. ⚠️ 원자성은 '문장이 반쯤 실행되는 것'만 막는다 — 그 사이 누가 일부를 지정했으면 나머지만 **정상 커밋**된다(롤백 아님) → `partial`로 "N중 M행만" 경고 + 새로고침. 해롭지 않다(빈 칸만 채웠으므로). 0행 = RLS 또는 전부 이미 지정 → `not-updated`. 기각 b(RPC로 raise 롤백 — 마이그레이션·SQL 함수 신설, 부분 반영이 무해해 과잉), c(행마다 반복 — 297번을 화면 뒤로 옮긴 것, 중간 끊김 시 부분 반영) |
| Q4 화면 | **공무 미지정 카드 팝업(`ActualsSheet`) 안, 공사 묶음마다 체크박스 + 위쪽에 '담당 선택 + [N개 공사 · M행 지정]' 바. 행마다 있던 `AssignRow`는 없앤다** | 지정하는 길이 둘이면 판정 코드도 두 벌. 미지정 보기는 주별 행 목록 → **그 달의 공사별 목록**으로 바뀐다(여러 주에 걸친 공사가 주마다 따로 체크되면 헷갈림). 날짜는 공사 줄 아래에 모아 적는다 |
| Q5 되돌리기 | **(i) 저장 직후 [되돌리기] — 돌아온 id만, `.in('id', 돌아온ids).eq(칸, 방금값)`으로 null** | Q1 B는 체크 실수 한 번에 여러 공사가 틀린다 → 되돌릴 길이 필요. 돌아온 id만 되돌리므로 그 사이 남이 지정한 행은 안 건드리고, `eq(칸, 방금값)`이라 그 뒤 다른 사람으로 바뀐 행도 안 건드린다. 그 뒤로는 기존 길(시공: 진행 페이지 이력 수정 시트 / 정산: 수주대장 정산 담당) |
| 정산 포함 | **포함** (조성현) — 같은 패널을 `수주.정산담당자_id`에 쓴다 | 기존 안내("수주대장에서 지정하세요")는 지운다 |

**알려진 위험 (이번 PR에서 안 고침):** `OrderForm` 저장은 폼 전체 덮어쓰기(`정산담당자_id: values.정산담당자_id ?? null`, `OrderForm.tsx:335`). 수주대장 폼을 일괄 지정 **전에** 열어 두고 **후에** 저장하면 정산 담당이 null로 되돌아간다(조용히). 기존 전 칸 공통 문제라 범위 밖 — 일괄 지정 중엔 수주대장 폼을 열어 두지 않는다. 반대 방향(일괄 지정이 폼 값을 덮어씀)은 `is null` 조건 때문에 없다.

---

## 2. 파일 구조

| 파일 | 책임 |
|---|---|
| Create `src/app/(dashboard)/gongmu/_lib/일괄지정.ts` | 쓰기 4개(시공 지정/되돌리기, 정산 지정/되돌리기) + 판정 + 메시지 + 팝업 목록용 순수 함수 2개 |
| Create `src/app/(dashboard)/gongmu/_lib/일괄지정.test.ts` | 위 전부 (가짜 supabase 체인) |
| Create `src/app/(dashboard)/gongmu/_components/BulkAssignPanel.tsx` | 체크박스 목록 + 담당 선택 + 저장/되돌리기 바 (시공·정산 공용) |
| Modify `src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx` | 미지정 보기에 패널 두 개, `AssignRow`·정산 안내문 삭제 |
| Modify `src/app/(dashboard)/progress/_lib/update-공사이력.ts:1-10` | 머리 주석에 두 번째 쓰기 통로(일괄지정.ts) 명시 |
| Modify `docs/superpowers/specs/2026-11-12-dashboard-yearly-plan-actual-design.md` §6 | Q4 결정 한 줄 (기획 세션에서 이미 추가됨) |

`erp-실적.ts`·`page.tsx`는 바꾸지 않는다.

---

### Task 0: 브랜치

- [ ] `git switch -c feat/bulk-manager-assign` (main에서). 작업 트리의 `AGENTS.md`·`docs/공사이력카드 자동화/` 변경은 이 PR과 무관 — 커밋에 넣지 않는다.

---

### Task 1: 판정과 시공 일괄 지정

**Files:** Create `src/app/(dashboard)/gongmu/_lib/일괄지정.ts`, `src/app/(dashboard)/gongmu/_lib/일괄지정.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/app/(dashboard)/gongmu/_lib/일괄지정.test.ts
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { 시공담당지정, 시공담당되돌리기, 정산담당지정, 정산담당되돌리기, 일괄결과메시지 } from './일괄지정'

type 호출 = { table?: string; update?: unknown; in?: [string, unknown]; is?: [string, unknown]; eq?: [string, unknown]; select?: string }

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: 호출 = {}
  let 요청수 = 0
  const chain = {
    update(p: unknown) { calls.update = p; return chain },
    in(c: string, v: unknown) { calls.in = [c, v]; return chain },
    is(c: string, v: unknown) { calls.is = [c, v]; return chain },
    eq(c: string, v: unknown) { calls.eq = [c, v]; return chain },
    select(s: string) { calls.select = s; return Promise.resolve(result) },
  }
  const client = { from(t: string) { 요청수++; calls.table = t; return chain } } as unknown as SupabaseClient<Database>
  return { client, calls, 요청수: () => 요청수 }
}

describe('시공담당지정', () => {
  it('요청한 수만큼 돌아오면 성공 — 담당 칸 하나만, 빈 칸에만 쓴다', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }, { id: 2 }], error: null })
    await expect(시공담당지정(client, [1, 2], 9)).resolves.toEqual({ ok: true, ids: [1, 2] })
    expect(calls).toEqual({
      table: '공사이력', update: { 담당공무_id: 9 }, in: ['id', [1, 2]], is: ['담당공무_id', null], select: 'id',
    })
  })
  it('중복 id는 한 번만 보낸다 — 안 그러면 기대 수가 부풀어 성공이 partial로 오진된다', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }, { id: 2 }], error: null })
    await expect(시공담당지정(client, [1, 2, 2], 9)).resolves.toEqual({ ok: true, ids: [1, 2] })
    expect(calls.in).toEqual(['id', [1, 2]])
  })
  it('일부만 돌아오면 partial — 나머지는 이미 커밋됐으므로 돌아온 id를 들고 간다(되돌리기용)', async () => {
    const { client } = fakeClient({ data: [{ id: 1 }], error: null })
    await expect(시공담당지정(client, [1, 2, 3], 9)).resolves.toEqual({ ok: false, reason: 'partial', ids: [1], 기대: 3 })
  })
  it('0행이면 not-updated — RLS에 막히면 에러가 아니라 200 + []로 온다', async () => {
    const { client } = fakeClient({ data: [], error: null })
    await expect(시공담당지정(client, [1, 2], 9)).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('data가 null이어도 not-updated', async () => {
    const { client } = fakeClient({ data: null, error: null })
    await expect(시공담당지정(client, [1], 9)).resolves.toEqual({ ok: false, reason: 'not-updated' })
  })
  it('에러면 error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    await expect(시공담당지정(client, [1], 9)).resolves.toEqual({ ok: false, reason: 'error' })
  })
  it('빈 목록이면 요청 없이 성공 — 0행을 "권한 없음"으로 오진하지 않는다', async () => {
    const { client, 요청수 } = fakeClient({ data: [], error: null })
    await expect(시공담당지정(client, [], 9)).resolves.toEqual({ ok: true, ids: [] })
    expect(요청수()).toBe(0)
  })
})

describe('시공담당되돌리기', () => {
  it('방금 값인 행만 null로 — 그 사이 다른 사람으로 바뀐 행은 건드리지 않는다', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }, { id: 2 }], error: null })
    await expect(시공담당되돌리기(client, [1, 2], 9)).resolves.toEqual({ ok: true, ids: [1, 2] })
    expect(calls).toEqual({
      table: '공사이력', update: { 담당공무_id: null }, in: ['id', [1, 2]], eq: ['담당공무_id', 9], select: 'id',
    })
  })
})

describe('정산담당지정 / 되돌리기 — 수주 칸', () => {
  it('지정: 수주.정산담당자_id 빈 칸에만', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 30 }], error: null })
    await expect(정산담당지정(client, [30], 8)).resolves.toEqual({ ok: true, ids: [30] })
    expect(calls).toEqual({
      table: '수주', update: { 정산담당자_id: 8 }, in: ['id', [30]], is: ['정산담당자_id', null], select: 'id',
    })
  })
  it('되돌리기: 방금 값인 수주만 null로', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 30 }], error: null })
    await expect(정산담당되돌리기(client, [30], 8)).resolves.toEqual({ ok: true, ids: [30] })
    expect(calls).toEqual({
      table: '수주', update: { 정산담당자_id: null }, in: ['id', [30]], eq: ['정산담당자_id', 8], select: 'id',
    })
  })
})

describe('일괄결과메시지', () => {
  it('partial은 몇 중 몇인지 말한다', () => {
    expect(일괄결과메시지({ ok: false, reason: 'partial', ids: [1], 기대: 3 }))
      .toBe('3건 중 1건만 지정됐습니다. 나머지는 그 사이 다른 담당이 지정됐거나 권한이 없습니다. 목록을 새로 읽었습니다.')
  })
  it('not-updated / error', () => {
    expect(일괄결과메시지({ ok: false, reason: 'not-updated' })).toBe('지정되지 않았습니다 (권한이 없거나 이미 지정된 항목).')
    expect(일괄결과메시지({ ok: false, reason: 'error' })).toBe('저장에 실패했습니다.')
  })
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run "src/app/(dashboard)/gongmu/_lib/일괄지정.test.ts"` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
// src/app/(dashboard)/gongmu/_lib/일괄지정.ts
/**
 * 담당 일괄 지정 (PR-1.5, 2026-11-12) — 공무 미지정 팝업에서 여러 공사를 한 번에.
 * 시공 = 공사이력.담당공무_id(이력 행마다), 정산 = 수주.정산담당자_id(공사마다). 담당의 정의는 그대로다.
 *
 * ⚠️ 한 문장 `.in('id', ids)`로 쓴다 — 문장이 반쯤 실행되는 일은 없다(원자성). 그러나 `.is(칸, null)` 조건에
 *    안 걸린 행(그 사이 남이 지정)은 빠진 채 나머지가 정상 커밋된다 = 롤백이 아니다. 그래서 돌아온 id 수를
 *    요청 수와 비교해 'partial'로 알린다. 빈 칸만 채우므로 부분 반영이 기존 담당을 지우지는 않는다.
 * ⚠️ RLS(is_whitelisted)에 막히면 에러가 아니라 200 + []다 — .select('id')로 바뀐 행을 돌려받아야 잡힌다
 *    (update-공사이력.ts와 같은 판정, 기대 수가 1이 아니라 N).
 * 클라이언트는 호출부가 넘긴다 — 테스트에서 가짜를 꽂으려는 것.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type 일괄결과 =
  | { ok: true; ids: number[] }
  | { ok: false; reason: 'error' }
  | { ok: false; reason: 'not-updated' }
  /** 일부만 커밋됨 — ids는 실제로 바뀐 행(되돌리기 대상) */
  | { ok: false; reason: 'partial'; ids: number[]; 기대: number }

type 결과 = { data: { id: number }[] | null; error: unknown }
type 클라 = SupabaseClient<Database>

function 정리(ids: number[]): number[] {
  return [...new Set(ids)]
}

function 판정({ data, error }: 결과, 요청: number[], 작업: string): 일괄결과 {
  if (error) {
    // 사용자에겐 "실패"만 보이므로 원인은 콘솔에 남긴다
    console.error(`[일괄 ${작업} 실패]`, { 요청, error })
    return { ok: false, reason: 'error' }
  }
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length === 0) return { ok: false, reason: 'not-updated' }
  if (ids.length !== 요청.length) return { ok: false, reason: 'partial', ids, 기대: 요청.length }
  return { ok: true, ids }
}

export async function 시공담당지정(sb: 클라, 이력ids: number[], 담당공무_id: number): Promise<일괄결과> {
  const 요청 = 정리(이력ids)
  // 보낼 게 없으면 0행이 돌아와 "권한 없음"으로 오진된다 — 요청 없이 성공
  if (요청.length === 0) return { ok: true, ids: [] }
  const res = await sb.from('공사이력').update({ 담당공무_id }).in('id', 요청).is('담당공무_id', null).select('id')
  return 판정(res, 요청, '시공 담당 지정')
}

export async function 시공담당되돌리기(sb: 클라, 이력ids: number[], 담당공무_id: number): Promise<일괄결과> {
  const 요청 = 정리(이력ids)
  if (요청.length === 0) return { ok: true, ids: [] }
  // eq(방금값): 그 사이 다른 사람으로 바뀐 행은 되돌리지 않는다
  const res = await sb.from('공사이력').update({ 담당공무_id: null }).in('id', 요청).eq('담당공무_id', 담당공무_id).select('id')
  return 판정(res, 요청, '시공 담당 되돌리기')
}

export async function 정산담당지정(sb: 클라, 수주ids: number[], 정산담당자_id: number): Promise<일괄결과> {
  const 요청 = 정리(수주ids)
  if (요청.length === 0) return { ok: true, ids: [] }
  // 공사 단위 칸 — 이 공사의 모든 달 정산이 이 사람 몫이 된다(화면에 명시)
  const res = await sb.from('수주').update({ 정산담당자_id }).in('id', 요청).is('정산담당자_id', null).select('id')
  return 판정(res, 요청, '정산 담당 지정')
}

export async function 정산담당되돌리기(sb: 클라, 수주ids: number[], 정산담당자_id: number): Promise<일괄결과> {
  const 요청 = 정리(수주ids)
  if (요청.length === 0) return { ok: true, ids: [] }
  const res = await sb.from('수주').update({ 정산담당자_id: null }).in('id', 요청).eq('정산담당자_id', 정산담당자_id).select('id')
  return 판정(res, 요청, '정산 담당 되돌리기')
}

export function 일괄결과메시지(r: Exclude<일괄결과, { ok: true }>): string {
  if (r.reason === 'partial') {
    return `${r.기대}건 중 ${r.ids.length}건만 지정됐습니다. 나머지는 그 사이 다른 담당이 지정됐거나 권한이 없습니다. 목록을 새로 읽었습니다.`
  }
  return r.reason === 'not-updated' ? '지정되지 않았습니다 (권한이 없거나 이미 지정된 항목).' : '저장에 실패했습니다.'
}
```

> 되돌리기의 partial 메시지도 같은 함수를 쓴다(문구 "지정됐습니다"는 되돌리기에선 패널이 앞에 "되돌리기:"를 붙인다 — Task 3).

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS. `npx tsc --noEmit`도 통과(`.in`/`.is`/`.eq`의 칸 이름이 `Database` 타입과 맞는지 — 여기선 캐스트가 없어 tsc가 실제로 검사한다).

---

### Task 2: 팝업 목록용 순수 함수

**Files:** Modify `일괄지정.ts`, `일괄지정.test.ts`

- [ ] **Step 1: 실패하는 테스트** (파일 끝에 추가)

```ts
import { 시공미지정공사목록, 정산미지정공사목록 } from './일괄지정'
import type { 실적행, 정산행 } from './erp-실적'

const 행 = (id: number, 수주_id: number, 작업일자: string, 천원: number): 실적행 => ({
  id, 수주_id, 작업일자, 성과금액: 천원 * 1000, 담당공무_id: null, 지중no: `J${수주_id}`, 공사명: `공사${수주_id}`,
  천원, 월요일: '2026-01-05',
})

describe('시공미지정공사목록', () => {
  it('그 달의 미지정 행을 주를 가리지 않고 공사별로 — 이력 id 전부, 날짜는 중복 없이', () => {
    const 목록 = 시공미지정공사목록([
      행(1, 10, '2026-01-02', 100), 행(2, 20, '2026-01-06', 50), 행(3, 10, '2026-01-20', 30), 행(4, 10, '2026-01-20', 5),
    ])
    expect(목록).toEqual([
      { 수주_id: 10, 지중no: 'J10', 공사명: '공사10', 천원: 135, 날짜들: ['2026-01-02', '2026-01-20'], ids: [1, 3, 4] },
      { 수주_id: 20, 지중no: 'J20', 공사명: '공사20', 천원: 50, 날짜들: ['2026-01-06'], ids: [2] },
    ])
  })
})

const 정 = (수주_id: number, 구분: string, 날짜: string, 금액천원: number): 정산행 => ({
  수주_id, 지중no: `J${수주_id}`, 공사명: `공사${수주_id}`, 구분, 일: Number(날짜.slice(8)), 날짜, 금액천원,
  담당공무_id: null, 담당: '', 월요일: '2026-01-05',
})

describe('정산미지정공사목록', () => {
  it('계산서를 공사별로 — ids는 수주 id 하나, 구분은 모아 적는다', () => {
    expect(정산미지정공사목록([정(30, '기성 1차', '2026-01-09', 200), 정(30, '준공', '2026-01-23', -20), 정(40, '기성', '2026-01-12', 70)]))
      .toEqual([
        { 수주_id: 30, 지중no: 'J30', 공사명: '공사30', 천원: 180, 날짜들: ['2026-01-09', '2026-01-23'], 구분들: ['기성 1차', '준공'], ids: [30] },
        { 수주_id: 40, 지중no: 'J40', 공사명: '공사40', 천원: 70, 날짜들: ['2026-01-12'], 구분들: ['기성'], ids: [40] },
      ])
  })
})
```

> `정산행` = `월정산내역Row & {월요일}`(`monthly-split.ts:31-47`, 2026-11-12 확인). 캐스트 없이 적어 tsc가 칸 누락을 잡게 둔다.

- [ ] **Step 2: FAIL 확인** (함수 없음)

- [ ] **Step 3: 구현** (`일괄지정.ts` 끝에 추가)

```ts
import { 공사별로묶기, type 실적행, type 정산행 } from './erp-실적'

/** 팝업의 한 줄 = 공사 하나. ids = 저장할 때 보낼 id(시공: 이력 id들 / 정산: 수주 id 하나) */
export type 지정항목 = {
  수주_id: number
  지중no: string
  공사명: string
  천원: number
  날짜들: string[]
  구분들?: string[]
  ids: number[]
}

/**
 * 미지정 묶음의 행(= 지금 보는 달의 주 기준 기간 안, 화면에 보이는 그 행들)을 공사별로.
 * Q2 가: 저장 대상은 이 목록의 ids뿐 — 다른 달의 미지정 행은 보내지 않는다.
 */
export function 시공미지정공사목록(행들: 실적행[]): 지정항목[] {
  // 주 단위가 아니라 달 전체를 한 번에 묶는다 — 여러 주에 걸친 공사를 주마다 따로 체크하게 하지 않으려고
  return 공사별로묶기(행들).map((g) => ({
    수주_id: g.수주_id, 지중no: g.지중no, 공사명: g.공사명, 천원: g.천원, 날짜들: g.날짜들, ids: g.행.map((r) => r.id),
  }))
}

/** 정산은 칸이 수주에 있으므로 ids = [수주_id] — 지정하면 그 공사의 모든 달 정산에 적용된다 */
export function 정산미지정공사목록(행들: 정산행[]): 지정항목[] {
  const m = new Map<number, 지정항목>()
  for (const r of 행들) {
    let g = m.get(r.수주_id)
    if (!g) {
      g = { 수주_id: r.수주_id, 지중no: r.지중no, 공사명: r.공사명, 천원: 0, 날짜들: [], 구분들: [], ids: [r.수주_id] }
      m.set(r.수주_id, g)
    }
    g.천원 += r.금액천원
    if (!g.날짜들.includes(r.날짜)) g.날짜들.push(r.날짜)
    if (!g.구분들!.includes(r.구분)) g.구분들!.push(r.구분)
  }
  for (const g of m.values()) g.날짜들.sort()
  return [...m.values()]
}
```

> `erp-실적.ts`는 `일괄지정.ts`를 import하지 않으므로 순환 없음. `공사별로묶기`는 값 import(함수) — 문제 없음.

- [ ] **Step 4: PASS 확인** — `npx vitest run "src/app/(dashboard)/gongmu"`

---

### Task 3: `BulkAssignPanel.tsx`

**Files:** Create `src/app/(dashboard)/gongmu/_components/BulkAssignPanel.tsx`

(컴포넌트 테스트 환경 없음 — vitest는 `*.test.ts`만. 동작은 Task 1·2의 함수가 지고, 패널은 그것을 부르는 얇은 층으로 둔다. 확인은 Task 5 브라우저.)

- [ ] **Step 1: 구현**

```tsx
// src/app/(dashboard)/gongmu/_components/BulkAssignPanel.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 일괄결과메시지, type 일괄결과, type 지정항목 } from '../_lib/일괄지정'
import type { 담당자 } from '../_lib/erp-실적'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type 쓰기 = (sb: SupabaseClient<Database>, ids: number[], 담당id: number) => Promise<일괄결과>

const 천원표기 = (n: number) => `${n.toLocaleString('ko-KR')}천원`
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

export function BulkAssignPanel({
  제목, 안내, 항목들, 담당자목록, 지정, 되돌리기, 단위,
}: {
  제목: string
  /** 정산: "이 공사의 모든 달 정산에 적용" 같은 범위 설명 */
  안내?: string
  항목들: 지정항목[]
  담당자목록: 담당자[]
  지정: 쓰기
  되돌리기: 쓰기
  /** 버튼 문구의 행 단위 — 시공 '행', 정산은 공사 단위라 표시 안 함 */
  단위: '행' | null
}) {
  const router = useRouter()
  const [선택, set선택] = useState<Set<number>>(new Set())
  const [담당id, set담당id] = useState<number | null>(null)
  const [저장중, set저장중] = useState(false)
  const [에러, set에러] = useState<string | null>(null)
  // 방금 지정한 것 — 새로고침으로 목록에서 사라져도 되돌릴 수 있게 id와 값을 들고 있는다(Q5)
  const [직전, set직전] = useState<{ ids: number[]; 담당id: number; 공사수: number } | null>(null)

  // 새로고침 뒤 목록에서 사라진 공사는 선택에서도 뺀다 — 숨은 선택이 다음 저장에 섞이지 않게(파생)
  const 보이는선택 = 항목들.filter((h) => 선택.has(h.수주_id))
  const 보낼ids = 보이는선택.flatMap((h) => h.ids)
  const 이름 = (id: number) => 담당자목록.find((d) => d.id === id)?.이름 ?? `#${id}`

  const 토글 = (수주_id: number) => set선택((s) => {
    const n = new Set(s)
    if (n.has(수주_id)) n.delete(수주_id)
    else n.add(수주_id)
    return n
  })
  const 전체토글 = () => set선택(보이는선택.length === 항목들.length ? new Set() : new Set(항목들.map((h) => h.수주_id)))

  const 실행 = async (작업: () => Promise<일괄결과>, 접두: string, 성공시: (r: 일괄결과) => void) => {
    set저장중(true)
    set에러(null)
    try {
      const r = await 작업()
      if (!r.ok) set에러(접두 + 일괄결과메시지(r))
      성공시(r)
    } catch (e) {
      console.error('[gongmu] 일괄 지정 실패', e)
      set에러(접두 + '저장에 실패했습니다.')
    } finally {
      set저장중(false)
      // 성공·부분·실패 모두 새로 읽는다 — 부분 반영이면 화면이 DB와 다르다
      router.refresh()
    }
  }

  const save = () => {
    if (담당id == null || 보낼ids.length === 0) return
    const 값 = 담당id
    const 공사수 = 보이는선택.length
    return 실행(() => 지정(createClient(), 보낼ids, 값), '', (r) => {
      // partial도 커밋된 행이 있으므로 되돌리기 대상으로 남긴다
      if (r.ok || r.reason === 'partial') { set직전({ ids: r.ids, 담당id: 값, 공사수 }); set선택(new Set()) }
    })
  }

  const undo = () => {
    if (!직전) return
    const d = 직전
    return 실행(() => 되돌리기(createClient(), d.ids, d.담당id), '되돌리기: ', (r) => {
      if (r.ok) set직전(null)
    })
  }

  if (항목들.length === 0 && !직전) return null

  return (
    <section className="space-y-2">
      <div className="flex justify-between items-baseline border-b border-gray-200 pb-1">
        <h3 className="text-sm font-semibold text-[#1e2d5a]">{제목}</h3>
        {항목들.length > 0 && (
          <button type="button" className="text-xs text-blue-600" onClick={전체토글}>
            {보이는선택.length === 항목들.length ? '전체 해제' : '전체 선택'}
          </button>
        )}
      </div>
      {안내 && <p className="text-xs text-amber-700">{안내}</p>}

      {항목들.length > 0 && (
        <div className="flex gap-2 sticky top-0 bg-background py-1">
          <select
            className="h-8 flex-1 rounded-lg border border-input bg-background text-xs px-2"
            value={담당id ?? ''}
            onChange={(e) => set담당id(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">담당 선택</option>
            {담당자목록.map((g) => <option key={g.id} value={g.id}>{g.이름}</option>)}
          </select>
          <Button size="sm" className="h-8 bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={save}
            disabled={담당id == null || 보낼ids.length === 0 || 저장중}>
            {저장중 ? <Loader2 className="size-3.5 animate-spin" />
              : `${보이는선택.length}개 공사${단위 ? ` · ${보낼ids.length}${단위}` : ''} 지정`}
          </Button>
        </div>
      )}

      {직전 && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
          <span>{이름(직전.담당id)}에게 {직전.공사수}개 공사{단위 ? ` · ${직전.ids.length}${단위}` : ''} 지정됨</span>
          <Button size="sm" variant="outline" className="h-7" onClick={undo} disabled={저장중}>되돌리기</Button>
        </div>
      )}
      {에러 && <p className="text-xs text-red-600">{에러}</p>}

      <ul className="space-y-1.5">
        {항목들.map((h) => (
          <li key={h.수주_id}>
            <label className={cn('flex gap-2 items-start rounded-lg px-2 py-1.5 text-sm cursor-pointer',
              선택.has(h.수주_id) && 'bg-blue-50')}>
              <input type="checkbox" className="mt-1" checked={선택.has(h.수주_id)} onChange={() => 토글(h.수주_id)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 truncate">{h.공사명}</p>
                <p className="text-xs text-gray-400">
                  <span className="font-mono">{h.지중no}</span>
                  {h.구분들 && <> · {h.구분들.join(', ')}</>} · {h.날짜들.map(md).join(', ')}
                  {단위 && <> · {h.ids.length}{단위}</>}
                </p>
              </div>
              <span className={cn('shrink-0 font-semibold tabular-nums', h.천원 < 0 ? 'text-red-600' : 'text-gray-800')}>
                {천원표기(h.천원)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

결정 근거(주석으로 남긴 것 외):
- 선택은 `Set<수주_id>`(원본), 보낼 id는 렌더 중 파생 — effect 동기화 없음
- 새로고침은 `finally`에서 항상 — partial·실패에도 화면을 DB에 맞춘다
- 되돌리기 대상은 **돌아온 ids**(요청 ids 아님) — 안 바뀐 행을 되돌리려 하지 않는다
- 패널 state는 `router.refresh()` 뒤에도 유지된다(클라이언트 컴포넌트는 다시 마운트되지 않음) → 되돌리기 바가 남는다. ⚠️ `ActualsSheet`에서 이 패널에 `key`를 항목에 따라 바꾸지 말 것(바꾸면 state가 사라져 되돌리기 바도 사라진다)

- [ ] **Step 2:** `npx tsc --noEmit` · `npx eslint "src/app/(dashboard)/gongmu"` 통과

---

### Task 4: `ActualsSheet` 미지정 보기 교체

**Files:** Modify `src/app/(dashboard)/gongmu/_components/ActualsSheet.tsx`

- [ ] **Step 1:** `AssignRow` 함수와 그 import(`useState`, `useRouter`, `Loader2`, `createClient`, `Button`, `update공사이력`, `저장실패메시지`)를 지운다. 남는 용도가 있으면 유지(`Link`·`cn` 등 확인).
- [ ] **Step 2:** import 추가

```tsx
import { BulkAssignPanel } from './BulkAssignPanel'
import {
  시공담당지정, 시공담당되돌리기, 정산담당지정, 정산담당되돌리기, 시공미지정공사목록, 정산미지정공사목록,
} from '../_lib/일괄지정'
```

- [ ] **Step 3:** 본문 `<div className="px-4 pb-6 space-y-5">` 안에서 미지정일 때는 주별 목록·정산 섹션 대신 패널 둘을 그린다. 주별 목록(`주순서.map`)과 정산 섹션은 `묶음.종류 !== '미지정'`일 때만.

```tsx
{묶음?.종류 === '미지정' ? (
  <>
    <BulkAssignPanel
      제목="시공 — 담당 미지정 공사"
      항목들={시공미지정공사목록(묶음.행)}
      담당자목록={담당자목록}
      지정={시공담당지정}
      되돌리기={시공담당되돌리기}
      단위="행"
    />
    <BulkAssignPanel
      제목="정산 (계산서) — 정산 담당 미지정 공사"
      안내="정산 담당은 공사마다 하나라, 지정하면 이 공사의 모든 달 정산(앞으로의 기성 포함)에 적용됩니다."
      항목들={정산미지정공사목록(묶음.정산.행)}
      담당자목록={담당자목록}
      지정={정산담당지정}
      되돌리기={정산담당되돌리기}
      단위={null}
    />
  </>
) : (
  <>{/* 기존 주순서.map(...) + 정산 섹션 + 구 양식 링크 — 그대로, 단 미지정 분기 코드(행마다 AssignRow, 정산 안내문)는 삭제 */}</>
)}
```

- 빈 상태 문구 "미지정 이력이 없습니다 ✓"는 그대로 둔다(두 패널 모두 `null`을 돌려줄 때 보인다 — 조건 `묶음.건수 === 0 && 묶음.정산.건수 === 0`가 이미 그 경우). ⚠️ 단, 방금 지정해 목록이 비었는데 되돌리기 바가 남아 있는 경우 ✓문구와 되돌리기 바가 함께 보인다 — 의도대로(지정이 끝났다는 뜻이 맞다).
- 머리말 `SheetDescription`의 "M월 누적 시공 …"은 그대로.

- [ ] **Step 4:** `update-공사이력.ts` 머리 주석 첫 줄 아래에 한 줄 추가:
  ` * (여러 행 한 번에: gongmu/_lib/일괄지정.ts — 같은 판정을 기대 수 N으로)`
- [ ] **Step 5:** `npx vitest run` · `npx tsc --noEmit` · `npm run lint` · `npm run build` 모두 통과

---

### Task 5: 브라우저 확인 (로컬 `npm run dev` — ⚠️ 로컬도 운영 Supabase에 쓴다)

실제 데이터가 바뀌므로 **조성현이 직접** 담당을 아는 공사 1개로만 한다.

- [ ] `/gongmu?month=2026-01` → 미지정 카드 → 팝업이 공사별 목록 + 체크박스로 보이는지, 행 수 합 = 카드 건수
- [ ] 공사 1개 체크 + 담당 선택 → 버튼 문구 "1개 공사 · N행 지정" → 저장 → 목록에서 사라지고 그 담당자 카드 금액이 그만큼 늘어나는지(검산식: 담당 합 + 미지정 = 월 누적 그대로)
- [ ] [되돌리기] → 다시 미지정에 나타나는지 → 다시 지정(최종 상태)
- [ ] 정산 패널: 정산 미지정이 있는 달(실측 기준 1~8월 중)에서 안내문 확인, 지정 → 수주대장에서 그 공사의 '정산 담당'이 바뀌었는지
- [ ] 읽기 스크립트로 DB 대조: 지정한 이력 id들의 `담당공무_id`가 그 값인지, 같은 공사의 **다른 달** 미지정 행은 그대로 null인지(Q2 가 확인)

---

### Task 6: 문서·커밋·PR (구현 세션)

- [ ] 이 계획 문서 + 설계 문서 §6 Q4 줄을 같은 커밋에(기획 세션에서 편집만 해 둠)
- [ ] 게이트 3 리뷰 → 게이트 4 질문(1~2개, 아래 후보) → 게이트 5 커밋 메시지는 조성현이 작성
- [ ] PR 생성 → 머지 → 배포(조성현 수동) → 운영에서 Task 5 첫 항목만 다시 확인
- [ ] 세션 보고서(§7) + 다음 세션(PR-2 기획) 프롬프트

**게이트 4 질문 후보 (바닥 개념):**
1. (트랜잭션) "`.in('id', [1,2,3]).is('담당공무_id', null)` 한 문장인데 1행만 돌아왔다. 2·3번 행은 DB에서 어떤 상태고, 1번 행은 커밋됐나 롤백됐나? 원자성이 이 경우에 막아준 것과 못 막은 것은?"
2. (RLS 침묵) "화이트리스트 밖 사람이 유효한 세션으로 이 버튼을 누르면 응답(상태코드 + 본문 한 줄)은? `판정()`의 어느 줄이 그걸 잡고, 그 줄이 없으면 화면엔 뭐가 뜨나?"
3. (되돌리기 범위) "되돌리기를 `.in('id', 요청ids)`로 썼다면 무엇이 잘못 되돌려지나?"

---

## Self-review

- 게이트 1 Q1~Q5 + 정산 포함 → Task 1(쓰기·판정·되돌리기), 2(공사 단위 목록, 달 범위), 3·4(체크박스 UI, AssignRow 삭제), 5(Q2 가의 DB 대조) ✓
- 원칙: 바뀐 칸만(`update({담당공무_id})` / `update({정산담당자_id})`) ✓ · 판정 = 기대 수 일치 ✓ · `erp-실적.ts` 무변경(import만) ✓
- 타입 이름 일관: `일괄결과`·`지정항목`·`시공담당지정`·`정산미지정공사목록` — Task 1~4 동일 ✓
