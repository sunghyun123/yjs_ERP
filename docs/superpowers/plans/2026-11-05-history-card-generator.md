# 공사이력카드 자동 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 담당자가 시공통보서 PDF를 올리면, 씽크와이즈에 붙여 넣을 공사이력카드 텍스트(탭 들여쓰기)를 ERP 화면에 만들어 준다. DB에는 쓰지 않는다.

**Architecture:** 브라우저가 머리글자 id와 PDF를 `POST /api/history-card`로 보낸다. 서버는 세션을 확인하고, `pdf-lib`로 1쪽만 잘라 OpenAI Responses API(구조화 출력)에 보낸다. 돌아온 JSON을 zod로 검증한 뒤 ERP를 읽어(세션+RLS) 카드를 조립해 돌려준다. 금액 계산·번호 제안·카드 형식은 전부 순수 함수(`history-card/_lib/*`)라서 AI·DB 없이 테스트한다. 머리글자 규칙은 새 테이블 `이력카드_머리글자`에 두고 관리자 화면에서 고친다.

**Tech Stack:** Next.js 16 route handler(Node 런타임), Supabase(anon+세션, RLS), `pdf-lib` 1.17.1, OpenAI Responses API를 `fetch`로 직접 호출, zod 4, vitest 4.

**기획서:** `docs/superpowers/specs/2026-11-03-history-card-generator-design.md`

---

## 0. 게이트1 결정 (2026-11-05 확정) + 실측 근거

| # | 결정 | 근거 |
|---|---|---|
| 1 | 천원 표기는 **버림**. 단, 원 단위로 한 번 반올림한 뒤 버린다 (`9,942,999.9999` → 9,943) | 예시 카드와 담당자 손작업이 버림을 쓴다. 부동소수 오차로 1천원이 깎이는 것은 막는다 |
| 2 | 번호의 연도는 **시공통보일자의 연도** | 실측: 금성 건은 통보서가 2026-01-08이고 공사번호는 2025인데 ERP 번호는 `JY26-004`다 |
| 3 | 새 수주의 요율은 **규칙 → 거래처 FK**. 거래처가 없는 규칙(TY·MY)은 `확인 필요`와 경고를 띄운다 | 요율을 한 곳(거래처)에만 둔다. 실측: CG 11건의 원청사는 전부 `(주) 영전사`(id 19)이고, `삼천리`(id 20)의 요율은 1/1이라 그대로 쓰면 영전사금액이 0원이 된다. 그래서 CG는 영전사에 연결한다. TY는 원청사가 10곳으로 갈리고, MY는 같은 영전사인데 수주의 요율이 0과 0.075로 섞여 있다. 그래서 둘은 비워 둔다 |
| 4 | 공사시행 첫 줄에 `(AI 초안)` 표시를 넣는다 | 붙여 넣은 뒤에도 사람이 안 고친 줄이 드러난다 |
| 5 | OpenAI는 `fetch`로 직접 부르고, 모델 이름은 env `OPENAI_MODEL`에 둔다 | 의존성이 하나 줄고 목(mock) 테스트가 쉽다. 모델은 키를 만들 때 정한다 |
| 6 | 요청 본문 상한은 **9MB** (기획서의 20MB에서 바꿈) | `proxy.ts`가 모든 경로에 걸려 있다. Next 16의 `proxyClientMaxBodySize` 기본값은 10MB다(`node_modules/next/dist/server/config-shared.d.ts:1315`). 10MB를 넘는 본문은 우리 코드에 닿기 전에 잘린다. 예시 통보서는 0.8MB다 |
| 7 | 공사번호 비교 키 = **괄호 꼬리 삭제 → 숫자만**. 키가 10자리 미만이면 매칭하지 않는다 | 실측: ERP 645건 중 `(01)`이 붙은 행은 0건이다. 금성 건은 `391720253862`(대시 없음)로 저장돼 있다. 숫자 키가 같은 행이 2쌍 있다(`847420253394`, `391720263331`). CG의 `26-100` 같은 내부 번호와 우연히 겹치는 것을 막으려고 짧은 키는 버린다 |
| 8 | 같은 공사번호의 수주가 2건 이상이면 번호를 `확인 필요`로 둔다 | 새 번호를 제안하면 이미 있는 공사에 번호가 하나 더 생긴다. 후보 지중no는 경고에 나열한다 |
| 9 | OpenAI 요청에 `store: false`를 붙인다 | Responses API는 기본적으로 응답을 저장한다. 통보서 내용을 OpenAI 쪽에도 남기지 않는다 |
| 10 | AI와 주고받는 JSON 키는 **영문**으로 두고, 우리 코드에서 한글 타입으로 한 번 옮긴다 | 구조화 출력의 `name`은 `^[a-zA-Z0-9_-]+$`만 받는다. 스키마 키에 한글이 되는지는 문서에서 보장을 찾지 못했다. 구현 중에 실패해서 다시 짜는 위험을 미리 없앤다 |

**아직 열린 것 (구현 중 확인):**
- 카드 제목: ERP 공사명(`평촌동70 (주)금성 750kw 신설`)과 예시 카드 제목이 같은 표기인지. 예시 카드 번호 `JY26-136`은 ERP의 금성 건(`JY26-004`)과 다르다. → Task 11의 수동 대조에서 확인한다
- 씽크와이즈가 줄바꿈 `\n`을 받는지, `\r\n`이 필요한지 → Task 11

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20261105090000_history_card_prefixes.sql` | 새 테이블, RLS(읽기=화이트리스트 / 추가·수정=관리자 / **삭제 정책 없음**), 감사 트리거, 초기 데이터 |
| `src/types/database.ts` | `이력카드_머리글자` 타입 + Row 재export |
| `src/app/(dashboard)/history-card/_lib/공사번호.ts` | 공사번호 정규화, 기존 수주 찾기 (순수) |
| `src/app/(dashboard)/history-card/_lib/번호.ts` | 지중no 제안 (순수) |
| `src/app/(dashboard)/history-card/_lib/extract.ts` | AI 응답 스키마(zod + JSON schema), 한글 타입 변환, 추출 지시문, "읽지 못함" 판정 (순수) |
| `src/app/(dashboard)/history-card/_lib/card.ts` | 천원 버림, 날짜 형식, 검산, 금액, 카드 텍스트 조립 (순수) |
| `src/app/api/history-card/pdf.ts` | 매직바이트 검사, 1쪽 추출 (서버 전용) |
| `src/app/api/history-card/openai.ts` | Responses API 호출과 응답 파싱 (서버 전용) |
| `src/app/api/history-card/route.ts` | 문지기 + 위 조각들을 잇는 접착 코드 |
| `src/app/(dashboard)/history-card/page.tsx` | 사용 중인 머리글자를 읽어 클라이언트에 넘김 |
| `src/app/(dashboard)/history-card/_components/HistoryCardClient.tsx` | 머리글자 선택, 드롭존, 결과 textarea, 복사 |
| `src/app/(dashboard)/admin/history-card-prefixes/page.tsx` + `_components/PrefixesClient.tsx` | 머리글자 규칙 관리 |
| `src/components/sidebar/Sidebar.tsx`, `MobileTabBar.tsx` | 메뉴 추가 |
| `.env.production.example` | `OPENAI_API_KEY`, `OPENAI_MODEL` 설명 |

순수 함수는 화면 폴더의 `_lib/`에 두고(클라이언트도 응답 타입을 가져다 쓴다), 키와 파일을 다루는 코드는 `app/api/history-card/` 아래에만 둔다. 그러면 키를 읽는 코드가 클라이언트 번들에 끌려 들어갈 길이 없다.

---

### Task 0: 브랜치, 의존성, env

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `.env.production.example`

- [ ] **Step 1: 브랜치 만들기**

```bash
git checkout -b feat/history-card-generator
```

- [ ] **Step 2: pdf-lib 설치**

```bash
npm install pdf-lib@1.17.1
```
Expected: `package.json` dependencies에 `"pdf-lib": "^1.17.1"`이 추가된다.

- [ ] **Step 3: env 예시 추가** — `.env.production.example`의 `# ── Next.js ──` 줄 바로 위에 넣는다

```bash
# ── 공사이력카드 생성 (OpenAI) ─────────────────────────────
# 회사 결제 OpenAI 계정에서 "이 기능 전용"으로 새로 만든 키. 다른 프로젝트와 같이 쓰지 않는다.
# 절대 NEXT_PUBLIC_ 접두사 붙이지 말 것 — 브라우저 JS 파일에 문자열로 박힌다.
# 서버 전용 값이라 고친 뒤 pm2 reload 만으로 반영된다 (재빌드 불필요).
OPENAI_API_KEY=replace_with_history_card_openai_key
# PDF(이미지) 입력을 받는 비전 모델 이름. 키를 만들 때 정한다.
OPENAI_MODEL=replace_with_model_name
```

- [ ] **Step 4: 로컬 `.env.local`에도 같은 두 줄을 실제 값으로 넣는다** (커밋 안 함. 키가 없으면 Task 8~11의 실제 호출만 못 하고, 나머지 테스트는 돈다)

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json .env.production.example
git commit -m "chore(history-card): pdf-lib 추가, OpenAI env 예시"
```

---

### Task 1: 머리글자 규칙 테이블

**Files:**
- Create: `supabase/migrations/20261105090000_history_card_prefixes.sql`
- Modify: `src/types/database.ts` (Tables 안 `자재_품목기록` 블록 뒤, Row 재export 목록 끝)

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 공사이력카드 머리글자 규칙 (2026-11-05)
-- 카드 생성 화면에서 고르는 번호 머리글자(JY·SY·CG …)와, 새 수주의 영전사금액 요율을 가져올 거래처.
-- 요율은 여기 두지 않는다 — 거래처 한 곳에만 둬야 두 장부가 갈라지지 않는다.
-- 계약이 끝난 규칙은 지우지 말고 '사용'을 끈다(지난 번호 JY25-xxx의 뜻이 남아야 한다).
--   → 그래서 delete 정책을 만들지 않는다. RLS가 켜진 테이블에 정책이 없으면 그 동작은 아무도 못 한다.
-- 선행: 20260622090000(is_whitelisted), 20260622090300(is_admin), 20260624120000(audit_trigger)
-- 적용: Supabase SQL 편집기에 이 파일을 통째로 1회 실행. 코드 배포보다 먼저.

create table public.이력카드_머리글자 (
  id        bigint generated by default as identity primary key,
  머리글자  text not null unique check (머리글자 ~ '^[A-Z]{2}$'),
  이름      text not null,
  거래처_id bigint references public.거래처(id),
  사용      boolean not null default true,
  정렬      int not null default 0
);

alter table public.이력카드_머리글자 enable row level security;

create policy 이력카드_머리글자_select_whitelisted on public.이력카드_머리글자
  for select to authenticated using ((select public.is_whitelisted()));
create policy 이력카드_머리글자_insert_admin on public.이력카드_머리글자
  for insert to authenticated with check ((select public.is_admin()));
create policy 이력카드_머리글자_update_admin on public.이력카드_머리글자
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger audit_이력카드_머리글자
  after insert or update or delete on public.이력카드_머리글자
  for each row execute function public.audit_trigger();

-- 초기 데이터 (2026-11-05 실측 근거)
--   JY·JG = 정우전설(4), SY·SG = 에스제이이(3): 수주의 원청사가 그 거래처다.
--   CG: 표시 이름은 삼천리지만 수주 11건의 원청사는 전부 '(주) 영전사'다. '삼천리' 거래처의 요율 1/1을 쓰면 금액이 0원이 된다.
--   MY·TY: 원청사·요율이 공사마다 달라 하나로 못 정한다 → 비워 두면 카드에 '확인 필요'가 뜬다.
-- 이름으로 찾는다 — 이름이 없으면 서브쿼리가 null이라 틀린 거래처에 붙지 않는다.
insert into public.이력카드_머리글자 (머리글자, 이름, 거래처_id, 정렬) values
  ('JY', '정우전설',   (select id from public.거래처 where 거래처명 = '정우전설'),   10),
  ('JG', '정우전설',   (select id from public.거래처 where 거래처명 = '정우전설'),   20),
  ('SY', '에스제이이', (select id from public.거래처 where 거래처명 = '에스제이이'), 30),
  ('SG', '에스제이이', (select id from public.거래처 where 거래처명 = '에스제이이'), 40),
  ('CG', '삼천리',     (select id from public.거래처 where 거래처명 = '(주) 영전사'), 50),
  ('MY', '민수',       null, 60),
  ('TY', '총가공사',   null, 70);

-- 확인용: 7행, JY·JG→4, SY·SG→3, CG→19, MY·TY→null
-- select 머리글자, 이름, 거래처_id, 사용 from public.이력카드_머리글자 order by 정렬;
```

- [ ] **Step 2: 타입 추가** — `src/types/database.ts`의 `자재_품목기록: { … Relationships: [] }` 블록 바로 뒤(Tables 객체 안)

```ts
      이력카드_머리글자: {
        // 카드 생성 화면의 번호 머리글자 규칙. 요율은 거래처에서 읽는다(여기 두지 않음).
        Row: { id: number; 머리글자: string; 이름: string; 거래처_id: number | null; 사용: boolean; 정렬: number }
        Insert: { id?: number; 머리글자: string; 이름: string; 거래처_id?: number | null; 사용?: boolean; 정렬?: number }
        Update: { id?: number; 머리글자?: string; 이름?: string; 거래처_id?: number | null; 사용?: boolean; 정렬?: number }
        Relationships: []
      }
```

그리고 파일 끝의 Row 재export 목록에 추가:

```ts
export type 이력카드_머리글자Row = Database['public']['Tables']['이력카드_머리글자']['Row']
```

- [ ] **Step 3: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: 마이그레이션 운영 적용** — 사용자가 Supabase SQL 편집기에 파일을 통째로 1회 실행한다. 이어서 확인 쿼리를 돌려 7행·거래처 연결을 눈으로 본다. (Claude는 운영 DB에 쓰지 않는다)

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20261105090000_history_card_prefixes.sql src/types/database.ts
git commit -m "feat(history-card): 머리글자 규칙 테이블 추가"
```

---

### Task 2: 공사번호 정규화 + 기존 수주 찾기

**Files:**
- Create: `src/app/(dashboard)/history-card/_lib/공사번호.ts`
- Test: `src/app/(dashboard)/history-card/_lib/공사번호.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { 공사번호키, find기존수주, type 수주후보 } from './공사번호'

const 행 = (id: number, 지중no: string, 공사번호: string | null): 수주후보 => ({
  id, 지중no, 공사명: `공사${id}`, 공사번호, 원청사_id: 4,
  수주금액_공급가: 1_000_000, 보험료율: 0.075, 하도전용율: 0.85,
})

describe('공사번호키', () => {
  it('차수 꼬리 (01)을 지우고 숫자만 남긴다', () => {
    expect(공사번호키('3917-2025-3862 (01)')).toBe('391720253862')
  })
  it('대시 없이 저장된 ERP 값과 같은 키가 된다', () => {
    expect(공사번호키('391720253862')).toBe('391720253862')
  })
  it('비었거나 숫자가 없으면 null', () => {
    expect(공사번호키(null)).toBeNull()
    expect(공사번호키('')).toBeNull()
    expect(공사번호키('(01)')).toBeNull()
  })
})

describe('find기존수주', () => {
  const 목록 = [
    행(1, 'JY26-004', '391720253862'),
    행(2, 'JY26-010', '3917-2026-3331'),
    행(3, 'JY26-011', '391720263331'),
    행(4, 'CG26-001', '26-100'),
  ]
  it('대시 유무가 달라도 찾는다', () => {
    expect(find기존수주('3917-2025-3862 (01)', 목록).map(r => r.지중no)).toEqual(['JY26-004'])
  })
  it('같은 키가 둘이면 둘 다 돌려준다 (첫 행을 고르지 않는다)', () => {
    expect(find기존수주('3917-2026-3331', 목록).map(r => r.지중no)).toEqual(['JY26-010', 'JY26-011'])
  })
  it('없으면 빈 배열', () => {
    expect(find기존수주('3917-2026-9999', 목록)).toEqual([])
  })
  it('10자리 미만 키는 매칭하지 않는다 (내부 번호 26-100과 우연히 겹치는 것 방지)', () => {
    expect(find기존수주('26-100', 목록)).toEqual([])
  })
  it('통보서 공사번호가 null이면 빈 배열', () => {
    expect(find기존수주(null, 목록)).toEqual([])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/공사번호.test.ts"`
Expected: FAIL — `Cannot find module './공사번호'`

- [ ] **Step 3: 구현**

```ts
import type { 수주Row } from '@/types/database'

/** 카드 생성에 필요한 수주 칸만. route가 이 칸들만 select 한다. */
export type 수주후보 = Pick<
  수주Row,
  'id' | '지중no' | '공사명' | '공사번호' | '원청사_id' | '수주금액_공급가' | '보험료율' | '하도전용율'
>

/**
 * 비교용 키: 괄호 꼬리(차수 "(01)")를 지우고 숫자만 남긴다.
 * ERP에는 대시 없이 저장된 행이 있고(391720253862), 차수 꼬리를 저장한 행은 없다(2026-11-05 실측).
 */
export function 공사번호키(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\([^)]*\)/g, '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

// 한전 공사번호는 12자리(NNNN-YYYY-NNNN). CG의 '26-100'처럼 짧은 내부 번호와 우연히 겹치지 않게 한다.
const 최소키길이 = 10

/** 같은 키의 수주를 전부 돌려준다. 2건 이상이면 고르는 건 호출한 쪽의 몫(첫 행을 조용히 고르지 않는다). */
export function find기존수주(통보서공사번호: string | null, 수주목록: 수주후보[]): 수주후보[] {
  const key = 공사번호키(통보서공사번호)
  if (key === null || key.length < 최소키길이) return []
  return 수주목록.filter(r => 공사번호키(r.공사번호) === key)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/공사번호.test.ts"`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/history-card/_lib/공사번호.ts" "src/app/(dashboard)/history-card/_lib/공사번호.test.ts"
git commit -m "feat(history-card): 공사번호 정규화와 기존 수주 찾기"
```

---

### Task 3: 지중no 제안

**Files:**
- Create: `src/app/(dashboard)/history-card/_lib/번호.ts`
- Test: `src/app/(dashboard)/history-card/_lib/번호.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { suggest지중no } from './번호'

describe('suggest지중no', () => {
  it('마지막 번호 + 1, 3자리 0채움', () => {
    expect(suggest지중no('JY', '2026-01-08', ['JY26-098', 'JY26-099'])).toBe('JY26-100')
  })
  it('문자열이 아니라 정수로 비교한다 ("99" > "100" 함정)', () => {
    expect(suggest지중no('JY', '2026-03-01', ['JY26-100', 'JY26-99'])).toBe('JY26-101')
  })
  it('그 연도의 번호가 없으면 001', () => {
    expect(suggest지중no('JY', '2027-01-02', ['JY26-143'])).toBe('JY27-001')
  })
  it('다른 머리글자·다른 연도는 무시한다', () => {
    expect(suggest지중no('JG', '2026-05-01', ['JY26-143', 'JG25-048', 'JG26-053'])).toBe('JG26-054')
  })
  it('0채움이 안 된 기존 번호(TY25-11)도 읽는다', () => {
    expect(suggest지중no('TY', '2025-12-01', ['TY25-010', 'TY25-11'])).toBe('TY25-012')
  })
  it('통보일자 형식이 틀리면 null', () => {
    expect(suggest지중no('JY', '26.01.08', [])).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/번호.test.ts"`
Expected: FAIL — `Cannot find module './번호'`

- [ ] **Step 3: 구현**

```ts
/**
 * 새 수주 번호 '제안'. 확정은 수주 등록 때다(동시에 두 사람이 같은 번호를 받을 수 있다 — 화면 문구로 알린다).
 * 연도는 시공통보일자에서 읽는다. 서버 시계를 읽지 않으니 KST/UTC 9시간 창이 생길 자리가 없다.
 * 머리글자는 DB check(^[A-Z]{2}$)를 통과한 값만 들어온다 → 정규식에 그대로 넣어도 안전.
 */
export function suggest지중no(머리글자: string, 통보일자: string, 기존지중no: string[]): string | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(통보일자)
  if (!m) return null
  const yy = m[1].slice(2)
  const 패턴 = new RegExp(`^${머리글자}${yy}-(\\d+)$`)
  let 최대 = 0
  for (const no of 기존지중no) {
    const hit = 패턴.exec(no)
    if (hit) 최대 = Math.max(최대, parseInt(hit[1], 10)) // 정수 비교
  }
  return `${머리글자}${yy}-${String(최대 + 1).padStart(3, '0')}`
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/번호.test.ts"`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/history-card/_lib/번호.ts" "src/app/(dashboard)/history-card/_lib/번호.test.ts"
git commit -m "feat(history-card): 지중no 제안"
```

---

### Task 4: AI 응답 스키마와 추출 지시문

**Files:**
- Create: `src/app/(dashboard)/history-card/_lib/extract.ts`
- Test: `src/app/(dashboard)/history-card/_lib/extract.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { 추출WireSchema, 추출JSONSchema, toKorean, 읽지못함 } from './extract'

const 정상 = {
  project_no: '3917-2025-3862 (01)',
  project_name: '평촌동70 (주)금성 750kW 신설',
  notice_date: '2026-01-08',
  office_name: '경기본부 안양지사',
  contract_amount: 54232930,
  supply_amount: 49302664,
  vat_amount: 4930266,
  overview: '고압 신설 1식',
  period_start: '2026-01-12',
  period_end: '2026-02-28',
  work_draft: ['케이블 포설', '접속 및 시험'],
}

describe('추출WireSchema', () => {
  it('정상 응답을 받는다', () => {
    expect(추출WireSchema.safeParse(정상).success).toBe(true)
  })
  it('칸이 빠지면 거부한다', () => {
    const 빠짐: Record<string, unknown> = { ...정상 }
    delete 빠짐.supply_amount
    expect(추출WireSchema.safeParse(빠짐).success).toBe(false)
  })
  it('null 칸을 받는다', () => {
    expect(추출WireSchema.safeParse({ ...정상, overview: null, supply_amount: null }).success).toBe(true)
  })
})

describe('추출JSONSchema', () => {
  it('strict 조건: 모든 칸 required, additionalProperties false', () => {
    expect([...추출JSONSchema.required].sort()).toEqual(Object.keys(추출JSONSchema.properties).sort())
    expect(추출JSONSchema.additionalProperties).toBe(false)
  })
  it('zod 스키마와 칸 이름이 같다 (두 벌이 갈라지지 않게)', () => {
    expect(Object.keys(추출JSONSchema.properties).sort()).toEqual(Object.keys(추출WireSchema.shape).sort())
  })
})

describe('toKorean', () => {
  it('영문 키를 한글 타입으로 옮긴다', () => {
    const k = toKorean(추출WireSchema.parse(정상))
    expect(k.공사번호).toBe('3917-2025-3862 (01)')
    expect(k.공급가액).toBe(49302664)
    expect(k.공사시행초안).toEqual(['케이블 포설', '접속 및 시험'])
  })
})

describe('읽지못함', () => {
  it('핵심 칸이 전부 비면 true', () => {
    const 빈 = toKorean(추출WireSchema.parse({
      ...정상, project_no: null, project_name: '', notice_date: null,
      contract_amount: null, supply_amount: null,
    }))
    expect(읽지못함(빈)).toBe(true)
  })
  it('하나라도 있으면 false (부분 판독은 카드에 확인 필요로 드러낸다)', () => {
    expect(읽지못함(toKorean(추출WireSchema.parse({ ...정상, project_name: null })))).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/extract.test.ts"`
Expected: FAIL — `Cannot find module './extract'`

- [ ] **Step 3: 구현**

```ts
import { z } from 'zod'

// AI와 주고받는 키는 영문(구조화 출력의 name은 ASCII만 받고, 한글 스키마 키는 문서상 보장이 없다).
// 우리 코드 안에서는 toKorean()으로 한 번 옮긴 한글 타입만 쓴다.
const 문자 = z.string().nullable()
// 금액은 정수 검사를 하지 않는다 — 형식이 이상하면 카드에서 검산 경고로 드러내는 편이 502보다 낫다
const 금액 = z.number().nullable()

export const 추출WireSchema = z.object({
  project_no: 문자,
  project_name: 문자,
  notice_date: 문자, // YYYY-MM-DD 기대. 형식이 틀리면 카드에서 '확인 필요'
  office_name: 문자,
  contract_amount: 금액,
  supply_amount: 금액,
  vat_amount: 금액,
  overview: 문자,
  period_start: 문자,
  period_end: 문자,
  work_draft: z.array(z.string()).max(8),
})

const 문자칸 = { type: ['string', 'null'] } as const
const 금액칸 = { type: ['number', 'null'] } as const

/** OpenAI text.format 에 넣는 JSON schema. strict 모드라 모든 칸 required + additionalProperties false. */
export const 추출JSONSchema = {
  type: 'object',
  properties: {
    project_no: { ...문자칸, description: '공사번호 원문 그대로 (예: 3917-2025-3862 (01))' },
    project_name: { ...문자칸, description: '공사명 원문 그대로' },
    notice_date: { ...문자칸, description: '시공통보일자, YYYY-MM-DD' },
    office_name: { ...문자칸, description: '사업소명' },
    contract_amount: { ...금액칸, description: '계약금액(부가세 포함), 원 단위 정수, 쉼표 없이' },
    supply_amount: { ...금액칸, description: '공급가액, 원 단위 정수' },
    vat_amount: { ...금액칸, description: '부가가치세, 원 단위 정수' },
    overview: { ...문자칸, description: '공사개요' },
    period_start: { ...문자칸, description: '공사기간 시작, YYYY-MM-DD' },
    period_end: { ...문자칸, description: '공사기간 끝, YYYY-MM-DD' },
    work_draft: {
      type: 'array',
      items: { type: 'string' },
      description: '공사시행 초안 2~5줄. 공사개요·공사기간만 근거로, 한 줄에 한 작업. 날짜를 붙이지 않는다',
    },
  },
  required: [
    'project_no', 'project_name', 'notice_date', 'office_name', 'contract_amount',
    'supply_amount', 'vat_amount', 'overview', 'period_start', 'period_end', 'work_draft',
  ],
  additionalProperties: false,
} as const

export const 추출지시 = [
  '너는 한국전력 시공통보서 1쪽(스캔 이미지)에서 값을 읽는 도구다.',
  '문서에 적힌 값만 옮긴다. 읽지 못하거나 문서에 없는 칸은 지어내지 말고 null로 둔다.',
  '금액은 원 단위 정수로, 쉼표·"원"을 빼고 적는다.',
  '날짜는 YYYY-MM-DD로 적는다.',
  'work_draft만 예외로 초안을 쓴다: 공사개요와 공사기간을 근거로 할 작업을 2~5줄로 적는다.',
].join('\n')

export type 추출WireResult = z.infer<typeof 추출WireSchema>

export type 추출결과 = {
  공사번호: string | null
  공사명: string | null
  시공통보일자: string | null
  사업소명: string | null
  계약금액: number | null
  공급가액: number | null
  부가가치세: number | null
  공사개요: string | null
  공사기간_시작: string | null
  공사기간_끝: string | null
  공사시행초안: string[]
}

export function toKorean(w: 추출WireResult): 추출결과 {
  return {
    공사번호: w.project_no,
    공사명: w.project_name,
    시공통보일자: w.notice_date,
    사업소명: w.office_name,
    계약금액: w.contract_amount,
    공급가액: w.supply_amount,
    부가가치세: w.vat_amount,
    공사개요: w.overview,
    공사기간_시작: w.period_start,
    공사기간_끝: w.period_end,
    공사시행초안: w.work_draft,
  }
}

/**
 * 판정의 '존재' 검사: 핵심 칸이 하나도 없으면 AI가 문서를 읽은 게 아니다.
 * 이걸 통과시키면 '확인 필요'로 가득 찬 빈 카드가 성공처럼 보인다 → 실패로 돌린다.
 * 일부만 비면 통과(판정의 '내용'은 관대하게) — 카드에 '확인 필요'와 경고로 드러난다.
 */
export function 읽지못함(e: 추출결과): boolean {
  const 핵심 = [e.공사번호, e.공사명, e.시공통보일자, e.계약금액, e.공급가액]
  return 핵심.every(v => v == null || v === '')
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/extract.test.ts"`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(dashboard)/history-card/_lib/extract.ts" "src/app/(dashboard)/history-card/_lib/extract.test.ts"
git commit -m "feat(history-card): AI 응답 스키마와 추출 지시문"
```

---

### Task 5: 카드 조립 (금액·검산·형식)

**Files:**
- Create: `src/app/(dashboard)/history-card/_lib/card.ts`
- Test: `src/app/(dashboard)/history-card/_lib/card.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { build카드, 천원버림, toYYMMDD, type 카드입력 } from './card'
import type { 추출결과 } from './extract'
import type { 수주후보 } from './공사번호'

const 추출: 추출결과 = {
  공사번호: '3917-2025-3862 (01)',
  공사명: '평촌동70 (주)금성 750kW 신설',
  시공통보일자: '2026-01-08',
  사업소명: null,
  계약금액: 54232930,
  공급가액: 49302664,
  부가가치세: 4930266,
  공사개요: null,
  공사기간_시작: null,
  공사기간_끝: null,
  공사시행초안: ['케이블 포설', '접속 및 시험'],
}

const 기본입력 = (덮어쓰기: Partial<카드입력> = {}): 카드입력 => ({
  추출,
  규칙: { 머리글자: 'JY', 거래처_id: 4 },
  거래처요율: { 보험료제외율: 0.075, 하도전용율: 0.85 },
  수주목록: [{ ...수주('JY26-143', '3917-2026-0001') }],
  ...덮어쓰기,
})

function 수주(지중no: string, 공사번호: string, 덮어쓰기: Partial<수주후보> = {}): 수주후보 {
  return {
    id: 1, 지중no, 공사명: 'ERP 공사명', 공사번호, 원청사_id: 4,
    수주금액_공급가: 12_000_000, 보험료율: 0.075, 하도전용율: 0.81, ...덮어쓰기,
  }
}

describe('천원버림', () => {
  it('천원 미만은 버린다', () => expect(천원버림(9_943_800)).toBe('9,943천원'))
  it('부동소수 오차로 1천원이 깎이지 않는다', () => expect(천원버림(9_942_999.9999)).toBe('9,943천원'))
})

describe('toYYMMDD', () => {
  it('YYYY-MM-DD → YY.MM.DD', () => expect(toYYMMDD('2026-01-08')).toBe('26.01.08'))
  it('형식이 다르면 null', () => {
    expect(toYYMMDD('2026.01.08')).toBeNull()
    expect(toYYMMDD(null)).toBeNull()
  })
})

describe('build카드 — 신규 수주', () => {
  it('제안 번호 + 통보서 금액 + 거래처 요율로 카드를 만든다 (탭 들여쓰기)', () => {
    const r = build카드(기본입력())
    expect(r.번호상태).toBe('제안')
    expect(r.text).toBe([
      'JY26-144. 평촌동70 (주)금성 750kW 신설',
      '\t접수',
      '\t\t26.01.08 시공통보서 접수',
      '\t\t공급가액',
      '\t\t\t49,302천원',
      '\t\t영전사금액',
      '\t\t\t38,764천원', // 49,302,664 × 0.925 × 0.85 = 38,764,219.57
      '\t진행사항',
      '\t공사시행',
      '\t\t(AI 초안)',
      '\t\t케이블 포설',
      '\t\t접속 및 시험',
      '\t향후계획',
    ].join('\n'))
    expect(r.warnings).toEqual([])
  })

  it('규칙에 거래처가 없으면 영전사금액은 확인 필요 + 경고', () => {
    const r = build카드(기본입력({ 규칙: { 머리글자: 'TY', 거래처_id: null }, 거래처요율: null }))
    expect(r.text).toContain('\t\t영전사금액\n\t\t\t확인 필요')
    expect(r.warnings.some(w => w.includes('영전사금액'))).toBe(true)
  })

  it('공사시행 초안이 비면 (AI 초안) 표시도 넣지 않는다', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 공사시행초안: [] } }))
    expect(r.text).toContain('\t공사시행\n\t향후계획')
  })
})

describe('build카드 — 기존 수주', () => {
  it('ERP의 지중no·공사명·공급가·요율을 쓴다', () => {
    const r = build카드(기본입력({ 수주목록: [수주('JY26-004', '391720253862')] }))
    expect(r.번호상태).toBe('기존')
    expect(r.text.split('\n')[0]).toBe('JY26-004. ERP 공사명')
    expect(r.text).toContain('\t\t공급가액\n\t\t\t12,000천원')
    expect(r.text).toContain('\t\t영전사금액\n\t\t\t8,991천원') // 12,000,000 × 0.925 × 0.81
  })

  it('수주의 요율이 비면 확인 필요 (공급가를 영전사금액으로 적지 않는다)', () => {
    const r = build카드(기본입력({ 수주목록: [수주('JY26-004', '391720253862', { 하도전용율: null })] }))
    expect(r.text).toContain('\t\t영전사금액\n\t\t\t확인 필요')
  })

  it('수주의 원청사가 규칙의 거래처와 다르면 경고', () => {
    const r = build카드(기본입력({ 수주목록: [수주('SY26-001', '391720253862', { 원청사_id: 3 })] }))
    expect(r.warnings.some(w => w.includes('머리글자'))).toBe(true)
  })

  it('같은 공사번호가 2건이면 번호는 확인 필요, 후보를 경고에 나열, 금액은 통보서 기준', () => {
    const r = build카드(기본입력({
      수주목록: [수주('JY26-010', '391720253862'), 수주('JY26-011', '3917-2025-3862')],
    }))
    expect(r.번호상태).toBe('확인 필요')
    expect(r.후보).toEqual(['JY26-010', 'JY26-011'])
    expect(r.text.split('\n')[0]).toBe('확인 필요. 평촌동70 (주)금성 750kW 신설')
    expect(r.text).toContain('\t\t\t49,302천원')
  })
})

describe('build카드 — 검산과 빈 칸', () => {
  it('공급가 + 부가세 ≠ 계약금액이면 경고, 카드는 그대로', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 계약금액: 54_232_931 } }))
    expect(r.warnings.some(w => w.includes('공급가 + 부가세'))).toBe(true)
    expect(r.text).toContain('49,302천원')
  })

  it('공급가액을 못 읽으면 확인 필요 + 경고', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 공급가액: null } }))
    expect(r.text).toContain('\t\t공급가액\n\t\t\t확인 필요')
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('통보일자를 못 읽으면 날짜와 번호가 확인 필요', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 시공통보일자: null } }))
    expect(r.text.split('\n')[0]).toBe('확인 필요. 평촌동70 (주)금성 750kW 신설')
    expect(r.text).toContain('\t\t확인 필요 시공통보서 접수')
  })

  it('AI가 준 글자 안의 탭·줄바꿈은 공백으로 바꾼다 (가지 구조가 깨지지 않게)', () => {
    const r = build카드(기본입력({ 추출: { ...추출, 공사명: '평촌동70\t금성\n신설', 공사시행초안: ['포설\n시험'] } }))
    expect(r.text.split('\n')[0]).toBe('JY26-144. 평촌동70 금성 신설')
    expect(r.text).toContain('\t\t포설 시험')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/card.test.ts"`
Expected: FAIL — `Cannot find module './card'`

- [ ] **Step 3: 구현**

```ts
import { calc하도적용금액 } from '@/app/(dashboard)/orders/_lib/completion'
import { find기존수주, type 수주후보 } from './공사번호'
import { suggest지중no } from './번호'
import type { 추출결과 } from './extract'

export type 카드입력 = {
  추출: 추출결과
  규칙: { 머리글자: string; 거래처_id: number | null }
  /** 규칙에 연결된 거래처의 요율. 거래처가 없으면 null */
  거래처요율: { 보험료제외율: number | null; 하도전용율: number | null } | null
  수주목록: 수주후보[]
}

export type 카드결과 = {
  text: string
  warnings: string[]
  번호상태: '기존' | '제안' | '확인 필요'
  /** 같은 공사번호의 수주가 2건 이상일 때 그 지중no들 */
  후보: string[]
}

const 확인필요 = '확인 필요'

/** 천원 버림 (게이트1 결정). 원 단위로 먼저 반올림해 부동소수 오차(…999.9999)가 1천원을 깎지 않게 한다. */
export function 천원버림(원: number): string {
  const 천원 = Math.floor(Math.round(원) / 1000)
  return `${new Intl.NumberFormat('ko-KR').format(천원)}천원`
}

/** 'YYYY-MM-DD' → 'YY.MM.DD'. 문자열만 다룬다 — new Date()를 안 써서 타임존 창이 생길 자리가 없다. */
export function toYYMMDD(날짜: string | null): string | null {
  const m = 날짜 ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(날짜) : null
  return m ? `${m[1].slice(2)}.${m[2]}.${m[3]}` : null
}

// AI가 준 글자에 탭·줄바꿈이 섞이면 씽크와이즈 가지 구조가 깨진다
function 한줄(s: string | null): string | null {
  if (s == null) return null
  const t = s.replace(/[\t\r\n]+/g, ' ').trim()
  return t === '' ? null : t
}

const 금액표시 = (원: number | null) => (원 == null ? 확인필요 : 천원버림(원))

export function build카드(입력: 카드입력): 카드결과 {
  const { 추출, 규칙, 거래처요율, 수주목록 } = 입력
  const warnings: string[] = []

  // 검산: 숫자 셋 중 하나가 틀린 것만 잡는다(셋이 같이 틀리면 못 잡는다 — 화면에 '통보서와 대조' 상시 표시)
  const { 공급가액, 부가가치세, 계약금액 } = 추출
  if (공급가액 == null || 부가가치세 == null || 계약금액 == null) {
    warnings.push('통보서 금액 일부를 읽지 못했습니다. 통보서에서 직접 확인하세요.')
  } else if (공급가액 + 부가가치세 !== 계약금액) {
    warnings.push('통보서 금액을 다시 확인하세요 (공급가 + 부가세 ≠ 계약금액).')
  }

  const 기존 = find기존수주(추출.공사번호, 수주목록)
  let 번호: string | null
  let 번호상태: 카드결과['번호상태']
  let 공사명: string | null
  let 공급가: number | null
  let 영전사: number | null

  if (기존.length === 1) {
    const r = 기존[0]
    번호 = r.지중no
    번호상태 = '기존'
    공사명 = r.공사명
    공급가 = r.수주금액_공급가
    // 공식을 새로 쓰지 않는다 — 수주대장과 같은 함수(엄격판: 요율이 하나라도 없으면 null)
    영전사 = calc하도적용금액(공급가, r.보험료율, r.하도전용율)
    if (공급가 != null && 영전사 == null) {
      warnings.push(`ERP의 ${r.지중no}에 요율이 비어 있어 영전사금액을 계산하지 못했습니다.`)
    }
    if (r.원청사_id != null && 규칙.거래처_id != null && r.원청사_id !== 규칙.거래처_id) {
      warnings.push(`ERP의 ${r.지중no} 원청사가 고른 머리글자(${규칙.머리글자})의 거래처와 다릅니다. 머리글자를 확인하세요.`)
    }
  } else {
    if (기존.length >= 2) {
      번호 = null
      번호상태 = '확인 필요'
      warnings.push(`같은 공사번호의 수주가 ${기존.length}건 있습니다: ${기존.map(r => r.지중no).join(', ')}. 번호를 직접 고르세요.`)
    } else {
      번호 = 추출.시공통보일자 ? suggest지중no(규칙.머리글자, 추출.시공통보일자, 수주목록.map(r => r.지중no)) : null
      번호상태 = 번호 ? '제안' : '확인 필요'
    }
    공사명 = 추출.공사명
    공급가 = 공급가액
    영전사 = calc하도적용금액(공급가, 거래처요율?.보험료제외율 ?? null, 거래처요율?.하도전용율 ?? null)
    if (거래처요율 == null) {
      warnings.push(`머리글자 ${규칙.머리글자}에 연결된 거래처가 없어 영전사금액을 계산하지 못했습니다.`)
    } else if (공급가 != null && 영전사 == null) {
      warnings.push(`머리글자 ${규칙.머리글자}의 거래처에 요율이 비어 있어 영전사금액을 계산하지 못했습니다.`)
    }
  }

  if (공급가 == null) warnings.push('공급가액을 알 수 없습니다.')

  const 날짜 = toYYMMDD(추출.시공통보일자)
  const 초안 = 추출.공사시행초안.map(한줄).filter((s): s is string => s !== null)

  const lines = [
    `${번호 ?? 확인필요}. ${한줄(공사명) ?? 확인필요}`,
    '\t접수',
    `\t\t${날짜 ?? 확인필요} 시공통보서 접수`,
    '\t\t공급가액',
    `\t\t\t${금액표시(공급가)}`,
    '\t\t영전사금액',
    `\t\t\t${금액표시(영전사)}`,
    '\t진행사항',
    '\t공사시행',
    ...(초안.length > 0 ? ['\t\t(AI 초안)', ...초안.map(s => `\t\t${s}`)] : []),
    '\t향후계획',
  ]

  return { text: lines.join('\n'), warnings, 번호상태, 후보: 기존.length >= 2 ? 기존.map(r => r.지중no) : [] }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run "src/app/(dashboard)/history-card/_lib/card.test.ts"`
Expected: PASS (15 tests). 신규 카드 테스트의 `warnings`가 `[]`가 아니면, 거래처 요율이 있을 때 경고 조건이 잘못 걸린 것이다.

- [ ] **Step 5: 기존 테스트까지 전부**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(dashboard)/history-card/_lib/card.ts" "src/app/(dashboard)/history-card/_lib/card.test.ts"
git commit -m "feat(history-card): 카드 텍스트 조립과 금액 검산"
```

---

### Task 6: PDF 1쪽 추출

**Files:**
- Create: `src/app/api/history-card/pdf.ts`
- Test: `src/app/api/history-card/pdf.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { isPdf, 첫쪽만, PdfError } from './pdf'

async function 쪽수가(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) doc.addPage([200 + i, 200])
  return doc.save()
}

describe('isPdf', () => {
  it('%PDF- 로 시작하면 true', async () => expect(isPdf(await 쪽수가(1))).toBe(true))
  it('확장자만 pdf인 다른 파일은 false', () => expect(isPdf(new TextEncoder().encode('PK\x03\x04zip'))).toBe(false))
  it('5바이트보다 짧으면 false', () => expect(isPdf(new Uint8Array([0x25]))).toBe(false))
})

describe('첫쪽만', () => {
  it('3쪽 PDF에서 첫 쪽만 남긴다', async () => {
    const out = await PDFDocument.load(await 첫쪽만(await 쪽수가(3)))
    expect(out.getPageCount()).toBe(1)
    expect(out.getPage(0).getWidth()).toBe(200) // 0번 쪽 (너비 200+0)
  })
  it('열 수 없는 PDF는 PdfError', async () => {
    const 깨진 = new TextEncoder().encode('%PDF-1.7 garbage')
    await expect(첫쪽만(깨진)).rejects.toBeInstanceOf(PdfError)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/history-card/pdf.test.ts`
Expected: FAIL — `Cannot find module './pdf'`

- [ ] **Step 3: 구현**

```ts
import { PDFDocument } from 'pdf-lib'

/**
 * 9MB. proxy.ts가 모든 요청에 걸려 있고 Next 16 proxyClientMaxBodySize 기본값이 10MB라,
 * 그보다 큰 본문은 우리 코드에 닿기 전에 잘린다. 잘린 본문은 '깨진 PDF'로 보여 원인을 못 찾는다
 * → 10MB 아래에서 우리가 먼저 명확한 400을 낸다. (화면도 같은 값으로 미리 막는다)
 */
export const PDF_최대바이트 = 9 * 1024 * 1024

export class PdfError extends Error {}

/** 확장자·MIME은 보내는 쪽이 마음대로 적는다. 파일 첫 5바이트를 직접 본다. */
export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false
  return String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-'
}

/**
 * 1쪽만 새 PDF로 만든다. 무엇이 OpenAI로 나가는지 서버가 정한다 — 2~9쪽(예산서·명세서)은 안 나간다.
 * 암호 걸린 PDF는 load가 던진다 → PdfError(400).
 */
export async function 첫쪽만(bytes: Uint8Array): Promise<Uint8Array> {
  let src: PDFDocument
  try {
    src = await PDFDocument.load(bytes)
  } catch {
    throw new PdfError('PDF를 열 수 없습니다. 암호가 걸렸거나 손상된 파일입니다.')
  }
  if (src.getPageCount() < 1) throw new PdfError('쪽이 없는 PDF입니다.')
  const out = await PDFDocument.create()
  const [page] = await out.copyPages(src, [0])
  out.addPage(page)
  return out.save()
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/api/history-card/pdf.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 실제 통보서로 한 번 확인** (스캔 PDF에서도 copyPages가 되는지)

```bash
node -e "const {PDFDocument}=require('pdf-lib');const fs=require('fs');(async()=>{const s=await PDFDocument.load(fs.readFileSync('../thinkwise-ops/시공통보서.pdf'));const o=await PDFDocument.create();const [p]=await o.copyPages(s,[0]);o.addPage(p);const b=await o.save();console.log('pages',s.getPageCount(),'-> 1, bytes',b.length)})()"
```
Expected: `pages 9 -> 1, bytes <원본 837473보다 작은 수>`

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/history-card/pdf.ts src/app/api/history-card/pdf.test.ts
git commit -m "feat(history-card): PDF 검사와 1쪽 추출"
```

---

### Task 7: OpenAI 호출

**Files:**
- Create: `src/app/api/history-card/openai.ts`
- Test: `src/app/api/history-card/openai.test.ts`

요청 형태는 공식 문서(2026-11-05 확인)를 따른다: `developers.openai.com/api/docs/guides/pdf-files`(`input_file` + `file_data: data:application/pdf;base64,…`), `…/structured-outputs`(`text.format: { type: 'json_schema', name, schema, strict: true }`, 거절은 content의 `type: 'refusal'`, 미완료는 `status: 'incomplete'`).

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it, vi } from 'vitest'
import { 통보서읽기, UpstreamError } from './openai'

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
const 옵션 = (fetchImpl: typeof fetch) => ({ apiKey: 'sk-test', model: 'test-model', fetchImpl })

function 응답(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

const 성공본문 = {
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }],
}

describe('통보서읽기', () => {
  it('요청: Responses API, PDF는 base64 data URL, strict 스키마, store false, 키는 Authorization 헤더', async () => {
    const f = 응답(성공본문)
    await 통보서읽기(pdf, 옵션(f))
    const [url, init] = vi.mocked(f).mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(init.headers.Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('test-model')
    expect(body.store).toBe(false)
    expect(body.text.format.type).toBe('json_schema')
    expect(body.text.format.strict).toBe(true)
    expect(body.text.format.name).toMatch(/^[a-zA-Z0-9_-]+$/)
    const file = body.input[1].content[0]
    expect(file.type).toBe('input_file')
    expect(file.file_data).toBe('data:application/pdf;base64,JVBERi0=')
  })

  it('output_text를 JSON으로 파싱해 돌려준다', async () => {
    expect(await 통보서읽기(pdf, 옵션(응답(성공본문)))).toEqual({ a: 1 })
  })

  it('HTTP 오류는 UpstreamError (단계명에 상태코드)', async () => {
    await expect(통보서읽기(pdf, 옵션(응답({ error: {} }, 429)))).rejects.toMatchObject({ 단계: 'openai_http_429' })
  })

  it('거절(refusal)은 UpstreamError', async () => {
    const f = 응답({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] })
    await expect(통보서읽기(pdf, 옵션(f))).rejects.toMatchObject({ 단계: 'openai_refusal' })
  })

  it('미완료(incomplete)는 UpstreamError', async () => {
    await expect(통보서읽기(pdf, 옵션(응답({ status: 'incomplete', output: [] })))).rejects.toMatchObject({ 단계: 'openai_incomplete' })
  })

  it('JSON이 아닌 출력은 UpstreamError', async () => {
    const f = 응답({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }] })
    await expect(통보서읽기(pdf, 옵션(f))).rejects.toMatchObject({ 단계: 'openai_json' })
  })

  it('네트워크 실패·시간 초과는 UpstreamError', async () => {
    const f = vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError') }) as unknown as typeof fetch
    await expect(통보서읽기(pdf, 옵션(f))).rejects.toBeInstanceOf(UpstreamError)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/history-card/openai.test.ts`
Expected: FAIL — `Cannot find module './openai'`

- [ ] **Step 3: 구현**

```ts
import { 추출JSONSchema, 추출지시 } from '@/app/(dashboard)/history-card/_lib/extract'

/** 상류(OpenAI) 실패. 단계명만 담는다 — 응답 원문·PDF 내용은 로그에 남기지 않는다. */
export class UpstreamError extends Error {
  constructor(public readonly 단계: string) {
    super(단계)
  }
}

type 옵션 = { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number }

type ResponsesBody = {
  status?: string
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[]
}

/** 1쪽 PDF를 보내고, 구조화 출력 JSON을 파싱해 돌려준다. 스키마 검증은 호출한 쪽(zod)이 한다. */
export async function 통보서읽기(pdf1쪽: Uint8Array, opts: 옵션): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const body = {
    model: opts.model,
    store: false, // OpenAI 쪽에도 통보서 내용을 남기지 않는다
    input: [
      { role: 'system', content: 추출지시 },
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: 'notice.pdf',
            file_data: `data:application/pdf;base64,${Buffer.from(pdf1쪽).toString('base64')}`,
          },
          { type: 'input_text', text: '이 시공통보서 1쪽에서 값을 읽어 주세요.' },
        ],
      },
    ],
    text: { format: { type: 'json_schema', name: 'construction_notice', schema: 추출JSONSchema, strict: true } },
  }

  let res: Response
  try {
    res = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    })
  } catch (e) {
    throw new UpstreamError(e instanceof DOMException && e.name === 'TimeoutError' ? 'openai_timeout' : 'openai_network')
  }
  if (!res.ok) throw new UpstreamError(`openai_http_${res.status}`)

  const json = (await res.json()) as ResponsesBody
  if (json.status === 'incomplete') throw new UpstreamError('openai_incomplete')

  const contents = (json.output ?? []).filter(o => o.type === 'message').flatMap(o => o.content ?? [])
  if (contents.some(c => c.type === 'refusal')) throw new UpstreamError('openai_refusal')
  const text = contents.filter(c => c.type === 'output_text').map(c => c.text ?? '').join('')

  try {
    return JSON.parse(text)
  } catch {
    throw new UpstreamError('openai_json')
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/api/history-card/openai.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/history-card/openai.ts src/app/api/history-card/openai.test.ts
git commit -m "feat(history-card): OpenAI Responses API 호출"
```

---

### Task 8: Route handler (문지기 + 접착)

**Files:**
- Create: `src/app/api/history-card/route.ts`

이 파일은 위 조각들을 잇기만 한다. 로직은 전부 테스트된 함수에 있다. route 단위 테스트는 쿠키·세션을 흉내 내는 비용이 커서 만들지 않는다. 대신 Step 3의 수동 확인으로 대신한다.

- [ ] **Step 1: 구현**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getDashboardAccess } from '@/lib/auth/dashboard-access'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { 추출WireSchema, toKorean, 읽지못함 } from '@/app/(dashboard)/history-card/_lib/extract'
import { build카드 } from '@/app/(dashboard)/history-card/_lib/card'
import type { 수주후보 } from '@/app/(dashboard)/history-card/_lib/공사번호'
import { isPdf, 첫쪽만, PdfError, PDF_최대바이트 } from './pdf'
import { 통보서읽기, UpstreamError } from './openai'

export const runtime = 'nodejs' // pdf-lib·Buffer

const 실패 = (status: number, message: string) => NextResponse.json({ error: message }, { status })

export async function POST(req: NextRequest) {
  // ① 문지기: 이 라우트는 OpenAI 요금을 쓴다. 로그인 + 화이트리스트만 부른다.
  //    service_role(Bearer) 라우트와 섞지 않는다 — 여기서 쓰는 DB 클라이언트는 세션+RLS다.
  const access = await getDashboardAccess()
  if (!access.authenticated) return 실패(401, '로그인이 필요합니다.')
  if (!access.entry) return 실패(403, '허용된 사용자가 아닙니다.')

  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  if (!apiKey || !model) {
    console.error('[history-card] env_missing')
    return 실패(500, '서버 설정이 빠졌습니다. 관리자에게 알려 주세요.')
  }

  // ② 입력 검사 (400 = 요청한 쪽이 고칠 수 있는 것)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return 실패(400, '요청 형식이 잘못됐습니다.')
  }
  const 규칙Id = Number(form.get('prefixId'))
  const file = form.get('file')
  if (!Number.isInteger(규칙Id) || 규칙Id <= 0) return 실패(400, '머리글자를 고르세요.')
  if (!(file instanceof File)) return 실패(400, 'PDF 파일을 올려 주세요.')
  if (file.size > PDF_최대바이트) return 실패(400, 'PDF가 9MB를 넘습니다.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isPdf(bytes)) return 실패(400, 'PDF 파일이 아닙니다.')

  // ③ 1쪽만 — 밖으로 나가는 것을 서버가 정한다
  let 첫쪽: Uint8Array
  try {
    첫쪽 = await 첫쪽만(bytes)
  } catch (e) {
    if (e instanceof PdfError) return 실패(400, e.message)
    throw e
  }

  const supabase = await createClient()

  // 규칙은 AI 호출 '전에' 읽는다 — 잘못된 요청에 요금을 쓰지 않는다
  const { data: 규칙, error: 규칙Err } = await supabase
    .from('이력카드_머리글자')
    .select('id, 머리글자, 거래처_id, 사용')
    .eq('id', 규칙Id)
    .maybeSingle()
  if (규칙Err) {
    console.error('[history-card] rule_query', 규칙Err.code)
    return 실패(500, '머리글자 규칙을 읽지 못했습니다.')
  }
  if (!규칙 || !규칙.사용) return 실패(400, '사용 중인 머리글자가 아닙니다.')

  // ④ AI (502 = 우리 서버는 멀쩡하고 상류가 실패)
  let raw: unknown
  try {
    raw = await 통보서읽기(첫쪽, { apiKey, model })
  } catch (e) {
    if (e instanceof UpstreamError) {
      console.error('[history-card]', e.단계) // 단계명만. 응답 원문·PDF 내용은 찍지 않는다
      return 실패(502, 'AI가 통보서를 읽지 못했습니다. 잠시 뒤 다시 시도하세요.')
    }
    throw e
  }
  // ⑤ 스키마 검증
  const parsed = 추출WireSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[history-card] openai_schema')
    return 실패(502, 'AI 응답 형식이 올바르지 않습니다.')
  }
  const 추출 = toKorean(parsed.data)
  // 빈 카드를 성공처럼 보여 주지 않는다
  if (읽지못함(추출)) return 실패(422, '통보서에서 값을 읽지 못했습니다. 시공통보서가 맞는지 확인하세요.')

  // ⑦ ERP 읽기 (쓰기 없음)
  let 수주목록: 수주후보[]
  try {
    수주목록 = await fetchAllRows<수주후보>('수주', (from, to) =>
      supabase
        .from('수주')
        .select('id, 지중no, 공사명, 공사번호, 원청사_id, 수주금액_공급가, 보험료율, 하도전용율')
        .order('id')
        .range(from, to),
    )
  } catch {
    console.error('[history-card] orders_query')
    return 실패(500, '수주 목록을 읽지 못했습니다.')
  }
  // RLS는 권한이 없을 때 에러가 아니라 200 + 빈 배열을 준다. 그대로 가면 '기존 수주 없음' + 번호 001이
  // 조용히 제안된다. 수주가 0건인 ERP는 실제로 없으니 빈 목록은 실패로 본다.
  if (수주목록.length === 0) {
    console.error('[history-card] orders_empty')
    return 실패(500, '수주 목록이 비어 있습니다. 관리자에게 알려 주세요.')
  }

  let 거래처요율: { 보험료제외율: number | null; 하도전용율: number | null } | null = null
  if (규칙.거래처_id != null) {
    const { data: 거래처, error } = await supabase
      .from('거래처')
      .select('보험료제외율, 하도전용율')
      .eq('id', 규칙.거래처_id)
      .maybeSingle()
    if (error) {
      console.error('[history-card] client_query', error.code)
      return 실패(500, '거래처 요율을 읽지 못했습니다.')
    }
    거래처요율 = 거래처
  }

  // ⑧ 조립 (저장 없음)
  return NextResponse.json(build카드({ 추출, 규칙, 거래처요율, 수주목록 }))
}
```

- [ ] **Step 2: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 0

- [ ] **Step 3: 문지기 수동 확인** (`npm run dev` 상태에서)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/history-card
```
Expected: `401` (쿠키 없음)

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/history-card/route.ts
git commit -m "feat(history-card): 카드 생성 API"
```

---

### Task 9: 생성 화면 + 메뉴

**Files:**
- Create: `src/app/(dashboard)/history-card/page.tsx`
- Create: `src/app/(dashboard)/history-card/_components/HistoryCardClient.tsx`
- Modify: `src/components/sidebar/Sidebar.tsx` (navGroups의 공무 그룹 줄)
- Modify: `src/components/sidebar/MobileTabBar.tsx` (tabs 끝)

- [ ] **Step 1: 페이지**

```tsx
import { createClient } from '@/lib/supabase/server'
import type { 이력카드_머리글자Row } from '@/types/database'
import { HistoryCardClient } from './_components/HistoryCardClient'

export const metadata = { title: '이력 카드 생성 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('이력카드_머리글자')
    .select()
    .eq('사용', true)
    .order('정렬')
    .order('id')

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">이력 카드 생성</h1>
        <p className="text-sm text-gray-400 mt-0.5">시공통보서 PDF를 올리면 씽크와이즈에 붙여 넣을 공사이력카드를 만듭니다 · 저장되지 않습니다</p>
      </div>
      <HistoryCardClient 규칙목록={(data ?? []) as 이력카드_머리글자Row[]} />
    </div>
  )
}
```

- [ ] **Step 2: 클라이언트 컴포넌트**

```tsx
'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Copy, Check, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { 이력카드_머리글자Row } from '@/types/database'
import type { 카드결과 } from '../_lib/card'

// 서버(pdf.ts)와 같은 값. 서버 proxy의 10MB 상한보다 작게 — 올리기 전에 막아 시간을 아낀다
const 최대바이트 = 9 * 1024 * 1024

export function HistoryCardClient({ 규칙목록 }: { 규칙목록: 이력카드_머리글자Row[] }) {
  const [규칙Id, set규칙Id] = useState<number | null>(null)
  const [처리중, set처리중] = useState(false)
  const [오류, set오류] = useState<string | null>(null)
  const [결과, set결과] = useState<카드결과 | null>(null)
  // 카드 텍스트는 사용자가 복사 전에 고칠 수 있는 초안 = 원본 state (결과에서 매번 파생하지 않는다)
  const [본문, set본문] = useState('')
  const [복사됨, set복사됨] = useState(false)
  const [끌어옴, set끌어옴] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const 올리기가능 = 규칙Id !== null && !처리중

  async function 보내기(file: File) {
    if (!올리기가능) return
    if (file.size > 최대바이트) { set오류('PDF가 9MB를 넘습니다.'); return }
    set처리중(true); set오류(null); set결과(null); set복사됨(false)
    try {
      const fd = new FormData()
      fd.append('prefixId', String(규칙Id))
      fd.append('file', file)
      const res = await fetch('/api/history-card', { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)
      if (!res.ok) { set오류(json?.error ?? `요청 실패 (${res.status})`); return }
      set결과(json as 카드결과)
      set본문((json as 카드결과).text)
    } catch {
      set오류('서버에 연결하지 못했습니다.')
    } finally {
      set처리중(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function 복사() {
    await navigator.clipboard.writeText(본문) // 탭 문자 그대로
    set복사됨(true)
  }

  return (
    <div className="space-y-4">
      <fieldset className="bg-white rounded-lg border border-gray-200 p-4">
        <legend className="text-sm font-medium text-gray-700 px-1">머리글자</legend>
        {규칙목록.length === 0 ? (
          <p className="text-sm text-gray-400">사용 중인 머리글자가 없습니다. 관리자에게 알려 주세요.</p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {규칙목록.map(r => (
              <label key={r.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="prefix" checked={규칙Id === r.id} onChange={() => set규칙Id(r.id)} />
                <span className="font-mono font-semibold">{r.머리글자}</span>
                <span className="text-gray-500">{r.이름}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div
        role="button"
        tabIndex={0}
        aria-disabled={!올리기가능}
        onClick={() => 올리기가능 && inputRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && 올리기가능) inputRef.current?.click() }}
        onDragOver={e => { e.preventDefault(); if (올리기가능) set끌어옴(true) }}
        onDragLeave={() => set끌어옴(false)}
        onDrop={e => {
          e.preventDefault(); set끌어옴(false)
          const f = e.dataTransfer.files[0]
          if (f) void 보내기(f)
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-10 text-center text-sm transition-colors',
          올리기가능 ? 'cursor-pointer border-gray-300 text-gray-600 hover:border-[#2d45a8]' : 'cursor-not-allowed border-gray-200 text-gray-300',
          끌어옴 && 'border-[#2d45a8] bg-blue-50',
        )}
      >
        {처리중 ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />통보서 읽는 중 (수십 초 걸릴 수 있습니다)</span>
        ) : (
          <span className="inline-flex items-center gap-2"><Upload className="size-4" />
            {규칙Id === null ? '먼저 머리글자를 고르세요' : '시공통보서 PDF를 끌어다 놓거나 클릭'}
          </span>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void 보내기(f) }} />
      </div>

      {오류 && <p className="text-sm text-red-600">{오류}</p>}

      {결과 && (
        <div className="space-y-2">
          {결과.warnings.length > 0 && (
            <ul className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-1">
              {결과.warnings.map(w => (
                <li key={w} className="flex gap-1.5"><AlertTriangle className="size-4 shrink-0 mt-0.5" />{w}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">금액은 통보서와 대조하세요. AI가 셋을 같이 잘못 읽으면 검산으로 못 잡습니다.</p>
          <textarea
            value={본문}
            onChange={e => { set본문(e.target.value); set복사됨(false) }}
            rows={16}
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm [tab-size:4]"
          />
          <div className="flex items-center gap-3">
            <Button type="button" onClick={복사}>
              {복사됨 ? <Check className="size-4" /> : <Copy className="size-4" />}{복사됨 ? '복사됨' : '복사'}
            </Button>
            <span className="text-sm text-gray-500">
              번호: {결과.번호상태 === '기존' ? 'ERP 등록된 공사' : 결과.번호상태 === '제안' ? '제안 (수주 등록 시 확정)' : '확인 필요'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 메뉴** — `Sidebar.tsx`

import에 `ScrollText` 추가, `navGroups`의 공무 줄을 바꾼다:

```tsx
  [
    { href: '/gongmu', label: '공무', icon: FileText },
    { href: '/history-card', label: '이력 카드 생성', icon: ScrollText },
  ],
```

`MobileTabBar.tsx`: import에 `ScrollText` 추가, `tabs` 맨 끝에:

```tsx
  { href: '/history-card', label: '이력카드', icon: ScrollText },
```

- [ ] **Step 4: 타입·린트·테스트**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 전부 통과

- [ ] **Step 5: 화면 확인** — `npm run dev` → `/history-card`. 확인할 것: 머리글자 7개 표시, 고르기 전엔 드롭존 비활성, 9MB 넘는 파일은 올리기 전에 막힘, PC·모바일 메뉴에 항목이 보임

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(dashboard)/history-card/page.tsx" "src/app/(dashboard)/history-card/_components/HistoryCardClient.tsx" src/components/sidebar/Sidebar.tsx src/components/sidebar/MobileTabBar.tsx
git commit -m "feat(history-card): 이력 카드 생성 화면과 메뉴"
```

---

### Task 10: 머리글자 관리 화면

**Files:**
- Create: `src/app/(dashboard)/admin/history-card-prefixes/page.tsx`
- Create: `src/app/(dashboard)/admin/history-card-prefixes/_components/PrefixesClient.tsx`
- Modify: `src/components/sidebar/Sidebar.tsx` (adminNav)

관리자 확인은 `admin/layout.tsx`가 이미 한다(화면). 쓰기를 실제로 막는 건 Task 1의 RLS(`is_admin()`)다. 삭제 버튼은 두지 않는다(삭제 정책도 없다).

- [ ] **Step 1: 페이지**

```tsx
import { createClient } from '@/lib/supabase/server'
import type { 이력카드_머리글자Row, 거래처Row } from '@/types/database'
import { PrefixesClient } from './_components/PrefixesClient'

export const metadata = { title: '이력카드 머리글자 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const [{ data: 규칙 }, { data: 거래처 }] = await Promise.all([
    supabase.from('이력카드_머리글자').select().order('정렬').order('id'),
    supabase.from('거래처').select('id, 거래처명, 보험료제외율, 하도전용율').order('거래처명'),
  ])
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">이력카드 머리글자 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">카드 번호 머리글자와, 새 공사의 영전사금액 요율을 가져올 거래처 · 끝난 규칙은 지우지 말고 사용을 끕니다</p>
      </div>
      <PrefixesClient
        initialRows={(규칙 ?? []) as 이력카드_머리글자Row[]}
        거래처목록={(거래처 ?? []) as Pick<거래처Row, 'id' | '거래처명' | '보험료제외율' | '하도전용율'>[]}
      />
    </div>
  )
}
```

- [ ] **Step 2: 클라이언트 컴포넌트**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { 이력카드_머리글자Row, 거래처Row } from '@/types/database'

type 거래처요약 = Pick<거래처Row, 'id' | '거래처명' | '보험료제외율' | '하도전용율'>
type FormState = { 머리글자: string; 이름: string; 거래처_id: string; 사용: boolean; 정렬: string }

const emptyForm: FormState = { 머리글자: '', 이름: '', 거래처_id: '', 사용: true, 정렬: '0' }

const 요율표시 = (c: 거래처요약 | undefined) =>
  !c ? '없음 (카드에 확인 필요)'
    : `${c.거래처명} · 보험료 ${c.보험료제외율 != null ? c.보험료제외율 * 100 : '-'}% · 하도 ${c.하도전용율 != null ? c.하도전용율 * 100 : '-'}%`

export function PrefixesClient({ initialRows, 거래처목록 }: { initialRows: 이력카드_머리글자Row[]; 거래처목록: 거래처요약[] }) {
  const [rows, setRows] = useState(initialRows)
  const [editRow, setEditRow] = useState<이력카드_머리글자Row | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const 거래처by = useMemo(() => new Map(거래처목록.map(c => [c.id, c])), [거래처목록])

  function openEdit(row: 이력카드_머리글자Row | null) {
    setEditRow(row)
    setForm(row
      ? { 머리글자: row.머리글자, 이름: row.이름, 거래처_id: row.거래처_id != null ? String(row.거래처_id) : '', 사용: row.사용, 정렬: String(row.정렬) }
      : emptyForm)
    setMsg(null)
    setOpen(true)
  }

  async function save() {
    const 머리글자 = form.머리글자.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(머리글자)) { setMsg('머리글자는 영문 대문자 2글자입니다.'); return }
    if (!form.이름.trim()) { setMsg('이름을 입력하세요.'); return }
    const 정렬 = parseInt(form.정렬, 10)
    if (Number.isNaN(정렬)) { setMsg('정렬은 숫자입니다.'); return }
    // 화면에서 칸을 없애지 않았으므로 모든 키를 보낸다. 거래처 비움 = 명시적 null(요율 없음)
    const payload = { 머리글자, 이름: form.이름.trim(), 거래처_id: form.거래처_id ? Number(form.거래처_id) : null, 사용: form.사용, 정렬 }
    setSaving(true)
    const q = editRow
      ? supabase.from('이력카드_머리글자').update(payload).eq('id', editRow.id).select().single()
      : supabase.from('이력카드_머리글자').insert(payload).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) { setMsg(error.code === '23505' ? '이미 있는 머리글자입니다.' : '저장에 실패했습니다.'); return }
    const saved = data as 이력카드_머리글자Row
    setRows(prev => (editRow ? prev.map(r => (r.id === saved.id ? saved : r)) : [...prev, saved]).sort((a, b) => a.정렬 - b.정렬 || a.id - b.id))
    setOpen(false)
  }

  return (
    <>
      <div className="mb-3"><Button onClick={() => openEdit(null)}>규칙 추가</Button></div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr><th className="p-2 text-left">머리글자</th><th className="p-2 text-left">이름</th><th className="p-2 text-left">요율 거래처</th><th className="p-2">사용</th><th className="p-2">정렬</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => openEdit(r)} className="border-t cursor-pointer hover:bg-gray-50">
                <td className="p-2 font-mono font-semibold">{r.머리글자}</td>
                <td className="p-2">{r.이름}</td>
                <td className="p-2 text-gray-600">{요율표시(r.거래처_id != null ? 거래처by.get(r.거래처_id) : undefined)}</td>
                <td className="p-2 text-center">{r.사용 ? '사용' : <span className="text-gray-400">끔</span>}</td>
                <td className="p-2 text-center">{r.정렬}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editRow ? '규칙 수정' : '규칙 추가'}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4">
            <div><Label>머리글자</Label><Input value={form.머리글자} maxLength={2} onChange={e => setForm({ ...form, 머리글자: e.target.value })} /></div>
            <div><Label>이름</Label><Input value={form.이름} onChange={e => setForm({ ...form, 이름: e.target.value })} /></div>
            <div>
              <Label>요율 거래처 (새 공사의 영전사금액 계산용)</Label>
              <select className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm" value={form.거래처_id}
                onChange={e => setForm({ ...form, 거래처_id: e.target.value })}>
                <option value="">없음 — 카드에 '확인 필요'</option>
                {거래처목록.map(c => <option key={c.id} value={c.id}>{c.거래처명}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{요율표시(form.거래처_id ? 거래처by.get(Number(form.거래처_id)) : undefined)}</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.사용} onChange={e => setForm({ ...form, 사용: e.target.checked })} />생성 화면에 보이기</label>
            <div><Label>정렬</Label><Input inputMode="numeric" value={form.정렬} onChange={e => setForm({ ...form, 정렬: e.target.value })} /></div>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
          </div>
          <SheetFooter><Button onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 3: 관리자 메뉴** — `Sidebar.tsx`의 `adminNav`에서 `공사현장 관리` 줄 뒤에:

```tsx
  { href: '/admin/history-card-prefixes', label: '이력카드 머리글자' },
```

- [ ] **Step 4: 타입·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 0

- [ ] **Step 5: 화면 확인** — 관리자 계정으로 `/admin/history-card-prefixes`: 7행, CG의 요율 거래처가 `(주) 영전사`, 규칙 하나의 `사용`을 끄면 `/history-card`에서 사라지는지, 같은 머리글자를 추가하면 "이미 있는 머리글자"가 뜨는지 본다. 관리자가 아닌 계정은 `/`로 튕기는지 본다

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(dashboard)/admin/history-card-prefixes" src/components/sidebar/Sidebar.tsx
git commit -m "feat(history-card): 머리글자 규칙 관리 화면"
```

---

### Task 11: 실제 통보서로 끝까지 확인 + 게이트 3·4

- [ ] **Step 1: 실제 호출 1회** — `.env.local`에 키·모델을 넣고 `npm run dev`를 띄운다. `/history-card`에서 JY를 고르고 `../thinkwise-ops/시공통보서.pdf`를 올린다. 기획서 §8의 기대값과 대조한다:
  - 공사번호 3917-2025-3862 (01) → **기존 수주 `JY26-004`로 잡혀야 한다** (대시 없이 저장된 행)
  - 접수 날짜 `26.01.08`
  - 공급가액: 기존 수주라 ERP의 `수주금액_공급가`를 쓴다 (통보서 49,302,664와 같은지 본다)
  - 경고 없음 (49,302,664 + 4,930,266 = 54,232,930)
  - 공사시행 초안이 `(AI 초안)` 아래 2~5줄

- [ ] **Step 2: 카드 제목 대조** — 결과 제목과 `thinkwise-ops/공사이력카드 예시.png`의 제목 표기(kW 대소문자 등), ERP 공사명을 실데이터 2~3건으로 비교한다. 다르면 사용자에게 어느 쪽을 쓸지 묻는다(기획서 §4의 열린 질문)

- [ ] **Step 3: 붙여 넣기 확인** — 복사 버튼으로 복사해 씽크와이즈 테스트 가지에 붙여 넣는다. 가지 구조(탭 단계)가 맞는지, 줄바꿈 `\n`이 그대로 먹히는지 본다. 안 먹히면 `card.ts`의 `join('\n')`을 `'\r\n'`으로 바꾸고 테스트 기대값도 같이 고친다

- [ ] **Step 4: 실패 경로** — 9쪽짜리 다른 PDF(예: `시공지시서.pdf`, 4.9MB)를 올려 보고, 422 "값을 읽지 못했습니다" 또는 경고가 뜨는지 본다. 빈 카드가 성공처럼 나오면 안 된다. PDF가 아닌 파일 → 400

- [ ] **Step 5: 서버 로그 확인** — dev 콘솔에 통보서 내용이나 AI 응답 원문이 한 줄도 없는지 본다 (`[history-card] <단계명>`만 있어야 한다)

- [ ] **Step 6: 게이트 3 (리뷰)** — `superpowers:requesting-code-review`. 보안(키·문지기·밖으로 나가는 것), 조용한 실패, 금액 공식 재사용 여부를 중점으로 본다. 사용자가 항목마다 수용/반박한다

- [ ] **Step 7: 게이트 4 (이해)** — 지뢰 개념은 면접 모드로. 후보 질문:
  1. (RLS) 이 route가 `수주`를 읽을 때 쓰는 신원은 누구의 것이고, 화이트리스트 밖 사람이면 `fetchAllRows`는 무엇을 돌려받나. 그때 `orders_empty` 가드가 없으면 카드의 번호 칸에 뭐가 찍히나
  2. (상태코드) 같은 "못 읽음"인데 왜 OpenAI가 거절하면 502이고, 시공지시서를 올리면 422인가
  3. (경계) `OPENAI_API_KEY`에 `NEXT_PUBLIC_`을 붙이면 키가 어디에 살게 되고, 서버에서 env를 지운 뒤 `pm2 reload`로 회수되나

- [ ] **Step 8: 게이트 5** — PR 설명과 커밋 메시지는 사용자가 쓴다. 배포 순서를 PR에 적는다: ①마이그레이션 SQL 실행 → ②`.env.production`에 키 2개 → ③빌드·배포. 그리고 사장님께 "통보서 1쪽이 OpenAI로 간다"를 한 줄 보고한다(기획서 §7)

---

## 자체 점검 (기획서 대비)

- §2 결정 1~9: 1(DB 안 씀) Task 8 / 2(제안 번호) Task 3·5 / 3(관리자 규칙) Task 1·10 / 4(AI는 값만) Task 4·5 / 5(1쪽만) Task 6 / 6(통보일자) Task 5 / 7(제목만, AI 초안) Task 5 / 8(twdx 제외) 해당 없음 / 9(전용 키, 서버 env) Task 0·8
- §3 화면: 비활성 업로드, 스피너 문구, 편집 textarea, 탭 그대로 복사, 저장 안 함 → Task 9
- §5.2 검산 + 상시 문구 → Task 5·9 / §5.3 세 갈래 + 원청사 불일치 → Task 2·5 / §5.4 엄격판 재사용 → Task 5 / §5.5 정수 비교·연도 → Task 3
- §7 상태코드: 400·401·502는 기획서대로. 추가: 403(화이트리스트 밖), 422(문서를 못 읽음), 500(env 누락·ERP 조회 실패). 로그는 단계명만
- §8 테스트 → Task 2~7, 실제 호출 → Task 11
- 기획서에서 바꾼 것: 크기 상한 20MB → 9MB (proxy 10MB 상한)
