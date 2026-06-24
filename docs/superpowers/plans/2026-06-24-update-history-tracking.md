# 변경내역 추적 (Update History Tracking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 ERP의 모든 데이터 변경(INSERT/UPDATE/DELETE)을 DB 트리거로 `audit_log`에 기록하고, 관리자가 `/admin/updates`에서 기간·분류별로 조회해 레거시 ERP에 옮길 수 있게 한다.

**Architecture:** Postgres `AFTER INSERT/UPDATE/DELETE` 트리거가 범용 함수로 각 대상 테이블의 행 스냅샷(jsonb)을 `audit_log`에 적재한다. Next.js 서버 페이지가 기간(URL searchParams)으로 로그를 조회하고, 순수 함수로 분류 라벨과 사람이 읽는 요약(FK id→이름 해석)을 만들어 클라이언트에 넘긴다. 클라이언트는 분류 필터·행 펼치기만 담당.

**Tech Stack:** Supabase(Postgres), Next.js App Router(서버/클라이언트 컴포넌트), TypeScript, Vitest, Tailwind.

참조 스펙: `docs/superpowers/specs/2026-06-24-update-history-tracking-design.md`

---

## File Structure

- `supabase/migrations/20260624120000_audit_log.sql` — **신규**. `audit_log` 테이블 + 범용 트리거 함수 + 대상 테이블 트리거 + RLS.
- `src/types/database.ts` — **수정**. `audit_log` 타입 추가.
- `src/app/(dashboard)/admin/updates/_lib/types.ts` — **신규**. `AuditLogRow`, `LookupMaps`, `Category`, `PreparedEntry` 타입.
- `src/app/(dashboard)/admin/updates/_lib/category.ts` — **신규**. `deriveCategory()` 순수 함수.
- `src/app/(dashboard)/admin/updates/_lib/category.test.ts` — **신규**.
- `src/app/(dashboard)/admin/updates/_lib/format.ts` — **신규**. `formatSummary()`, `prepareEntry()`, `formatWon()` 순수 함수.
- `src/app/(dashboard)/admin/updates/_lib/format.test.ts` — **신규**.
- `src/app/(dashboard)/admin/updates/page.tsx` — **신규**. 서버: 로그 fetch + 조회 맵 로드 + prepareEntry.
- `src/app/(dashboard)/admin/updates/_components/UpdatesClient.tsx` — **신규**. 필터 + 테이블 + 펼치기.
- `src/components/sidebar/Sidebar.tsx` — **수정**. `/admin/updates` 링크 추가.

대상 테이블(트리거 부착): `수주`, `기성`, `공사이력`, `투입실적`, `투입실적상세`, `공사현장`, `거래처`, `공사단가`, `공무담당자`.

---

## Task 1: 마이그레이션 — audit_log 테이블 + 트리거 + RLS

**Files:**
- Create: `supabase/migrations/20260624120000_audit_log.sql`

이 작업은 SQL이라 단위 테스트 대신 적용 후 수동 검증한다.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/20260624120000_audit_log.sql`:

```sql
-- 변경내역 추적: 모든 대상 테이블의 INSERT/UPDATE/DELETE를 audit_log에 적재.
-- 레거시 ERP 이중입력을 위한 한시적 운영 보조. (수개월 후 프루닝/드롭 대상)

create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  operation   text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_id      bigint,
  old_data    jsonb,
  new_data    jsonb,
  changed_at  timestamptz not null default now()
);

-- 기간 조회용 인덱스 (기본 정렬 = changed_at desc)
create index audit_log_changed_at_idx on public.audit_log (changed_at desc);

-- 범용 트리거 함수.
-- security definer 이유: audit_log에 RLS를 켜면, 일반 사용자의 mutation이
-- 트리거로 audit_log에 INSERT를 시도할 때 RLS에 막혀 원래 작업까지 실패한다.
-- 함수를 소유자(postgres) 권한으로 실행해 RLS를 우회한다.
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
    values (tg_table_name, tg_op, old.id, to_jsonb(old), null);
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
    values (tg_table_name, tg_op, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  else -- INSERT
    insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
    values (tg_table_name, tg_op, new.id, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

-- 대상 테이블마다 트리거 부착
create trigger audit_수주          after insert or update or delete on public.수주          for each row execute function public.audit_trigger();
create trigger audit_기성          after insert or update or delete on public.기성          for each row execute function public.audit_trigger();
create trigger audit_공사이력      after insert or update or delete on public.공사이력      for each row execute function public.audit_trigger();
create trigger audit_투입실적      after insert or update or delete on public.투입실적      for each row execute function public.audit_trigger();
create trigger audit_투입실적상세  after insert or update or delete on public.투입실적상세  for each row execute function public.audit_trigger();
create trigger audit_공사현장      after insert or update or delete on public.공사현장      for each row execute function public.audit_trigger();
create trigger audit_거래처        after insert or update or delete on public.거래처        for each row execute function public.audit_trigger();
create trigger audit_공사단가      after insert or update or delete on public.공사단가      for each row execute function public.audit_trigger();
create trigger audit_공무담당자    after insert or update or delete on public.공무담당자    for each row execute function public.audit_trigger();

-- RLS: admin만 조회. INSERT/UPDATE/DELETE 정책 없음(클라이언트 직접 조작 불가).
alter table public.audit_log enable row level security;

create policy audit_log_admin_select on public.audit_log
  for select using ((select public.is_admin()));

comment on table public.audit_log is
  '변경내역 추적(레거시 ERP 이중입력용 한시적 도구). 트리거 audit_trigger가 적재.';
```

- [ ] **Step 2: 마이그레이션 적용**

Supabase 프로젝트에 적용한다(둘 중 환경에 맞는 방법):
- Supabase CLI: `supabase db push`
- 또는 Supabase 대시보드 SQL Editor에 위 SQL 붙여넣어 실행.

- [ ] **Step 3: 트리거 동작 수동 검증**

SQL Editor에서 INSERT/UPDATE/DELETE 1건씩 실행 후 audit_log 확인. 예(거래처로 검증, 검증 후 정리):

```sql
-- INSERT
insert into public.거래처 (거래처코드, 거래처명) values ('ZZTEST', '감사테스트') returning id;
-- 위 id를 사용해 UPDATE / DELETE
update public.거래처 set 거래처명 = '감사테스트2' where 거래처코드 = 'ZZTEST';
delete from public.거래처 where 거래처코드 = 'ZZTEST';

select table_name, operation, row_id, old_data->>'거래처명' as old명, new_data->>'거래처명' as new명, changed_at
from public.audit_log order by id desc limit 3;
```

Expected: 3행(INSERT/UPDATE/DELETE)이 changed_at 역순으로 조회되고, DELETE는 new_data null·old_data 존재, INSERT는 old_data null·new_data 존재.

- [ ] **Step 4: 검증 잔여물 정리 확인**

위 DELETE로 거래처 테스트행은 제거됨. audit_log의 테스트 3행은 남겨둬도 무방(실데이터 아님). 남기기 싫으면:

```sql
delete from public.audit_log where new_data->>'거래처코드' = 'ZZTEST' or old_data->>'거래처코드' = 'ZZTEST';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260624120000_audit_log.sql
git commit -m "feat(audit): audit_log 테이블·범용 트리거·RLS 추가"
```

---

## Task 2: database.ts 타입 추가

**Files:**
- Modify: `src/types/database.ts` (Tables 객체 안에 `audit_log` 추가)

- [ ] **Step 1: audit_log 타입 블록 추가**

`src/types/database.ts`의 `Tables: {` 내부(예: `공무담당자` 블록 뒤)에 추가:

```ts
      audit_log: {
        Row: {
          id: number
          table_name: string
          operation: 'INSERT' | 'UPDATE' | 'DELETE'
          row_id: number | null
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          changed_at: string
        }
        Insert: {
          id?: number
          table_name: string
          operation: 'INSERT' | 'UPDATE' | 'DELETE'
          row_id?: number | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          changed_at?: string
        }
        Update: {
          id?: number
          table_name?: string
          operation?: 'INSERT' | 'UPDATE' | 'DELETE'
          row_id?: number | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          changed_at?: string
        }
      }
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (또는 기존과 동일, 신규 에러 없음).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(audit): audit_log Database 타입 추가"
```

---

## Task 3: `_lib/types.ts` + `_lib/category.ts` (분류 도출, 순수 함수, TDD)

**Files:**
- Create: `src/app/(dashboard)/admin/updates/_lib/types.ts`
- Create: `src/app/(dashboard)/admin/updates/_lib/category.ts`
- Test: `src/app/(dashboard)/admin/updates/_lib/category.test.ts`

- [ ] **Step 1: 공유 타입 작성**

`src/app/(dashboard)/admin/updates/_lib/types.ts`:

```ts
// audit_log 행(페이지가 DB에서 읽는 형태)
export interface AuditLogRow {
  id: number
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: number | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_at: string
}

// FK id → 이름 해석용. 서버에서 한 번 로드해 주입.
export interface LookupMaps {
  거래처: Map<number, string>      // id → 거래처명
  공무담당자: Map<number, string>  // id → 이름
  수주: Map<number, string>        // id → 공사명
}

// 화면 필터 그룹
export type CategoryGroup =
  | '수주' | '준공완료' | '기성' | '공사이력' | '투입실적' | '마스터'

export interface Category {
  group: CategoryGroup
  label: string // 예: "수주등록", "준공완료", "마스터: 거래처 수정"
}

// 클라이언트로 넘기는 가공된 행
export interface PreparedEntry {
  id: number
  changed_at: string
  category: Category
  summary: string
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: number | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}
```

- [ ] **Step 2: 실패 테스트 작성**

`src/app/(dashboard)/admin/updates/_lib/category.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveCategory } from './category'
import type { AuditLogRow } from './types'

function row(p: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: 1, table_name: '수주', operation: 'INSERT',
    row_id: 1, old_data: null, new_data: null, changed_at: '2026-06-24T00:00:00Z',
    ...p,
  }
}

describe('deriveCategory', () => {
  it('수주 INSERT → 수주등록', () => {
    expect(deriveCategory(row({ table_name: '수주', operation: 'INSERT' })))
      .toEqual({ group: '수주', label: '수주등록' })
  })

  it('수주 UPDATE 준공여부 false→true → 준공완료', () => {
    const c = deriveCategory(row({
      table_name: '수주', operation: 'UPDATE',
      old_data: { 준공여부: false }, new_data: { 준공여부: true },
    }))
    expect(c).toEqual({ group: '준공완료', label: '준공완료' })
  })

  it('수주 UPDATE 준공여부 변화 없음 → 수주수정', () => {
    const c = deriveCategory(row({
      table_name: '수주', operation: 'UPDATE',
      old_data: { 준공여부: false }, new_data: { 준공여부: false },
    }))
    expect(c).toEqual({ group: '수주', label: '수주수정' })
  })

  it('수주 DELETE → 수주삭제', () => {
    expect(deriveCategory(row({ table_name: '수주', operation: 'DELETE' })))
      .toEqual({ group: '수주', label: '수주삭제' })
  })

  it('기성 INSERT → 기성등록', () => {
    expect(deriveCategory(row({ table_name: '기성', operation: 'INSERT' })))
      .toEqual({ group: '기성', label: '기성등록' })
  })

  it('공사이력 UPDATE → 공사이력 수정', () => {
    expect(deriveCategory(row({ table_name: '공사이력', operation: 'UPDATE' })))
      .toEqual({ group: '공사이력', label: '공사이력 수정' })
  })

  it('투입실적상세도 투입실적 그룹으로 묶인다', () => {
    expect(deriveCategory(row({ table_name: '투입실적상세', operation: 'INSERT' })))
      .toEqual({ group: '투입실적', label: '투입실적 등록' })
  })

  it('거래처 UPDATE → 마스터 그룹', () => {
    expect(deriveCategory(row({ table_name: '거래처', operation: 'UPDATE' })))
      .toEqual({ group: '마스터', label: '마스터: 거래처 수정' })
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/admin/updates/_lib/category.test.ts"`
Expected: FAIL ("deriveCategory is not a function" 또는 모듈 없음).

- [ ] **Step 4: 구현**

`src/app/(dashboard)/admin/updates/_lib/category.ts`:

```ts
import type { AuditLogRow, Category, CategoryGroup } from './types'

const OP_KOR: Record<AuditLogRow['operation'], string> = {
  INSERT: '등록',
  UPDATE: '수정',
  DELETE: '삭제',
}

// table_name → 거래/계약 그룹 매핑 (없으면 마스터)
const GROUP_BY_TABLE: Record<string, CategoryGroup> = {
  수주: '수주',
  기성: '기성',
  공사이력: '공사이력',
  투입실적: '투입실적',
  투입실적상세: '투입실적',
}

function isCompletion(row: AuditLogRow): boolean {
  // 준공완료 = 수주 UPDATE 에서 준공여부 false → true
  return (
    row.operation === 'UPDATE' &&
    row.old_data?.준공여부 === false &&
    row.new_data?.준공여부 === true
  )
}

export function deriveCategory(row: AuditLogRow): Category {
  const op = OP_KOR[row.operation]

  if (row.table_name === '수주' && isCompletion(row)) {
    return { group: '준공완료', label: '준공완료' }
  }

  const group = GROUP_BY_TABLE[row.table_name]
  if (!group) {
    // 마스터 데이터(거래처/공사단가/공사현장/공무담당자 등)
    return { group: '마스터', label: `마스터: ${row.table_name} ${op}` }
  }

  // 수주는 라벨을 붙여쓰기(수주등록/수주수정/수주삭제), 나머지는 띄어쓰기
  const label = group === '수주' ? `수주${op}` : `${row.table_name} ${op}`
  return { group, label }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/admin/updates/_lib/category.test.ts"`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/admin/updates/_lib/types.ts" "src/app/(dashboard)/admin/updates/_lib/category.ts" "src/app/(dashboard)/admin/updates/_lib/category.test.ts"
git commit -m "feat(audit): 분류 라벨 도출 deriveCategory + 공유 타입"
```

---

## Task 4: `_lib/format.ts` (요약 + id→이름 + prepareEntry, 순수 함수, TDD)

**Files:**
- Create: `src/app/(dashboard)/admin/updates/_lib/format.ts`
- Test: `src/app/(dashboard)/admin/updates/_lib/format.test.ts`

요약은 옛 ERP 재입력용이므로 금액은 억 변환 없이 정확한 원(천단위 콤마)으로 표기한다.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/(dashboard)/admin/updates/_lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatWon, formatSummary, prepareEntry } from './format'
import type { AuditLogRow, LookupMaps } from './types'

function lookups(): LookupMaps {
  return {
    거래처: new Map([[10, '○○건설'], [11, '△△전력']]),
    공무담당자: new Map([[5, '홍길동']]),
    수주: new Map([[100, '○○현장 신설']]),
  }
}

function row(p: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: 1, table_name: '수주', operation: 'INSERT',
    row_id: 1, old_data: null, new_data: null, changed_at: '2026-06-24T00:00:00Z',
    ...p,
  }
}

describe('formatWon', () => {
  it('정수 원을 천단위 콤마로', () => {
    expect(formatWon(1200000)).toBe('1,200,000원')
  })
  it('null 은 대시', () => {
    expect(formatWon(null)).toBe('-')
  })
})

describe('formatSummary', () => {
  it('수주등록: 공사명·발주자(이름)·금액', () => {
    const s = formatSummary(row({
      table_name: '수주', operation: 'INSERT',
      new_data: { 공사명: '○○현장 신설', 발주자_id: 10, 수주금액_공급가: 1200000, 준공여부: false },
    }), lookups())
    expect(s).toContain('○○현장 신설')
    expect(s).toContain('○○건설')
    expect(s).toContain('1,200,000원')
  })

  it('FK 이름 해석 실패 시 id:N 로 폴백', () => {
    const s = formatSummary(row({
      table_name: '수주', operation: 'INSERT',
      new_data: { 공사명: 'X', 발주자_id: 999, 수주금액_공급가: null, 준공여부: false },
    }), lookups())
    expect(s).toContain('id:999')
  })

  it('기성: 수주명(수주_id 해석)·차수·기성액', () => {
    const s = formatSummary(row({
      table_name: '기성', operation: 'INSERT',
      new_data: { 수주_id: 100, 차수: 2, 기성액_공급가: 500000, 기성일: '2026-06-20' },
    }), lookups())
    expect(s).toContain('○○현장 신설')
    expect(s).toContain('2차')
    expect(s).toContain('500,000원')
  })

  it('DELETE 는 old_data 기준으로 요약', () => {
    const s = formatSummary(row({
      table_name: '거래처', operation: 'DELETE',
      old_data: { 거래처명: '폐업건설', 거래처코드: 'C001' },
    }), lookups())
    expect(s).toContain('폐업건설')
  })
})

describe('prepareEntry', () => {
  it('category 와 summary 를 합쳐 PreparedEntry 생성', () => {
    const e = prepareEntry(row({
      id: 7, table_name: '수주', operation: 'INSERT',
      new_data: { 공사명: 'Y현장', 발주자_id: 10, 수주금액_공급가: 100, 준공여부: false },
    }), lookups())
    expect(e.id).toBe(7)
    expect(e.category.label).toBe('수주등록')
    expect(e.summary).toContain('Y현장')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/admin/updates/_lib/format.test.ts"`
Expected: FAIL (모듈/함수 없음).

- [ ] **Step 3: 구현**

`src/app/(dashboard)/admin/updates/_lib/format.ts`:

```ts
import { deriveCategory } from './category'
import type { AuditLogRow, LookupMaps, PreparedEntry } from './types'

export function formatWon(v: unknown): string {
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return `${v.toLocaleString('ko-KR')}원`
}

// FK id → 이름. 맵에 없으면 id:N 폴백, id 자체가 없으면 '-'.
function name(map: Map<number, string>, id: unknown): string {
  if (typeof id !== 'number') return '-'
  return map.get(id) ?? `id:${id}`
}

function str(v: unknown): string {
  return v == null ? '-' : String(v)
}

// 변경 후 스냅샷 우선, 없으면(삭제) 변경 전.
function snapshot(row: AuditLogRow): Record<string, unknown> {
  return row.new_data ?? row.old_data ?? {}
}

export function formatSummary(row: AuditLogRow, lookups: LookupMaps): string {
  const d = snapshot(row)
  const parts: string[] = []

  switch (row.table_name) {
    case '수주':
      parts.push(str(d.공사명))
      parts.push(`발주자 ${name(lookups.거래처, d.발주자_id)}`)
      if (d.원청사_id != null) parts.push(`원청 ${name(lookups.거래처, d.원청사_id)}`)
      if (d.공무담당자_id != null) parts.push(`공무 ${name(lookups.공무담당자, d.공무담당자_id)}`)
      // 준공완료면 준공일·준공액 부각
      if (d.준공여부 === true) {
        parts.push(`준공일 ${str(d.준공일)}`)
        parts.push(`준공액 ${formatWon(d.준공액_공급가)}`)
      } else {
        parts.push(`금액 ${formatWon(d.수주금액_공급가)}`)
      }
      break

    case '기성':
      parts.push(name(lookups.수주, d.수주_id))
      parts.push(`${str(d.차수)}차`)
      parts.push(`기성일 ${str(d.기성일)}`)
      parts.push(`기성액 ${formatWon(d.기성액_공급가)}`)
      break

    case '공사이력':
      parts.push(name(lookups.수주, d.수주_id))
      parts.push(`작업일 ${str(d.작업일자)}`)
      parts.push(`성과 ${formatWon(d.성과금액)}`)
      break

    case '투입실적':
      parts.push(name(lookups.수주, d.수주_id))
      parts.push(`투입일 ${str(d.투입일)}`)
      break

    case '투입실적상세':
      parts.push(`투입실적#${str(d.투입실적_id)}`)
      parts.push(str(d.투입구분))
      parts.push(`주 ${str(d.주간수량)} / 야 ${str(d.야간수량)}`)
      break

    case '거래처':
      parts.push(str(d.거래처명))
      parts.push(`코드 ${str(d.거래처코드)}`)
      break

    case '공사단가':
      parts.push(str(d.투입구분))
      parts.push(`주간 ${formatWon(d.주간단가)}`)
      if (d.야간단가 != null) parts.push(`야간 ${formatWon(d.야간단가)}`)
      parts.push(`적용 ${str(d.적용시작일)}`)
      break

    case '공사현장':
      parts.push(str(d.현장명))
      break

    case '공무담당자':
      parts.push(str(d.이름))
      break

    default:
      // 미지정 테이블: 행 id만
      parts.push(`#${str(row.row_id)}`)
  }

  return parts.join(' · ')
}

export function prepareEntry(row: AuditLogRow, lookups: LookupMaps): PreparedEntry {
  return {
    id: row.id,
    changed_at: row.changed_at,
    category: deriveCategory(row),
    summary: formatSummary(row, lookups),
    table_name: row.table_name,
    operation: row.operation,
    row_id: row.row_id,
    old_data: row.old_data,
    new_data: row.new_data,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/admin/updates/_lib/format.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/admin/updates/_lib/format.ts" "src/app/(dashboard)/admin/updates/_lib/format.test.ts"
git commit -m "feat(audit): 요약 포맷터·id→이름 해석·prepareEntry"
```

---

## Task 5: 서버 페이지 `page.tsx` (기간 조회 + 조회 맵 로드)

**Files:**
- Create: `src/app/(dashboard)/admin/updates/page.tsx`

기간은 URL searchParams(`from`,`to`)로 받고 서버에서 재조회. 분류 필터·펼치기는 클라이언트(Task 6). `/admin` 레이아웃이 이미 admin 게이트.

- [ ] **Step 1: 페이지 작성**

`src/app/(dashboard)/admin/updates/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { prepareEntry } from './_lib/format'
import type { AuditLogRow, LookupMaps, PreparedEntry } from './_lib/types'
import { UpdatesClient } from './_components/UpdatesClient'

export const dynamic = 'force-dynamic'

// 기본 기간 = 최근 7일
function defaultRange(): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - 7)
  const from = fromDate.toISOString().slice(0, 10)
  return { from, to }
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const def = defaultRange()
  const from = sp.from ?? def.from
  const to = sp.to ?? def.to

  const supabase = await createClient()

  // 기간 조회: to 는 그날 끝까지 포함하려고 +1일 미만(exclusive) 처리
  const toExclusive = `${to}T23:59:59.999Z`
  const fromInclusive = `${from}T00:00:00.000Z`

  const [{ data: logs }, { data: 거래처들 }, { data: 공무들 }, { data: 수주들 }] =
    await Promise.all([
      supabase
        .from('audit_log')
        .select('*')
        .gte('changed_at', fromInclusive)
        .lte('changed_at', toExclusive)
        .order('changed_at', { ascending: false })
        .limit(500),
      supabase.from('거래처').select('id, 거래처명'),
      supabase.from('공무담당자').select('id, 이름'),
      supabase.from('수주').select('id, 공사명'),
    ])

  const lookups: LookupMaps = {
    거래처: new Map((거래처들 ?? []).map((r) => [r.id, r.거래처명])),
    공무담당자: new Map((공무들 ?? []).map((r) => [r.id, r.이름])),
    수주: new Map((수주들 ?? []).map((r) => [r.id, r.공사명])),
  }

  const entries: PreparedEntry[] = (logs ?? []).map((row) =>
    prepareEntry(row as AuditLogRow, lookups),
  )

  return <UpdatesClient entries={entries} from={from} to={to} />
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (이 시점엔 UpdatesClient 미구현 → "Cannot find module './_components/UpdatesClient'" 에러가 정상. Task 6 후 재확인.)

- [ ] **Step 3: 커밋은 Task 6와 함께** (UpdatesClient 의존이라 단독 빌드 불가)

---

## Task 6: 클라이언트 `UpdatesClient.tsx` (필터 + 테이블 + 펼치기)

**Files:**
- Create: `src/app/(dashboard)/admin/updates/_components/UpdatesClient.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`src/app/(dashboard)/admin/updates/_components/UpdatesClient.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoryGroup, PreparedEntry } from '../_lib/types'

const GROUPS: CategoryGroup[] = ['수주', '준공완료', '기성', '공사이력', '투입실적', '마스터']

const OP_BADGE: Record<PreparedEntry['operation'], string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

interface Props {
  entries: PreparedEntry[]
  from: string
  to: string
}

export function UpdatesClient({ entries, from, to }: Props) {
  const router = useRouter()
  const [fromLocal, setFromLocal] = useState(from)
  const [toLocal, setToLocal] = useState(to)
  // 기본: 전체 그룹 선택
  const [selected, setSelected] = useState<Set<CategoryGroup>>(new Set(GROUPS))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function applyRange() {
    router.push(`/admin/updates?from=${fromLocal}&to=${toLocal}`)
  }

  function toggleGroup(g: CategoryGroup) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visible = useMemo(
    () => entries.filter((e) => selected.has(e.category.group)),
    [entries, selected],
  )

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">변경내역</h1>
        <p className="text-sm text-gray-500">
          신규 ERP에 입력된 변경을 기간·분류별로 조회 (레거시 ERP 이중입력용)
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="flex items-end gap-2">
        <label className="text-sm text-gray-600">
          시작
          <input
            type="date"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            className="block border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600">
          종료
          <input
            type="date"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            className="block border rounded px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={applyRange}
          className="px-3 py-1.5 rounded bg-[#2d45a8] text-white text-sm"
        >
          조회
        </button>
      </div>

      {/* 분류 필터 */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggleGroup(g)}
            className={
              'px-2.5 py-1 rounded-full text-xs border ' +
              (selected.has(g)
                ? 'bg-[#2d45a8] text-white border-[#2d45a8]'
                : 'bg-white text-gray-500 border-gray-300')
            }
          >
            {g}
          </button>
        ))}
      </div>

      {/* 결과 */}
      <p className="text-xs text-gray-400">{visible.length}건 (최대 500건)</p>
      <div className="border rounded-lg divide-y">
        {visible.length === 0 && (
          <p className="p-4 text-sm text-gray-400">해당 기간·분류의 변경내역이 없습니다.</p>
        )}
        {visible.map((e) => (
          <div key={e.id}>
            <button
              type="button"
              onClick={() => toggleExpand(e.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-xs text-gray-400 w-32 shrink-0">
                {new Date(e.changed_at).toLocaleString('ko-KR')}
              </span>
              <span
                className={'text-[11px] px-1.5 py-0.5 rounded shrink-0 ' + OP_BADGE[e.operation]}
              >
                {e.category.label}
              </span>
              <span className="text-sm text-gray-700 flex-1 truncate">{e.summary}</span>
              <span className="text-xs text-gray-300 shrink-0">#{e.row_id}</span>
            </button>
            {expanded.has(e.id) && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-3 bg-gray-50/50">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">변경 전 (old)</p>
                  <pre className="text-[11px] bg-white border rounded p-2 overflow-x-auto">
                    {e.old_data ? JSON.stringify(e.old_data, null, 2) : '—'}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">변경 후 (new)</p>
                  <pre className="text-[11px] bg-white border rounded p-2 overflow-x-auto">
                    {e.new_data ? JSON.stringify(e.new_data, null, 2) : '—'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 체크 + 린트 + 빌드**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (Task 5 page.tsx 포함 전체 통과).

Run: `npm run lint`
Expected: 신규 파일 에러 없음.

- [ ] **Step 3: 수동 동작 확인 (선택, 권장)**

`npm run dev` 실행 → admin 계정으로 `/admin/updates` 접속.
Expected: 최근 7일 변경내역이 보이고, 기간 변경 시 조회, 분류칩 토글 시 필터, 행 클릭 시 old/new JSON 펼침.

- [ ] **Step 4: Commit (Task 5 + 6 함께)**

```bash
git add "src/app/(dashboard)/admin/updates/page.tsx" "src/app/(dashboard)/admin/updates/_components/UpdatesClient.tsx"
git commit -m "feat(audit): /admin/updates 변경내역 조회 페이지(기간·분류 필터·펼치기)"
```

---

## Task 7: 사이드바 링크 추가

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx:34-39` (`adminNav` 배열)

- [ ] **Step 1: adminNav 에 항목 추가**

`src/components/sidebar/Sidebar.tsx`의 `adminNav` 배열에 추가:

```ts
const adminNav = [
  { href: '/admin/clients', label: '거래처 관리' },
  { href: '/admin/rates', label: '공사단가 관리' },
  { href: '/admin/gongmu', label: '공무담당자 관리' },
  { href: '/admin/sites', label: '공사현장 관리' },
  { href: '/admin/updates', label: '변경내역' },
] as const
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/Sidebar.tsx
git commit -m "feat(audit): 사이드바에 변경내역 링크 추가"
```

---

## 최종 검증

- [ ] **전체 테스트**

Run: `npm test`
Expected: 기존 테스트 + 신규 category/format 테스트 모두 PASS.

- [ ] **전체 빌드**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **엔드투엔드 수동 확인**

admin 로그인 → 수주 1건 등록 → 준공처리 → `/admin/updates`에서 "수주등록", "준공완료" 2건이 올바른 요약(공사명·금액)과 함께 보이는지 확인.

---

## Self-Review 결과

- **스펙 커버리지**: audit_log/트리거/RLS(Task1·2) · 분류 도출(Task3) · 요약+id→이름(Task4) · 기간 조회 페이지(Task5) · 필터/펼치기(Task6) · 사이드바(Task7). 스펙 4~8장 전 항목 매핑됨.
- **준공완료 감지**: 스펙 5.2와 동일(`준공여부` false→true) — category.ts와 format.ts(준공일/준공액 부각) 일관.
- **타입 일관성**: `AuditLogRow`/`LookupMaps`/`Category`/`PreparedEntry`를 Task3에서 정의, Task4~6에서 동일 시그니처로 사용. `deriveCategory`/`formatSummary`/`prepareEntry`/`formatWon` 명칭 전 태스크 일치.
- **금액 표기**: 스펙 예시의 "1.2억"은 예시일 뿐, 재입력 정확도를 위해 정확한 원(콤마)으로 구현 — Task4에 명시.
- **엣지케이스**: 무의미 UPDATE 로그됨(스펙 6장대로 1차 허용), FK 폴백 id:N(Task4 테스트), 500행 상한(Task5).
