# 영전사 ERP 개발 진행 기록

> 최종 업데이트: 2026-06-18 (성과금액 일별 증분 정본화 — 매출손익 정합성 복구)

---

## 2026-06-18 성과금액 일별 증분 정본화 — 매출손익 정합성 복구

- **배경**: 공사이력을 일별 증분(`Δ달성률 × 하도적용금액`)으로 재마이그레이션하면서, 읽기 측에 남아 있던 `isMonthEndDate()` 월말 필터가 일별 증분 중 월말 행(약 18%)만 골라 합산 → 성과금액이 82% 누락(실제 1,952M인데 349M만 표시).
- **수정**: 월말 필터를 전부 제거하고 기간 내 *전체 행*을 합산하도록 통일.
  - `sales/page.tsx`, `_components/ProfitChartSection.tsx`, `_lib/revenue.ts`(`sumMonthlyRevenue`)에서 `isMonthEndDate` 제거. `_lib/monthly-kpi.ts`는 주석만 정리(전월 동기간 환산 로직 유지).
  - `scripts/migrate-공사이력.ts`도 월말 스킵/예약 로직 제거 — 공사현황.xlsx 단일 정본을 월말까지 동일하게 일별 증분으로 적재.
  - 더 이상 쓰지 않는 `scripts/migrate-매출손익.ts` 삭제(이중적재 사고의 원인 스크립트).
- **검증**: 신ERP 누적 성과 1,952,265,227원으로 복구, `check-신구비교.ts` 전체-행 합산값과 일치. 구ERP 매출손익.xlsx와의 잔여 약 7.7M 차이는 **신ERP 버그 아님** — 구ERP 월별 인식 방식 차이(연도경계 누적 재인식, 연초 증분 귀속, 일부 단월 과다적재)에서 발생. 신ERP 하도적용금액은 수주대장조회.xlsx `수주금액(하도적용)`과 원 단위 일치.
- **동기화 방침**: 배포 전까지 구ERP 값 반영은 수기 전사 금지(이중적재 회귀 위험). 공사현황.xlsx 최신본을 받아 공사이력 전체 삭제 후 `migrate-공사이력.ts` 재실행 → `check-신구비교.ts`로 대조.
- 검증: `npx tsc --noEmit` 통과.

---

## 2026-06-18 Dashboard 월간 KPI API 연동

- 홈 KPI 카드 계산 로직을 `src/app/(dashboard)/_lib/monthly-kpi.ts`로 분리해 UI와 외부 API가 같은 성과금액/투입금액/손익 계산을 재사용하도록 변경.
- `GET /api/kpi/monthly-performance` 추가: `DASHBOARD_API_KEY` Bearer 인증 후 서비스 롤 Supabase 클라이언트로 월간 KPI JSON 반환.
- API 응답은 Dashboard 프록시가 바로 쓰기 좋게 `label`, `amounts`, `formatted`, `updatedAt` 구조로 제공.
- 기존 `KpiCards.tsx`는 분리된 KPI 계산 함수를 호출하도록 정리해 화면 표시값과 API 값의 불일치 가능성 제거.
- Dashboard `home.html`의 월별 총 공정률 영역에서 ERP 월간 성과금액이 정상 표시되는 것 확인.
- 검증: `npm run build` 통과.

---

## 2026-06-18 투입실적 상세 구조 + 관리자 권한 보호

- `투입실적상세` 테이블 마이그레이션 추가: `투입실적_id + 투입구분` 단위로 주간/야간 수량 저장, 기존 `투입실적` 고정 컬럼은 호환용으로 유지.
- 기존 고정 컬럼(`상용직`, `일용직`, `모범신호수`, `6W`, `3W`, `덤프15T`, `크레인`, `물청소차`, `MCM`, `접속`)을 `투입실적상세`로 백필하는 SQL 포함. `재료비/인`은 별도 상세 row를 만들지 않고 상용직 수량 기반 계산 정책 유지.
- 투입실적 입력/현황을 공사단가의 `투입구분` 목록 기반 동적 행으로 전환. 새 단가 항목 추가 시 코드 수정 없이 입력/수정 화면에 표시.
- 매출손익, 홈 KPI, 손익 차트의 투입금액 계산을 상세 기반으로 전환하되, 기존 데이터 호환을 위해 레거시 고정 컬럼 fallback 유지.
- `/admin/*` 전체를 `whitelist.role = 'admin'` 사용자만 접근 가능하도록 서버 layout 보호 추가. 사이드바 관리자 메뉴도 admin에게만 표시.
- 공사단가 관리(`/admin/rates`)는 관리자 전용 CRUD로 유지하고, 수정/삭제 시 기존 투입실적 금액이 재계산될 수 있다는 안내와 삭제 확인창 추가.
- 운영 DB 백필 확인: `select count(*) from "투입실적상세";` 결과 3,530건, 신규 `test` 투입구분 저장 확인.
- 검증: `npm run build` 통과, `npm test` 10개 통과.

---

## 2026-06-17 백업/포트폴리오 증거 체계

- 원천 Excel 복구용 private 백업 체계 추가: `npm run backup:data`가 `backups/private/<timestamp>-data-backup/<yyyy-mm-dd>.backup.xlsx` 단일 workbook 생성.
- 일일 백업 대상은 `공사현황`, `매출손익`, `수주대장조회`, `투입실적현황` 4개 시트로 제한. `거래처 데이터.xlsx`는 정적 reference 성격이라 daily backup에서 제외하고 manifest에 제외 사유 기록.
- Windows 작업 스케줄러 `YJS ERP Daily Data Backup` 등록: 매일 02:00 `npm run backup:data` 실행.
- 최신 private 백업 위치 추적용 `backups/private/LATEST_BACKUP.txt` 생성.
- public portfolio용 합성 데이터 생성 스크립트 추가: `npm run backup:portfolio`가 실제 원본을 읽지 않고 `backups/portfolio/generated/<yyyy-mm-dd>.portfolio-sample.xlsx` 생성.
- 백업/검증/포트폴리오 문서 추가: `docs/backup-inventory.md`, `docs/data-validation-report-template.md`, `docs/anonymized-sample-data-plan.md`, `docs/portfolio-case-study.md`.
- PostHog 제품 분석 기반 포트폴리오 증거 체계 초안 구현: production-only 초기화, URL 원문 미전송, hashed distinctId, allowlist property sanitizer, manual page view capture, Excel export event capture.
- 문서화: `docs/posthog-analytics.md`. 당장은 운영 수집을 보류하고, 필요 시 env 설정 후 이어서 사용.
- 검증: `npm test` 10개 통과, `npx tsc --noEmit` 통과.

---

## 완료된 작업

| # | 기능 | 상태 |
| --- | --- | --- |
| 1 | DB 스키마 + Supabase 세팅 (8개 테이블, RLS) | ✅ |
| 2 | 인증 (로그인/로그아웃) + 레이아웃 | ✅ |
| 3 | 대시보드 홈 (`/`) — KPI 카드, 손익 차트, 진행 공사 목록 | ✅ |
| 4 | 투입실적 입력 (`/input`) — 자동완성, 실시간 계산, 저장/수정 | ✅ |
| 5 | 매출손익 현황 (`/sales`) — 연도별 KPI + 월별 차트 + 상세 테이블 | ✅ |
| 6 | 수주 마이그레이션 518건 + 기성 192건 + 거래처 24개 | ✅ |
| 7 | 수주대장 계산 버그 수정 (보험료율·하도전용율 → 발주자 JOIN → 수주 직접 컬럼) | ✅ |
| 8 | VPS 배포 (`erp.yjsboard.com`, PM2 + Nginx + SSL) | ✅ |
| 9 | 성과금액 소스 변경: 기성/준공 → 공사이력 (진행기준 수익인식) | ✅ |
| 10 | 투입금액 계산식 변경: `calc투입금액` → `calc합계(×1.06)` | ✅ |
| 11 | 투입실적 마이그레이션 312건 + 공사이력 마이그레이션 263건 | ✅ |
| 12 | 투입실적 현황 탭 (`/input?tab=history`) — DataTable + Sheet 수정/삭제 | ✅ |
| 13 | 투입실적 현황 UX 개선 — 날짜 범위 필터, 검색어 유지, key 리마운트 → useEffect 동기화 | ✅ |
| 14 | 투입실적 입력 2단 레이아웃 (우측 sticky 계산 패널) | ✅ |
| 15 | 수주 등록·수정·삭제 폼 (`/orders` — Sheet → Dialog 900px) | ✅ |
| 16 | 차트 범례 순서 고정 (성과→투입→손익) + 차트 헤더 연간 합계 표시 (백만원) | ✅ |
| 17 | SearchableSelect 3종 버그 완전 수정 — ①선택 불가(Radix modal `pointer-events:none` + `DismissableLayerBranch`) ②스크롤 시 닫힘(`dropRef` 내부 스크롤 제외) ③마우스 휠 차단(`react-remove-scroll` bubble listener `stopPropagation`) | ✅ |
| 18 | 수주금액 계산 패널 UX 개선 — 패널 너비 확장(208→288px), 하도적용 히어로 카드(브랜드 네이비·18px bold), 줄바꿈 방지(`whitespace-nowrap`), 필수 표시 주황색 별표(수주금액 추가) | ✅ |
| 19 | 수주대장 UX 개선 ① 행 우측 항상-표시 "수정" 버튼 (상세 Sheet 불필요) ② 삭제 확인 UI를 오른쪽 버튼 패널로 이동(스크롤 없이 보임) ③ 수정 폼의 진행 상태(시공상태·정산상태·준공완료)를 우측 패널 상단으로 이동 | ✅ |
| 20 | 수주 Dialog 탭 구조 도입 — [기본정보][기성][준공] 3탭, 기성 CRUD (차수·기성일·기성액, 인라인 폼), 준공 탭 별도 저장 (수주 테이블 직접 UPDATE) | ✅ |
| 21 | 공사이력 페이지 (`/progress`) — 입력 탭(공사 검색 드롭다운·달성율 역산·마지막 기록 표시) + 현황 탭(날짜 범위 필터·지중No/공사명 검색·수정·삭제) | ✅ |
| 22 | 공사이력 현황 UI 투입실적 패턴 통일 — 필터 바 카드화, 날짜 raw input + `~` 구분자, 플로팅 토스트, 테이블 rounded card | ✅ |
| 23 | 투입실적 메뉴 이름 변경 (`투입실적 입력` → `투입실적`) + 입력 탭 공사 선택 시 마지막 투입일 표시 | ✅ |
| 24 | 달성률 이중 표시 — 수주대장 우측 패널에 공정 달성률(공사이력 누계 기반)·기성 달성률(기성 청구 기반) 나란히 표시, 공사이력 입력 레이블 '공정 달성률'로 통일 | ✅ |
| 25 | 투입실적 입력 화면 UI/UX 개선 — ①폼 `max-w-4xl` 왼쪽 정렬(공사이력 탭과 통일) ②인풋 크기·테두리·포커스 강화(`w-[68px] h-10`, `border-gray-400`, `ring/40`) ③테이블 행 지브라+호버(`even:bg-blue-50/40`, `hover:bg-blue-100/50`) ④주간/야간 td `text-center`로 헤더-인풋 정렬 일치 | ✅ |
| 26 | 홈 KPI 개선 — 계획금액 카드 제거, 전월 동기간 대비 성과금액 카드 추가 (양수 녹색·음수 빨강) | ✅ |
| 27 | ERP 미입력 공사 섹션 (`dashboard_공사` 테이블) — 외부 대시보드에서 공사 목록 수신 후 공사이력·투입실적 미입력 건 표시, ✕ 소프트 삭제, 10건 페이지네이션 | ✅ |
| 28 | `POST /api/dashboard-sync` — Bearer 인증, 중복 무시(upsert), 서비스 롤 admin 클라이언트 | ✅ |
| 29 | 이력/실적 빠른 입력 — 미입력 공사 행에서 "이력 입력"·"실적 입력" 버튼 클릭 시 해당 공사·날짜 사전 선택된 채로 `/progress`·`/input` 이동 | ✅ |
| 30 | 공무 보고서 (`/gongmu`) 재설계 — 3단계→2단계 네비게이션, KPI 3카드+담당자 그리드, 월 이동, ISO year 경계 버그 수정 | ✅ |
| 31 | 공무 주간보고서 — 월간현황 통합카드(계획금액 수정+달성률 바), textarea 작업란, MonthlySummary/total 페이지 삭제 | ✅ |
| 32 | 공무 보고서 버그 수정 — ①월 이동 시 계획금액 초기화 안 됨(WeeklyReportForm key remount) ②이력초안/기성초안 자동가져오기 제거 ③공무파트에 지중No+공사명 검색 추가 | ✅ |
| 33 | 공사검색 드롭다운 UX 개선 — 지중No·공사명 통합 셀(공사명 메인+지중No 서브), 포커스 시 목록 표시, createPortal+position:fixed로 overflow 잘림 해결 | ✅ |
| 34 | 금액 입력란 천단위 쉼표 포맷 — 포커스 시 숫자·블러 시 1,000,000,000 형식 (금주계획/실적/차주계획 + 월간계획 입력란) | ✅ |
| 35 | 거래처 관리 (`/admin/clients`) — DataTable + Sheet CRUD | ✅ |
| 36 | 공사단가 관리 (`/admin/rates`) — 인라인 편집 CRUD | ✅ |
| 37 | 공무담당자 관리 (`/admin/gongmu`) — 이름·등록일 CRUD, Sidebar 링크 추가 | ✅ |
| 38 | 공무 페이지 개선 — ①드롭다운 화면 하단 flip ②지중No 대소문자 무시 검색 ③개인 페이지 진입 시 이번주차 기본 선택 ④담당자 등록 순서(id) 정렬 ⑤등록일 기반 이전달 필터링 ⑥메뉴명 "공무 보고서"→"공무" | ✅ |
| 39 | 매출손익 공사별 피벗 테이블 정상화 — 과도한 기능(상태필터·정렬·페이지네이션·행펼침·주별모달·요약스트립) 제거하고 지표 토글(성과/투입/손익)+12개월+합계행으로 단순화, 주별(`weekly`/`isoWeek`) 죽은 코드 전부 제거, `table-fixed`+`colgroup`으로 컬럼 너비 픽셀 고정(줄바꿈·sticky 겹침 버그 해결) | ✅ |
| 40 | 매출손익 마이그레이션 (`scripts/migrate-매출손익.ts`) — 매출손익.xlsx 성과금액 → 공사이력 UPSERT (월말 기준, `수주_id + 작업일자` onConflict) | ✅ |
| 41 | 매출손익 데이터 정합성 완료 — 구ERP(매출손익.xlsx) vs 웹ERP 성과금액·투입금액 0원 차이 달성. 2026년 공사이력 전체 교체(248→143건). TY25-004 2026-06-12, CG26-001 2026-03-24 오기입 투입실적 삭제. | ✅ |
| 42 | 매출손익현황.xlsx 삭제 → 매출손익.xlsx로 파일명 통일 (ExcelExportButton, check-신구비교 참조 업데이트) | ✅ |
| 43 | KpiCards 버그 3건 수정 — ①6월 성과 0원(월말 레코드 누락): 공사이력 쿼리를 월 전체 범위(`lt monthEnd`)로 수정 ②타임존 버그(KST에서 `new Date(y,m,1).toISOString()` = 전달 말일): 문자열 산술로 monthEnd 계산 ③전월대비 동기간 환산: 전월 전체 성과 × (오늘 일수 / 전월 총일수) | ✅ |
| 44 | 매출손익 공사별 성과 표 개편 — 성과/투입/손익 탭 토글 제거 → 공사 1건당 3행 그룹(지표 열 신설, 색상 구분)으로 한눈에 비교, 전체 합계를 표 맨 위로 이동, 셀 금액을 억/만원 → 원 단위(천단위 콤마, 단위 캡션), 표 컨테이너 `max-h-[70vh] overflow-auto` + `thead sticky`로 가로·세로 동시 스크롤 | ✅ |
| 45 | 모바일 레이아웃 정비 — ①페이지 패딩 통일(`p-6` → `p-4 md:p-6`: home·sales·orders·gongmu) ②비반응형 stat 그리드 반응형화(매출손익 KPI·공무 카드) ③홈 미입력 공사 행 세로 스택(공사명 잘림 해결) ④수주 등록 모달·공사이력 입력 폼 좌우 2분할 → `flex-col lg:flex-row` 세로 스택(모바일 단일 스크롤) ⑤매출손익 표 모바일 전용 좁은 컬럼 폭(`useIsMobile`+matchMedia)으로 고정열이 숫자 가리는 문제 해결 ⑥공무 개인별 계획금액 3열 → 모바일 스택 | ✅ |
| 46 | `formatEok` 천단위 콤마 — 만원·억원 분기에 `toLocaleString('ko-KR')` 적용(예: `8867만원` → `8,867만원`). 홈 KPI·매출손익 KPI·공무 카드 등 공통 포맷터라 일괄 반영 | ✅ |
| 47 | 수주대장 팝업 통합 — 상세 사이드 Sheet(`OrderDetail`·`calc수주금액`·`detailRow`) 전부 제거, 행 클릭 시 수정 Dialog 직접 오픈, 수정 폼에 착공일 날짜 필드 추가(schema·defaultValues·payload·렌더) | ✅ |
| 48 | 삭제 확인 UI 위치 재수정 — 좌측 form 스크롤 영역(폼 하단) → 우측 버튼 패널 하단으로 이동, 스크롤 없이 항상 보이도록 복원 (기존 #19 회귀 버그) | ✅ |
| 49 | 공무 목록 페이지 금주실적 월 이동 버그 수정 — `weekRowsResult` 쿼리가 항상 오늘 실제 주차(`curYear/curWeek`)를 고정 사용해 월 이동해도 같은 값 표시. 선택 월에 현재 주차가 있으면 해당 주, 없으면 마지막 주차(`displayWeekEntry`)로 동적 전환. KPI 카드 타이틀도 함께 변경 | ✅ |
| 50 | 카카오 단일 로그인 + 화이트리스트 — 이메일/비번 로그인 제거, `signInWithOAuth({provider:'kakao'})` 단일 방식. `whitelist` 테이블(kakao_id)로 외부 접근 차단: `/auth/callback`에서 명단 대조 후 미등록자 거부, 대시보드 레이아웃 매 요청 재확인(퇴사자 차단), `/auth/signout` 쿠키정리 라우트(무한루프 방지). `kakao_whitelist.json`→DB 동기화 스크립트(`npm run sync:whitelist`, reconcile). **함정 3종**: ①kakao_id는 카카오 앱마다 다름 → 명단 공유하는 다른 사내 프로그램과 **동일 카카오 앱**을 Supabase 공급자에 연결 ②GoTrue가 `account_email`+`profile_image`+`profile_nickname` 스코프 강제 → 동의항목 3개 활성화 ③`handle_new_user` 트리거가 카카오 유저 NULL 이메일에서 실패 → 합성 이메일 폴백(`supabase/handle-new-user.sql`) | ✅ |
| 51 | 투입실적 상세 테이블 전환 — `투입실적상세` 추가, 기존 고정 컬럼 백필, 입력/현황/수정 화면을 공사단가 `투입구분` 기반 동적 행으로 전환. `재료비/인`은 상용직 수량 기반 계산 정책 유지, 외주1/외주2는 헤더 유지 | ✅ |
| 52 | 상세 기반 투입금액/손익 계산 + 관리자 권한 보호 — `calc투입금액상세` 추가, 기존 `calc합계` 호출부는 상세 우선·레거시 fallback으로 호환. 매출손익/KPI/차트 반영. `/admin/*`는 `whitelist.role = 'admin'`만 접근, 공사단가 CRUD는 관리자 전용으로 복구 | ✅ |
| 53 | Dashboard 월간 KPI API — 홈 KPI 계산을 `monthly-kpi.ts`로 분리하고 `GET /api/kpi/monthly-performance` Bearer 인증 API 추가. Dashboard 홈의 월별 총 공정률 영역이 ERP 월간 성과금액을 실시간 반영하도록 연동 확인 | ✅ |
| 54 | 성과금액 일별 증분 정본화 — 읽기 측 `isMonthEndDate()` 월말 필터 제거(성과 82% 누락 버그), 전체 행 합산으로 통일(sales·ProfitChart·revenue·monthly-kpi). `migrate-공사이력.ts` 월말 스킵 제거, `migrate-매출손익.ts` 삭제. 신ERP 1,952,265,227원 복구, 구ERP 잔여 차이는 인식 방식 차이로 확인(신ERP 정확) | ✅ |

---

## 남은 작업

없음. Phase 2 완료 ✅

---

## 핵심 기술 결정사항 (코딩 시 필독)

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

### 인증 — 카카오 OAuth 단일 로그인 + 화이트리스트
- `auth.getSession()` 대신 `auth.getUser()` (서버 측 토큰 검증)
- 로그인: 카카오 OAuth 단일 (`signInWithOAuth({provider:'kakao'})`). 이메일/비번 로그인 제거.
- 인가: `whitelist` 테이블(kakao_id). `/auth/callback`에서 명단 대조 → 미등록자 `signOut` + `?error=not_allowed`. 대시보드 레이아웃이 매 요청 재확인(퇴사자 즉시 차단).
- 표시 이름: `사용자` 테이블이 아니라 `whitelist.user_name`에서 읽음.
- 미로그인 → `/login` 리다이렉트. 강제 로그아웃은 `/auth/signout` 라우트 경유(서버 컴포넌트는 쿠키를 못 지워 무한루프 → 라우트 핸들러에서 쿠키 정리).
- 명단 동기화: `npm run sync:whitelist` (`kakao_whitelist.json` → `whitelist` 테이블 reconcile, service-role). JSON은 gitignore(개인정보).
- ⚠️ **카카오 회원번호(kakao_id)는 카카오 앱마다 다름** → 명단을 공유하는 다른 사내 프로그램과 **동일 카카오 앱**을 Supabase 공급자에 연결해야 매칭됨.
- ⚠️ **Supabase GoTrue는 `account_email`+`profile_image`+`profile_nickname` 3개 스코프를 서버에서 강제** 요청(클라 `scopes`로 제거 불가) → 카카오 앱 동의항목 3개 모두 "사용"이어야 함(이메일은 비즈앱 전환 필요).
- DB: `supabase/whitelist.sql`(테이블+RLS), `supabase/handle-new-user.sql`(트리거가 카카오 NULL 이메일 처리 — 합성 `<uid>@kakao.local`). `사용자` 테이블은 생성자/수정자 FK 대상이라 유지.
- 로그아웃 버튼: Server Action (`src/app/actions/auth.ts`)

### 스크롤 레이아웃
- `html/body`에 `h-full` + `overflow-y-auto` 조합 금지 → `min-h-screen` + 자연 window 스크롤 사용

### Table 내 드롭다운 — overflow 클리핑 해결 패턴

`overflow-x-auto` 컨테이너 내부의 `position: absolute` 드롭다운은 컨테이너에 잘린다.

**해결**: `createPortal(dropdown, document.body)` + `position: fixed` + `getBoundingClientRect()`로 위치 지정.

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

---

### SearchableSelect — Radix Dialog 내 portal dropdown 3종 버그 패턴

**① 클릭 선택 불가**
- 원인: Radix modal Dialog가 `disableOutsidePointerEvents:true` → `body.style.pointerEvents = "none"` 설정, portal이 클릭 불가
- 해결: `DismissableLayerBranch`(`@radix-ui/react-dismissable-layer`)로 portal 감싸기 + container에 `pointerEvents: 'auto'`
- 아이템 핸들러: `onMouseDown={e => e.preventDefault()}` (blur 차단) + `onClick`에서 실제 선택

**② 스크롤 시 드롭다운 닫힘**
- 원인: `document` scroll 리스너(capture)가 드롭다운 내부 스크롤도 감지해 닫아버림
- 해결: `dropRef`를 컨테이너 div에 연결, `e.target`이 `dropRef.current` 내부이면 early return

**③ 마우스 휠 차단**
- 원인: `react-remove-scroll`(Radix Dialog 내장)이 `document`에 **bubble phase** `wheel` 리스너 등록 → portal(shard 미등록)의 휠 이벤트를 `preventDefault()`로 차단
- 해결: 드롭다운 컨테이너에 `onWheel={e => e.stopPropagation()}` → document까지 버블링 차단

---

## 파일 구조 (핵심)

```
src/
├── proxy.ts                          # Next.js 16 세션 갱신 (middleware 대체)
├── lib/
│   ├── supabase/client.ts            # 브라우저용 클라이언트
│   ├── supabase/server.ts            # 서버 컴포넌트용 클라이언트 (async)
│   ├── supabase/admin.ts             # 서비스 롤 클라이언트 (API 전용)
│   ├── whitelist.ts                  # extractKakaoId + getWhitelistEntry (명단 조회)
│   ├── whitelist-sync.ts             # reconcileWhitelist 순수 함수 (sync 스크립트용)
│   └── format.ts                     # formatKRW, formatEok
├── types/database.ts                 # 11개 테이블 TypeScript 타입 (whitelist, 투입실적상세 추가)
└── app/
    ├── login/                        # 카카오 로그인 페이지 (KakaoLoginButton)
    ├── auth/
    │   ├── callback/route.ts         # 카카오 OAuth 콜백 + 화이트리스트 검증
    │   └── signout/route.ts          # 쿠키 정리 로그아웃 (강제 차단용)
    ├── actions/auth.ts               # 로그아웃 Server Action
    └── (dashboard)/
        ├── layout.tsx                # 인증 보호 레이아웃
        ├── admin/layout.tsx          # whitelist.role=admin 관리자 구역 보호
        ├── _lib/calc.ts              # calc투입금액, calc합계
        ├── _components/             # KpiCards, ProfitChart, UnregisteredProjects
        ├── _actions/dashboard.ts    # deleteUnregisteredProject Server Action
        ├── orders/                  # 수주대장 (OrdersTable, OrderForm — 기본정보/기성/준공 탭)
        ├── input/                   # 투입실적 (InputForm, HistoryTable)
        ├── progress/                # 공사이력 (ProgressInputForm, ProgressHistoryTable)
        └── sales/                   # 매출손익 현황
```

---

## 배포

```bash
# VPS에서
cd /var/www/yjs_erp && ./deploy.sh
# git pull → npm install → build → pm2 reload
```

**환경변수 (VPS `.env.production`):**
```
NEXT_PUBLIC_SUPABASE_URL=https://ljwglblarxvhhcogznmf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DASHBOARD_API_KEY=...   # 대시보드 연동 Bearer 토큰
```

---

## 테스트

```bash
npm run dev   # http://localhost:3000
npx tsc --noEmit  # 타입 검사
```

사용자 등록(카카오 로그인): `kakao_whitelist.json`에 `{kakao_id, user_name, role}` 추가 → `npm run sync:whitelist`로 `whitelist` 테이블 반영. 신입 kakao_id는 명단 공유하는 다른 사내 프로그램(동일 카카오 앱)에서 확보.
