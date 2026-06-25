# Navigation-Resilient Workspace — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 페이지를 이동해도 두 입력 폼(투입실적 입력·공사이력 입력)이 "어떤 공사·어떤 날짜를 작업 중이었는지"(신원)를 잃지 않게 한다.

**Architecture:** `(dashboard)/layout.tsx`에 클라이언트 `WorkspaceProvider`를 끼운다. 레이아웃은 형제 라우트 이동 시 언마운트되지 않으므로, 그 안의 Context 상태가 네비게이션을 가로질러 생존한다. 각 폼은 자기 키(`inputForm`/`progressForm`)의 슬라이스만 읽고 쓴다. 상태는 sessionStorage에 미러링해 탭 새로고침에도 생존한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, vitest.

**Scope (중요):** 이 슬라이스는 **신원만 보존**한다 — InputForm: `{선택수주, 검색어, 투입일}`, ProgressInputForm: `{선택수주Id, 작업일자}`. 투입구분 수량·외주·성과금액 같은 **미저장 입력값 보존은 비범위**(별도 슬라이스). 이유: InputForm은 `(수주, 투입일)`로 기존 실적을 자동조회해 수량/외주를 채우는 effect가 있어, 미저장 값까지 보존하면 복귀 시 자동조회가 덮어쓰는 충돌이 난다. 신원만 보존하면 자동조회가 나머지를 DB에서 재구성하므로 충돌이 없다.

---

## File Structure

- Create: `src/app/(dashboard)/_lib/workspace-storage.ts` — sessionStorage 직렬화 순수 헬퍼 (단위 테스트 대상)
- Create: `src/app/(dashboard)/_lib/workspace-storage.test.ts` — 헬퍼 테스트
- Create: `src/app/(dashboard)/_components/WorkspaceProvider.tsx` — Context Provider + `useWorkspaceSlice` 훅
- Modify: `src/app/(dashboard)/layout.tsx` — `{children}`를 Provider로 감쌈
- Modify: `src/app/(dashboard)/input/_components/InputForm.tsx` — 신원 보존 배선
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` — 신원 보존 배선

---

## Task 1: Storage helpers (순수 직렬화)

**Files:**
- Create: `src/app/(dashboard)/_lib/workspace-storage.ts`
- Test: `src/app/(dashboard)/_lib/workspace-storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/(dashboard)/_lib/workspace-storage.test.ts
import { describe, it, expect } from 'vitest'
import { deserializeWorkspace, serializeWorkspace } from './workspace-storage'

describe('workspace-storage', () => {
  it('null 입력이면 빈 객체', () => {
    expect(deserializeWorkspace(null)).toEqual({})
  })
  it('깨진 JSON이면 빈 객체 (throw 안 함)', () => {
    expect(deserializeWorkspace('{not json')).toEqual({})
  })
  it('객체가 아닌 JSON이면 빈 객체', () => {
    expect(deserializeWorkspace('42')).toEqual({})
  })
  it('직렬화→역직렬화 라운드트립', () => {
    const state = { inputForm: { 검색어: '지중-1', 투입일: '2026-06-25' } }
    expect(deserializeWorkspace(serializeWorkspace(state))).toEqual(state)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/\(dashboard\)/_lib/workspace-storage.test.ts`
Expected: FAIL — `Cannot find module './workspace-storage'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/(dashboard)/_lib/workspace-storage.ts
export const WORKSPACE_STORAGE_KEY = 'erp_workspace_v1'

export function serializeWorkspace(state: Record<string, unknown>): string {
  return JSON.stringify(state)
}

export function deserializeWorkspace(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/\(dashboard\)/_lib/workspace-storage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/_lib/workspace-storage.ts" "src/app/(dashboard)/_lib/workspace-storage.test.ts"
git commit -m "feat(workspace): sessionStorage 직렬화 헬퍼 + 테스트"
```

---

## Task 2: WorkspaceProvider + useWorkspaceSlice

**Files:**
- Create: `src/app/(dashboard)/_components/WorkspaceProvider.tsx`

설계 노트:
- `store`는 빈 객체로 초기화(SSR과 일치) → 마운트 후 `useEffect`에서 sessionStorage 주입(`hydrated=true`). 이렇게 해야 하이드레이션 미스매치가 없다.
- 자식 effect는 부모 effect보다 먼저 실행되므로, 폼은 `hydrated`가 true가 된 뒤에만 복원/저장해야 한다. 따라서 훅은 `hydrated`를 함께 노출한다.
- `save` 함수는 `setSlice`(stable) + `key`(stable)에만 의존해 **안정적 identity**를 갖는다 → 소비자 effect 의존성에 넣어도 churn 없음.

- [ ] **Step 1: Write the provider**

```tsx
// src/app/(dashboard)/_components/WorkspaceProvider.tsx
'use client'

import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import {
  WORKSPACE_STORAGE_KEY, deserializeWorkspace, serializeWorkspace,
} from '../_lib/workspace-storage'

type Store = Record<string, unknown>
type WorkspaceCtx = {
  store: Store
  setSlice: (key: string, value: unknown) => void
  hydrated: boolean
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({})
  const [hydrated, setHydrated] = useState(false)

  // 마운트 후에만 sessionStorage 읽기 (SSR엔 sessionStorage 없음 → 하이드레이션 미스매치 방지)
  useEffect(() => {
    setStore(deserializeWorkspace(sessionStorage.getItem(WORKSPACE_STORAGE_KEY)))
    setHydrated(true)
  }, [])

  const setSlice = useCallback((key: string, value: unknown) => {
    setStore((prev) => {
      const next = { ...prev, [key]: value }
      try { sessionStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(next)) } catch {}
      return next
    })
  }, [])

  return (
    <WorkspaceContext.Provider value={{ store, setSlice, hydrated }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceSlice<T>(key: string): {
  value: T | undefined
  save: (value: T) => void
  hydrated: boolean
} {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaceSlice must be used within WorkspaceProvider')
  const { store, setSlice, hydrated } = ctx
  const value = store[key] as T | undefined
  const save = useCallback((v: T) => setSlice(key, v), [setSlice, key])
  return { value, save, hydrated }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (성공)

- [ ] **Step 3: Verify it lints**

Run: `npx eslint "src/app/(dashboard)/_components/WorkspaceProvider.tsx"`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/_components/WorkspaceProvider.tsx"
git commit -m "feat(workspace): 페이지별 상태 보존 Provider + useWorkspaceSlice 훅"
```

---

## Task 3: Provider를 레이아웃에 배선

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: import 추가**

`src/app/(dashboard)/layout.tsx` 상단 import 블록(현재 5번째 줄 `MobileTabBar` import 아래)에 추가:

```tsx
import { WorkspaceProvider } from './_components/WorkspaceProvider'
```

- [ ] **Step 2: `{children}`를 Provider로 감싸기**

현재 (`layout.tsx` 36-38행):

```tsx
      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        {children}
      </main>
```

다음으로 교체:

```tsx
      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </main>
```

- [ ] **Step 3: 빌드로 검증 (서버 컴포넌트 안에 클라 Provider 배치가 깨지지 않는지)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat(workspace): 대시보드 레이아웃에 WorkspaceProvider 배선"
```

---

## Task 4: InputForm 신원 보존

**Files:**
- Modify: `src/app/(dashboard)/input/_components/InputForm.tsx`

배선 개요: 슬라이스 키 `inputForm`에 `{선택수주, 검색어, 투입일}`을 저장한다. 마운트 시 `hydrated`가 되면, URL `default수주Id`가 없을 때 한정해 저장된 신원을 복원한다(기존 `handleSelect` 재사용 → 최근투입일·실적 자동조회까지 그대로 동작). 신원이 바뀔 때마다 저장한다.

- [ ] **Step 1: import + 슬라이스 타입/훅 추가**

13번째 줄 `import { Input } ...` 부근의 import 블록에 추가:

```tsx
import { useWorkspaceSlice } from '../../_components/WorkspaceProvider'
```

`수주검색결과` 타입은 파일에 이미 정의돼 있음(40행). 그 아래(타입 정의 영역)에 추가:

```tsx
type InputWorkspace = { 선택수주: 수주검색결과 | null; 검색어: string; 투입일: string }
```

- [ ] **Step 2: 컴포넌트 안에서 훅 호출**

`export function InputForm(...)` 본문에서 `const [선택수주, set선택수주] = useState...` 선언들 부근(78행 근처)에 추가:

```tsx
  const inputWs = useWorkspaceSlice<InputWorkspace>('inputForm')
  const wsRestored = useRef(false)
```

(`useRef`는 이미 3번째 줄에서 import됨.)

- [ ] **Step 3: 복원 effect 추가**

기존 `default수주Id` 복원 effect(현재 207-218행, `if (default수주Id == null) return` 으로 시작) **바로 아래**에 새 effect를 추가:

```tsx
  // 네비게이션 복귀 시 신원 복원: hydrated 이후 1회. URL 딥링크가 있으면 그쪽이 우선이라 건너뛴다.
  useEffect(() => {
    if (!inputWs.hydrated || wsRestored.current) return
    wsRestored.current = true
    if (default수주Id != null) return
    const saved = inputWs.value
    if (saved?.선택수주) {
      handleSelect(saved.선택수주)        // 선택수주·검색어 세팅 + 최근투입일 재조회
      setValue('투입일', saved.투입일)     // 이후 실적 effect가 (수주, 투입일)로 수량/외주 재구성
    } else if (saved?.검색어) {
      set검색어(saved.검색어)             // 선택은 안 했고 검색어만 있던 경우
    }
  }, [inputWs.hydrated]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: 저장 effect 추가**

Step 3의 effect 아래에 추가:

```tsx
  // 신원이 바뀔 때마다 슬라이스에 저장 (hydrated 전에는 기본값으로 저장본을 덮지 않도록 가드)
  useEffect(() => {
    if (!inputWs.hydrated) return
    inputWs.save({ 선택수주, 검색어, 투입일 })
  }, [inputWs.hydrated, inputWs.save, 선택수주, 검색어, 투입일])
```

- [ ] **Step 5: 타입·린트 검증**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output

Run: `npx eslint "src/app/(dashboard)/input/_components/InputForm.tsx"`
Expected: 0 errors (기존 경고 `qty`, `watch()`는 무관하게 남아있을 수 있음 — 신규 에러 0이면 통과)

- [ ] **Step 6: 수동 검증 체크리스트**

`npm run dev` 후 `/input` 입력 탭에서:
- [ ] 공사 선택 → `/input?tab=history`(현황) 이동 → 다시 입력 탭: **선택 공사·날짜가 그대로** 복원됨
- [ ] 공사 선택 → `/progress`(다른 라우트) 이동 → 브라우저 뒤로/사이드바로 `/input` 복귀: 복원됨
- [ ] 탭 **새로고침**(F5): 선택 공사·날짜 유지됨 (sessionStorage)
- [ ] `/input?수주_id=<유효id>` 딥링크로 진입: 저장본이 있어도 **URL 공사가 우선** 선택됨
- [ ] 공사 선택 안 한 상태로 이동·복귀: 빈 폼 (에러 없음)

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/input/_components/InputForm.tsx"
git commit -m "feat(workspace): 투입실적 입력 폼 신원 보존(공사·날짜·검색어)"
```

---

## Task 5: ProgressInputForm 신원 보존

**Files:**
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`

배선 개요: 슬라이스 키 `progressForm`에 `{선택수주Id, 작업일자}`를 저장한다. 마운트 후 `hydrated`가 되면 URL `default수주Id`가 없을 때 한정해 복원한다(기존 `handle공사선택` 재사용 → 누계·하도적용금액·담당공무 재조회). 신원이 바뀔 때마다 저장한다.

- [ ] **Step 1: import + 타입 추가**

3번째 줄 `import { useState, useRef, useEffect, useDeferredValue } from 'react'` 는 그대로 두고, 14번째 줄 `import type { 수주목록항목 } ...` 부근에 추가:

```tsx
import { useWorkspaceSlice } from '../../_components/WorkspaceProvider'
```

`Props` 타입 정의(18-23행) 아래에 추가:

```tsx
type ProgressWorkspace = { 선택수주Id: number | null; 작업일자: string }
```

- [ ] **Step 2: 훅 호출**

`export function ProgressInputForm(...)` 본문에서 상태 선언부(285-295행) 부근, `const toastTimer = useRef...`(295행) 아래에 추가:

```tsx
  const progressWs = useWorkspaceSlice<ProgressWorkspace>('progressForm')
  const wsRestored = useRef(false)
```

- [ ] **Step 3: 복원 effect 추가**

기존 마운트 effect(현재 338-342행, `if (default수주Id != null) handle공사선택(default수주Id)`) **바로 아래**에 추가:

```tsx
  // 네비게이션 복귀 시 신원 복원: hydrated 이후 1회. URL 딥링크가 있으면 그쪽이 우선.
  useEffect(() => {
    if (!progressWs.hydrated || wsRestored.current) return
    wsRestored.current = true
    if (default수주Id != null) return
    const saved = progressWs.value
    if (saved?.선택수주Id != null) {
      handle공사선택(saved.선택수주Id)     // 누계·하도적용금액·담당공무 재조회
      if (saved.작업일자) set작업일자(saved.작업일자)
    }
  }, [progressWs.hydrated]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: 저장 effect 추가**

Step 3 effect 아래에 추가:

```tsx
  // 신원이 바뀔 때마다 저장 (hydrated 전 기본값으로 저장본 덮어쓰기 방지)
  useEffect(() => {
    if (!progressWs.hydrated) return
    progressWs.save({ 선택수주Id, 작업일자 })
  }, [progressWs.hydrated, progressWs.save, 선택수주Id, 작업일자])
```

- [ ] **Step 5: 타입·린트 검증**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output

Run: `npx eslint "src/app/(dashboard)/progress/_components/ProgressInputForm.tsx"`
Expected: 0 신규 에러

- [ ] **Step 6: 수동 검증 체크리스트**

`npm run dev` 후 `/progress` 입력 탭에서:
- [ ] 공사 선택 → `/input` 이동 → `/progress` 복귀: 선택 공사·작업일자 복원, 누계·달성률도 재계산됨
- [ ] **독립성**: `/input`에서 고른 공사가 `/progress`로 안 따라옴 (각 슬라이스 독립)
- [ ] 탭 새로고침: 유지
- [ ] `/progress?수주_id=<유효id>` 딥링크: URL 우선

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/progress/_components/ProgressInputForm.tsx"
git commit -m "feat(workspace): 공사이력 입력 폼 신원 보존(공사·작업일자)"
```

---

## 완료 기준 (Slice 1)

- [ ] 두 입력 폼이 네비게이션·새로고침을 가로질러 선택 공사·날짜를 유지한다.
- [ ] 두 폼의 상태가 서로 독립이다.
- [ ] URL 딥링크가 저장본보다 우선한다.
- [ ] `npm test` 전체 통과, `npx tsc --noEmit` 통과, 신규 lint 에러 0.

## 다음 슬라이스 (이 플랜 범위 아님)

- **Slice 2** — 공사이력 현황(`ProgressHistoryTable`) 검색어·날짜 보존.
- **Slice 3** — 투입실적 현황(`HistoryTable`) 클라 fetch 전환 + 상태 보존(+날짜 lag 해결).
- **후속** — 미저장 입력값 보존(투입구분 수량·외주·성과금액): InputForm 자동조회 effect와의 덮어쓰기 충돌을 reconcile하는 별도 설계 필요.
