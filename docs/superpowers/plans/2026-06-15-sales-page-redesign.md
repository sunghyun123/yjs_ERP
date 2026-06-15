# 매출 손익 현황 페이지 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매출 손익 현황 페이지(`/sales`)에서 공사별 테이블을 상단 주인공으로 올리고, 월별 차트를 접기/펼치기 패널로 내리며, 엑셀 내보내기를 추가하고, 중복된 월별 상세 테이블을 제거한다.

**Architecture:** 신규 Client Component 두 개(`CollapsibleChart`, `ExcelExportButton`)를 추가하고, `sales/page.tsx`의 레이아웃 순서와 KPI 표시 방식만 수정한다. 기존 `SalesChart`, `ProjectTable`, `YearSelector`는 내부 변경 없음. 홈 페이지(`/`)는 건드리지 않는다.

**Tech Stack:** Next.js 16 App Router (Server Component page + Client Component children), React `useState`, `xlsx` (SheetJS — 이미 설치됨 `^0.18.5`), Tailwind CSS, lucide-react

---

## File Map

| 작업 | 파일 |
|---|---|
| 신규 | `src/app/(dashboard)/sales/_components/CollapsibleChart.tsx` |
| 신규 | `src/app/(dashboard)/sales/_components/ExcelExportButton.tsx` |
| 수정 | `src/app/(dashboard)/sales/page.tsx` |
| 변경 없음 | `src/app/(dashboard)/sales/_components/SalesChart.tsx` |
| 변경 없음 | `src/app/(dashboard)/sales/_components/ProjectTable.tsx` |
| 변경 없음 | `src/app/(dashboard)/sales/_components/YearSelector.tsx` |

---

## Task 1: CollapsibleChart 컴포넌트 생성

**Files:**
- Create: `src/app/(dashboard)/sales/_components/CollapsibleChart.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/app/(dashboard)/sales/_components/CollapsibleChart.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SalesChart, type SalesChartRow } from './SalesChart'

export function CollapsibleChart({ data, year }: { data: SalesChartRow[]; year: number }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="bg-white shadow-sm border-0">
      <CardHeader
        className="px-5 py-4 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">
            {year}년 월별 매출손익
          </span>
          {open ? (
            <ChevronDown className="size-4 text-gray-400" />
          ) : (
            <ChevronRight className="size-4 text-gray-400" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-5 pb-5">
          <SalesChart data={data} />
        </CardContent>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
npx tsc --noEmit
```

오류 없음을 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/sales/_components/CollapsibleChart.tsx
git commit -m "feat: CollapsibleChart — 월별 차트 접기/펼치기 래퍼"
```

---

## Task 2: ExcelExportButton 컴포넌트 생성

**Files:**
- Create: `src/app/(dashboard)/sales/_components/ExcelExportButton.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/app/(dashboard)/sales/_components/ExcelExportButton.tsx
'use client'

import * as XLSX from 'xlsx'
import type { ProjectRow } from './ProjectTable'
import type { SalesChartRow } from './SalesChart'

type Props = {
  projectData: ProjectRow[]
  chartData: SalesChartRow[]
  year: number
}

export function ExcelExportButton({ projectData, chartData, year }: Props) {
  function handleExport() {
    const wb = XLSX.utils.book_new()

    // 시트 1: 공사별
    const projectSheet = XLSX.utils.aoa_to_sheet([
      ['지중No', '공사명', '성과금액(원)', '투입금액(원)', '손익금액(원)', '이익률(%)'],
      ...projectData.map(r => [
        r.지중no,
        r.공사명,
        r.성과금액,
        r.투입금액,
        r.손익금액,
        parseFloat(r.이익률.toFixed(2)),
      ]),
    ])
    XLSX.utils.book_append_sheet(wb, projectSheet, '공사별')

    // 시트 2: 월별
    const monthlySheet = XLSX.utils.aoa_to_sheet([
      ['월', '성과금액(원)', '투입금액(원)', '손익금액(원)'],
      ...chartData.map(r => [r.month, r.성과금액, r.투입금액, r.손익금액]),
    ])
    XLSX.utils.book_append_sheet(wb, monthlySheet, '월별')

    XLSX.writeFile(wb, `매출손익현황_${year}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors"
    >
      ⬇ 엑셀 내보내기
    </button>
  )
}
```

- [ ] **Step 2: TypeScript 확인**

```bash
npx tsc --noEmit
```

오류 없음을 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(dashboard\)/sales/_components/ExcelExportButton.tsx
git commit -m "feat: ExcelExportButton — 공사별/월별 xlsx 내보내기"
```

---

## Task 3: sales/page.tsx 레이아웃 재구성

**Files:**
- Modify: `src/app/(dashboard)/sales/page.tsx`

현재 순서: KPI 카드 → 월별 차트(크게) → 공사별 테이블 → 월별 상세 테이블  
변경 후 순서: KPI 스트립 → 공사별 테이블 → CollapsibleChart

- [ ] **Step 1: 불필요한 import 제거**

현재 파일 상단 3~4번째 줄:
```tsx
import { CircleDollarSign, TrendingUp, Wallet } from 'lucide-react'
```
이 줄 삭제. (아이콘은 KPI 스트립에서 사용 안 함)

- [ ] **Step 2: 신규 컴포넌트 import 추가**

현재 `import { YearSelector }` 줄 아래에 추가:
```tsx
import { CollapsibleChart } from './_components/CollapsibleChart'
import { ExcelExportButton } from './_components/ExcelExportButton'
```

- [ ] **Step 3: tableData 변수 제거**

현재 99~109번째 줄 (월별 상세 테이블용 변수) 전체 삭제:
```tsx
// 아래 블록 삭제
const tableData = monthly.map(({ 성과, 투입 }, i) => {
  const 손익 = 성과 - 투입
  return {
    month: `${i + 1}월`,
    성과금액: 성과,
    투입금액: 투입,
    손익금액: 손익,
    이익률: 성과 > 0 ? (손익 / 성과) * 100 : 0,
    데이터없음: 성과 === 0 && 투입 === 0,
  }
})
```

- [ ] **Step 4: kpiCards 배열 제거**

현재 111~133번째 줄 전체 삭제:
```tsx
// 아래 블록 삭제
const kpiCards = [
  {
    title: `${year}년 누적 성과금액`,
    ...
  },
  ...
]
```

- [ ] **Step 5: return JSX 전체 교체**

현재 135~283번째 줄(`return (` ~ 마지막 `)`)을 아래로 교체:

```tsx
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
            매출손익 현황
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            공사이력·투입일 기준 월별 집계
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton projectData={projectData} chartData={chartData} year={year} />
          <YearSelector currentYear={year} />
        </div>
      </div>

      {/* KPI 스트립 */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 성과금액</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{formatEok(총성과)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 투입금액</p>
          <p className="text-2xl font-bold mt-1 text-amber-500">{formatEok(총투입)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-gray-500">{year}년 누적 손익 / 이익률</p>
          <p
            className="text-2xl font-bold mt-1"
            style={{ color: 총손익 >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {formatEok(총손익)}&nbsp;·&nbsp;{총성과 > 0 ? 총이익률.toFixed(1) + '%' : '—'}
          </p>
        </div>
      </div>

      {/* 공사별 테이블 (주인공) */}
      <Card className="bg-white shadow-sm border-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-sm font-medium text-gray-600">
            {year}년 공사별 성과
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-4 pb-5">
          <ProjectTable data={projectData} />
        </CardContent>
      </Card>

      {/* 월별 차트 (접기/펼치기) */}
      <CollapsibleChart data={chartData} year={year} />
    </div>
  )
```

- [ ] **Step 6: TypeScript 확인**

```bash
npx tsc --noEmit
```

오류 없음을 확인. `tableData`, `kpiCards` 관련 오류가 나오면 해당 변수가 덜 지워진 것이므로 제거한다.

- [ ] **Step 7: 커밋**

```bash
git add src/app/\(dashboard\)/sales/page.tsx
git commit -m "refactor: 매출 손익 현황 페이지 레이아웃 재구성 — 공사별 테이블 상단 이동, 차트 접기, 월별 테이블 제거"
```

---

## Task 4: 브라우저 확인

- [ ] **Step 1: 개발 서버 실행**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/sales` 접속.

- [ ] **Step 2: 체크리스트**

| 확인 항목 | 기대 결과 |
|---|---|
| 페이지 진입 시 공사별 테이블이 차트보다 위에 보임 | ✓ |
| KPI가 3개 한 줄로 가로 표시됨 | ✓ |
| 헤더 우측에 "엑셀 내보내기" 버튼이 있음 | ✓ |
| "월별 매출손익" 헤더 클릭 시 차트 펼쳐짐 | ✓ |
| 다시 클릭 시 차트 닫힘 | ✓ |
| 월별 상세 숫자 테이블이 없음 | ✓ |
| 엑셀 내보내기 클릭 시 .xlsx 다운로드됨 | ✓ |
| 다운로드된 xlsx에 "공사별", "월별" 시트 2개 있음 | ✓ |
| 연도 변경 시 데이터 반영됨 | ✓ |
| 홈 화면(`/`)은 변경 없음 | ✓ |

- [ ] **Step 3: 최종 커밋 없음** — Task 3에서 이미 커밋 완료.
