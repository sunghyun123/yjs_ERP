# 영전사 ERP 개발 진행 기록

> 최종 업데이트: 2026-06-11 (공무 보고서 재설계 + 버그 수정 + 검색/금액 UX 개선)

---

## 완료된 작업

| # | 기능 | 상태 |
|---|------|------|
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

---

## 남은 작업 (우선순위 순)

| 순서 | 기능 | 경로 |
|------|------|------|
| 1 | 공사이력 CRUD (Sheet 탭) | `/orders` |

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

### 인증
- `auth.getSession()` 대신 `auth.getUser()` (서버 측 토큰 검증)
- 미로그인 → `/login` 서버 리다이렉트 (dashboard layout)
- 로그아웃: Server Action (`src/app/actions/auth.ts`)

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
│   └── format.ts                     # formatKRW, formatEok
├── types/database.ts                 # 9개 테이블 TypeScript 타입 (dashboard_공사 추가)
└── app/
    ├── login/                        # 로그인 페이지
    ├── actions/auth.ts               # 로그아웃 Server Action
    └── (dashboard)/
        ├── layout.tsx                # 인증 보호 레이아웃
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

Supabase 사용자 생성: [Auth 콘솔](https://supabase.com/dashboard/project/ljwglblarxvhhcogznmf/auth/users) → Add user → Auto Confirm User
