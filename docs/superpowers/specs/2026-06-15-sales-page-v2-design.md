# 매출손익 페이지 v2 — Design Spec

**Date:** 2026-06-15  
**Goal:** 7가지 수정 사항을 한 번에 반영. ProjectTable을 PivotProjectTable로 대체하는 것이 핵심.

---

## 변경 목록 요약

| # | 항목 | 변경 내용 |
|---|---|---|
| 1 | 페이지 제목 | "매출손익 현황" → "매출손익" |
| 2 | 테이블 시각 | 지브라 패턴 (홀수 행 bg-gray-50/50) |
| 3 | 페이징 | 25건/페이지, 하단 페이지네이터 |
| 4 | 손익 색상 | \|손익\| ≥ 5,000,000원일 때만 초록/빨강 |
| 5 | 레이아웃 | 차트를 테이블 위로 이동 + 차트 헤더에 연간 합계 |
| 6 | 이익률 제거 | ProjectTable·ExcelExportButton에서 완전 제거 |
| 7 | 피벗 확장 테이블 | 공사별 월별 피벗 + 펼침 + "주별로 보기" 링크 |

---

## Architecture

### 파일 변경 맵

| 작업 | 파일 |
|---|---|
| 수정 | `src/app/(dashboard)/sales/page.tsx` |
| 수정 | `src/app/(dashboard)/sales/_components/CollapsibleChart.tsx` |
| 수정 | `src/app/(dashboard)/sales/_components/ExcelExportButton.tsx` |
| 신규 | `src/app/(dashboard)/sales/_components/PivotProjectTable.tsx` |
| 신규 | `src/app/(dashboard)/sales/_components/WeeklyDetailModal.tsx` |
| 삭제 | `src/app/(dashboard)/sales/_components/ProjectTable.tsx` |

---

## 1. 데이터 구조 변경 (`page.tsx`)

### 신규 타입 `PivotProjectRow`

`PivotProjectTable.tsx` 상단에 정의하고 `export`. `page.tsx`와 `ExcelExportButton.tsx`는 여기서 import.

```ts
export type PivotProjectRow = {
  id: number
  지중no: string
  공사명: string
  // 연간 합계
  성과금액: number
  투입금액: number
  손익금액: number
  // 월별 (인덱스 0=1월 … 11=12월)
  monthly: Array<{ 성과: number; 투입: number; 손익: number }>
  // 주별 (활동 있는 주만, 희소)
  weekly: Array<{ week: string; label: string; 성과: number; 투입: number; 손익: number }>
}
```

`week` 형식: `"2026-W03"` (ISO year-week)  
`label` 형식: `"1월 3주"` (화면 표시용)

### `page.tsx` 에서 계산

`투입실적목록`과 `공사이력목록`은 이미 전체 연도 데이터를 로드하므로 추가 쿼리 없이 월별·주별을 동시에 집계한다.

```ts
// 공사별 monthly[12] + weekly(희소) 집계
const 공사별상세 = new Map<number, {
  monthly: { 성과: number; 투입: number }[]   // length 12
  weekly: Map<string, { 성과: number; 투입: number; label: string }>
}>()

// 투입실적 순회 → monthly[m].투입, weekly[weekKey].투입 누적
// 공사이력 순회 → monthly[m].성과, weekly[weekKey].성과 누적

// ISO 주 계산 유틸 (같은 파일 내 헬퍼)
function isoWeek(dateStr: string): { key: string; label: string } { ... }
```

`projectData` 이름을 `pivotData: PivotProjectRow[]` 로 변경.

---

## 2. `CollapsibleChart.tsx` 수정

### 추가 props

```ts
type Props = {
  data: SalesChartRow[]
  year: number
  총성과: number  // ← 신규
  총투입: number  // ← 신규
  총손익: number  // ← 신규
}
```

### 헤더 레이아웃

홈 화면 `ProfitChartSection`의 헤더와 동일한 패턴으로:

```
[year]년 월별 매출손익    성과 NNN백만  투입 NNN백만  손익 ±NNN백만   ▶
```

열리면 `▶` → `▼`, 닫히면 `▼` → `▶`.

---

## 3. `PivotProjectTable.tsx` (신규, Client Component)

### Props

```ts
type Props = {
  data: PivotProjectRow[]
  year: number
}
```

### State

```ts
const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
const [page, setPage] = useState(0)
const [query, setQuery] = useState('')
const [weeklyTarget, setWeeklyTarget] = useState<PivotProjectRow | null>(null)
```

### 레이아웃 구조

```
[검색 input]                              [페이지네이터]

지중No | 공사명 | 1월 | 2월 | … | 12월 | 합계
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CG26-005   지상기기 정기검사   — | 1803만 | … | 1803만   ← 손익 1줄 (접힘)
▼ JG26-014  광명전통문화연구회           ← 펼침 (파란 좌측 보더)
   성과    —  | 832만 | 1724만| … | 2556만
   투입    84만|  84만 |  —   | … |  168만
   손익  -84만 |+748만 |+1724만| … |+2388만      주별로 보기 →
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 행 클릭 동작

- 접힌 행: 클릭 → expandedIds에 추가 (여러 공사 동시 펼침 가능)
- 펼쳐진 행: 헤더 클릭 → expandedIds에서 제거

### 지브라 패턴

접힌 행: `index % 2 === 1` → `bg-gray-50/50`  
펼쳐진 블록: 배경 `#eff6ff` (파란 연한 배경), 좌측 보더 `border-l-2 border-blue-400`

### 손익 색상 규칙

```ts
function 손익색(v: number) {
  if (v >= 5_000_000)  return '#16a34a'  // 초록
  if (v <= -5_000_000) return '#dc2626'  // 빨강
  return '#374151'                        // 기본 (gray-700)
}
```

### 페이지네이션

- 페이지 크기: 25건 고정
- 하단 중앙: `〈 1 2 3 … 〉` 형태
- 검색 시 page → 0 리셋

### 이익률

**완전 제거** — 접힌 행·펼쳐진 행 모두 표시 안 함.

### "주별로 보기" 링크

펼쳐진 블록 우하단에 `text-xs text-blue-500 underline cursor-pointer` 버튼.  
클릭 시 `setWeeklyTarget(row)` → `WeeklyDetailModal` 열림.

---

## 4. `WeeklyDetailModal.tsx` (신규, Client Component)

### 역할

특정 공사의 주별 성과/투입/손익을 모달로 표시. 이미 `PivotProjectRow.weekly`에 데이터가 있으므로 **추가 API 호출 없음**.

### Props

```ts
type Props = {
  row: PivotProjectRow | null  // null이면 닫힘
  onClose: () => void
}
```

### UI

```
모달 헤더: [지중no] [공사명]
탭 없음 (항상 주별)

주   | 성과금액  | 투입금액  | 손익
1월 3주 | 832만   | 84만    | +748만
1월 4주 | 1724만  | 84만    | +1640만
...
합계   | 2556만  | 168만   | +2388만
```

- 활동 없는 주는 표시 안 함 (희소 데이터)
- 손익 색상 규칙 동일 (`손익색` 함수 적용)
- ESC 키 / 배경 클릭으로 닫기

---

## 5. `ExcelExportButton.tsx` 수정

`ProjectRow` → `PivotProjectRow` 타입으로 교체.

엑셀 시트 구성:
- **시트 1 "공사별"**: 지중No, 공사명, 성과금액, 투입금액, 손익금액 (연간 합계, 이익률 제거)
- **시트 2 "월별 피벗"**: 지중No, 공사명, 1월성과, 1월투입, 1월손익, … 12월손익
- **시트 3 "월별 합계"**: month, 성과금액, 투입금액, 손익금액

---

## 6. `page.tsx` 레이아웃 순서

```
헤더 (제목 "매출손익" + ExcelExportButton + YearSelector)
KPI 스트립
CollapsibleChart  ← 차트가 테이블 위
PivotProjectTable ← 피벗 테이블이 메인
```

---

## 7. ISO 주 계산 헬퍼

`page.tsx` 내부 헬퍼 함수:

```ts
function isoWeek(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr)
  // ISO 8601 주 계산
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const weekNo = Math.floor((d.getTime() - startOfWeek1.getTime()) / 604800000) + 1
  const month = d.getMonth() + 1
  const weekOfMonth = Math.ceil((d.getDate() + ((d.getDay() + 6) % 7 - d.getDay() + 7) % 7 - 6) / 7) // 근사치
  return {
    key: `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`,
    label: `${month}월 ${weekOfMonth}주`
  }
}
```

실제 구현 시 정밀도보다 일관성 우선 — 같은 날짜는 항상 같은 key를 반환하면 됨.

---

## 8. 삭제

`ProjectTable.tsx` — `PivotProjectTable.tsx`로 대체. 삭제.

---

## 검토 체크리스트

- [ ] `PivotProjectRow.monthly` 인덱스 0~11 (1월~12월) 일관성
- [ ] ISO 주 계산이 연말 경계(12월 마지막 주 / 1월 1주 겹침)에서 일관되게 동작하는가
- [ ] 페이지네이션 + 검색 필터 조합 시 page 리셋 동작
- [ ] `expandedIds`는 페이지 넘어가도 유지 (공사 id 기반이라 괜찮음)
- [ ] 주별 데이터가 없는 공사(모든 weekly가 빈 배열)에서 "주별로 보기" 링크 숨김 처리
