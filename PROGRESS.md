# 영전사 ERP 개발 진행 기록

> 최종 업데이트: 2026-06-24 (공사이력 % 입력을 누적 달성률로 재해석 — 증분 역산)
>
> 이 문서는 2층 구조다.
> - **완료된 작업** = 무엇을 했는지 한 줄씩, 전체 기록(검색·추적용).
> - **주요 엔지니어링 결정** = 왜 그렇게 했는지·무엇에 데었는지(포트폴리오·심층 분석용).
> - 굵직한 항목은 표에서 `→` 표시로 심층 섹션을 가리킨다.

---

## 완료된 작업

| # | 기능 | 요약 |
| --- | --- | --- |
| 1 | DB 스키마 + Supabase 세팅 | 8개 테이블, RLS |
| 2 | 인증 + 레이아웃 | 로그인/로그아웃, 보호 레이아웃 |
| 3 | 대시보드 홈 (`/`) | KPI 카드 · 손익 차트 · 진행 공사 목록 |
| 4 | 투입실적 입력 (`/input`) | 자동완성 · 실시간 계산 · 저장/수정 |
| 5 | 매출손익 현황 (`/sales`) | 연도별 KPI + 월별 차트 + 상세 테이블 |
| 6 | 초기 마이그레이션 | 수주 518 + 기성 192 + 거래처 24 |
| 7 | 수주대장 계산 버그 수정 | 보험료율·하도전용율 JOIN 경로 → 수주 직접 컬럼 |
| 8 | VPS 배포 | `erp.yjsboard.com`, PM2 + Nginx + SSL |
| 9 | 성과금액 소스 변경 | 기성/준공 → 공사이력 (진행기준 수익인식) |
| 10 | 투입금액 계산식 변경 | `calc투입금액` → `calc합계(×1.06)` |
| 11 | 마이그레이션 | 투입실적 312 + 공사이력 263건 |
| 12 | 투입실적 현황 탭 | DataTable + Sheet 수정/삭제 |
| 13 | 투입실적 현황 UX | 날짜 범위 필터 · 검색어 유지 · useEffect 동기화 |
| 14 | 투입실적 입력 2단 레이아웃 | 우측 sticky 계산 패널 |
| 15 | 수주 등록·수정·삭제 폼 | Sheet → Dialog 900px |
| 16 | 차트 범례 순서 고정 | 성과→투입→손익 + 헤더 연간 합계(백만원) |
| 17 | SearchableSelect 3종 버그 수정 | → [Radix Dialog 내 portal 드롭다운](#searchableselect--radix-dialog-내-portal-드롭다운-3종-버그) |
| 18 | 수주금액 계산 패널 UX | 너비 확장 · 하도적용 히어로 카드 · 필수 별표 |
| 19 | 수주대장 UX | 항상-표시 수정 버튼 · 삭제 확인 위치 · 진행상태 이동 |
| 20 | 수주 Dialog 탭 구조 | [기본/기성/준공] 3탭 + 기성 CRUD |
| 21 | 공사이력 페이지 (`/progress`) | 입력 탭(달성율 역산) + 현황 탭(필터·검색·CRUD) |
| 22 | 공사이력 현황 UI 통일 | 투입실적 패턴으로 맞춤 |
| 23 | 투입실적 메뉴명 변경 | + 입력 시 마지막 투입일 표시 |
| 24 | 달성률 이중 표시 | 공정 달성률(공사이력) vs 기성 달성률(기성 청구) |
| 25 | 투입실적 입력 화면 UI/UX | 정렬 · 인풋 강화 · 지브라/호버 |
| 26 | 홈 KPI 개선 | 계획금액 제거, 전월 동기간 대비 성과 추가 |
| 27 | ERP 미입력 공사 섹션 | `dashboard_공사` 수신 · 소프트 삭제 · 페이지네이션 |
| 28 | `POST /api/dashboard-sync` | Bearer 인증, upsert |
| 29 | 이력/실적 빠른 입력 | 미입력 공사 → 사전 선택된 채 이동 |
| 30 | 공무 보고서 (`/gongmu`) 재설계 | 3→2단계 네비, ISO year 경계 버그 수정 |
| 31 | 공무 주간보고서 | 월간현황 통합카드, total 페이지 삭제 |
| 32 | 공무 보고서 버그 수정 | 월이동 초기화 · 자동가져오기 제거 · 검색 추가 |
| 33 | 공사검색 드롭다운 UX | 통합 셀 + createPortal로 overflow 잘림 해결 |
| 34 | 금액 입력란 천단위 쉼표 포맷 | 포커스 시 숫자 · 블러 시 콤마 |
| 35 | 거래처 관리 (`/admin/clients`) | DataTable + Sheet CRUD |
| 36 | 공사단가 관리 (`/admin/rates`) | 인라인 편집 CRUD |
| 37 | 공무담당자 관리 (`/admin/gongmu`) | 이름·등록일 CRUD |
| 38 | 공무 페이지 개선 6종 | 드롭다운 flip · 검색 · 기본주차 · 정렬 등 |
| 39 | 매출손익 공사별 피벗 단순화 | 과기능 제거, `table-fixed`+`colgroup` 컬럼 고정 |
| 40 | 매출손익 마이그레이션 스크립트 | (후속 #54에서 삭제됨) |
| 41 | 매출손익 데이터 정합성 | → [구ERP 0원 차이 달성](#데이터-정합성--성과금액-일별-증분-정본화) |
| 42 | 파일명 통일 | 매출손익현황.xlsx → 매출손익.xlsx |
| 43 | KpiCards 버그 3건 수정 | 월말 누락 · 타임존 · 전월 동기간 환산 |
| 44 | 매출손익 공사별 표 개편 | 1공사 3행 그룹(지표 열), 원 단위, sticky 스크롤 |
| 45 | 모바일 레이아웃 정비 6종 | 패딩·그리드·표 컬럼폭 반응형화 |
| 46 | `formatEok` 천단위 콤마 | 공통 포맷터 일괄 반영 |
| 47 | 수주대장 팝업 통합 | 상세 Sheet 제거, 행 클릭 → 수정 Dialog |
| 48 | 삭제 확인 UI 위치 재수정 | #19 회귀 버그 복원 |
| 49 | 공무 금주실적 월 이동 버그 수정 | 동적 주차 전환(`displayWeekEntry`) |
| 50 | 카카오 단일 로그인 + 화이트리스트 | → [카카오 OAuth 인증](#카카오-oauth-단일-로그인--화이트리스트) |
| 51 | 투입실적 상세 테이블 전환 | `투입구분` 기반 동적 행 |
| 52 | 상세 기반 투입금액/손익 계산 | + `/admin/*` admin 전용 권한 보호 |
| 53 | Dashboard 월간 KPI API | `monthly-kpi.ts` 분리 + Bearer API |
| 54 | 성과금액 일별 증분 정본화 | → [데이터 정합성](#데이터-정합성--성과금액-일별-증분-정본화) |
| 55 | 현황 검색 금액 합계 footer | 필터 전체 행 합산(페이지 무관), 수주대장·투입실적 |
| 56 | 백업/포트폴리오 증거 체계 | `backup:data` 스케줄러 + PostHog 초안 |
| 57 | 안정성 개선 5종 | 검색어 quote · 에러 표면화 · 배치 upsert 등 |
| 58 | 날짜 KST 고정 | → [KST 타임존 고정](#날짜-kst-고정) |
| 59 | RLS 화이트리스트 강제 (방향 A) | → [RLS 방향 A](#rls-방향-a--앱-우회-직접-호출-차단) |
| 60 | RLS admin 쓰기 제한 | `is_admin()`, 거래처·공사단가 쓰기 admin 전용 |
| 61 | 에러 모니터링 도입 | PostHog 3계층 캡처(클라/서버/렌더) |
| 62 | 공사현장 드롭다운 + 준공 자동화 | → [준공 자동화·두 달성률](#준공-자동화--두-달성률-구분) |
| 63 | 공사이력 성과 원/% 토글 입력 | 운영 피드백 — 정본은 항상 원(원/% 환산은 순수 헬퍼) |
| 64 | 변경내역 추적 (`/admin/updates`) | → [audit_log 트리거 결정](#변경내역-추적--db-트리거-vs-앱레벨-로깅) |
| 65 | 공사이력 % 입력 = 누적 달성률 | → [누적 입력 재해석](#공사이력--입력--누적-달성률로-재해석) |

> 표기: `→`는 아래 **주요 엔지니어링 결정** 섹션의 심층 설명을 가리킨다.

**남은 작업:** 없음. Phase 2 완료 ✅

---

## 주요 엔지니어링 결정 (포트폴리오·심층)

> 면접에서 "이거 왜 이렇게 했어요?"라고 물어볼 만한 결정들. 트레이드오프와 데인 지점(함정)을 남긴다.

### 카카오 OAuth 단일 로그인 + 화이트리스트

이메일/비번 로그인을 제거하고 `signInWithOAuth({provider:'kakao'})` 단일 방식으로 전환. 인가는 별도 `whitelist` 테이블(`kakao_id`)로 처리 — `/auth/callback`에서 명단 대조 후 미등록자 거부, 대시보드 레이아웃이 **매 요청 재확인**(퇴사자 즉시 차단). 강제 로그아웃은 서버 컴포넌트가 쿠키를 못 지워 무한루프가 나므로 `/auth/signout` 라우트 핸들러 경유. 명단은 `kakao_whitelist.json` → DB reconcile 스크립트(`npm run sync:whitelist`)로 동기화.

**함정 3종:**
1. **`kakao_id`는 카카오 앱마다 다르다** → 명단을 공유하는 다른 사내 프로그램과 **동일 카카오 앱**을 Supabase 공급자에 연결해야 매칭된다.
2. **GoTrue가 `account_email`+`profile_image`+`profile_nickname` 스코프를 서버에서 강제** 요청(클라 `scopes`로 제거 불가) → 카카오 앱 동의항목 3개 모두 "사용"이어야 한다(이메일은 비즈앱 전환 필요).
3. **`handle_new_user` 트리거가 카카오 NULL 이메일에서 실패** → 합성 이메일 폴백(`<uid>@kakao.local`, `supabase/handle-new-user.sql`).

### RLS 방향 A — 앱 우회 직접 호출 차단

모든 업무 테이블 정책이 `using(true)`라, anon key + 세션만 있으면 앱을 우회해 PostgREST를 직접 호출하면 전 테이블 읽기/변조가 가능한 구멍이 있었다. `is_whitelisted()` SECURITY DEFINER 함수가 **`auth.identities`**(GoTrue 관리·위조 불가)에서 `kakao_id`를 읽어 whitelist와 대조 → 14개 업무 테이블 정책을 `(select is_whitelisted())`로 교체. 쓰기 한 겹 더: `is_admin()`(role='admin')으로 `거래처`·`공사단가`의 insert/update/delete를 admin 전용으로 제한(#60).

**핵심 판단:** `user_metadata`는 사용자가 위조할 수 있으므로 RLS에서 신뢰 금지 — 반드시 `auth.identities` 기준. `whitelist` select 정책은 유지(콜백/레이아웃 본인 조회), service role 경로는 RLS 우회라 무영향. 비상 롤백 스크립트 동봉. 플랜=`docs/superpowers/plans/2026-06-22-rls-whitelist-enforcement.md`.

### 데이터 정합성 — 성과금액 일별 증분 정본화

**단독 소스 원칙:** 성과금액은 `공사이력`에만 일별 증분으로 적재한다(매출손익.xlsx는 적재 금지 — 이중적재 사고 방지). 초기엔 읽기 측이 `isMonthEndDate()` 월말 행만 합산해 **성과 82%가 누락**되던 버그가 있었고, 월말 필터를 제거하고 전체 행 합산으로 통일(sales·ProfitChart·revenue·monthly-kpi)해 신ERP `1,952,265,227원`을 복구했다. 구ERP와의 잔여 차이는 수익인식 방식 차이로 확인(신ERP가 진행기준으로 더 정확). 구ERP(매출손익.xlsx) vs 웹ERP 성과·투입금액 **0원 차이** 달성(#41), 오기입 투입실적 정리 포함.

### 변경내역 추적 — DB 트리거 vs 앱레벨 로깅

신규 ERP가 안정화될 때까지 레거시 ERP에 변경을 이중입력해야 해서 "최근 무엇이 들어왔는지"를 빠짐없이 조회할 필요가 있었다.

**앱레벨 로깅 기각 → DB 트리거 채택:** 앱레벨은 10+ mutation 자리를 다 손봐야 하고 하나라도 빠지면 누락된다(특히 행이 사라지는 삭제). 9개 테이블에 `AFTER INSERT/UPDATE/DELETE` 범용 트리거를 걸어 `audit_log`(table_name·operation·row_id·old_data/new_data jsonb·changed_at)에 적재.

**함정 3종:**
1. `audit_log`에 RLS를 켜면 일반 mutation의 트리거 INSERT가 막혀 **원래 작업까지 실패** → 트리거 함수를 `security definer`로 소유자 권한 우회.
2. SELECT(admin) 정책만 두고 INSERT 정책은 두지 않음 → 클라 직접 조작 불가, 기록은 트리거만.
3. `공사이력`엔 생성일 컬럼이 없어 소급입력(작업일자=지난주, 입력=오늘)이 날짜 조회로 안 잡힘 → `changed_at`(실제 insert 시각)이 메운다.

한시적 도구(신규 ERP 단독운영 정착 시 트리거·테이블 드롭). 마이그=`supabase/migrations/20260624120000_audit_log.sql`.

### 날짜 KST 고정

서버가 UTC 런타임이라 `today()`·`formatDate`가 하루 밀리는 버그가 있었다. `src/lib/kst.ts`(`todayKST`·`formatKST`·`partsKST`, Asia/Seoul 고정)를 추가하고 입력/공무/단가/공정 폼의 기본값·기간 계산을 KST로 통일. **함정:** `week.ts`(UTC Date 전용)와 수정일/updatedAt 타임스탬프는 의도적으로 ISO 유지.

### 준공 자동화 + 두 달성률 구분

준공을 찍어도 저장 컬럼 `수주.달성율`을 갱신하는 코드가 없어 달성률이 안 바뀌었고, 준공액≠수주액인데 매출손익은 공사이력 기준이라 정확도가 떨어졌다. 준공 저장 시 `수주.달성율=100` + `공사이력`에 `준공정산=true` 행 한 줄 upsert(성과=준공액공급가−기존누계)로, 매출손익 정본(공사이력 합산)을 안 깨면서 총성과=준공액이 되게 했다. **무손실 해제:** 실수 대비, 해제는 `eq('준공정산',true)`인 자동 행만 삭제(직접 입력 공사이력 보존)+달성율 재계산.

**두 달성률 분리:** 공사이력 기반 공정 달성률(추정치, 100% 초과 허용·clamp 금지)과 수주대장 준공 플래그(=100)는 별개다. 준공은 수동 전용(공사이력 100%가 자동 준공을 트리거하지 않음). 계산은 순수 함수(`completion.ts`)로 분리+단위테스트.

### 공사이력 % 입력 — 누적 달성률로 재해석

운영 피드백: `%` 입력칸이 "이번 증분 %"라 65% 공사를 끝내려면 사용자가 `100−65`를 암산해야 했다. 옛 ERP는 `%`칸에 **누적 목표**(30→60→100)를 직접 쳤다. 그 습관을 재현해, `%` 입력을 "이번 작업 후 누적 달성률"로 재해석하고 증분은 시스템이 역산하게 했다(`원` 모드는 증분 그대로 — 규모 큰 공사는 그때그때 시행액을 치는 게 자연스러워 모드별 의미를 분리).

**핵심 판단 — 저장 정본은 여전히 증분(원):** 화면 입력만 누적%로 바꾸고 DB 적재는 행마다 증분 원을 유지했다. 이유는 (1) 성과금액 단일 정본 원칙(`공사이력`만, 원 단위), (2) **기존 데이터 호환** — 과거 행이 전부 증분으로 쌓여 있어 "행마다 누적달성률" 모델로 바꾸면 옛 행엔 그 값이 없어 매출손익 합산이 깨진다. `누적목표를증분으로(누적목표%, base, 누계)` 순수함수(`percent.ts`)로 분리+단위테스트.

**음수 증분 허용:** 현재 60%에서 50%를 입력하면 증분 = 50%−60% = **−10%**(음수)를 저장 → 최종 누계가 입력값(50%)에 정확히 착지. 매출손익은 증분의 월별 합산이라 정정이 일어난 달의 매출이 그만큼 차감(총 누계는 정확) — 의도된 동작.

**100% 초과는 차단 대신 경고:** 옛 ERP는 `0~100` CHECK 제약으로 초과를 막아, 실무자가 초과분을 **준공금액에만** 적어 공사이력과 데이터가 어긋났다. 우리는 제약을 풀되 저장후 100%↑·0%↓에 **비차단 노란 경고**만 띄워(저장은 허용) 오타는 잡고 현실(초과 달성)은 수용한다.

**남은 함정(범위 밖):** 증분-합산 모델은 과거 행을 수정하면 최신 누계가 흔들린다(옛 ERP의 행별 누계-스냅샷과 대비). 이번 입력폼 변경엔 무영향이라 손대지 않음.

---

## 핵심 기술 결정사항 (코딩 시 필독)

> 프레임워크·라이브러리 특이점과 재사용 가능한 UI 패턴. 다음 코딩 때 또 밟을 함정들.

### Next.js 16 Breaking Changes
- `middleware.ts` → `proxy.ts`, 함수명 `middleware` → `proxy`
- `cookies()` → `await cookies()` (async)
- `searchParams` → `Promise<{...}>` 타입, `await searchParams`로 접근

### Zod v4 API 변경
- 커스텀 에러: `{ message }` → `{ error }`
- `z.string().email()` → `z.email()`
- `z.coerce.number()` 타입 추론 깨짐 → `z.number()` + `setValueAs` 옵션으로 대체
- `@hookform/resolvers v5` 사용 (Zod v4 지원)

### Supabase 한글 테이블명 TypeScript 이슈
- 한글 테이블/컬럼명 → 반환 타입이 `never`로 추론됨
- 해결: `as any` 또는 명시적 타입 캐스팅

```ts
const { data: raw } = await supabase.from('사용자').select()
const user = raw as Pick<사용자Row, '이름'> | null
```

### 인증 — 운영 레퍼런스
- `auth.getSession()` 대신 `auth.getUser()` (서버 측 토큰 검증)
- 표시 이름은 `사용자` 테이블이 아니라 `whitelist.user_name`에서 읽음
- 미로그인 → `/login` 리다이렉트, 강제 로그아웃은 `/auth/signout` 라우트 경유
- 명단 동기화: `npm run sync:whitelist` (JSON은 gitignore — 개인정보)
- DB: `supabase/whitelist.sql`, `supabase/handle-new-user.sql`. `사용자` 테이블은 생성자/수정자 FK 대상이라 유지
- 설계 배경·함정 3종은 → [카카오 OAuth 인증](#카카오-oauth-단일-로그인--화이트리스트)

### 스크롤 레이아웃
- `html/body`에 `h-full` + `overflow-y-auto` 조합 금지 → `min-h-screen` + 자연 window 스크롤 사용

### Table 내 드롭다운 — overflow 클리핑 해결 패턴

`overflow-x-auto` 컨테이너 내부의 `position: absolute` 드롭다운은 컨테이너에 잘린다.
**해결:** `createPortal(dropdown, document.body)` + `position: fixed` + `getBoundingClientRect()`로 위치 지정.

```tsx
const rect = inputRef.current?.getBoundingClientRect()
createPortal(
  <div style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, zIndex: 9999 }}>
    {items}
  </div>,
  document.body
)
```

항목 클릭 시 input blur 방지: `onMouseDown={e => e.preventDefault()}`.

### SearchableSelect — Radix Dialog 내 portal 드롭다운 3종 버그

**① 클릭 선택 불가** — Radix modal Dialog가 `body.style.pointerEvents="none"` 설정 → portal 클릭 불가.
해결: `DismissableLayerBranch`로 portal 감싸기 + container `pointerEvents:'auto'`, 아이템은 `onMouseDown` preventDefault + `onClick` 선택.

**② 스크롤 시 닫힘** — `document` scroll 리스너(capture)가 드롭다운 내부 스크롤도 감지.
해결: `dropRef`를 컨테이너에 연결, `e.target`이 내부면 early return.

**③ 마우스 휠 차단** — `react-remove-scroll`(Radix Dialog 내장)이 `document` bubble phase `wheel` 리스너로 portal 휠을 `preventDefault()`.
해결: 컨테이너에 `onWheel={e => e.stopPropagation()}`.

---

## 파일 구조 (핵심)

```
src/
├── proxy.ts                          # Next.js 16 세션 갱신 (middleware 대체)
├── lib/
│   ├── supabase/client.ts            # 브라우저용 클라이언트
│   ├── supabase/server.ts            # 서버 컴포넌트용 클라이언트 (async)
│   ├── supabase/admin.ts             # 서비스 롤 클라이언트 (API 전용)
│   ├── whitelist.ts                  # extractKakaoId + getWhitelistEntry
│   ├── whitelist-sync.ts             # reconcileWhitelist 순수 함수
│   └── format.ts                     # formatKRW, formatEok
├── types/database.ts                 # 11개 테이블 TypeScript 타입
└── app/
    ├── login/                        # 카카오 로그인 페이지
    ├── auth/
    │   ├── callback/route.ts         # 카카오 OAuth 콜백 + 화이트리스트 검증
    │   └── signout/route.ts          # 쿠키 정리 로그아웃
    ├── actions/auth.ts               # 로그아웃 Server Action
    └── (dashboard)/
        ├── layout.tsx                # 인증 보호 레이아웃
        ├── admin/layout.tsx          # whitelist.role=admin 관리자 구역 보호
        ├── _lib/calc.ts              # calc투입금액, calc합계
        ├── _components/              # KpiCards, ProfitChart, UnregisteredProjects
        ├── _actions/dashboard.ts     # deleteUnregisteredProject Server Action
        ├── orders/                   # 수주대장 (기본정보/기성/준공 탭)
        ├── input/                    # 투입실적 (InputForm, HistoryTable)
        ├── progress/                 # 공사이력 (ProgressInputForm, ProgressHistoryTable)
        └── sales/                    # 매출손익 현황
```

---

## 배포 / 테스트

```bash
# VPS에서
cd /var/www/yjs_erp && ./deploy.sh    # git pull → npm install → build → pm2 reload

# 로컬
npm run dev        # http://localhost:3000
npx tsc --noEmit   # 타입 검사
```

**환경변수 (VPS `.env.production`):**
```
NEXT_PUBLIC_SUPABASE_URL=https://ljwglblarxvhhcogznmf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DASHBOARD_API_KEY=...   # 대시보드 연동 Bearer 토큰
```

**사용자 등록(카카오 로그인):** `kakao_whitelist.json`에 `{kakao_id, user_name, role}` 추가 → `npm run sync:whitelist`. 신입 `kakao_id`는 명단 공유하는 다른 사내 프로그램(동일 카카오 앱)에서 확보.
