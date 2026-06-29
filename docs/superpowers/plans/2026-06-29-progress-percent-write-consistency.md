# 공사이력 쓰기 측 % 일관성 (슬라이스 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백필 시 % 입력 기준을 "그 작업일자 직전 누계"로 정확히 잡고, 수정 Sheet에서도 원/% 토글로 편집 가능하게 한다.

**Architecture:** 증분(원)이 1차 정본, 누적 %는 읽기 시 파생. 공용 순수함수 `직전누계`와 공용 `성과Input` 컴포넌트를 추출해 입력 폼·수정 Sheet가 공유한다. 폼 내부는 `이력목록` 단일 소스에서 누계·최근일·직전누계를 `useMemo`로 파생.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase, Vitest, Tailwind.

> **커밋 규칙 (CLAUDE.md):** Task 1~4는 기술적 변경(Tier A)이라 **커밋 메시지는 사용자가 직접 작성**한다. 아래 각 커밋 스텝의 메시지는 *제안*이며, 실행 시 사용자가 "왜"를 담아 최종 문구를 확정한다. 실행 주체는 커밋 직전 멈추고 사용자에게 메시지를 받는다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/app/(dashboard)/progress/_lib/percent.ts` | 원↔% 환산·누계 순수함수 | `직전누계` 추가 |
| `src/app/(dashboard)/progress/_lib/percent.test.ts` | 위 단위 테스트 | `직전누계` 테스트 추가 |
| `src/app/(dashboard)/progress/_components/성과Input.tsx` | 공용 성과 입력(원/% 토글) | **신규** |
| `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` | 이력 입력 폼 | 로컬 입력 제거·import, 이력목록 단일 소스 |
| `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx` | 이력 조회·수정 | 쿼리·타입 확장, 수정 Sheet에 공용 입력 |
| `src/app/(dashboard)/progress/_types.ts` | 공유 타입 | `공사이력행.수주`에 base 원자료 |

테스트 실행: `npx vitest run percent` (파일명 substring 필터, 괄호 경로 회피)
타입 체크: `npx tsc --noEmit`
린트: `npm run lint`

---

## Task 1: 직전누계 순수함수 (TDD)

**Files:**
- Test: `src/app/(dashboard)/progress/_lib/percent.test.ts`
- Modify: `src/app/(dashboard)/progress/_lib/percent.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`percent.test.ts` 상단 import에 `직전누계`를 추가하고(`import { percentToWon, wonToPercent, 누적목표를증분으로, 직전누계 } from './percent'`), 파일 끝에 다음 describe 블록을 추가:

```ts
describe('직전누계 (기준일 직전까지의 누계 증분, strict <)', () => {
  const recs = [
    { 작업일자: '2026-06-25', 성과금액: 100 },
    { 작업일자: '2026-06-26', 성과금액: 200 },
    { 작업일자: '2026-06-28', 성과금액: 400 },
  ]

  it('빈 배열이면 0', () => {
    expect(직전누계([], '2026-06-27')).toBe(0)
  })

  it('모든 레코드가 기준일 이전이면 전부 합산', () => {
    expect(직전누계(recs, '2026-06-29')).toBe(700)
  })

  it('기준일보다 이전인 레코드만 합산한다 (백필 27 → 25·26만)', () => {
    expect(직전누계(recs, '2026-06-27')).toBe(300)
  })

  it('기준일과 같은 날 레코드는 제외한다 (strict <, 수정 시 자기 제외 근거)', () => {
    expect(직전누계(recs, '2026-06-26')).toBe(100)
  })

  it('정렬 안 된 입력에서도 정확하다', () => {
    const unsorted = [recs[2], recs[0], recs[1]]
    expect(직전누계(unsorted, '2026-06-27')).toBe(300)
  })

  it('성과금액이 null인 레코드는 0으로 취급', () => {
    expect(직전누계([{ 작업일자: '2026-06-25', 성과금액: null }], '2026-06-27')).toBe(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run percent`
Expected: FAIL — `직전누계 is not a function` / `not exported`.

- [ ] **Step 3: 최소 구현**

`percent.ts` 끝에 추가:

```ts
// 기준일 '직전'까지의 누계 증분(원). strict < 기준일.
// 날짜당 1건(unique 제약)이라 기준일과 같은 날 레코드는 자동 제외된다.
// 폼 백필(아직 없는 날짜)·수정 Sheet(자기 자신 제외) 양쪽이 같은 함수를 쓴다.
// ISO(YYYY-MM-DD) 문자열은 사전순 비교가 곧 날짜순이라 별도 파싱 없이 비교한다.
export function 직전누계(
  records: { 작업일자: string; 성과금액: number | null }[],
  기준일: string,
): number {
  return records.reduce(
    (sum, r) => (r.작업일자 < 기준일 ? sum + (r.성과금액 ?? 0) : sum),
    0,
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run percent`
Expected: PASS (전체 percent 테스트 그린).

- [ ] **Step 5: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_lib/percent.ts" "src/app/(dashboard)/progress/_lib/percent.test.ts"
git commit -m "feat(progress): 기준일 직전 누계 순수함수 직전누계 추가"
```

---

## Task 2: 성과Input 공용 추출

기존 `ProgressInputForm.tsx` 안의 `MoneyInput`/`PercentInput`/`성과Input`을 공용 파일로 이동한다. 동작 변경은 없고(이름만 `누계`→`직전누계`, % 라벨 문구 확정), 폼은 import해서 쓴다. 이 시점엔 폼이 아직 총계를 `직전누계`로 넘긴다(Task 3에서 진짜 직전누계로 교체).

**Files:**
- Create: `src/app/(dashboard)/progress/_components/성과Input.tsx`
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`

- [ ] **Step 1: 공용 컴포넌트 파일 생성**

`성과Input.tsx` 전체 내용:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { wonToPercent, 누적목표를증분으로 } from '../_lib/percent'

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('ko-KR') : '')
  useEffect(() => {
    setDisplay(value != null ? value.toLocaleString('ko-KR') : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') { setDisplay(''); onChange(null) }
    else {
      const num = parseInt(raw, 10)
      setDisplay(num.toLocaleString('ko-KR'))
      onChange(num)
    }
  }

  return (
    <Input
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      className={className}
    />
  )
}

function PercentInput({
  value,
  onChange,
  base,
  직전누계,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  base: number // 환산 가능할 때만 렌더되므로 호출부에서 > 0 보장
  직전누계: number // 기준일 직전까지의 누계 성과금액(원). %는 "누적 목표"라 증분 역산의 기준점이 된다.
  className?: string
}) {
  // display 는 사용자가 입력한 "누적 달성률 %" 문자열. value(정본)는 이번 증분(원)이라
  // 의미가 달라(누적 vs 증분) 둘을 분리해 타이핑 중 반올림 떨림을 막는다.
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (value == null) { setDisplay(''); return }
    // 현재 display(누적%)가 이미 value(증분원)을 나타내면 덮어쓰지 않는다 (타이핑 떨림 방지).
    const implied = display === '' || display === '.' ? null : 누적목표를증분으로(parseFloat(display), base, 직전누계)
    if (implied === value) return
    // value는 증분 → 화면에는 누적%로 환원: (직전누계 + 증분) / base.
    const pct = wonToPercent(직전누계 + value, base)
    setDisplay(pct == null ? '' : String(Math.round(pct * 100) / 100))
  }, [value, base, 직전누계]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 숫자와 소수점 1개만 허용
    const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setDisplay(raw)
    if (raw === '' || raw === '.') { onChange(null); return }
    // 입력은 "누적 목표"이므로 저장 정본(증분) = 누적목표 − 직전누계. (음수=하향 정정도 그대로 허용)
    onChange(누적목표를증분으로(parseFloat(raw), base, 직전누계))
  }

  return (
    <div className="relative">
      <Input
        value={display}
        onChange={handleChange}
        placeholder="0"
        inputMode="decimal"
        className={cn('pr-7', className)}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">%</span>
    </div>
  )
}

export function 성과Input({
  value,
  onChange,
  하도적용금액,
  직전누계,
}: {
  value: number | null
  onChange: (v: number | null) => void
  하도적용금액: number | null
  직전누계: number
}) {
  const 환산가능 = 하도적용금액 != null && 하도적용금액 > 0
  const [모드, set모드] = useState<'원' | '%'>('%')
  // 환산 불가(공사단가 정보 없음)면 % 입력 불가 → 원 모드 강제.
  const effective모드 = 환산가능 ? 모드 : '원'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        {/* %는 "이 작업일자까지 누적 달성률", 원은 "이번 증분" — 모드마다 입력 의미가 달라 라벨도 분기한다.
            % 라벨에 "이 작업일자까지"를 명시해 우측 "저장 후 전체 누계"와 혼동을 막는다. */}
        <Label className="text-xs text-gray-600">
          {effective모드 === '%' ? '성과 (이 작업일자까지 누적)' : '성과 (이번 증분)'}
        </Label>
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(['원', '%'] as const).map((m) => {
            const disabled = m === '%' && !환산가능
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => set모드(m)}
                title={disabled ? '공사단가 정보가 없어 % 입력 불가' : undefined}
                className={cn(
                  'px-2.5 py-1 transition-colors',
                  effective모드 === m ? 'bg-[#1e2d5a] text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
                  disabled && 'opacity-40 cursor-not-allowed hover:bg-white',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>
      {effective모드 === '%' ? (
        <PercentInput value={value} onChange={onChange} base={하도적용금액 as number} 직전누계={직전누계} className="h-10 text-sm" />
      ) : (
        <MoneyInput value={value} onChange={onChange} className="h-10 text-sm" placeholder="0" />
      )}
      {!환산가능 && (
        <p className="text-[10px] text-gray-400 mt-1">공사단가 정보가 없어 % 입력은 사용할 수 없습니다.</p>
      )}
      {환산가능 && effective모드 === '%' && (
        <p className="text-[10px] text-gray-400 mt-1">이번 작업 후 <b>이 작업일자까지의 누적</b> 달성률을 입력하세요. 증분 금액은 자동 계산됩니다.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 폼에서 로컬 컴포넌트 제거 + import 교체**

`ProgressInputForm.tsx`:

(a) import 정리 — 더 이상 폼이 직접 쓰지 않는 `wonToPercent, 누적목표를증분으로`를 제거하고 공용 컴포넌트를 import. 17번째 줄
```ts
import { wonToPercent, 누적목표를증분으로 } from '../_lib/percent'
```
를 다음으로 교체:
```ts
import { 성과Input } from './성과Input'
```

(b) 로컬 `MoneyInput`(165~200줄), `PercentInput`(202~250줄), `성과Input`(252~310줄) **세 함수 정의를 통째로 삭제**. (이 시점 폼에서 `MoneyInput`은 `성과Input` 안에서만 쓰였으므로 폼 본문 다른 곳에 남은 사용처 없음 — 삭제 후 grep으로 확인.)

(c) 성과Input 사용처(505~510줄) 프로퍼티 이름 교체 — `누계성과금액` → `직전누계` (값은 아직 총계 `누계성과금액` 그대로, Task 3에서 진짜 직전누계로 교체):
```tsx
<성과Input
  value={성과금액}
  onChange={set성과금액}
  하도적용금액={하도적용금액}
  직전누계={누계성과금액}
/>
```

- [ ] **Step 3: 타입·린트·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`MoneyInput`/`PercentInput` 미사용 심볼 에러가 나면 삭제 누락 — 확인.)

Run: `npm run lint`
Expected: 신규 에러 없음.

Run: `npx vitest run percent`
Expected: PASS.

- [ ] **Step 4: 수동 확인**

`npm run dev` → 공사이력 입력 폼에서 공사 선택 후 % 토글/원 토글이 이전과 동일하게 동작하는지 확인(최신 날짜 입력 기준 동작 불변).

- [ ] **Step 5: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_components/성과Input.tsx" "src/app/(dashboard)/progress/_components/ProgressInputForm.tsx"
git commit -m "refactor(progress): 성과Input 공용 컴포넌트로 추출"
```

---

## Task 3: 폼 이력목록 단일 소스 + 직전누계 배선

`누계성과금액`·`최근작업일자` state를 제거하고 `이력목록` 한 곳에서 파생한다. % 기준을 진짜 `직전누계(이력목록, 작업일자)`로 바꿔 백필을 정확히 만든다.

**Files:**
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`

- [ ] **Step 1: import에 useMemo·직전누계 추가**

3번째 줄
```ts
import { useState, useRef, useEffect, useDeferredValue } from 'react'
```
를
```ts
import { useState, useRef, useEffect, useDeferredValue, useMemo } from 'react'
```
로 바꾸고, 16번째 줄 `import type { 공사이력Row } from '@/types/database'` 아래에 추가:
```ts
import { 직전누계 } from '../_lib/percent'
```

- [ ] **Step 2: state 교체 (누계·최근 제거, 이력목록 추가)**

316~317줄
```ts
  const [누계성과금액, set누계성과금액] = useState<number>(0)
  const [최근작업일자, set최근작업일자] = useState<string | null>(null)
```
를 다음으로 교체:
```ts
  const [이력목록, set이력목록] = useState<Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[]>([])

  // 이력목록 단일 소스에서 파생 — 누계·최근일·직전누계 동기화 버그를 구조적으로 제거.
  const 누계성과금액 = useMemo(
    () => 이력목록.reduce((s, r) => s + (r.성과금액 ?? 0), 0),
    [이력목록],
  )
  const 최근작업일자 = useMemo(
    () => 이력목록.reduce<string | null>((max, r) => (max == null || r.작업일자 > max ? r.작업일자 : max), null),
    [이력목록],
  )
  // % 입력 기준: "이 작업일자 직전"까지의 누계. 최신 날짜면 총계와 같고, 백필이면 그 날짜 전까지만.
  const 직전누계값 = useMemo(() => 직전누계(이력목록, 작업일자), [이력목록, 작업일자])
```

- [ ] **Step 3: handle공사선택 — records 보존**

343~367줄의 `handle공사선택`에서 누계/최근 처리를 이력목록으로 교체.

상단 리셋부(344~347줄):
```ts
    set선택수주Id(id)
    set성과금액(null)
    set누계성과금액(0)
    set최근작업일자(null)
    if (id == null) return
```
를:
```ts
    set선택수주Id(id)
    set성과금액(null)
    set이력목록([])
    if (id == null) return
```

fetch 이후부(361~364줄):
```ts
    const records = 이력결과.data ?? []
    const 누계 = records.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0)
    set누계성과금액(누계)
    if (records.length > 0) set최근작업일자(records[0].작업일자)
```
를:
```ts
    set이력목록(이력결과.data ?? [])
```

- [ ] **Step 4: handleSave — insert 반환행을 이력목록에 append**

425~431줄의 insert를 `.select(...).single()`로 바꾸고 반환행을 받는다:
```ts
    const { data: inserted, error } = await (supabase.from('공사이력') as any).insert({
      수주_id: 선택수주Id,
      작업일자,
      성과금액,
      작업내용: 작업내용 || null,
      담당공무_id: 담당공무Id,
    }).select('id, 작업일자, 성과금액').single()
```

439~440줄
```ts
    set누계성과금액((prev) => prev + (성과금액 ?? 0))
    set최근작업일자(작업일자)
```
를:
```ts
    // 반환행을 이력목록에 추가 → 누계·최근·직전 자동 재파생(백필 시 최근일 덮어쓰기 버그 없음).
    if (inserted) set이력목록((prev) => [...prev, inserted as Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>])
```

- [ ] **Step 5: 성과Input에 진짜 직전누계 전달**

Step 2(Task 2)에서 `직전누계={누계성과금액}`로 둔 것을 `직전누계={직전누계값}`로 교체:
```tsx
<성과Input
  value={성과금액}
  onChange={set성과금액}
  하도적용금액={하도적용금액}
  직전누계={직전누계값}
/>
```

- [ ] **Step 6: 우측 패널 라벨 명시 (전체 누계)**

578줄
```tsx
          <p className="text-[10px] text-blue-300 mb-3">저장 후 누계</p>
```
를:
```tsx
          <p className="text-[10px] text-blue-300 mb-3">저장 후 전체 누계</p>
```

- [ ] **Step 7: 타입·린트·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

Run: `npm run lint`
Expected: 신규 에러 없음.

Run: `npx vitest run percent`
Expected: PASS.

- [ ] **Step 8: 수동 확인 (백필 시나리오)**

`npm run dev` → 여러 날짜(예: 25·26·28)가 있는 공사를 선택 → 작업일자를 27(빠진 날)로 설정 → % 모드 입력란이 "26까지의 누적"을 기준으로 환원되는지 확인(28의 증분이 기준에 포함되지 않음). 작업일자를 최신(예: 29)로 두면 총계 기준과 동일한지 확인.

- [ ] **Step 9: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_components/ProgressInputForm.tsx"
git commit -m "feat(progress): 입력 폼 % 기준을 작업일자 직전 누계로 — 백필 정확화"
```

---

## Task 4: 수정 Sheet 원/% 토글

`ProgressHistoryTable`의 수정 Sheet가 원 단위 전용이던 것을 공용 `성과Input`(원/% 토글)으로 바꾼다. base는 메인 쿼리 조인으로, 직전누계는 edit-open 시 그 수주의 전체 이력을 lazy-fetch해 계산한다.

**Files:**
- Modify: `src/app/(dashboard)/progress/_types.ts`
- Modify: `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx`

- [ ] **Step 1: 공사이력행 타입에 base 원자료 추가**

`_types.ts`의 `공사이력행`(8~10줄)을 교체:
```ts
export type 공사이력행 = Pick<공사이력Row, 'id' | '작업일자' | '성과금액' | '수주_id'> & {
  수주: {
    지중no: string
    공사명: string
    수주금액_공급가: number | null
    보험료율: number | null
    하도전용율: number | null
  } | null
}
```

- [ ] **Step 2: 메인 쿼리 조인 확장**

`ProgressHistoryTable.tsx` 54줄
```ts
      .select('id, 작업일자, 성과금액, 수주_id, 수주!수주_id(지중no, 공사명)')
```
를:
```ts
      .select('id, 작업일자, 성과금액, 수주_id, 수주!수주_id(지중no, 공사명, 수주금액_공급가, 보험료율, 하도전용율)')
```

- [ ] **Step 3: import 교체 + 로컬 MoneyInput 제거**

(a) 3줄 `import { useState, useEffect, useCallback } from 'react'`를:
```ts
import { useState, useEffect, useCallback, useMemo } from 'react'
```

(b) 14줄 `import type { 공사이력행 } from '../_types'` 아래에 추가:
```ts
import { 성과Input } from './성과Input'
import { 직전누계 } from '../_lib/percent'
```

(c) 로컬 `MoneyInput` 정의(16~27줄)를 **통째로 삭제**. (수정 Sheet에서만 쓰였고 Step 7에서 공용 `성과Input`으로 대체됨. `Input` import는 검색창에서 계속 쓰므로 유지.)

- [ ] **Step 4: edit용 state 추가**

`editAmount` state 선언(40줄) 아래에 추가:
```ts
  const [editRecords, setEditRecords] = useState<{ id: number; 작업일자: string; 성과금액: number | null }[]>([])
  const [editLoading, setEditLoading] = useState(false)
```

- [ ] **Step 5: base·직전누계 파생(useMemo)**

`handleDelete` 정의 위(96줄 근처, `const handleSave` 위)에 추가:
```ts
  // 수정 대상 수주의 하도적용금액(=환산 base). 조인된 원자료로 계산.
  const editBase = useMemo(() => {
    const s = editRow?.수주
    if (!s || s.수주금액_공급가 == null || s.보험료율 == null || s.하도전용율 == null) return null
    return s.수주금액_공급가 * (1 - s.보험료율) * s.하도전용율
  }, [editRow])

  // 수정 중 레코드의 % 기준: 자기 자신을 뺀 "그 작업일자 직전" 누계.
  // strict <(직전누계) + id 필터 이중안전. editDate를 바꾸면 재계산된다.
  const edit직전누계 = useMemo(
    () => 직전누계(editRecords.filter((r) => r.id !== editRow?.id), editDate),
    [editRecords, editDate, editRow],
  )
```

- [ ] **Step 6: openEdit에서 전체 이력 lazy-fetch**

76~80줄 `openEdit`를 async로 교체:
```ts
  const openEdit = async (row: 공사이력행) => {
    setEditRow(row)
    setEditDate(row.작업일자)
    setEditAmount(row.성과금액)
    setEditLoading(true)
    setEditRecords([])
    const supabase = createClient()
    const { data, error } = await (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액')
      .eq('수주_id', row.수주_id) as { data: { id: number; 작업일자: string; 성과금액: number | null }[] | null; error: unknown }
    setEditLoading(false)
    if (error) { showToast(false, '이력을 불러오지 못했습니다. 원 단위로만 수정할 수 있습니다.'); return }
    setEditRecords(data ?? [])
  }
```

> 참고: fetch 실패 시 `editRecords`가 비어 직전누계를 신뢰할 수 없다. Step 7에서 그 경우 `하도적용금액`에 `null`을 넘겨 `성과Input`이 자동으로 원 모드로 강등되게 한다.

- [ ] **Step 7: Sheet의 성과금액 입력을 공용 성과Input으로 교체**

237~240줄
```tsx
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">성과금액</Label>
              <MoneyInput value={editAmount} onChange={setEditAmount} className="h-9 text-sm" />
            </div>
```
를:
```tsx
            <div>
              {editLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 className="size-4 animate-spin" /> 이력 불러오는 중...
                </div>
              ) : (
                <성과Input
                  value={editAmount}
                  onChange={setEditAmount}
                  하도적용금액={editRecords.length > 0 ? editBase : null}
                  직전누계={edit직전누계}
                />
              )}
            </div>
```

> `editRecords.length > 0 ? editBase : null`: 이력을 못 불러왔으면(빈 배열) base를 null로 넘겨 % 비활성(원 모드 강등). 정상 로드면 editBase 사용.

- [ ] **Step 8: 타입·린트·테스트 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`MoneyInput` 미사용/미정의 에러 시 Step 3(c) 삭제 또는 Step 7 교체 누락 확인.)

Run: `npm run lint`
Expected: 신규 에러 없음.

Run: `npx vitest run percent`
Expected: PASS.

- [ ] **Step 9: 수동 확인 (%로 입력한 레코드 수정)**

`npm run dev` → 이력 현황 탭에서 % 모드로 입력했던 레코드의 "수정" → Sheet에서 % 토글 선택 시 "이 작업일자까지 누적 %"가 보이는지, % 값을 바꿔 저장 후 다시 열었을 때 일관된지 확인. 원/% 전환도 확인.

- [ ] **Step 10: 커밋** (Tier A — 사용자가 메시지 작성)

제안 메시지:
```bash
git add "src/app/(dashboard)/progress/_types.ts" "src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx"
git commit -m "feat(progress): 수정 Sheet 원/% 토글 — %로 입력한 이력을 %로 수정"
```

---

## 완료 기준

- [ ] `직전누계` 단위 테스트 그린, `npx vitest run percent` 전체 통과.
- [ ] 입력 폼: 백필(빠진 중간 날짜) 시 % 기준이 그 날짜 직전 누계. 최신 날짜는 총계와 동일.
- [ ] 수정 Sheet: %로 입력한 레코드를 % 토글로 수정 가능, 정본은 원 그대로.
- [ ] % 필드 라벨("이 작업일자까지 누적")과 우측 패널("저장 후 전체 누계")이 단어로 구분됨.
- [ ] `npx tsc --noEmit` / `npm run lint` 신규 에러 없음.
