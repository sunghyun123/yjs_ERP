# 영전사 ERP 개발 진행 기록

> 최종 업데이트: 2026-06-08 (7차)

---

## 완료된 작업

### 7. 수주대장 계산 버그 수정 및 기성 마이그레이션 수정 (7차, 2026-06-08)

#### 보험료율/하도전용율 계산 버그 수정

**문제**: `calc수주금액`이 `발주자` 거래처 JOIN의 `보험료제외율`·`하도전용율`을 읽고 있었음.
발주자(삼천리 등) 거래처에는 해당 요율이 없어 항상 null → 보험료제외·하도적용이 표시되지 않거나 0으로 계산됨.
**원인**: 요율은 원청사 기준이며, 마이그레이션 때 `수주` 테이블에 직접 저장됨(`보험료율`, `하도전용율` 컬럼).

| 변경 파일 | 내용 |
|-----------|------|
| `src/app/(dashboard)/orders/page.tsx` | SELECT에 `보험료율, 하도전용율` 직접 추가; `발주자` JOIN에서 두 필드 제거 |
| `src/app/(dashboard)/orders/_types.ts` | `수주행` 타입에 `보험료율 \| null`, `하도전용율 \| null` 추가; `발주자정보`에서 제거 |
| `src/app/(dashboard)/orders/_components/OrdersTable.tsx` | `calc수주금액`이 `row.발주자?.보험료제외율` 대신 `row.보험료율` 사용 |

#### 수주대장 상세 패널(Sheet) UI 개선

- **합계 행 삭제**: 공급가 + 부가세10% 합계는 실무에서 미사용 → 제거
- **공급가** 파란 배경(`bg-blue-50`) + 굵은 글씨로 하이라이트
- **하도적용** 파란 배경 + 굵은 글씨로 하이라이트 (실질 수주금액)
- **부가세** 회색으로 시각적 비중 낮춤

#### 수주대장 테이블 수주금액 컬럼 교체

- 기존: 수주금액(공급가) 원금 그대로 표시
- 변경: **수주금액(하도적용)** = `공급가 × (1 - 보험료율) × 하도전용율` 계산값 표시
- 요율이 없는 공사(보험료율·하도전용율 모두 null)는 공급가 그대로 표시

#### 기성 마이그레이션 수정

**문제**: 기존 스크립트가 개별 1차/2차/3차 기성액(col 25/30/37)만 읽었는데, 엑셀에서 이 컬럼들이 전부 비어있어 기성 0건으로 처리됨.
**실제 데이터**: M열(index 12) `누적기성(공급가)` — 518건 중 192건에 데이터 존재.

| 변경 파일 | 내용 |
|-----------|------|
| `scripts/migrate-수주.ts` | `COL`에 `누적기성_공급가: 12` 추가; 개별 1/2/3차 처리 제거; 누적기성 > 0이면 `차수=1` 단일 기성 레코드로 저장 |

**마이그레이션 재실행 필요** (기성 테이블이 비어있으므로 바로 실행 가능):
```bash
npx ts-node --project scripts/tsconfig.json scripts/migrate-수주.ts
```
→ 기성 192건 INSERT 예정

---

### 6. 수주 마이그레이션 및 성과금액 계산 정확도 개선 (6차, 2026-06-08)

#### 수주 마이그레이션 (`scripts/migrate-수주.ts`)

- `수주대장조회.xlsx` 518건 Supabase `수주` 테이블에 UPSERT 완료
- RLS 우회를 위해 `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가 필요 (현재 설정됨)
- 기성: 개별 1/2/3차 기성액 컬럼(col 25/30/37) 전부 비어있음 → **7차에서 M열 누적기성으로 방식 변경**

#### 거래처 데이터 입력

- `거래처 데이터.xlsx` 24개 거래처 SQL INSERT 쿼리 생성 → Supabase SQL Editor에서 실행

#### 보험료율/하도전용율 적용 (수주별 요율 저장 방식)

**문제**: 성과금액이 `기성액_공급가` / `준공액_공급가` 원금 그대로 표시됨  
**공식**: `성과금액 = 공급가 × (1 - 보험료율) × 하도전용율`  
(보험료율 null → 0, 하도전용율 null → 1로 fallback)

| 변경 파일 | 내용 |
|-----------|------|
| `src/types/database.ts` | `수주` Row/Insert/Update 타입에 `보험료율: number \| null`, `하도전용율: number \| null` 추가 |
| `scripts/migrate-수주.ts` | COL 상수에 `보험료율: 19`, `하도전용율: 20` 추가; 행 구성 시 `/100` 소수 변환 |
| `src/app/(dashboard)/sales/page.tsx` | 기성 쿼리에 `수주!수주_id(보험료율, 하도전용율)` JOIN 추가; 성과금액 공식 적용 |
| `src/app/(dashboard)/_components/ProfitChartSection.tsx` | 기성 JOIN 동일 적용; 준공결과 쿼리에 보험료율/하도전용율 추가; 양쪽 성과금액 공식 적용 |

**완료**:

```sql
-- Supabase SQL Editor (실행 완료)
ALTER TABLE "수주" ADD COLUMN IF NOT EXISTS "보험료율" FLOAT;
ALTER TABLE "수주" ADD COLUMN IF NOT EXISTS "하도전용율" FLOAT;
```

- 마이그레이션 재실행 완료 (518건 UPSERT → 보험료율·하도전용율 컬럼 채움)

---

### 1. DB 스키마 설계 및 Supabase 세팅

**Supabase SQL Editor에서 실행한 테이블 (7개):**

| 테이블 | 역할 |
|--------|------|
| `사용자` | Supabase Auth 연동 계정 |
| `거래처` | 원청사/발주자 마스터 |
| `공사단가` | 직종별 주/야간 단가 이력 |
| `수주` | 프로젝트(공사) 기본 정보 |
| `기성` | 차수별 기성금 |
| `투입실적` | 일별 직종별 투입 인원 |
| `시스템설정` | 일반관리비율 등 전사 설정값 |
| `계획금액` | 월별 성과 계획금액 (YYYY-MM PK) |

- 모든 테이블 RLS 활성화 완료
- `authenticated` 역할: 전체 권한(ALL)
- `anon` 역할: SELECT 전용 (yjsboard.com 대시보드 연동용)

---

### 2. Next.js 프로젝트 파일 구성

#### 환경 변수 (`.env.local` — 직접 생성, git 제외)
```
NEXT_PUBLIC_SUPABASE_URL=https://ljwglblarxvhhcogznmf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5PHMr2qF7cv76Usq22OzkQ_aWtIiNiP
```

#### 생성된 파일 목록

| 파일 | 역할 |
|------|------|
| `src/lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `src/lib/supabase/server.ts` | 서버 컴포넌트용 Supabase 클라이언트 (async) |
| `src/proxy.ts` | 세션 갱신 프록시 (Next.js 16 — middleware.ts 대체) |
| `src/lib/format.ts` | 금액/날짜/퍼센트 포맷 유틸 |
| `src/types/database.ts` | Supabase 8개 테이블 전체 TypeScript 타입 |
| `src/app/layout.tsx` | 루트 레이아웃 |
| `src/app/actions/auth.ts` | 로그아웃 Server Action |
| `src/app/(dashboard)/layout.tsx` | 인증 보호 레이아웃 (미로그인 시 /login 리다이렉트) |
| `src/app/(dashboard)/page.tsx` | 대시보드 홈 (URL: /) |
| `src/app/(dashboard)/_lib/calc.ts` | 투입금액 계산 로직 (단가 이력 조회 포함) |
| `src/app/(dashboard)/_components/KpiCards.tsx` | KPI 카드 4개 + 스켈레톤 |
| `src/app/(dashboard)/_components/ProfitChartSection.tsx` | 연간 매출손익 차트 데이터 fetch |
| `src/app/(dashboard)/_components/ProfitChart.tsx` | Recharts BarChart (Client Component) |
| `src/app/(dashboard)/_components/ActiveProjects.tsx` | 진행중 공사 목록 + 스켈레톤 |
| `src/app/(dashboard)/orders/_types.ts` | 수주대장 페이지 전용 타입 |
| `src/app/(dashboard)/orders/page.tsx` | 수주대장 목록 (URL: /orders) |
| `src/app/(dashboard)/orders/_components/OrdersTable.tsx` | TanStack Table v8 + 필터 + Sheet 상세 (Client) |
| `src/app/login/page.tsx` | 로그인 페이지 (Server Component) |
| `src/app/login/LoginForm.tsx` | 로그인 폼 (Client Component) |
| `src/components/sidebar/Sidebar.tsx` | 데스크탑 사이드바 |
| `src/components/sidebar/MobileTabBar.tsx` | 모바일 하단 탭바 |

---

### 3. 매출손익 현황 구현 (W4 완료)

#### 생성 파일

| 파일 | 역할 |
|------|------|
| `src/app/(dashboard)/sales/page.tsx` | Server Component — 연도별 기성·투입실적 조회 및 월별 집계 |
| `src/app/(dashboard)/sales/_components/YearSelector.tsx` | Client Component — 연도 선택 (URL searchParams 방식) |
| `src/app/(dashboard)/sales/_components/SalesChart.tsx` | Client Component — Recharts BarChart (손익 바 Cell 조건부 색상) |

#### 주요 기능

- **연도 선택**: 상단 `<select>`로 연도 변경 → `?year=YYYY` URL 파라미터 → Server Component 재조회
- **KPI 카드 3개**: 연간 누적 성과금액 / 투입금액 / 손익 (손익은 양수 초록·음수 빨강)
- **월별 막대차트**: 성과(파랑) / 투입(주황) / 손익(초록·빨강) 3개 Bar, Y축 만원 단위, 툴팁 억/만원 포맷
- **월별 상세 테이블**: 월 / 성과금액 / 투입금액 / 손익 / 이익률, 하단 합계 행 (굵게)
- **성과금액**: 기성일 기준 기성액\_공급가 합계 (준공액 미포함)
- **투입금액**: 투입일 기준 calc투입금액 합계 (일반관리비 제외)

#### 사이드바/탭바 경로 변경

- `Sidebar.tsx`, `MobileTabBar.tsx`: `/profit` → `/sales`

#### 기술 이슈 및 해결

- **Next.js 16 searchParams**: `Promise<{ year?: string }>` 타입으로 선언 후 `await searchParams`로 접근
- **Recharts 손익 조건부 색상**: `Bar` 내부에 `Cell` 컴포넌트로 월별 양수/음수 분기

#### 차트 수정 (2026-06-08)

- **바 순서 통일**: 성과 → 투입 → 손익 (KPI 카드 순서와 일치)
- **매출손익 현황 차트 단위 변경**: 만원 → 원 단위 (Y축 억/만 자동 축약, 툴팁 정확한 원 단위 표시)
- **홈 대시보드 차트 단위 변경**: 천원 → 백만원 (빠른 파악 목적)
- 수정 파일: `SalesChart.tsx`, `sales/page.tsx`, `ProfitChart.tsx`, `ProfitChartSection.tsx`

---

### 4. 투입실적 입력 구현 (W3 완료)

#### 생성 파일

| 파일 | 역할 |
|------|------|
| `src/app/(dashboard)/input/page.tsx` | Server Component — 공사단가 fetch 후 폼 컴포넌트에 전달 |
| `src/app/(dashboard)/input/_components/InputForm.tsx` | Client Component — 전체 입력 UI |

#### 주요 기능

- **공사 자동완성**: 지중No 또는 공사명 입력 시 250ms 디바운스로 Supabase 실시간 검색, 드롭다운 선택
- **기존 실적 자동 로드**: 공사+날짜 조합이 DB에 존재하면 자동으로 불러오고 "기존 실적 수정 중" 뱃지 표시
- **직종별 그리드**: 11개 직종 × 주간/야간, Tab 키로 주간→야간→다음 직종 순서로 이동
- **0인 직종 dim 처리**: 주간·야간 모두 0인 행은 `opacity-35`로 흐리게 표시, 값 입력 시 컬러 하이라이트
- **실시간 합계**: 입력할 때마다 투입금액 / 일반관리비(6%) / 합계 즉시 계산 (투입일 기준 공사단가 적용)
- **전날 복사**: 선택 공사의 전날 실적을 불러와 인원 필드 자동 채우기 (금액은 현재 날짜 단가로 재계산)
- **초기화**: 공사·날짜는 유지하고 인원 필드만 0으로 초기화
- **저장**: 기존 레코드면 UPDATE (수정자·수정일 갱신), 신규면 INSERT (생성자 기록)
- **토스트**: 저장 성공/실패 시 우상단 3.5초 알림

#### 기술 이슈 및 해결

- **Next.js 한글 폴더명 라우팅 불가**: `(dashboard)/투입실적/` → `(dashboard)/input/` 으로 변경 (비ASCII 폴더는 URL 세그먼트 불가)
- **Zod v4 `z.coerce.number()` 타입 추론 깨짐**: `z.coerce.number()` → `z.number()` + register `setValueAs` 옵션으로 대체
- **Supabase UPDATE/INSERT 한글 테이블명 타입 never**: `.update()` / `.insert()` 호출 시 `as any` 캐스팅으로 처리 (기존 `.select()` 패턴과 동일)

#### 입력 UX 수정 (2026-06-08)

- **소수점 정밀도 개선**: `step="0.5"` → `step="0.01"` — 0.33, 0.2 등 자유로운 소수 입력 가능 (1인이 여러 공사 분할 투입 시 대응)
- **모범신호수 단위 명시**: 행 라벨 `모범신호수` → `모범신호수 (h)` — 시급 단위임을 명확히 표시 (입력값 = 투입 시간, 단가 30,000/40,000원은 시급)

---

### 5. 대시보드 구현 (W1 완료)

- URL `/` = 대시보드 홈 (`(dashboard)` route group)
- KPI 카드: n월 계획금액 / 성과금액(기성+준공) / 투입금액 / 손익금액
- 월별 매출손익 차트: Recharts BarChart, 단위 천원, 성과→투입→손익 순
- 진행중 공사 목록: 달성율 프로그레스바 (80% 이상 초록, 50~80% 주황, 미만 파랑)
- 계획금액: 매월 공무팀이 Supabase `계획금액` 테이블에 입력 (YYYY-MM 키)
- 모든 섹션 Suspense + Skeleton 처리

### 5. 주요 기술 결정 사항

#### Next.js 16 Breaking Changes 대응
- `middleware.ts` 파일명 → `proxy.ts`, 함수명 `middleware` → `proxy`
- `cookies()` → `await cookies()` (async로 변경됨)
- 참고 문서: `node_modules/next/dist/docs/`

#### Zod v4 API 변경
- 커스텀 에러: `{ message: '...' }` → `{ error: '...' }`
- `z.string().email()` → `z.email()` (standalone)
- `@hookform/resolvers v5`가 Zod v4 지원

#### Supabase 한글 테이블명 TypeScript 이슈
- 한글 테이블명/컬럼명 사용 시 반환 타입이 `never`로 추론됨
- **해결책:** 결과를 명시적 캐스팅으로 처리
  ```ts
  const { data: rawProfile } = await supabase.from('사용자').select()...
  const profile = rawProfile as Pick<사용자Row, '이름' | '이메일'> | null
  ```

#### 인증 방식
- `auth.getSession()` 대신 `auth.getUser()` 사용 (서버 측 토큰 검증)
- Protected 레이아웃에서 미로그인 시 `/login`으로 서버 리다이렉트
- 로그아웃은 Server Action (`src/app/actions/auth.ts`)

#### 디자인 컬러
- 사이드바 배경: `#1e2d5a` (네이비)
- 사이드바 텍스트: `#c8d3f0`
- 활성 메뉴 배경: `#2d45a8`
- 페이지 배경: `#f1f4fb`

---

## 현재 상태

- 개발 서버: `npm run dev` → `http://localhost:3000`
- 로그인 화면: 정상 동작 확인 (GET /login 200)
- TypeScript 컴파일: 오류 없음 (`npx tsc --noEmit` 통과)

---

## 남은 작업

| 우선순위 | 페이지 | 경로 | 상태 |
|---------|--------|------|------|
| 1 | 대시보드 | `/` | ✅ 완료 |
| 2 | 수주대장 | `/orders` | ✅ 완료 |
| 3 | 투입실적 입력 | `/input` | ✅ 완료 |
| 4 | 매출손익 현황 | `/sales` | ✅ 완료 |
| 5 | 공사이력 등록 | `/orders/[id]/history` | 📋 설계 필요 |
| 6 | 거래처 관리 | `/admin/clients` | 미구현 |
| 7 | 공사단가 관리 | `/admin/rates` | 미구현 |

---

## 공사이력 등록 — 신규 기능 설계 메모 (2026-06-08)

### 배경 및 문제

기존 ERP 방식의 월별 실적 집계 흐름:
```
직원이 달성률(%) 수동 입력
→ 하도적용금액 × 달성률 = 수주금액(실적금액) [수주대장조회.xlsx S열]
→ 월별 실적 = (이번달 말 달성률 - 전달 말 달성률) × 하도적용금액
```

**문제점**: 달성률을 계산하려면 어차피 금액 기반 계산이 필요한데, 그 계산 결과로 달성률을 뽑고, 다시 달성률로 월별 실적을 역산하는 이중 구조라 복잡하고 유지가 안 됨.

### 새 설계 방향

진행중인 공사에 대해 **오늘 진행한 금액을 직접 입력** → 시스템이 자동으로 계산:

```
공사이력 입력: 이번달 진행 금액 (원)
→ 누적 달성률 = Σ 공사이력.금액 / 하도적용금액 × 100
→ 월별 달성률 = 해당월 공사이력.금액 / 하도적용금액 × 100
→ 월별 실적금액 = 해당월 공사이력.금액 (입력값 그대로)
```

### 필요한 DB 테이블 (신규)

```sql
CREATE TABLE 공사이력 (
  id         SERIAL PRIMARY KEY,
  수주_id    INTEGER NOT NULL REFERENCES 수주(id),
  이력년월   VARCHAR(7) NOT NULL,  -- 'YYYY-MM' (해당 작업월)
  금액       DECIMAL(15,2) NOT NULL,  -- 해당월 진행 금액
  메모       TEXT,
  생성자     UUID REFERENCES 사용자(id),
  생성일     TIMESTAMP DEFAULT NOW(),
  수정자     UUID REFERENCES 사용자(id),
  수정일     TIMESTAMP,
  UNIQUE (수주_id, 이력년월)  -- 공사별 월 중복 방지
);
```

### 화면 구성 (안)

**공사이력 등록 (`/orders/[id]/history`)**:
- 수주 기본정보 헤더 (공사명, 하도적용금액)
- 월별 이력 테이블: 년월 / 진행금액 / 월별달성률 / 누적달성률
- 새 이력 추가 폼: 년월 선택 + 금액 입력
- 저장 시 달성률 자동계산 표시

**수주대장 연동**:
- 수주대장 달성률 컬럼 = 공사이력 기반 누적달성률로 대체
- 월별 실적 현황 화면에서 공사이력.금액 합계를 월별 성과금액으로 사용

### 현재 달성률 처리

기존 수주대장조회.xlsx에서 마이그레이션한 `달성율` 컬럼은 기존 ERP 기준 값으로 임시 보관.
공사이력 등록 기능 구축 후 새 방식으로 대체 예정.

---

## 테스트 방법

### 첫 로그인 전 Supabase 사용자 생성 필요

1. [Supabase Auth 콘솔](https://supabase.com/dashboard/project/ljwglblarxvhhcogznmf/auth/users) 접속
2. **Add user → Create new user** 클릭
3. 이메일/비밀번호 입력 후 **Auto Confirm User** 체크
4. `http://localhost:3000/login` 에서 로그인

### 개발 서버 실행
```bash
npm run dev
# → http://localhost:3000
```

---

## 기술 스택 요약

| 역할 | 버전 |
|------|------|
| Next.js | 16.2.7 (Turbopack, App Router) |
| TypeScript | 5.x |
| Supabase (@supabase/ssr) | 0.10.3 |
| shadcn/ui | latest |
| Tailwind CSS | v4 |
| Zod | 4.4.3 |
| @hookform/resolvers | v5 |
| react-hook-form | latest |
| lucide-react | latest |
