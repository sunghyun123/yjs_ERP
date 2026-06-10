# 영전사 ERP 개발 진행 기록

> 최종 업데이트: 2026-06-10 (달성률 이중 표시 — 공정 달성률 vs 기성 달성률)

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

---

## 남은 작업 (우선순위 순)

| 순서 | 기능 | 경로 |
|------|------|------|
| 1 | 거래처 관리 | `/admin/clients` |
| 2 | 공사단가 관리 | `/admin/rates` |

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
│   └── format.ts                     # formatKRW, formatEok
├── types/database.ts                 # 8개 테이블 TypeScript 타입
└── app/
    ├── login/                        # 로그인 페이지
    ├── actions/auth.ts               # 로그아웃 Server Action
    └── (dashboard)/
        ├── layout.tsx                # 인증 보호 레이아웃
        ├── _lib/calc.ts              # calc투입금액, calc합계
        ├── _components/             # KpiCards, ProfitChart, ActiveProjects
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
```

---

## 테스트

```bash
npm run dev   # http://localhost:3000
npx tsc --noEmit  # 타입 검사
```

Supabase 사용자 생성: [Auth 콘솔](https://supabase.com/dashboard/project/ljwglblarxvhhcogznmf/auth/users) → Add user → Auto Confirm User
