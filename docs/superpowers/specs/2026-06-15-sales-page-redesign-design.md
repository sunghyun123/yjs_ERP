# 매출 손익 현황 페이지 재설계

**날짜:** 2026-06-15  
**범위:** `src/app/(dashboard)/sales/page.tsx` 및 관련 컴포넌트  
**홈 페이지:** 변경 없음

---

## 배경 및 목표

현재 매출 손익 현황 페이지는 세 덩어리가 수직으로 쌓여 있어 스크롤이 많고, 홈 화면과 UI가 유사해 역할 구분이 모호하다. 이 페이지의 핵심 가치는 "어떤 공사가 돈 됐고 어떤 게 손해났나"이므로, 공사별 테이블을 주인공으로 올리고 월별 차트는 보조 패널로 내린다.

---

## 현재 상태

```
매출 손익 현황 (현재)
├── 연도 선택기
├── KPI 카드 3개 (누적 성과금액, 투입금액, 손익)
├── SalesChart — 월별 막대 차트 (크게)
│   [↓ 스크롤]
├── ProjectTable — 공사별 테이블 (검색 가능)
│   [↓ 스크롤]
└── 월별 상세 테이블 (인라인 HTML)
```

문제:
- 공사별 테이블에 도달하려면 차트를 지나 스크롤해야 함
- 월별 차트가 홈 화면의 ProfitChart와 중복
- 월별 상세 테이블은 차트와 동일한 데이터를 숫자로 반복

---

## 변경 후 구조

```
매출 손익 현황 (변경 후)
├── 페이지 헤더: 제목 + 연도 선택기 + 엑셀 내보내기 버튼
├── KPI 한 줄 스트립 (누적 성과 / 투입 / 손익·이익률)
├── 공사별 성과 테이블 ← 히어로 (검색 가능, 기존 ProjectTable 재사용)
└── 월별 추이 차트 (접기/펼치기 패널, 기본: 닫힘) ← SalesChart 재사용
    ✕ 월별 상세 테이블 — 제거
```

---

## 컴포넌트 변경

### 유지 (변경 없음)
- `_components/SalesChart.tsx` — 접기 패널 안에 그대로 사용
- `_components/ProjectTable.tsx` — 위치만 상단으로 이동, 내부 로직 그대로
- `_components/YearSelector.tsx` — 그대로

### 제거
- `sales/page.tsx` 내 월별 상세 테이블 인라인 HTML (약 50줄) — 삭제

### 신규
- `_components/CollapsibleChart.tsx` — SalesChart를 감싸는 접기/펼치기 래퍼
  - `useState(false)`로 열림 상태 관리
  - 헤더 클릭 시 토글
  - 기본 상태: 닫힘
- `_components/ExcelExportButton.tsx` — 공사별 데이터를 .xlsx로 내보내기
  - `xlsx` (SheetJS) 라이브러리 사용
  - props: `data: ProjectRow[]`, `filename: string`
  - 내보내는 컬럼: 지중No, 공사명, 성과금액, 투입금액, 손익금액, 이익률(%)
  - Client Component (`'use client'`)

### 수정
- `sales/page.tsx` — 레이아웃 순서 변경 및 제거
  - KPI 카드 → KPI 스트립으로 교체 (3개 → 한 줄, 이익률 추가)
  - 순서: KPI 스트립 → ProjectTable → CollapsibleChart
  - ExcelExportButton을 헤더에 추가
  - 월별 상세 테이블 제거

---

## KPI 스트립 상세

기존 카드 3개를 한 줄 그리드로 압축:

| 항목 | 표시 |
|---|---|
| 누적 성과금액 | `18.4억` (파란색) |
| 누적 투입금액 | `14.1억` (노란색) |
| 누적 손익 / 이익률 | `+4.3억 · 23%` (초록/빨간) |

---

## 엑셀 내보내기 상세

- 라이브러리: `xlsx` (SheetJS) — `npm install xlsx`
- 파일명: `매출손익현황_2025.xlsx` (연도 동적)
- 시트 1 — 공사별: 지중No, 공사명, 성과금액(원), 투입금액(원), 손익금액(원), 이익률(%)
- 시트 2 — 월별: 월, 성과금액(원), 투입금액(원), 손익금액(원) (차트 데이터 재사용)
- 월별 시트는 있어야 월별 테이블 제거를 완전히 대체할 수 있음

---

## 데이터 흐름 (변경 없음)

`sales/page.tsx`의 서버 컴포넌트 데이터 패치 로직은 그대로 유지:
- 4개 Supabase 테이블 병렬 조회 (투입실적, 공사단가, 공사이력, 수주)
- `monthlyData` (12개월 배열) — CollapsibleChart에 전달
- `projectRows` (공사별 배열) — ProjectTable + ExcelExportButton에 전달

---

## 범위 외

- 홈 페이지 (`/`) — 변경 없음
- `ProfitChart.tsx`, `ProfitChartSection.tsx` — 변경 없음
- 공사별 테이블 컬럼 정렬, 드릴다운 등 추가 기능 — 이번 범위 아님
