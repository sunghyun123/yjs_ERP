# 공무 전용 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공무담당자별 월간계획/주간실적 보고 화면을 신규 개발한다. ERP의 공사이력·기성 데이터가 주간 보고서 초안으로 자동 채워지며, 사용자가 자유롭게 편집 후 저장할 수 있다.

**Architecture:** 주차(ISO week) 기반 저장 모델. `공무담당자` / `공무_월간계획` / `공무_주간보고` 3개 테이블 신규 생성. 기존 `공사이력`·`기성`·`수주` 테이블에 `담당공무_id`(+`작업내용`) 컬럼 추가. `/gongmu` 선택 페이지 → `/gongmu/[id]` 개인 화면 → `/gongmu/total` 종합 탭 구조.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Supabase, TypeScript, Tailwind CSS, shadcn/ui, `xlsx` (엑셀 내보내기, 이미 devDependencies에 설치됨)

---

## 파일 구조

| 액션 | 경로 | 역할 |
|---|---|---|
| Modify | `src/types/database.ts` | 신규 3개 테이블 + 기존 테이블 컬럼 추가 |
| Create | `src/lib/week.ts` | ISO 주차 유틸 함수 |
| Modify | `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` | 작업내용·담당공무 필드 추가 |
| Modify | `src/app/(dashboard)/orders/_components/OrderForm.tsx` | 기성·수주 담당공무 필드 추가 |
| Create | `src/app/(dashboard)/gongmu/page.tsx` | 공무 선택 페이지 |
| Create | `src/app/(dashboard)/gongmu/[id]/page.tsx` | 개인 공무 화면 |
| Create | `src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx` | 월간 요약 카드 |
| Create | `src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx` | 주간 보고 편집 폼 (client) |
| Create | `src/app/(dashboard)/gongmu/total/page.tsx` | 종합 현황 |
| Create | `src/app/(dashboard)/gongmu/_lib/actions.ts` | Server Actions (CRUD) |
| Create | `src/app/(dashboard)/gongmu/_lib/calc.ts` | 누적실적·달성률 계산 |
| Create | `src/app/(dashboard)/gongmu/_lib/excel.ts` | 엑셀 내보내기 |
| Modify | `src/components/sidebar/Sidebar.tsx` | 공무 보고서 메뉴 추가 |
| Modify | `src/components/sidebar/MobileTabBar.tsx` | 공무 탭 추가 |

---

## Task 1: DB 마이그레이션 + 타입

**Files:**
- Supabase Dashboard SQL Editor
- Modify: `src/types/database.ts`

- [ ] **Step 1: Supabase Dashboard에서 신규 테이블 3개 생성**

```sql
-- 공무담당자
CREATE TABLE 공무담당자 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  이름 TEXT NOT NULL,
  생성일 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE 공무담당자 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON 공무담당자
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 공무_월간계획
CREATE TABLE 공무_월간계획 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  공무_id BIGINT NOT NULL REFERENCES 공무담당자(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  구분 TEXT NOT NULL CHECK (구분 IN ('공사', '공무')),
  월간계획금액 BIGINT NOT NULL DEFAULT 0,
  UNIQUE (공무_id, year, month, 구분)
);
ALTER TABLE 공무_월간계획 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON 공무_월간계획
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 공무_주간보고
CREATE TABLE 공무_주간보고 (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  공무_id BIGINT NOT NULL REFERENCES 공무담당자(id) ON DELETE CASCADE,
  year INT NOT NULL,
  week_no INT NOT NULL CHECK (week_no BETWEEN 1 AND 53),
  항목순서 INT NOT NULL DEFAULT 0,
  수주_id BIGINT REFERENCES 수주(id) ON DELETE SET NULL,
  지중no TEXT,
  공사명 TEXT NOT NULL DEFAULT '',
  금주작업 TEXT,
  차주작업 TEXT,
  금주계획 BIGINT NOT NULL DEFAULT 0,
  금주실적 BIGINT NOT NULL DEFAULT 0,
  차주계획 BIGINT NOT NULL DEFAULT 0,
  구분 TEXT NOT NULL CHECK (구분 IN ('공사', '공무')),
  비고 TEXT,
  erp_공사이력_id BIGINT,
  erp_기성_id BIGINT
);
ALTER TABLE 공무_주간보고 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON 공무_주간보고
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: 기존 테이블 컬럼 추가**

```sql
-- 공사이력에 작업내용·담당공무 추가
ALTER TABLE 공사이력 ADD COLUMN 작업내용 TEXT;
ALTER TABLE 공사이력 ADD COLUMN 담당공무_id BIGINT REFERENCES 공무담당자(id) ON DELETE SET NULL;

-- 기성에 작업내용·담당공무 추가
ALTER TABLE 기성 ADD COLUMN 작업내용 TEXT;
ALTER TABLE 기성 ADD COLUMN 담당공무_id BIGINT REFERENCES 공무담당자(id) ON DELETE SET NULL;

-- 수주에 공무담당자_id 추가 (기존 공사담당 텍스트는 유지)
ALTER TABLE 수주 ADD COLUMN 공무담당자_id BIGINT REFERENCES 공무담당자(id) ON DELETE SET NULL;
```

- [ ] **Step 3: database.ts에 신규 타입 추가**

`src/types/database.ts` Tables 블록에 추가:

```typescript
      공무담당자: {
        Row: { id: number; 이름: string; 생성일: string }
        Insert: { id?: number; 이름: string; 생성일?: string }
        Update: { id?: number; 이름?: string; 생성일?: string }
      }
      공무_월간계획: {
        Row: { id: number; 공무_id: number; year: number; month: number; 구분: '공사' | '공무'; 월간계획금액: number }
        Insert: { id?: number; 공무_id: number; year: number; month: number; 구분: '공사' | '공무'; 월간계획금액?: number }
        Update: { id?: number; 공무_id?: number; year?: number; month?: number; 구분?: '공사' | '공무'; 월간계획금액?: number }
      }
      공무_주간보고: {
        Row: {
          id: number; 공무_id: number; year: number; week_no: number; 항목순서: number
          수주_id: number | null; 지중no: string | null; 공사명: string
          금주작업: string | null; 차주작업: string | null
          금주계획: number; 금주실적: number; 차주계획: number
          구분: '공사' | '공무'; 비고: string | null
          erp_공사이력_id: number | null; erp_기성_id: number | null
        }
        Insert: {
          id?: number; 공무_id: number; year: number; week_no: number; 항목순서?: number
          수주_id?: number | null; 지중no?: string | null; 공사명?: string
          금주작업?: string | null; 차주작업?: string | null
          금주계획?: number; 금주실적?: number; 차주계획?: number
          구분: '공사' | '공무'; 비고?: string | null
          erp_공사이력_id?: number | null; erp_기성_id?: number | null
        }
        Update: {
          id?: number; 공무_id?: number; year?: number; week_no?: number; 항목순서?: number
          수주_id?: number | null; 지중no?: string | null; 공사명?: string
          금주작업?: string | null; 차주작업?: string | null
          금주계획?: number; 금주실적?: number; 차주계획?: number
          구분?: '공사' | '공무'; 비고?: string | null
          erp_공사이력_id?: number | null; erp_기성_id?: number | null
        }
      }
```

기존 테이블 Row 타입 수정:

`공사이력.Row`에 추가:
```typescript
작업내용: string | null
담당공무_id: number | null
```

`기성.Row`에 추가:
```typescript
작업내용: string | null
담당공무_id: number | null
```

`수주.Row`에 추가:
```typescript
공무담당자_id: number | null
```

파일 하단 re-export 추가:
```typescript
export type 공무담당자Row    = Database['public']['Tables']['공무담당자']['Row']
export type 공무_월간계획Row = Database['public']['Tables']['공무_월간계획']['Row']
export type 공무_주간보고Row = Database['public']['Tables']['공무_주간보고']['Row']
export type 공무_주간보고Insert = Database['public']['Tables']['공무_주간보고']['Insert']
```

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 공무담당자 초기 데이터 입력**

Supabase Dashboard → Table Editor → 공무담당자 → 실제 공무 이름 입력 (예: 김무선, 이공무, ...).

이후 `수주` 테이블의 `공무담당자_id`를 각 공사에 맞게 업데이트:
```sql
UPDATE 수주 SET 공무담당자_id = (SELECT id FROM 공무담당자 WHERE 이름 = '김무선')
WHERE 공사담당 = '김무선';
-- 각 담당자별로 반복
```

- [ ] **Step 6: 커밋**

```bash
git add src/types/database.ts
git commit -m "feat: 공무 화면 DB 타입 추가 (공무담당자·주간보고·월간계획)"
```

---

## Task 2: ISO 주차 유틸

**Files:**
- Create: `src/lib/week.ts`

- [ ] **Step 1: week.ts 작성**

```typescript
// src/lib/week.ts

/** ISO 주차 계산 (ISO 8601: 월요일 시작, 목요일이 속한 주가 해당 연도의 주) */
export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // ISO week: 목요일 기준
  const dayNum = d.getUTCDay() || 7 // 0(일) → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

/** 해당 ISO 주차의 월요일(시작일) 반환 */
export function getWeekStart(isoYear: number, isoWeek: number): Date {
  // Jan 4는 항상 1주차에 속함
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (isoWeek - 1) * 7)
  return monday
}

/** 해당 ISO 주차의 일요일(종료일) 반환 */
export function getWeekEnd(isoYear: number, isoWeek: number): Date {
  const start = getWeekStart(isoYear, isoWeek)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return end
}

/** YYYY-MM-DD 형식으로 반환 */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** 해당 월(year/month)에 속하는 ISO 주차 목록 반환 (월 경계 포함) */
export function getWeeksInMonth(year: number, month: number): { isoYear: number; week: number; label: string }[] {
  const result: { isoYear: number; week: number; label: string }[] = []
  const seen = new Set<string>()

  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const { year: wy, week: wk } = getISOWeek(new Date(year, month - 1, d))
    const key = `${wy}-${wk}`
    if (!seen.has(key)) {
      seen.add(key)
      const start = getWeekStart(wy, wk)
      const end = getWeekEnd(wy, wk)
      result.push({
        isoYear: wy,
        week: wk,
        label: `${result.length + 1}주차 (${toDateStr(start).slice(5)}~${toDateStr(end).slice(5)})`,
      })
    }
  }
  return result
}

/** 오늘이 속한 ISO 주차 */
export function getCurrentWeek(): { year: number; week: number } {
  return getISOWeek(new Date())
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/week.ts
git commit -m "feat: ISO 주차 유틸 추가 (src/lib/week.ts)"
```

---

## Task 3: 공사이력 입력 폼 — 작업내용 + 담당공무 필드

**Files:**
- Modify: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`
- Modify: `src/app/(dashboard)/progress/page.tsx`

- [ ] **Step 1: page.tsx에서 공무담당자 목록 조회 후 폼에 전달**

`progress/page.tsx`에서 공무담당자 조회 추가:

```typescript
// createClient() 후 기존 수주 조회 바로 아래에 추가
const { data: 공무담당자raw } = await supabase
  .from('공무담당자')
  .select('id, 이름')
  .order('이름')
const 공무담당자목록 = (공무담당자raw ?? []) as { id: number; 이름: string }[]
```

`ProgressInputForm` 호출 시 prop 추가:
```tsx
<ProgressInputForm
  수주목록={수주목록}
  공무담당자목록={공무담당자목록}
  default수주Id={params.수주_id ? Number(params.수주_id) : null}
  default날짜={params.날짜 ?? null}
/>
```

- [ ] **Step 2: ProgressInputForm — Props, state, 저장 로직 수정**

기존 `Props` 타입 변경:
```typescript
type Props = {
  수주목록: 수주목록항목[]
  공무담당자목록: { id: number; 이름: string }[]
  default수주Id?: number | null
  default날짜?: string | null
}
```

state 추가 (기존 state 선언 바로 아래):
```typescript
const [작업내용, set작업내용] = useState('')
const [담당공무Id, set담당공무Id] = useState<number | null>(null)
```

`handleSave` 내부 insert 코드 변경:
```typescript
const { error } = await (supabase.from('공사이력') as any).insert({
  수주_id: 선택수주Id,
  작업일자,
  성과금액,
  작업내용: 작업내용 || null,
  담당공무_id: 담당공무Id,
})
```

저장 성공 후 상태 초기화에 추가:
```typescript
set작업내용('')
set담당공무Id(null)
```

JSX: 성과금액 입력 아래에 두 필드 추가:
```tsx
<div>
  <Label className="text-xs text-gray-600 mb-1.5 block">
    작업내용 <span className="text-gray-400">(선택)</span>
  </Label>
  <Input
    type="text"
    className="h-10 text-sm"
    placeholder="이번 작업 내용을 간략히 입력..."
    value={작업내용}
    onChange={(e) => set작업내용(e.target.value)}
  />
</div>

<div>
  <Label className="text-xs text-gray-600 mb-1.5 block">
    담당 공무 <span className="text-gray-400">(선택)</span>
  </Label>
  <select
    className="h-10 w-full rounded-lg border border-input bg-background text-sm px-3 outline-none focus:border-ring"
    value={담당공무Id ?? ''}
    onChange={(e) => set담당공무Id(e.target.value ? Number(e.target.value) : null)}
  >
    <option value="">선택 안함</option>
    {공무담당자목록.map((g) => (
      <option key={g.id} value={g.id}>{g.이름}</option>
    ))}
  </select>
</div>
```

기존 수주 선택 시 수주 `공무담당자_id`로 담당 공무 자동 선택 (`handle공사선택` 수정):
```typescript
const handle공사선택 = async (id: number | null) => {
  set선택수주Id(id)
  set성과금액(null)
  set누계성과금액(0)
  set최근작업일자(null)
  if (id == null) { set담당공무Id(null); return }

  set로딩중(true)
  const supabase = createClient()
  const [이력결과, 수주결과] = await Promise.all([
    (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액')
      .eq('수주_id', id)
      .order('작업일자', { ascending: false }) as Promise<{ data: Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[] | null }>,
    supabase.from('수주').select('공무담당자_id').eq('id', id).single(),
  ])
  set로딩중(false)

  const records = 이력결과.data ?? []
  set누계성과금액(records.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0))
  if (records.length > 0) set최근작업일자(records[0].작업일자)
  if (수주결과.data?.공무담당자_id) set담당공무Id(수주결과.data.공무담당자_id)
}
```

- [ ] **Step 3: 타입 체크 + 브라우저 확인**

```bash
npx tsc --noEmit
```

브라우저 `/progress` → 공사 선택 후 작업내용·담당공무 필드가 보이는지 확인. 저장 시 Supabase 테이블에 작업내용, 담당공무_id 저장되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/progress/page.tsx \
        src/app/\(dashboard\)/progress/_components/ProgressInputForm.tsx
git commit -m "feat: 공사이력 입력 폼에 작업내용·담당공무 필드 추가"
```

---

## Task 4: 기성·수주 폼 — 담당공무 필드

**Files:**
- Modify: `src/app/(dashboard)/orders/_components/OrderForm.tsx`
- Modify: `src/app/(dashboard)/orders/_types.ts`

- [ ] **Step 1: _types.ts에 공무담당자 타입 추가**

```typescript
// src/app/(dashboard)/orders/_types.ts 에 추가
export type 공무담당자목록항목 = { id: number; 이름: string }
```

기존 `수주행` 타입에 `공무담당자_id` 필드 추가:
```typescript
export type 수주행 = Pick<
  수주Row,
  | ... (기존 필드들)
  | '공무담당자_id'  // 추가
> & {
  발주자: 발주자정보 | null
  원청사: 발주자정보 | null
  기성: 기성항목[]
}
```

`기성항목` 타입에 필드 추가:
```typescript
export type 기성항목 = Pick<기성Row, 'id' | '차수' | '기성일' | '기성액_공급가' | '작업내용' | '담당공무_id'>
```

- [ ] **Step 2: OrderForm에 공무담당자 prop 추가 및 수주 담당공무_id 필드 추가**

`Props` 타입에 추가:
```typescript
type Props = {
  mode: 'new' | 'edit'
  row?: 수주행
  거래처목록: 거래처목록항목[]
  공무담당자목록: 공무담당자목록항목[]
  onSuccess: () => void
}
```

Zod 스키마에 추가:
```typescript
공무담당자_id: z.number().int().nullable().optional(),
```

JSX에서 공사담당 입력 필드 바로 아래에 담당 공무 select 추가:
```tsx
<div>
  <Label className="text-xs">담당 공무</Label>
  <Controller
    name="공무담당자_id"
    control={control}
    render={({ field }) => (
      <select
        className="h-9 w-full rounded-lg border border-input bg-background text-sm px-3 outline-none"
        value={field.value ?? ''}
        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">선택 안함</option>
        {공무담당자목록.map((g) => (
          <option key={g.id} value={g.id}>{g.이름}</option>
        ))}
      </select>
    )}
  />
</div>
```

- [ ] **Step 3: 기성 항목 UI에 작업내용·담당공무 필드 추가**

OrderForm 내 기성 항목 표시/편집 부분을 찾아 각 기성 행에 `작업내용` input과 `담당공무_id` select 추가 (기존 기성 저장 로직과 동일한 패턴으로).

기성 저장 시:
```typescript
// 기존 기성 insert/update 코드에 추가
작업내용: 기성항목.작업내용 || null,
담당공무_id: 기성항목.담당공무_id || null,
```

- [ ] **Step 4: orders/page.tsx에서 공무담당자 조회 후 OrderForm에 전달**

```typescript
// orders/page.tsx 내 데이터 조회에 추가
const { data: 공무담당자raw } = await supabase.from('공무담당자').select('id, 이름').order('이름')
const 공무담당자목록 = (공무담당자raw ?? []) as { id: number; 이름: string }[]
```

`OrderForm` 컴포넌트에 `공무담당자목록={공무담당자목록}` prop 전달.

- [ ] **Step 5: 타입 체크 + 브라우저 확인**

```bash
npx tsc --noEmit
```

브라우저 `/orders` → 수주 편집 → 담당 공무 드롭다운 확인. 기성 행에 작업내용·담당공무 입력 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/app/\(dashboard\)/orders/_types.ts \
        src/app/\(dashboard\)/orders/_components/OrderForm.tsx \
        src/app/\(dashboard\)/orders/page.tsx
git commit -m "feat: 수주·기성 폼에 담당공무 및 작업내용 필드 추가"
```

---

## Task 5: 공무 선택 페이지

**Files:**
- Create: `src/app/(dashboard)/gongmu/page.tsx`

- [ ] **Step 1: 페이지 작성**

```tsx
// src/app/(dashboard)/gongmu/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'

export const metadata = { title: '공무 보고서 | 영전사 ERP' }

export default async function GongmuPage() {
  const supabase = await createClient()
  const { year, week } = getCurrentWeek()
  const now = new Date()

  const { data: 공무들 } = await supabase.from('공무담당자').select('id, 이름').order('이름')

  // 각 공무의 이번달 달성률 미리 계산
  const month = now.getMonth() + 1
  const weeks = getWeeksInMonth(year, month).map((w) => w.week)
  const weekData = 공무들 && 공무들.length > 0
    ? await supabase
        .from('공무_주간보고')
        .select('공무_id, 금주실적')
        .in('공무_id', 공무들.map((g) => g.id))
        .eq('year', year)
        .in('week_no', weeks)
    : { data: [] }

  const 실적Map = new Map<number, number>()
  for (const row of (weekData.data ?? []) as { 공무_id: number; 금주실적: number }[]) {
    실적Map.set(row.공무_id, (실적Map.get(row.공무_id) ?? 0) + row.금주실적)
  }

  const planData = 공무들 && 공무들.length > 0
    ? await supabase
        .from('공무_월간계획')
        .select('공무_id, 월간계획금액')
        .in('공무_id', 공무들.map((g) => g.id))
        .eq('year', year)
        .eq('month', month)
    : { data: [] }

  const 계획Map = new Map<number, number>()
  for (const row of (planData.data ?? []) as { 공무_id: number; 월간계획금액: number }[]) {
    계획Map.set(row.공무_id, (계획Map.get(row.공무_id) ?? 0) + row.월간계획금액)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">공무 보고서</h1>
        <p className="text-sm text-gray-500 mt-0.5">{year}년 {month}월</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 종합 현황 카드 */}
        <Link href="/gongmu/total" className="block">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 hover:border-indigo-400 transition-colors">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm mb-3">Σ</div>
            <p className="font-semibold text-indigo-900">종합 현황</p>
            <p className="text-xs text-indigo-400 mt-0.5">전체 공무 합산</p>
          </div>
        </Link>

        {/* 공무별 카드 */}
        {(공무들 ?? []).map((g) => {
          const 누계 = 실적Map.get(g.id) ?? 0
          const 계획 = 계획Map.get(g.id) ?? 0
          const 달성률 = 계획 > 0 ? Math.round((누계 / 계획) * 100) : null
          return (
            <Link key={g.id} href={`/gongmu/${g.id}`} className="block">
              <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 transition-colors">
                <div className="w-10 h-10 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-sm mb-3">
                  {g.이름.slice(0, 1)}
                </div>
                <p className="font-semibold text-gray-900">{g.이름}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {달성률 !== null ? `이번달 달성률 ${달성률}%` : '계획 미설정'}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크 + 브라우저 확인**

```bash
npx tsc --noEmit
```

`http://localhost:3000/gongmu` → 종합 현황 + 공무담당자 카드 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/page.tsx
git commit -m "feat: 공무 선택 페이지 추가"
```

---

## Task 6: Server Actions + 계산 유틸

**Files:**
- Create: `src/app/(dashboard)/gongmu/_lib/actions.ts`
- Create: `src/app/(dashboard)/gongmu/_lib/calc.ts`

- [ ] **Step 1: calc.ts 작성**

```typescript
// src/app/(dashboard)/gongmu/_lib/calc.ts
import type { 공무_주간보고Row, 공무_월간계획Row } from '@/types/database'

/** 해당 월 누적실적 = 현재 주차 포함 이전 주차들의 금주실적 합산 */
export function calc누적실적(
  rows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적'>[],
  currentWeek: number,
  currentYear: number,
): number {
  return rows
    .filter((r) => r.year < currentYear || (r.year === currentYear && r.week_no < currentWeek))
    .reduce((sum, r) => sum + r.금주실적, 0)
}

/** 금주 실적 합산 */
export function calc금주실적합산(rows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적'>[], week: number, year: number): number {
  return rows.filter((r) => r.year === year && r.week_no === week).reduce((sum, r) => sum + r.금주실적, 0)
}

/** 달성률 (%) */
export function calc달성률(누계: number, 계획: number): number | null {
  if (계획 <= 0) return null
  return Math.round((누계 / 계획) * 100 * 10) / 10
}

/** 월간계획 합산 (공사 or 공무 구분) */
export function calc월간계획(plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[], 구분: '공사' | '공무'): number {
  return plans.filter((p) => p.구분 === 구분).reduce((sum, p) => sum + p.월간계획금액, 0)
}
```

- [ ] **Step 2: actions.ts 작성**

```typescript
// src/app/(dashboard)/gongmu/_lib/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { 공무_주간보고Insert } from '@/types/database'

/** 월간계획 upsert */
export async function upsert월간계획(
  공무_id: number,
  year: number,
  month: number,
  구분: '공사' | '공무',
  월간계획금액: number,
) {
  const supabase = await createClient()
  await supabase.from('공무_월간계획').upsert(
    { 공무_id, year, month, 구분, 월간계획금액 },
    { onConflict: '공무_id,year,month,구분' },
  )
  revalidatePath(`/gongmu/${공무_id}`)
}

/** 주간 보고 행 일괄 저장 (해당 주차 전체 교체) */
export async function save주간보고(
  공무_id: number,
  year: number,
  week_no: number,
  rows: Omit<공무_주간보고Insert, 'id'>[],
) {
  const supabase = await createClient()
  // 기존 행 삭제
  await supabase
    .from('공무_주간보고')
    .delete()
    .eq('공무_id', 공무_id)
    .eq('year', year)
    .eq('week_no', week_no)
  // 새 행 삽입
  if (rows.length > 0) {
    await supabase.from('공무_주간보고').insert(rows)
  }
  revalidatePath(`/gongmu/${공무_id}`)
}

/** 단일 행 삭제 */
export async function delete주간보고행(id: number, 공무_id: number) {
  const supabase = await createClient()
  await supabase.from('공무_주간보고').delete().eq('id', id)
  revalidatePath(`/gongmu/${공무_id}`)
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/_lib/actions.ts \
        src/app/\(dashboard\)/gongmu/_lib/calc.ts
git commit -m "feat: 공무 보고서 server actions + 계산 유틸 추가"
```

---

## Task 7: 개인 공무 화면 — 페이지 + 월간 요약

**Files:**
- Create: `src/app/(dashboard)/gongmu/[id]/page.tsx`
- Create: `src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx`

- [ ] **Step 1: MonthlySummary.tsx 작성**

```tsx
// src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx
import { Card, CardContent } from '@/components/ui/card'
import type { 공무_월간계획Row, 공무_주간보고Row } from '@/types/database'
import { calc누적실적, calc금주실적합산, calc달성률, calc월간계획 } from '../../_lib/calc'
import { formatEok } from '@/lib/format'

type Props = {
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  allRows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적' | '구분'>[]
  currentWeek: number
  currentYear: number
}

function PlanCard({
  label, 계획, 누계, 달성률,
}: { label: string; 계획: number; 누계: number; 달성률: number | null }) {
  const pct = 달성률 ?? 0
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
  return (
    <Card className="bg-white shadow-sm border-0">
      <CardContent className="px-5 py-4">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-xl font-bold text-gray-900">{formatEok(계획)}</p>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          누계 {formatEok(누계)}
          {달성률 !== null ? ` · 달성률 ${달성률}%` : ' · 계획 미설정'}
        </p>
      </CardContent>
    </Card>
  )
}

export function MonthlySummary({ plans, allRows, currentWeek, currentYear }: Props) {
  const 공사계획 = calc월간계획(plans, '공사')
  const 공무계획 = calc월간계획(plans, '공무')

  const 공사rows = allRows.filter((r) => r.구분 === '공사')
  const 공무rows = allRows.filter((r) => r.구분 === '공무')

  const 공사누계 = calc누적실적(공사rows, currentWeek, currentYear) + calc금주실적합산(공사rows, currentWeek, currentYear)
  const 공무누계 = calc누적실적(공무rows, currentWeek, currentYear) + calc금주실적합산(공무rows, currentWeek, currentYear)
  const 금주합산 = calc금주실적합산(allRows, currentWeek, currentYear)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <PlanCard label="월간계획 (공사)" 계획={공사계획} 누계={공사누계} 달성률={calc달성률(공사누계, 공사계획)} />
      <PlanCard label="월간계획 (공무)" 계획={공무계획} 누계={공무누계} 달성률={calc달성률(공무누계, 공무계획)} />
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">이번주 금주실적</p>
          <p className="text-xl font-bold text-gray-900">{formatEok(금주합산)}</p>
          <p className="text-xs text-gray-500 mt-1.5">공사+공무 합산</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: [id]/page.tsx 작성**

```tsx
// src/app/(dashboard)/gongmu/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import { MonthlySummary } from './_components/MonthlySummary'
import { WeeklyReportForm } from './_components/WeeklyReportForm'

export default async function GongmuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string; week?: string; month?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const 공무_id = Number(id)

  const supabase = await createClient()
  const { data: 공무 } = await supabase.from('공무담당자').select('id, 이름').eq('id', 공무_id).single()
  if (!공무) notFound()

  const now = new Date()
  const { year: curYear, week: curWeek } = getCurrentWeek()
  const selectedYear = sp.year ? Number(sp.year) : curYear
  const selectedWeek = sp.week ? Number(sp.week) : curWeek
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1
  const weekOptions = getWeeksInMonth(selectedYear, month)

  const [planResult, allRowsResult, weekRowsResult, 수주Result, 공무담당자Result] = await Promise.all([
    supabase.from('공무_월간계획').select('구분, 월간계획금액').eq('공무_id', 공무_id).eq('year', selectedYear).eq('month', month),
    supabase.from('공무_주간보고').select('week_no, year, 금주실적, 구분').eq('공무_id', 공무_id).eq('year', selectedYear),
    supabase.from('공무_주간보고').select('*').eq('공무_id', 공무_id).eq('year', selectedYear).eq('week_no', selectedWeek).order('항목순서'),
    supabase.from('수주').select('id, 지중no, 공사명').eq('준공여부', false).order('지중no'),
    supabase.from('공무담당자').select('id, 이름').order('이름'),
  ])

  // ERP 초안: 해당 주차에 담당공무가 현재 공무인 공사이력·기성 중 아직 저장 안 된 것
  const savedErp이력Ids = new Set((weekRowsResult.data ?? []).map((r) => r.erp_공사이력_id).filter(Boolean))
  const savedErp기성Ids = new Set((weekRowsResult.data ?? []).map((r) => r.erp_기성_id).filter(Boolean))

  const weekStart = weekOptions.find((w) => w.week === selectedWeek)
  const weekDates = weekStart ? { start: weekStart.label.match(/\((.+)~/)![1], end: weekStart.label.match(/~(.+)\)/)![1] } : null

  const [이력초안Result, 기성초안Result] = weekDates
    ? await Promise.all([
        supabase.from('공사이력')
          .select('id, 수주_id, 작업일자, 성과금액, 작업내용')
          .eq('담당공무_id', 공무_id)
          .gte('작업일자', `${selectedYear}-${weekDates.start}`)
          .lte('작업일자', `${selectedYear}-${weekDates.end}`),
        supabase.from('기성')
          .select('id, 수주_id, 기성일, 기성액_공급가, 작업내용')
          .eq('담당공무_id', 공무_id)
          .gte('기성일', `${selectedYear}-${weekDates.start}`)
          .lte('기성일', `${selectedYear}-${weekDates.end}`),
      ])
    : [{ data: [] }, { data: [] }]

  const 이력초안 = ((이력초안Result.data ?? []) as { id: number; 수주_id: number | null; 작업일자: string; 성과금액: number | null; 작업내용: string | null }[])
    .filter((r) => !savedErp이력Ids.has(r.id))
  const 기성초안 = ((기성초안Result.data ?? []) as { id: number; 수주_id: number | null; 기성일: string | null; 기성액_공급가: number | null; 작업내용: string | null }[])
    .filter((r) => !savedErp기성Ids.has(r.id))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1e2d5a] flex items-center justify-center text-white font-bold text-sm">
            {공무.이름.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{공무.이름}</h1>
            <p className="text-sm text-gray-400">{selectedYear}년 {month}월 주간업무보고</p>
          </div>
        </div>
        <Link href="/gongmu" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
          ← 목록
        </Link>
      </div>

      <MonthlySummary
        plans={planResult.data ?? []}
        allRows={allRowsResult.data ?? []}
        currentWeek={selectedWeek}
        currentYear={selectedYear}
      />

      {/* 주차 탭 */}
      <div className="flex gap-2 flex-wrap">
        {weekOptions.map((w) => (
          <Link
            key={`${w.isoYear}-${w.week}`}
            href={`/gongmu/${공무_id}?year=${w.isoYear}&week=${w.week}&month=${month}`}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              w.week === selectedWeek && w.isoYear === selectedYear
                ? 'bg-[#1e2d5a] text-white border-[#1e2d5a]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {w.label}
            {w.week === curWeek && w.isoYear === curYear && ' ✦'}
          </Link>
        ))}
      </div>

      <WeeklyReportForm
        공무_id={공무_id}
        year={selectedYear}
        week_no={selectedWeek}
        savedRows={weekRowsResult.data ?? []}
        이력초안={이력초안}
        기성초안={기성초안}
        수주목록={수주Result.data ?? []}
        공무담당자목록={공무담당자Result.data ?? []}
        plans={planResult.data ?? []}
        month={month}
      />
    </div>
  )
}
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/\[id\]/page.tsx \
        src/app/\(dashboard\)/gongmu/\[id\]/_components/MonthlySummary.tsx
git commit -m "feat: 개인 공무 화면 페이지 + 월간 요약 카드 추가"
```

---

## Task 8: WeeklyReportForm — 주간 보고 편집 폼

**Files:**
- Create: `src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx`

- [ ] **Step 1: WeeklyReportForm.tsx 작성**

```tsx
// src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { save주간보고, upsert월간계획 } from '../../_lib/actions'
import type { 공무_주간보고Row, 공무_월간계획Row } from '@/types/database'

type 수주항목 = { id: number; 지중no: string; 공사명: string }
type 보고행 = {
  id?: number
  지중no: string
  공사명: string
  금주작업: string
  차주작업: string
  금주계획: number
  금주실적: number
  차주계획: number
  구분: '공사' | '공무'
  비고: string
  isDraft?: boolean
  erp_공사이력_id?: number | null
  erp_기성_id?: number | null
}

type Props = {
  공무_id: number
  year: number
  week_no: number
  savedRows: 공무_주간보고Row[]
  이력초안: { id: number; 수주_id: number | null; 성과금액: number | null; 작업내용: string | null }[]
  기성초안: { id: number; 수주_id: number | null; 기성액_공급가: number | null; 작업내용: string | null }[]
  수주목록: 수주항목[]
  공무담당자목록: { id: number; 이름: string }[]
  plans: Pick<공무_월간계획Row, '구분' | '월간계획금액'>[]
  month: number
}

function NumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className="w-full text-right text-xs border-0 bg-transparent outline-none focus:bg-blue-50 rounded px-1"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  )
}

function TextCell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      className="w-full text-xs border-0 bg-transparent outline-none focus:bg-blue-50 rounded px-1"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function 공사SearchCell({ value, onChange, 수주목록 }: { value: string; onChange: (지중no: string, 공사명: string) => void; 수주목록: 수주항목[] }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const filtered = query
    ? 수주목록.filter((s) => s.지중no.includes(query) || s.공사명.includes(query)).slice(0, 8)
    : []

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full text-xs border-0 bg-transparent outline-none focus:bg-blue-50 rounded px-1"
        value={query}
        placeholder="지중No 검색..."
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-48 max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s.지중no, s.공사명); setQuery(s.지중no); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
            >
              <span className="font-mono text-gray-400 mr-1">{s.지중no}</span>{s.공사명}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(query, query); setOpen(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t"
          >
            "{query}" 직접 입력
          </button>
        </div>
      )}
    </div>
  )
}

export function WeeklyReportForm({ 공무_id, year, week_no, savedRows, 이력초안, 기성초안, 수주목록, plans, month }: Props) {
  const [pending, startTransition] = useTransition()
  const [공사계획금액, set공사계획금액] = useState(plans.find((p) => p.구분 === '공사')?.월간계획금액 ?? 0)
  const [공무계획금액, set공무계획금액] = useState(plans.find((p) => p.구분 === '공무')?.월간계획금액 ?? 0)

  const initRows = (): 보고행[] => {
    const saved: 보고행[] = savedRows.map((r) => ({
      id: r.id,
      지중no: r.지중no ?? '',
      공사명: r.공사명,
      금주작업: r.금주작업 ?? '',
      차주작업: r.차주작업 ?? '',
      금주계획: r.금주계획,
      금주실적: r.금주실적,
      차주계획: r.차주계획,
      구분: r.구분,
      비고: r.비고 ?? '',
      erp_공사이력_id: r.erp_공사이력_id,
      erp_기성_id: r.erp_기성_id,
    }))
    const drafts공사: 보고행[] = 이력초안.map((d) => {
      const 수주 = 수주목록.find((s) => s.id === d.수주_id)
      return {
        지중no: 수주?.지중no ?? '',
        공사명: 수주?.공사명 ?? '',
        금주작업: d.작업내용 ?? '',
        차주작업: '',
        금주계획: 0,
        금주실적: d.성과금액 ?? 0,
        차주계획: 0,
        구분: '공사',
        비고: '',
        isDraft: true,
        erp_공사이력_id: d.id,
      }
    })
    const drafts공무: 보고행[] = 기성초안.map((d) => ({
      지중no: '',
      공사명: '',
      금주작업: d.작업내용 ?? '',
      차주작업: '',
      금주계획: 0,
      금주실적: d.기성액_공급가 ?? 0,
      차주계획: 0,
      구분: '공무',
      비고: '',
      isDraft: true,
      erp_기성_id: d.id,
    }))
    return [...saved, ...drafts공사, ...drafts공무]
  }

  const [rows, setRows] = useState<보고행[]>(initRows)

  const update = (i: number, patch: Partial<보고행>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addRow = (구분: '공사' | '공무') =>
    setRows((prev) => [...prev, { 지중no: '', 공사명: '', 금주작업: '', 차주작업: '', 금주계획: 0, 금주실적: 0, 차주계획: 0, 구분, 비고: '' }])

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    startTransition(async () => {
      await upsert월간계획(공무_id, year, month, '공사', 공사계획금액)
      await upsert월간계획(공무_id, year, month, '공무', 공무계획금액)
      await save주간보고(
        공무_id, year, week_no,
        rows.map((r, i) => ({
          공무_id, year, week_no,
          항목순서: i,
          지중no: r.지중no || null,
          공사명: r.공사명,
          금주작업: r.금주작업 || null,
          차주작업: r.차주작업 || null,
          금주계획: r.금주계획,
          금주실적: r.금주실적,
          차주계획: r.차주계획,
          구분: r.구분,
          비고: r.비고 || null,
          erp_공사이력_id: r.erp_공사이력_id ?? null,
          erp_기성_id: r.erp_기성_id ?? null,
        })),
      )
    })
  }

  const th = 'text-[10px] font-semibold text-gray-500 px-2 py-2 bg-gray-50 text-left'
  const td = (draft?: boolean) => `px-1 py-1.5 border-b border-gray-50 text-xs ${draft ? 'bg-blue-50/40' : ''}`

  const renderTable = (구분: '공사' | '공무') => {
    const tableRows = rows.map((r, i) => ({ ...r, idx: i })).filter((r) => r.구분 === 구분)
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-[#1e2d5a] text-white text-xs font-semibold px-4 py-2.5 flex justify-between">
          <span>{구분 === '공사' ? '공사 파트' : '공무 파트'}</span>
          <span className="text-blue-300 font-normal text-[11px]">
            금주실적 합계: {tableRows.reduce((s, r) => s + r.금주실적, 0).toLocaleString()}원
          </span>
        </div>
        <table className="w-full table-fixed text-xs">
          <colgroup>
            {구분 === '공사' && <col style={{ width: '90px' }} />}
            <col style={{ width: 구분 === '공사' ? '30px' : '30px' }} />
            <col />
            <col />
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '28px' }} />
          </colgroup>
          <thead>
            <tr>
              {구분 === '공사' && <th className={th}>지중No</th>}
              <th className={th}>{구분 === '공사' ? '공사명' : '#'}</th>
              <th className={th}>금주 작업</th>
              <th className={th}>차주 작업</th>
              <th className={`${th} text-right`}>금주계획</th>
              <th className={`${th} text-right`}>금주실적</th>
              <th className={`${th} text-right`}>차주계획</th>
              <th className={th}>비고</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, rowIdx) => (
              <tr key={r.idx} className={r.isDraft ? 'bg-blue-50/30' : ''}>
                {구분 === '공사' && (
                  <td className={td(r.isDraft)}>
                    <공사SearchCell
                      value={r.지중no}
                      onChange={(지중no, 공사명) => update(r.idx, { 지중no, 공사명 })}
                      수주목록={수주목록}
                    />
                  </td>
                )}
                <td className={td(r.isDraft)}>
                  {구분 === '공사'
                    ? <TextCell value={r.공사명} onChange={(v) => update(r.idx, { 공사명: v })} />
                    : <span className="text-gray-400 px-1">{rowIdx + 1}</span>
                  }
                </td>
                <td className={td(r.isDraft)}>
                  <TextCell value={r.금주작업} onChange={(v) => update(r.idx, { 금주작업: v })} placeholder="작업 내용..." />
                </td>
                <td className={td(r.isDraft)}>
                  <TextCell value={r.차주작업} onChange={(v) => update(r.idx, { 차주작업: v })} placeholder="차주 계획..." />
                </td>
                <td className={td(r.isDraft)}>
                  <NumberCell value={r.금주계획} onChange={(v) => update(r.idx, { 금주계획: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <NumberCell value={r.금주실적} onChange={(v) => update(r.idx, { 금주실적: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <NumberCell value={r.차주계획} onChange={(v) => update(r.idx, { 차주계획: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <TextCell value={r.비고} onChange={(v) => update(r.idx, { 비고: v })} />
                </td>
                <td className={td(r.isDraft)}>
                  <button type="button" onClick={() => removeRow(r.idx)} className="text-gray-300 hover:text-red-400 px-1">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => addRow(구분)}
          className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-dashed border-gray-200 hover:bg-gray-50 transition-colors"
        >
          + {구분 === '공사' ? '공사' : '공무'} 행 추가
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* 월간계획 입력 */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">월간계획 (공사)</span>
          <input
            type="number"
            className="h-8 text-sm border border-gray-200 rounded px-2 w-32"
            value={공사계획금액 || ''}
            placeholder="0"
            onChange={(e) => set공사계획금액(Number(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-400">원</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">월간계획 (공무)</span>
          <input
            type="number"
            className="h-8 text-sm border border-gray-200 rounded px-2 w-32"
            value={공무계획금액 || ''}
            placeholder="0"
            onChange={(e) => set공무계획금액(Number(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-400">원</span>
        </div>
      </div>

      {renderTable('공사')}
      {renderTable('공무')}

      <div className="flex justify-end gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          className="border-blue-400 text-blue-600"
          onClick={() => {/* Task 9에서 구현 */}}
        >
          ↓ 엑셀 내보내기
        </Button>
        <Button
          size="sm"
          className="bg-[#1e2d5a] hover:bg-[#2d45a8] text-white"
          onClick={handleSave}
          disabled={pending}
        >
          {pending ? '저장 중...' : '저장'}
        </Button>
      </div>

      {이력초안.length > 0 || 기성초안.length > 0 ? (
        <p className="text-xs text-blue-500 mt-2 text-right">
          ✦ 파란 배경 행은 ERP에서 불러온 초안입니다. 자유롭게 편집 후 저장하세요.
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 브라우저 확인**

`http://localhost:3000/gongmu/1` → 공무 화면 로드, 공사/공무 파트 테이블 표시, 행 추가/삭제, 저장 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/\[id\]/_components/WeeklyReportForm.tsx
git commit -m "feat: 주간 보고 편집 폼 (WeeklyReportForm) 추가"
```

---

## Task 9: 종합 탭

**Files:**
- Create: `src/app/(dashboard)/gongmu/total/page.tsx`

- [ ] **Step 1: total/page.tsx 작성**

```tsx
// src/app/(dashboard)/gongmu/total/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, getWeeksInMonth } from '@/lib/week'
import { Card, CardContent } from '@/components/ui/card'
import { calc달성률, calc금주실적합산 } from '../_lib/calc'
import { formatEok } from '@/lib/format'

export const metadata = { title: '공무 종합 현황 | 영전사 ERP' }

export default async function GongmuTotalPage() {
  const supabase = await createClient()
  const { year, week } = getCurrentWeek()
  const now = new Date()
  const month = now.getMonth() + 1
  const weeks = getWeeksInMonth(year, month).map((w) => w.week)

  const { data: 공무들 } = await supabase.from('공무담당자').select('id, 이름').order('이름')
  if (!공무들 || 공무들.length === 0) {
    return <div className="p-6 text-gray-500">등록된 공무담당자가 없습니다.</div>
  }

  const ids = 공무들.map((g) => g.id)

  const [rowsResult, plansResult] = await Promise.all([
    supabase.from('공무_주간보고').select('공무_id, week_no, year, 금주실적, 구분').in('공무_id', ids).eq('year', year),
    supabase.from('공무_월간계획').select('공무_id, 구분, 월간계획금액').in('공무_id', ids).eq('year', year).eq('month', month),
  ])

  const allRows = rowsResult.data ?? []
  const allPlans = plansResult.data ?? []

  const 총계획 = allPlans.reduce((s, p) => s + p.월간계획금액, 0)
  const 총금주 = calc금주실적합산(allRows, week, year)
  const 총누계 = allRows.filter((r) => r.year === year && weeks.includes(r.week_no)).reduce((s, r) => s + r.금주실적, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">종합 현황</h1>
          <p className="text-sm text-gray-400">{year}년 {month}월</p>
        </div>
        <Link href="/gongmu" className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">← 목록</Link>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '총 월간계획', value: formatEok(총계획) },
          { label: '총 누적실적', value: formatEok(총누계) },
          { label: '이번주 금주실적', value: formatEok(총금주) },
          { label: '전체 달성률', value: 총계획 > 0 ? `${calc달성률(총누계, 총계획)}%` : '—' },
        ].map(({ label, value }) => (
          <Card key={label} className="bg-white shadow-sm border-0">
            <CardContent className="px-5 py-4">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 공무별 달성률 */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-600 mb-4">공무별 달성률</p>
          <div className="space-y-3">
            {공무들.map((g) => {
              const 계획 = allPlans.filter((p) => p.공무_id === g.id).reduce((s, p) => s + p.월간계획금액, 0)
              const 누계 = allRows.filter((r) => r.공무_id === g.id && weeks.includes(r.week_no)).reduce((s, r) => s + r.금주실적, 0)
              const pct = calc달성률(누계, 계획) ?? 0
              const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3d5af1'
              return (
                <Link key={g.id} href={`/gongmu/${g.id}`} className="flex items-center gap-3 hover:bg-gray-50 rounded p-1 -m-1 transition-colors">
                  <span className="w-16 text-sm font-medium text-gray-800 shrink-0">{g.이름}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold" style={{ color }}>
                    {계획 > 0 ? `${pct}%` : '—'}
                  </span>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크 + 브라우저 확인**

```bash
npx tsc --noEmit
```

`http://localhost:3000/gongmu/total` → 요약 카드 4개, 공무별 달성률 바 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/total/page.tsx
git commit -m "feat: 공무 종합 현황 탭 추가"
```

---

## Task 10: 엑셀 내보내기

**Files:**
- Create: `src/app/(dashboard)/gongmu/_lib/excel.ts`
- Modify: `src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx`

- [ ] **Step 1: excel.ts 작성**

```typescript
// src/app/(dashboard)/gongmu/_lib/excel.ts
import * as XLSX from 'xlsx'
import type { 공무_주간보고Row } from '@/types/database'

type ExportRow = Pick<공무_주간보고Row, '지중no' | '공사명' | '금주작업' | '차주작업' | '금주계획' | '금주실적' | '차주계획' | '구분' | '비고'>

export function exportWeeklyReport(
  이름: string,
  year: number,
  week_no: number,
  weekLabel: string,
  rows: ExportRow[],
) {
  const wb = XLSX.utils.book_new()

  const headers = ['구분', '지중No / 번호', '공사명 / 작업항목', '금주 작업', '차주 작업', '금주계획', '금주실적', '차주계획', '비고']

  const data = rows.map((r, i) => [
    r.구분,
    r.구분 === '공사' ? (r.지중no ?? '') : String(i + 1),
    r.공사명,
    r.금주작업 ?? '',
    r.차주작업 ?? '',
    r.금주계획,
    r.금주실적,
    r.차주계획,
    r.비고 ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([
    [`${이름} 주간업무보고 — ${year}년 ${weekLabel}`],
    [],
    headers,
    ...data,
  ])

  // 컬럼 너비
  ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws, `${year}-W${week_no}`)
  XLSX.writeFile(wb, `${이름}_주간업무보고_${year}W${String(week_no).padStart(2, '0')}.xlsx`)
}
```

- [ ] **Step 2: WeeklyReportForm의 엑셀 버튼에 핸들러 연결**

`WeeklyReportForm.tsx`에 import 추가:
```typescript
import { exportWeeklyReport } from '../../_lib/excel'
```

컴포넌트 props에 `weekLabel` 추가 (page.tsx에서 현재 주차 label 전달):
```typescript
weekLabel: string
```

엑셀 버튼 onClick 수정:
```tsx
onClick={() =>
  exportWeeklyReport(이름, year, week_no, weekLabel, rows.map((r) => ({
    지중no: r.지중no || null,
    공사명: r.공사명,
    금주작업: r.금주작업,
    차주작업: r.차주작업,
    금주계획: r.금주계획,
    금주실적: r.금주실적,
    차주계획: r.차주계획,
    구분: r.구분,
    비고: r.비고,
  })))
}
```

`page.tsx`에서 `WeeklyReportForm`에 `weekLabel` 및 `이름` props 추가:
```tsx
<WeeklyReportForm
  ...
  이름={공무.이름}
  weekLabel={weekOptions.find((w) => w.week === selectedWeek)?.label ?? ''}
/>
```

- [ ] **Step 3: 타입 체크 + 동작 확인**

```bash
npx tsc --noEmit
```

브라우저에서 엑셀 내보내기 버튼 클릭 → `.xlsx` 파일 다운로드, 내용 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(dashboard\)/gongmu/_lib/excel.ts \
        src/app/\(dashboard\)/gongmu/\[id\]/_components/WeeklyReportForm.tsx
git commit -m "feat: 공무 주간보고 엑셀 내보내기 추가"
```

---

## Task 11: 사이드바 메뉴 추가

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`
- Modify: `src/components/sidebar/MobileTabBar.tsx`

- [ ] **Step 1: Sidebar.tsx에 공무 보고서 메뉴 추가**

`mainNav` 배열에 항목 추가:
```typescript
import { FileText } from 'lucide-react' // 상단 import에 추가

const mainNav = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주대장', icon: ClipboardList },
  { href: '/input', label: '투입실적', icon: PenLine },
  { href: '/progress', label: '공사이력', icon: Activity },
  { href: '/sales', label: '매출손익 현황', icon: TrendingUp },
  { href: '/gongmu', label: '공무 보고서', icon: FileText }, // 추가
] as const
```

- [ ] **Step 2: MobileTabBar.tsx 확인 후 동일하게 추가**

`src/components/sidebar/MobileTabBar.tsx`를 열어 탭 배열을 확인하고, 동일하게 공무 보고서 탭 추가.

- [ ] **Step 3: 타입 체크 + 브라우저 확인**

```bash
npx tsc --noEmit
```

사이드바에 "공무 보고서" 메뉴 표시 확인. 클릭 시 `/gongmu` 이동 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/components/sidebar/Sidebar.tsx src/components/sidebar/MobileTabBar.tsx
git commit -m "feat: 사이드바에 공무 보고서 메뉴 추가"
```
