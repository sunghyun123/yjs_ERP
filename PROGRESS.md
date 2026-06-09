# 영전사 ERP 개발 진행 기록

> 최종 업데이트: 2026-06-09 (15차)

---

## 완료된 작업

### 15. 수주 폼 UX 개선 2차 — 레이아웃·SearchableSelect 버그 수정 (15차, 2026-06-09)

#### 개선 내용

| # | 항목 | 변경 |
|---|------|------|
| 1 | SearchableSelect 선택 불가 버그 (치명적) | `onMouseDown` 이벤트 순서 문제 → `e.preventDefault()` + `onClick` 패턴으로 수정 |
| 2 | 공사구분·공사종류·공사현장 레이아웃 | 각각 별도 행 → `grid-cols-3` 한 행으로 통합 |
| 3 | 발주자·원청사 레이아웃 | 각각 별도 행 → `grid-cols-2` 한 행으로 통합 |
| 4 | 수주금액 위치 | 우측 패널 입력 → 좌측 필수 정보 섹션 (MoneyInput) 으로 이동 |
| 5 | 우측 패널 | MoneyInput 제거 → 계산 결과(공급가·부가세·합계·적용금액) 표시 전용 |

#### SearchableSelect 버그 원인 및 수정

```
[버그] 아이템 클릭 시 선택되지 않음
[원인] mousedown 발생 → input blur → setTimeout(150ms) 안에 dropdown 닫힘 → click 이벤트 도달 전 사라짐
[수정] 각 아이템에 onMouseDown={e => e.preventDefault()} 추가 (blur 차단)
       실제 선택은 onClick에서 처리 (mousedown → mouseup → click 순서 활용)
```

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(dashboard)/orders/_components/OrderForm.tsx` | SearchableSelect 버그 수정; 3열/2열 그리드 레이아웃; 수주금액 필수정보 섹션으로 이동 |

---

### 14. 수주 등록·수정·삭제 폼 구현 및 UX 개선 (14차, 2026-06-09)

#### 구현 내용

`/orders` 페이지에 수주 등록·수정·삭제 기능 추가. DataTable + Sheet(상세) + Dialog(폼) 구조.

#### UI 구조

```
/orders
  ├─ 필터 바 (준공여부 토글 / 공사구분 / 검색어 / [+ 새 수주] 버튼)
  ├─ TanStack Table (지중No / 공사명 / 발주자 / 수주금액(하도적용) / 누적기성액 / 달성율 / 준공여부)
  ├─ 행 클릭 → Sheet (상세, 480px)
  │    ├─ 기본정보 / 수주금액 계산 / 기성 이력
  │    └─ [수정] 버튼 → Dialog 폼으로 전환
  └─ [+ 새 수주] / [수정] → Dialog (폼, 900px × 85vh)
       ├─ 좌측 스크롤 폼 (필수정보 / 계약정보 / 담당자 / 기타 / 진행상태)
       └─ 우측 고정 패널 (실시간 계산 + 등록/저장/삭제 버튼)
```

#### 주요 기능

- **SearchableSelect**: 발주자·원청사 검색형 드롭다운. `createPortal`로 body에 렌더링하여 overflow 클리핑 없음. 스크롤 시 자동 닫힘
- **MoneyInput**: 수주금액·준공액 천단위 콤마 자동 포맷 (`toLocaleString('ko-KR')`)
- **원청사 자동적용**: 원청사 선택 시 `거래처.보험료제외율`·`하도전용율` → 수주 필드 자동 채움
- **실시간 계산 패널**: 공급가 입력 → 부가세(10%)·합계 / 보험료제외·하도적용 자동 계산 표시
- **인라인 삭제 확인**: AlertDialog 미사용, 폼 내 확인 UI로 FK 제약 오류 처리
- **toast**: 성공/실패 3.5초 로컬 알림

#### 폼 레이아웃 (최종)

| 섹션 | 필드 | 그리드 |
|------|------|--------|
| 필수 정보 | 지중No / 공사명(Textarea) / 수주금액(공급가) | 단일 컬럼 |
| 계약 정보 | 공사구분·공사종류·공사현장 | 3열 |
| | 공사번호 | 단일 컬럼 |
| | 발주자·원청사 (SearchableSelect) | 2열 |
| | 보험료율·하도전용율 | 2열 |
| 담당자 | 공사담당·감독자 | 2열 |
| 기타 | 포장여부·자재청구여부(Checkbox) / 참고사항(Textarea) | — |
| 진행 상태 (수정 전용) | 시공상태·정산상태 / 준공완료 / 준공일·준공액 | 2열 |

#### 기술 결정사항

- **Sheet → Dialog 전환**: 사이드 Sheet는 배경을 버려두는 공간 낭비 → 900px Dialog 모달로 전환
- **form id 연결**: `<form id="order-form">` (좌측) + `<Button form="order-form">` (우측 패널) — react-hook-form은 ref 기반이므로 form 요소 분리와 무관하게 동작
- **보험료율 소수 변환**: DB 저장 소수(`0.075`) ↔ 폼 표시 퍼센트(`7.5`) 변환 (입력 `×100`, 저장 `÷100`)

#### 수정/생성 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(dashboard)/orders/_components/OrderForm.tsx` | 신규 — 수주 등록/수정/삭제 폼 전체 구현 |
| `src/app/(dashboard)/orders/_components/OrdersTable.tsx` | 폼 Sheet → Dialog 전환; `[+ 새 수주]` 버튼; `[수정]` 버튼; `거래처목록` prop 추가 |
| `src/app/(dashboard)/orders/page.tsx` | `거래처` 목록 병렬 fetch; SELECT 필드 확장 (발주자_id, 원청사_id, 공사담당, 감독자 등); 원청사 JOIN 추가 |
| `src/app/(dashboard)/orders/_types.ts` | `거래처목록항목` 타입 추가; `수주행`에 신규 필드 추가 |

---

### 13. 투입실적 입력 UI 2단 레이아웃 + 기타 개선 (13차, 2026-06-09)

#### 개선 내용

| # | 항목 | 변경 |
|---|------|------|
| 1 | 입력 폼 레이아웃 | 단일 컬럼(`max-w-2xl`) → 2단 레이아웃 (lg 이상) |
| 2 | 실시간 계산 패널 | 폼 하단 → 우측 sticky 패널로 이동 |
| 3 | 저장/초기화 버튼 | 폼 하단 → 우측 패널 하단, 전체 너비(`w-full`) |
| 4 | "전날 복사" 버튼 | 삭제 (미사용) |

#### 레이아웃 구조

```
┌──────────────────────────────────┬──────────────────┐
│ 공사 선택                         │ 실시간 계산       │
│ 투입일                            │  투입금액         │
│ 직종별 입력 그리드                 │  일반관리비(6%)   │
│ 외주 금액                         │  ──────────────  │
│                                  │  합계 (크게 표시) │
│                                  │  기존실적 수정뱃지│
│                                  │  [저장] 버튼      │
│                                  │  [초기화] 버튼    │
└──────────────────────────────────┴──────────────────┘
```

- `lg:sticky lg:top-6` — 좌측 스크롤 중에도 우측 패널 고정
- 모바일(lg 미만): 세로 단일 컬럼으로 자동 전환

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(dashboard)/input/_components/InputForm.tsx` | 2단 레이아웃 적용; 실시간 계산·버튼 우측 sticky 패널로 이동; 전날 복사 삭제; 기존실적 뱃지 우측 패널로 이동 |

---

### 12. 투입실적 현황 탭 날짜 필터 + 검색어 유지 개선 (12차, 2026-06-09)

#### 개선 내용

| # | 문제 | 해결 |
|---|------|------|
| 1 | 월 단위 조회만 가능 | 날짜 범위 picker(`date_from` ~ `date_to`)로 교체 → 특정 날짜 구간 조회 가능 |
| 2 | 월 이동 시 공사명 검색어 초기화 | `key` 리마운트 제거 → `useEffect` 데이터 동기화로 전환, 검색어 상태 유지 |
| 3 | Sheet 상세보기 "직종별 투입 인원" 텍스트 | 삭제 |

#### URL 파라미터 변경

| 구분 | 이전 | 이후 |
|------|------|------|
| 기간 파라미터 | `?year=YYYY&month_from=MM&month_to=MM` | `?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` |
| 기본값 | 현재 연도·월 | 현재 월의 1일 ~ 말일 |

#### 기술 결정사항

- **기존 key 리마운트 방식의 한계**: 월 변경마다 컴포넌트 강제 언마운트 → 검색어·정렬 등 모든 state 초기화됨
- **변경 방식**: `key` prop 제거 + `useEffect(() => { setData(initialData); ... }, [initialData])` 추가
  - `initialData` prop이 바뀔 때(서버 재렌더)만 data 동기화
  - `검색어` state는 effect 대상 밖이므로 자동 유지
  - Sheet 열림 상태·페이지 인덱스는 월 이동 시 함께 초기화 (명시적 처리)
- **이전달/다음달 버튼**: `date_from` 기준으로 ±1개월 전체 월을 계산하여 navigate

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(dashboard)/input/page.tsx` | searchParams 타입 변경; `date_from`·`date_to` 기반 fetch; `key` prop 제거 |
| `src/app/(dashboard)/input/_components/HistoryTable.tsx` | props 변경; `useEffect` 데이터 동기화 추가; 날짜 picker + 이전달/다음달 버튼 UI; "직종별 투입 인원" 텍스트 삭제 |

---

### 11. 투입실적 현황 탭 UX 개선 (11차, 2026-06-09)

#### 개선 내용 (7개 항목)

| # | 문제 | 해결 |
|---|------|------|
| 1 | 검색 기능 없음 | 공사명·지중No 검색 입력창 추가 (클라이언트 사이드 필터링) |
| 2 | 단일 월만 조회 가능 | 연도 + 시작월 ~ 종료월 범위 필터로 변경 |
| 3 | 연도/월 변경 시 F5 필요 | `page.tsx`에 `key={연도-월from-월to}` 추가 → URL 변경 시 HistoryTable 강제 재마운트, `useState` 재초기화 |
| 4 | 공사명 말줄임표 | 열 정의에서 `max-w-[200px] truncate` 제거 |
| 5 | 투입금액·합계 컬럼 정렬 불일치 | 숫자 컬럼 헤더에 `justify-end` 적용 → 헤더·셀 모두 우측 정렬 |
| 6 | 수정일 컬럼 | 테이블에서 제거 (Sheet 상세보기 기록 섹션에만 유지) |
| 7 | "합계(×1.06)" 표기 | → "합계" 로 변경 |

#### URL 파라미터 변경

| 구분 | 이전 | 이후 |
|------|------|------|
| 기간 파라미터 | `?month=MM` | `?month_from=MM&month_to=MM` |
| 기본값 | 단일 현재 월 | 시작·종료 모두 현재 월 (기존과 동일한 초기 동작) |

#### 기술 결정사항

- **F5 버그 근본 원인**: `useState(initialData)`는 최초 마운트 시 한 번만 초기화됨. `router.push()`로 URL이 바뀌어 Server Component가 새 data를 넘겨줘도 이미 마운트된 Client Component의 state는 갱신되지 않음.
- **해결 방식**: `router.refresh()` 또는 `useEffect`로 동기화하는 방법 대신, `page.tsx`에서 `key` prop을 이용해 조건 변경 시 컴포넌트를 언마운트·재마운트. 구현 간단, 사이드이펙트 없음.

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(dashboard)/input/page.tsx` | URL params `month` → `month_from`, `month_to`; HistoryTable에 `key` prop 추가 |
| `src/app/(dashboard)/input/_components/HistoryTable.tsx` | 7개 항목 전체 수정; 검색 입력창·범위 월 필터 UI 추가 |

---

### 10. 투입실적 현황 탭 구현 (10차, 2026-06-09)

#### 구현 내용

`/input` 페이지에 "입력" / "현황" 탭 추가. DataTable + Sheet 패턴으로 조회·수정·삭제 구현.

#### UI 구조
```
/input
  ├─ 탭: [입력] [현황]
  └─ 현황 탭 (/input?tab=history&year=YYYY&month=MM)
       ├─ 연도·월 드롭다운 필터 (URL 파라미터 기반)
       ├─ DataTable: 날짜 | 공사명(지중No) | 투입금액 | 합계(×1.06) | 수정일
       └─ 행 클릭 → Sheet
            ├─ 직종별 상세 인원 (0인 행 dim 처리)
            ├─ 금액 요약 (투입금액 / 일반관리비 / 합계)
            ├─ "수정" 버튼 → 인라인 편집 모드 (인원 input 전환 + 실시간 금액 계산)
            └─ "삭제" 버튼 → Sheet 내 인라인 확인 UI → DELETE
```

#### 생성/수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(dashboard)/input/page.tsx` | 탭 UI 추가, 현황 탭 시 투입실적 월별 fetch |
| `src/app/(dashboard)/input/_types.ts` | 신규 — `투입실적행` 타입 (투입실적Row + 수주 JOIN) |
| `src/app/(dashboard)/input/_components/HistoryTable.tsx` | 신규 — Client Component |

#### 기술 결정사항
- 수정/삭제 후 `router.refresh()` 없이 로컬 state 갱신 → 즉각적인 UX
- 삭제 확인: AlertDialog 미설치 → Sheet 내 인라인 확인 UI 사용
- 외주금액: view 모드에서는 0인 경우 숨김, edit 모드에서는 항상 표시

---

### 9. 데이터 마이그레이션 및 성과금액 소스 변경 (9차, 2026-06-09)

#### UI/UX 버그 4개 수정

| 버그 | 원인 | 해결 | 변경 파일 |
|------|------|------|-----------|
| 스크롤 후 하단 빈 공간 | `html/body`에 `h-full` + `main`에 `overflow-y-auto` → 내부 viewport 스크롤 | `h-full` 제거, `min-h-screen` + 자연 window 스크롤로 변경 | `layout.tsx`, `(dashboard)/layout.tsx` |
| 홈↔매출손익 성과금액 불일치 | 홈은 준공액 포함, 매출손익은 미포함 | 매출손익에도 준공액 쿼리 추가 | `sales/page.tsx` |
| 계획금액 미등록 시 표시 없음 | — | '미등록' 텍스트 + 회색 처리 | `KpiCards.tsx` |
| 아이폰 홈 인디케이터 침범 | safe-area 미적용 | `.safe-area-inset-bottom` CSS 추가 | `globals.css` |

#### 투입금액 계산식 → 합계(×1.06) 변경

매출손익 리포트의 투입금액을 노무비 원가(`calc투입금액`)에서 **일반관리비 6% 포함 합계**(`calc합계`)로 변경.

```typescript
// src/app/(dashboard)/_lib/calc.ts
export function calc합계(row, 단가목록): number {
  return calc투입금액(row, 단가목록) * 1.06
}
```

적용 파일: `sales/page.tsx`, `ProfitChartSection.tsx`, `KpiCards.tsx`

#### 투입실적 마이그레이션 (`scripts/migrate-투입실적.ts`)

- `투입실적현황.xlsx` → Supabase `투입실적` 테이블 UPSERT
- **312건 INSERT** (6건 스킵 — CG26-113 수주 테이블 미등록)
- 엑셀 시리얼 날짜 → ISO 변환, 헤더 2행 제외

#### 공사이력 DB 테이블 및 마이그레이션 (`scripts/migrate-공사이력.ts`)

기존 설계(월별 금액 직접 입력)에서 **일별 달성률 증분 기반**으로 설계 변경:

```sql
-- 실제 구현된 스키마 (설계 메모와 다름)
CREATE TABLE 공사이력 (
  id         SERIAL PRIMARY KEY,
  수주_id    INTEGER NOT NULL REFERENCES 수주(id),
  작업일자   DATE NOT NULL,
  성과금액   DECIMAL(15,2),  -- Δ달성률/100 × 하도적용금액
  UNIQUE (수주_id, 작업일자)
);
```

- `공사현황.xlsx` → 지중No별 그룹화 → 날짜 오름차순 정렬 → Δ달성률 × 하도적용금액 계산
- 하도적용금액 = `수주금액_공급가 × (1 - 보험료율) × 하도전용율`
- **달성률 단조증가 처리**: 감소/정체 행 스킵, `prev달성률`은 증가했을 때만 갱신 (과거 ERP의 달성률 정정으로 인한 오차 방지)
- **263건 INSERT** (21건 스킵 — 수주 테이블 미등록 지중No)

검증 결과:
| 지중No | 달성률 | 계산값 | 엑셀값 | 오차 |
|--------|--------|--------|--------|------|
| CG26-008 | 100.00% | 20,350,000 | 20,350,000 | 0 |
| TY25-003 | 72.22% | 1,465,200,390 | 1,465,200,389.67 | 0.33원 (반올림) |
| CG26-005 | 50.00% | 18,037,500 | 18,037,500 | 0 |

#### 성과금액 소스를 공사이력으로 변경

기존 기성/준공 기반 → `공사이력.성과금액` 직접 합산으로 전환 (보험료율·하도전용율 재계산 불필요 — 이미 마이그레이션 시 적용됨).

**변경 이유**: 기성 방식은 청구 타이밍 기준(현금흐름 관점), 공사이력 방식은 실제 진행률 기준(진행기준 수익인식, 더 정확).

| 파일 | 변경 내용 |
|------|-----------|
| `sales/page.tsx` | 기성/준공 쿼리 제거 → `공사이력` 쿼리 + 자막 "공사이력·투입일 기준 월별 집계" |
| `ProfitChartSection.tsx` | 동일 |
| `KpiCards.tsx` | 기성/준공 합산 로직 제거 → 공사이력 reduce |

#### Recharts Legend 순서 고정

recharts가 한글 자모 순(성과 < 손익 < 투입)으로 범례를 정렬하는 문제 → `payload` 명시로 **성과→투입→손익** 순서 강제.

적용 파일: `ProfitChart.tsx`, `SalesChart.tsx`

---

### 8. VPS 배포 완료 (8차, 2026-06-09)

**배포 URL: https://erp.yjsboard.com** (HTTPS, 인증서 만료 2026-09-07 — 자동 갱신 설정됨)

#### 배포 구조 요약

```
인터넷 → Nginx(443/80) → PM2로 관리되는 Next.js(포트 3001) → Supabase
```

- **Nginx**: 리버스 프록시 역할. 브라우저 요청을 받아 내부 포트 3001로 전달. HTTP(80) 접속 시 자동으로 HTTPS(443)로 리다이렉트.
- **PM2**: Node.js 프로세스 관리자. 앱이 죽으면 자동 재시작, 서버 재부팅 시 자동 복구.
- **Let's Encrypt**: 무료 SSL 인증서. `certbot` 이 자동 갱신까지 처리.

#### 트러블슈팅 이력

| 문제 | 원인 | 해결 |
|------|------|------|
| `next: not found` | VPS Node.js 버전이 v12 (Next.js 16은 v20 필요) | NodeSource에서 Node.js 20 LTS 재설치 |
| `libnode-dev` 충돌 | 구버전 패키지 잔존 | `apt remove libnode-dev libnode72` 후 재설치 |
| Certbot 크래시 | 시스템 certbot 1.21.0이 OpenSSL 버전과 충돌 | `apt remove certbot` 후 `snap install --classic certbot` |
| `ERR_TOO_MANY_REDIRECTS` | Certbot이 HTTP 블록(301 리다이렉트)에 SSL을 붙여 HTTPS도 301 루프 발생 | Nginx 설정 수동 재작성 (HTTP 블록 → 리다이렉트, HTTPS 블록 → proxy_pass) |

#### 생성된 배포 파일

| 파일 | 역할 |
|------|------|
| `ecosystem.config.js` | PM2 설정 (앱명 yjs-erp, 포트 3001) |
| `nginx/erp.yjsboard.com.conf` | Nginx 서버 블록 템플릿 |
| `deploy.sh` | git pull → npm install → build → pm2 reload 자동화 |
| `.env.production.example` | 환경변수 템플릿 (실제 값은 VPS의 `.env.production`에만 존재) |

#### 이후 배포 방법

```bash
# VPS에서
cd /var/www/yjs_erp && ./deploy.sh
```

---

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
| 2 | 수주대장 (목록·상세·등록·수정·삭제) | `/orders` | ✅ 완료 |
| 3 | 투입실적 입력 | `/input` | ✅ 완료 |
| 4 | 매출손익 현황 | `/sales` | ✅ 완료 |
| 5 | VPS 배포 | `erp.yjsboard.com` | ✅ 완료 |
| 6 | 투입실적 마이그레이션 | `scripts/migrate-투입실적.ts` | ✅ 완료 (312건) |
| 7 | 공사이력 마이그레이션 | `scripts/migrate-공사이력.ts` | ✅ 완료 (263건) |
| 8 | 투입실적 현황 (조회·수정·삭제) | `/input?tab=history` | ✅ 완료 |
| 9 | 공사이력 조회/등록/수정/삭제 | `/orders` Sheet 기성 탭 | 미구현 (Phase 3) |
| 10 | 거래처 관리 | `/admin/clients` | 미구현 |
| 11 | 공사단가 관리 | `/admin/rates` | 미구현 |

---

## 공사이력 — 구현 현황 (2026-06-09 업데이트)

### 배경 및 설계 변경

기존 ERP(EMAX)는 달성률(%)을 수동 입력 → 월말 달성률 차이로 월별 실적 역산하는 구조.  
→ 초기 설계(월별 금액 직접 입력)에서 **일별 달성률 증분 기반**으로 변경하여 마이그레이션 구현.

### 실제 구현된 DB 스키마

```sql
CREATE TABLE 공사이력 (
  id         SERIAL PRIMARY KEY,
  수주_id    INTEGER NOT NULL REFERENCES 수주(id),
  작업일자   DATE NOT NULL,          -- 실제 달성률 기록 날짜
  성과금액   DECIMAL(15,2),          -- Δ달성률/100 × 하도적용금액
  UNIQUE (수주_id, 작업일자)
);
```

**성과금액 계산 로직**:
```
하도적용금액 = 수주금액_공급가 × (1 - 보험료율) × 하도전용율
Δ달성률 = 해당일 달성률 - 전일(최대) 달성률  (단조증가만 허용)
성과금액 = Δ달성률 / 100 × 하도적용금액
```

### 마이그레이션 완료

- `공사현황.xlsx` → `공사이력` 테이블 263건 INSERT (`scripts/migrate-공사이력.ts`)
- 달성률 감소/정체 행 스킵, 단조증가 보장으로 오차 없음

### 성과금액 집계 방식 (현재 적용)

```
매출손익/대시보드 성과금액 = Σ 공사이력.성과금액  (작업일자 기준 월 필터)
```

기성/준공 방식 대비 장점: 실제 공사 진행률 기준 수익인식 (진행기준법), 청구 타이밍 무관.

### 향후 공사이력 조회/수정 화면 (`/orders/[id]/history`)

- 공사별 날짜별 성과금액 이력 조회
- 신규 입력 및 수정 기능
- 누적 달성률 자동 표시

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
