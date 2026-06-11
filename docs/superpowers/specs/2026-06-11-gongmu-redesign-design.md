# 공무 보고서 UI 재설계 스펙

## 목표

기존 3단계 네비게이션(목록 → 종합현황 → 개인상세)을 2단계(대시보드 → 개인상세)로 단순화하고, 양쪽 화면의 가독성과 입력 편의성을 개선한다.

---

## 범위

### 수정 대상
- `src/app/(dashboard)/gongmu/page.tsx` — 대시보드 전면 재설계
- `src/app/(dashboard)/gongmu/[id]/page.tsx` — 월 이동 네비게이션 추가
- `src/app/(dashboard)/gongmu/[id]/_components/WeeklyReportForm.tsx` — 월간 현황 통합, textarea 전환, 컬럼 개선
- `src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx` — **삭제** (WeeklyReportForm에 통합)

### 삭제 대상
- `src/app/(dashboard)/gongmu/total/page.tsx` — `/gongmu` 대시보드에 흡수

### 변경 없음
- `_lib/actions.ts`, `_lib/calc.ts`, `_lib/excel.ts` — 로직 변경 없음
- DB 스키마 — 변경 없음
- 사이드바 — 변경 없음

---

## URL 스키마

### 월 파라미터 형식 변경

| 화면 | 기존 | 변경 후 |
|------|------|---------|
| `/gongmu` | 없음 (현재월 고정) | `?month=YYYY-MM` (없으면 현재월) |
| `/gongmu/[id]` | `?month=6` (숫자) | `?month=YYYY-MM` |

`?month=YYYY-MM` 파싱:
```ts
const monthStr = sp.month ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
const [calYearStr, calMonthStr] = monthStr.split('-')
const calYear = Number(calYearStr)
const calMonth = Number(calMonthStr)
```

월 이동 href 계산:
```ts
function shiftMonth(yyyy: number, mm: number, delta: number) {
  const d = new Date(yyyy, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}
// prevHref = `?month=${shiftMonth(calYear, calMonth, -1)}`
// nextHref = `?month=${shiftMonth(calYear, calMonth, +1)}`
```

---

## Task 1: `/gongmu` 대시보드 재설계

### 데이터 fetching

`?month=YYYY-MM`으로 선택된 달 기준으로:

1. `공무담당자` 전체 목록
2. `공무_월간계획` — 해당 달 전체 (구분별)
3. `공무_주간보고` — 해당 달의 ISO 주차들 (`getWeeksInMonth`로 산출)
4. 현재 ISO 주(week)는 `getCurrentWeek()`으로 별도 조회 (금주 실적용)

계산:
- `총 월간계획.공사` = 전체 공무 공사 계획 합산
- `총 월간계획.공무` = 전체 공무 공무 계획 합산
- `총 월간실적.공사` = 해당 달 전체 공사 주간보고 합산
- `총 월간실적.공무` = 해당 달 전체 공무 주간보고 합산
- `금주 실적.공사/공무` = 현재 ISO 주 행만 필터 후 합산

### 레이아웃

```
[페이지 헤더]
  제목: "공무 보고서"
  우측: ◀ YYYY년 M월  YYYY년 M월  YYYY년 M월 ▶

[KPI 섹션] — 3열 그리드
  카드1: 총 월간계획
    공사 tag | 금액
    공무 tag | 금액
  카드2: 총 월간실적(누적)
    공사 tag | 금액
    공무 tag | 금액
  카드3: 금주 실적 (N월 N주차)
    공사 tag | 금액
    공무 tag | 금액

[담당자 카드 그리드] — 4열
  Σ 카드 (네이비 그라디언트):
    아바타(Σ), "월간 전체 합산"
    금주 실적 부제목
    공사 달성률 (월간) — 프로그레스 바 + 실적/계획
    공무 달성률 (월간) — 프로그레스 바 + 실적/계획

  개인 카드 (담당자 수만큼):
    아바타(성씨), 이름
    금주 실적 부제목
    공사 달성률 (월간) — 프로그레스 바 + 실적/계획
    공무 달성률 (월간) — 프로그레스 바 + 실적/계획
    클릭 → /gongmu/[id]?month=YYYY-MM
```

### 달성률 색상 규칙
- ≥ 80% → `#22c55e` (green)
- ≥ 50% → `#f59e0b` (amber)
- < 50% → `#3d5af1` (blue)

### "금주 실적" KPI 기준
항상 **현재 ISO 주** (`getCurrentWeek()`) 기준으로 계산 — 선택된 월이 과거/미래여도 동일.
카드 제목: `금주 실적 (N월 N주차)` — 현재 주차 레이블 고정 표시.

### 기타
- `max-width: 1280px`
- KPI 카드에는 달성률 % 없음, 금액만 표시 (v4 승인 기준)
- 프로그레스 바는 담당자 카드에만 표시
- `/gongmu/total` 삭제 → 사이드바·링크 참조 없음 (기존 `/gongmu/page.tsx`의 Σ 링크만 존재)

---

## Task 2: `/gongmu/[id]` 헤더 + 월 이동

### 헤더 레이아웃 변경

```
변경 전:
  [avatar + 이름]                        [← 목록]

변경 후:
  [avatar + 이름]    ◀ M월  M월  M월 ▶   [← 목록]
```

월 이동 버튼: `<Link>` 컴포넌트로 구현 (클라이언트 JS 불필요)
- 이전달: `href="/gongmu/[id]?month=YYYY-MM"` (week 파라미터 생략)
- 현재달: active 스타일 (`bg-[#1e2d5a] text-white`)
- 다음달: same href pattern

### 주차 기본값 변경

`?week` 파라미터 없을 때 기존: `curWeek` (전체 ISO 주차 기준)
변경 후: `weekOptions[0]?.week` 및 `weekOptions[0]?.isoYear` 사용
→ 다른 달로 이동 시 자동으로 해당 달 첫 주차 선택

### MonthlySummary 제거

- `import { MonthlySummary }` 제거
- `<MonthlySummary>` JSX 제거
- WeeklyReportForm에 `allRows` prop 추가 전달:
  ```ts
  allRows={allRowsResult.data ?? []}
  ```

---

## Task 3: `WeeklyReportForm.tsx` 재설계

### A. 월간 현황 카드 통합 (상단 섹션 교체)

**기존**: 월간계획 (공사) 숫자입력 + 월간계획 (공무) 숫자입력 — 수평 나열

**변경**: 3열 카드로 통합

```
[공사 블록]
  badge: "공사"
  계획 입력: [________________] 원  ← 기존 plan input 이동
  누계 실적: 3,000만원  20.0%
  progress bar

[공무 블록]
  badge: "공무"
  계획 입력: [________________] 원
  누계 실적: 2,500만원  83.3%
  progress bar

[금주 실적 패널] — 왼쪽 border 구분선
  "금주 실적 (6월 2주차)"
  대형 금액: 3,500만원
  소형 부제목: 공사 3,000만 + 공무 500만
```

상단 우측에 `"계획 수정 가능"` 뱃지 (파란 pill).

**새 prop 추가**:
```ts
allRows: Pick<공무_주간보고Row, 'week_no' | 'year' | '금주실적' | '구분'>[]
```
계산은 기존 `calc*` 함수 재사용:
```ts
const 공사누계 = calc누적실적(공사rows, week_no, year) + calc금주실적합산(공사rows, week_no, year)
const 공무누계 = calc누적실적(공무rows, week_no, year) + calc금주실적합산(공무rows, week_no, year)
const 금주합산 = calc금주실적합산(allRows, week_no, year)
```

### B. TextAreaCell 컴포넌트 추가

```tsx
function TextAreaCell({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      className="w-full rounded-md border border-blue-100 bg-blue-50/60 px-2 py-1.5
                 text-sm text-[#1e2d5a] outline-none resize-vertical
                 focus:border-blue-400 focus:bg-blue-50
                 min-h-[66px] leading-relaxed font-sans"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
```

`금주작업`/`차주작업` 셀에 `TextCell` → `TextAreaCell` 교체.

### C. 테이블 컬럼 + 스타일 개선

**table-fixed → auto** (브라우저가 컨텐츠 기반으로 너비 결정)

**overflow-x-auto** wrapper 추가.

**공사 파트 colgroup**:
```
지중No:   96px
공사명:  190px
금주작업: min-width 200px, width 24%
차주작업: min-width 200px, width 24%
금주계획: 88px
금주실적: 88px
차주계획: 88px
삭제:     28px
```

**공무 파트 colgroup**:
```
#:        36px
금주작업: min-width 220px, width 30%
차주작업: min-width 220px, width 30%
금주계획: 88px
금주실적: 88px
차주계획: 88px
삭제:     28px
```

**비고 컬럼 제거**: JSX에서 렌더링 제거. `보고행` 타입의 `비고` 필드와 save 로직은 유지 (DB에 저장은 계속 됨, 단 항상 빈 문자열).

**셀 vertical-align**:
- textarea 행: `vertical-align: top`
- 숫자 input 행: `vertical-align: middle`

**편집 가능 셀 스타일 통일**:
```
일반 input (지중No, 공사명, 숫자):
  bg-blue-50/60 border border-blue-100 rounded-md px-2 py-1.5 text-sm
  focus:border-blue-400 focus:bg-blue-50
```

**ERP 초안 행**:
- `<tr>` 배경: `bg-blue-50`
- 초안 행의 input/textarea: `bg-blue-100/60 border-blue-200`

**텍스트 수정**:
- "이번주 금주실적" → "금주 실적" (파트 헤더 우측)

**하단 ERP 힌트**:
- 위치: action bar 좌측 (기존 우측 → 좌측 이동)
- 초안 행이 없으면 렌더링 안 함 (기존 로직 유지)

---

## Task 4: MonthlySummary.tsx 삭제

- 파일 삭제: `src/app/(dashboard)/gongmu/[id]/_components/MonthlySummary.tsx`
- `[id]/page.tsx`에서 import 제거 완료 (Task 2에서 처리)

---

## 유지되는 것들

- `save주간보고` / `upsert월간계획` / `delete주간보고행` 서버 액션 — 변경 없음
- `calc*` 함수 — 변경 없음
- `exportWeeklyReport` Excel 로직 — 변경 없음 (비고 컬럼 없어도 기존 export 시 빈 문자열 그대로)
- `공무_주간보고` 테이블의 `비고` 컬럼 — DB에 계속 저장, 단 UI에서 입력 불가

---

## 비기능 요건

- `max-width`: 대시보드 1280px, 상세 1400px
- 텍스트 크기: 테이블 셀 `text-sm` (13px)
- 다른 달 열람 시 읽기 전용 모드 없음 — 편집 + 저장 가능
