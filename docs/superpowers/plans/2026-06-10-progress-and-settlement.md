# 공사이력 페이지 + 기성/준공 탭 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공사이력 전용 페이지(/progress) 신규 생성 + 수주 수정 Dialog를 [기본정보][기성][준공] 3탭으로 재구성

**Architecture:** 공사이력은 `/input`과 동일한 입력탭+현황탭 패턴의 독립 페이지로 분리. 수주 Dialog는 탭 상태를 추가해 기존 폼(기본정보)에 기성 CRUD 탭과 준공 탭을 붙임. 기성은 `기성` 테이블 직접 CRUD, 준공은 `수주` 테이블 준공 컬럼만 별도 UPDATE.

**Tech Stack:** Next.js 16 App Router, Supabase JS, React Hook Form + Zod v4, shadcn/ui, Tailwind CSS v4, TypeScript

**⚠️ Next.js 16 주의:** `searchParams: Promise<{...}>` → `await searchParams`. 한글 테이블명 쿼리는 `as any` 캐스팅 필요 (타입이 `never`로 추론됨).

---

## 파일 맵

| 작업 | 파일 |
|------|------|
| 수정 | `src/types/database.ts` |
| 수정 | `src/app/(dashboard)/orders/_types.ts` |
| 수정 | `src/app/(dashboard)/orders/page.tsx` |
| 수정 | `src/app/(dashboard)/orders/_components/OrderForm.tsx` |
| 수정 | `src/components/sidebar/Sidebar.tsx` |
| 수정 | `src/components/sidebar/MobileTabBar.tsx` |
| 생성 | `src/app/(dashboard)/progress/_types.ts` |
| 생성 | `src/app/(dashboard)/progress/page.tsx` |
| 생성 | `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx` |
| 생성 | `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx` |

---

## Task 1: database.ts — 공사이력 타입 추가

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: 공사이력 테이블 타입을 `기성` 섹션 바로 뒤에 추가**

`기성` 테이블 닫는 `}` 다음 줄(현재 226번째 줄 근처)에 아래 블록을 삽입:

```typescript
      공사이력: {
        Row: {
          id: number
          수주_id: number
          작업일자: string
          성과금액: number | null
        }
        Insert: {
          id?: number
          수주_id: number
          작업일자: string
          성과금액?: number | null
        }
        Update: {
          id?: number
          수주_id?: number
          작업일자?: string
          성과금액?: number | null
        }
      }
```

- [ ] **Step 2: 파일 하단 re-export 섹션에 공사이력 타입 추가**

`기성Row` export 줄 바로 다음에 추가:

```typescript
export type 공사이력Row    = Database['public']['Tables']['공사이력']['Row']
export type 공사이력Insert = Database['public']['Tables']['공사이력']['Insert']
export type 공사이력Update = Database['public']['Tables']['공사이력']['Update']
```

- [ ] **Step 3: 타입 검사**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/types/database.ts
git commit -m "feat: database.ts에 공사이력 테이블 타입 추가"
```

---

## Task 2: 기성항목 타입에 id 추가 + 수주 쿼리 수정

기성 탭에서 수정/삭제를 하려면 `id`가 필요하지만 현재 `기성항목` 타입과 SELECT 쿼리에 빠져 있음.

**Files:**
- Modify: `src/app/(dashboard)/orders/_types.ts`
- Modify: `src/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: `_types.ts` — 기성항목에 id 추가**

```typescript
// Before
export type 기성항목 = Pick<기성Row, '차수' | '기성일' | '기성액_공급가'>

// After
export type 기성항목 = Pick<기성Row, 'id' | '차수' | '기성일' | '기성액_공급가'>
```

- [ ] **Step 2: `orders/page.tsx` — 기성 SELECT에 id 추가**

```typescript
// Before (line 20)
기성(차수, 기성일, 기성액_공급가)

// After
기성(id, 차수, 기성일, 기성액_공급가)
```

- [ ] **Step 3: 타입 검사**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/app/(dashboard)/orders/_types.ts src/app/(dashboard)/orders/page.tsx
git commit -m "feat: 기성항목 타입에 id 추가, 수주 쿼리 수정"
```

---

## Task 3: 사이드바 + 모바일 탭바에 공사이력 메뉴 추가

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`
- Modify: `src/components/sidebar/MobileTabBar.tsx`

- [ ] **Step 1: `Sidebar.tsx` — import에 `Activity` 아이콘 추가**

```typescript
// Before
import {
  LayoutDashboard,
  ClipboardList,
  PenLine,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react'

// After
import {
  LayoutDashboard,
  ClipboardList,
  PenLine,
  Activity,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react'
```

- [ ] **Step 2: `Sidebar.tsx` — mainNav에 공사이력 항목 추가**

```typescript
// Before
const mainNav = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주대장', icon: ClipboardList },
  { href: '/input', label: '투입실적 입력', icon: PenLine },
  { href: '/sales', label: '매출손익 현황', icon: TrendingUp },
] as const

// After
const mainNav = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주대장', icon: ClipboardList },
  { href: '/input', label: '투입실적 입력', icon: PenLine },
  { href: '/progress', label: '공사이력', icon: Activity },
  { href: '/sales', label: '매출손익 현황', icon: TrendingUp },
] as const
```

- [ ] **Step 3: `MobileTabBar.tsx` — Activity 아이콘 import 추가 + tabs에 공사이력 추가**

```typescript
// Before
import { LayoutDashboard, ClipboardList, PenLine, TrendingUp } from 'lucide-react'

const tabs = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주', icon: ClipboardList },
  { href: '/input', label: '투입입력', icon: PenLine },
  { href: '/sales', label: '매출손익', icon: TrendingUp },
] as const

// After
import { LayoutDashboard, ClipboardList, PenLine, Activity, TrendingUp } from 'lucide-react'

const tabs = [
  { href: '/', label: '홈', icon: LayoutDashboard },
  { href: '/orders', label: '수주', icon: ClipboardList },
  { href: '/input', label: '투입입력', icon: PenLine },
  { href: '/progress', label: '공사이력', icon: Activity },
  { href: '/sales', label: '매출손익', icon: TrendingUp },
] as const
```

- [ ] **Step 4: 타입 검사**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/sidebar/Sidebar.tsx src/components/sidebar/MobileTabBar.tsx
git commit -m "feat: 사이드바/모바일탭바에 공사이력 메뉴 추가"
```

---

## Task 4: OrderForm — 탭 구조 도입 + 준공 탭 분리

`OrderForm.tsx`에서 준공 필드를 schema/useForm에서 분리하고, 탭 UI를 추가하며, 준공 탭을 구현한다.

**Files:**
- Modify: `src/app/(dashboard)/orders/_components/OrderForm.tsx`

- [ ] **Step 1: schema에서 준공 관련 필드 3개 제거**

```typescript
// 제거할 줄들 (schema 내부):
준공여부:        z.boolean().optional(),
준공일:          z.string().nullable().optional(),
준공액_공급가:   z.number().nullable().optional(),
```

- [ ] **Step 2: FormValues에서 준공 필드 제거됨 (schema 변경으로 자동 반영)**

- [ ] **Step 3: 컴포넌트 상단 — 탭 상태 + 준공 로컬 상태 추가**

`const router = useRouter()` 바로 다음 줄에 추가:

```typescript
const [activeTab, setActiveTab] = useState<'info' | '기성' | '준공'>('info')

// 준공 탭 전용 로컬 상태 (useForm에서 분리)
const [준공여부Local, set준공여부Local] = useState(mode === 'edit' ? (row?.준공여부 ?? false) : false)
const [준공일Local, set준공일Local] = useState(mode === 'edit' ? (row?.준공일 ?? '') : '')
const [준공액Local, set준공액Local] = useState<number | null>(mode === 'edit' ? (row?.준공액_공급가 ?? null) : null)
const [준공저장중, set준공저장중] = useState(false)
```

- [ ] **Step 4: defaultValues에서 준공 필드 3개 제거**

```typescript
// 제거 (mode === 'edit' 블록에서):
준공여부:        row.준공여부,
준공일:          row.준공일 ?? '',
준공액_공급가:   row.준공액_공급가 ?? null,

// 제거 (mode === 'new' 블록에서):
준공여부: false,
```

- [ ] **Step 5: watch 선언에서 준공여부val 제거**

```typescript
// 제거:
const 준공여부val  = watch('준공여부')
```

- [ ] **Step 6: onSubmit payload에서 준공 필드 제거**

```typescript
// 제거 (mode === 'edit' 스프레드 내부):
준공여부:      values.준공여부 ?? false,
준공일:        values.준공여부 ? values.준공일 || null : null,
준공액_공급가: values.준공여부 ? (values.준공액_공급가 ?? null) : null,
```

- [ ] **Step 7: 준공 저장 핸들러 추가**

`onSubmit` 함수 바로 다음에 추가:

```typescript
const handleJunGongSave = async () => {
  if (!row) return
  set준공저장중(true)
  const supabase = createClient()
  const { error } = await (supabase.from('수주') as any)
    .update({
      준공여부: 준공여부Local,
      준공일: 준공여부Local ? 준공일Local || null : null,
      준공액_공급가: 준공여부Local ? 준공액Local : null,
    })
    .eq('id', row.id)
  set준공저장중(false)
  if (error) { showToast(false, '저장에 실패했습니다.'); return }
  showToast(true, '준공 정보가 저장되었습니다.')
  router.refresh()
}
```

- [ ] **Step 8: JSX 최상위 div를 flex-col로 변경하고 탭 바 추가**

```typescript
// Before (return 첫 줄):
<div className="flex flex-1 overflow-hidden relative">

// After:
<div className="flex flex-1 flex-col overflow-hidden relative">
```

Toast div 바로 다음, `{/* 좌측: 스크롤 폼 */}` 주석 바로 앞에 탭 바 삽입:

```tsx
{/* 탭 바 — 수정 모드에서만 */}
{mode === 'edit' && (
  <div className="flex border-b border-gray-100 shrink-0 bg-white">
    <button
      type="button"
      onClick={() => setActiveTab('info')}
      className={cn(
        'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        activeTab === 'info' ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-gray-500 border-transparent hover:text-gray-700',
      )}
    >
      기본정보
    </button>
    <button
      type="button"
      onClick={() => setActiveTab('기성')}
      className={cn(
        'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        activeTab === '기성' ? 'text-[#3d5af1] border-[#3d5af1]' : 'text-gray-500 border-transparent hover:text-gray-700',
      )}
    >
      기성{(row?.기성?.length ?? 0) > 0 && (
        <span className="ml-1.5 bg-[#3d5af1] text-white text-[10px] rounded-full px-1.5 py-0.5">
          {row?.기성?.length}
        </span>
      )}
    </button>
    <button
      type="button"
      onClick={() => setActiveTab('준공')}
      className={cn(
        'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        activeTab === '준공' ? 'text-[#22c55e] border-[#22c55e]' : 'text-gray-500 border-transparent hover:text-gray-700',
      )}
    >
      준공{준공여부Local && (
        <span className="ml-1.5 bg-[#22c55e] text-white text-[10px] rounded-full px-1.5 py-0.5">완료</span>
      )}
    </button>
  </div>
)}
```

- [ ] **Step 9: 기본정보 탭 콘텐츠를 flex div로 감싸기**

기존의 `{/* 좌측: 스크롤 폼 */}` form 태그부터 우측 패널 닫는 `</div>` 까지를 아래처럼 감싼다:

```tsx
{/* 기본정보 탭 */}
{activeTab === 'info' && (
  <div className="flex flex-1 overflow-hidden">
    {/* 좌측: 스크롤 폼 — 기존 <form> 그대로 */}
    ...
    {/* 우측 패널 — 기존 w-72 div, 단 준공 섹션 제거 */}
    ...
  </div>
)}
```

- [ ] **Step 10: 우측 패널에서 준공 섹션 제거**

우측 패널 내부의 아래 블록 전체 삭제:

```tsx
// 삭제할 블록:
<Controller
  name="준공여부"
  ...
/>
{준공여부val && (
  <>
    <Field label="준공일">...</Field>
    <Field label="준공액(공급가)">...</Field>
  </>
)}
```

- [ ] **Step 11: 준공 탭 JSX 추가 (기본정보 탭 블록 닫는 `}` 바로 다음)**

```tsx
{/* 준공 탭 */}
{mode === 'edit' && activeTab === '준공' && (
  <div className="flex-1 overflow-y-auto p-6">
    <div className="max-w-sm space-y-4">
      <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
        <Checkbox
          checked={준공여부Local}
          onCheckedChange={(v) => {
            set준공여부Local(!!v)
            if (!v) { set준공일Local(''); set준공액Local(null) }
          }}
        />
        <span className="font-medium">준공 완료</span>
      </label>

      {준공여부Local && (
        <>
          <Field label="준공일">
            <Input
              type="date"
              className="h-9 text-sm"
              value={준공일Local}
              onChange={(e) => set준공일Local(e.target.value)}
            />
          </Field>
          <Field label="준공액 (공급가)">
            <MoneyInput
              value={준공액Local}
              onChange={set준공액Local}
              className="h-9 text-sm"
            />
          </Field>
          {준공액Local != null && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>부가세 (10%)</span>
                <span>{formatKRW(준공액Local * 0.1)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-green-700">
                <span>준공 합계</span>
                <span>{formatKRW(준공액Local * 1.1)}</span>
              </div>
            </div>
          )}
        </>
      )}

      <Button
        type="button"
        size="sm"
        className="w-full h-9 text-sm bg-[#1e2d5a] hover:bg-[#2d45a8]"
        onClick={handleJunGongSave}
        disabled={준공저장중}
      >
        {준공저장중 ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
        준공 저장
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 12: 타입 검사 + 개발 서버 확인**

```bash
npx tsc --noEmit
npm run dev
```

확인 항목:
- 수주 수정 Dialog에 탭 3개 표시
- 기본정보 탭: 기존 폼 정상, 우측 패널에서 준공 섹션 없음
- 준공 탭: 체크박스 → 필드 표시 → 저장 동작

- [ ] **Step 13: 커밋**

```bash
git add src/app/(dashboard)/orders/_components/OrderForm.tsx
git commit -m "feat: 수주 Dialog에 탭 구조 도입 + 준공 탭 분리"
```

---

## Task 5: OrderForm — 기성 탭 추가

**Files:**
- Modify: `src/app/(dashboard)/orders/_components/OrderForm.tsx`

- [ ] **Step 1: 기성 탭 로컬 상태 추가**

`준공저장중` 선언 바로 다음에 추가:

```typescript
// 기성 탭 상태
const [기성목록, set기성목록] = useState<기성항목[]>(
  (row?.기성 ?? []).slice().sort((a, b) => a.차수 - b.차수)
)
const [기성폼모드, set기성폼모드] = useState<'none' | 'add' | number>('none')
const [기성폼값, set기성폼값] = useState<{ 기성일: string; 기성액_공급가: number | null }>({
  기성일: '', 기성액_공급가: null,
})
const [기성처리중, set기성처리중] = useState(false)
```

- [ ] **Step 2: 기성 관련 계산값 + 핸들러 추가**

`handleJunGongSave` 다음에 추가:

```typescript
const 기성누계공급가 = 기성목록.reduce((sum, g) => sum + (g.기성액_공급가 ?? 0), 0)
const 다음차수 = 기성목록.length > 0 ? Math.max(...기성목록.map((g) => g.차수)) + 1 : 1

const handle기성추가시작 = () => {
  set기성폼모드('add')
  set기성폼값({ 기성일: '', 기성액_공급가: null })
}

const handle기성수정시작 = (g: 기성항목) => {
  set기성폼모드(g.id)
  set기성폼값({ 기성일: g.기성일 ?? '', 기성액_공급가: g.기성액_공급가 })
}

const handle기성저장 = async () => {
  if (!row) return
  set기성처리중(true)
  const supabase = createClient()

  if (기성폼모드 === 'add') {
    const { data, error } = await (supabase.from('기성') as any)
      .insert({
        수주_id: row.id,
        차수: 다음차수,
        기성일: 기성폼값.기성일 || null,
        기성액_공급가: 기성폼값.기성액_공급가 ?? null,
      })
      .select('id, 차수, 기성일, 기성액_공급가')
      .single()
    set기성처리중(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    set기성목록((prev) => [...prev, data as 기성항목].sort((a, b) => a.차수 - b.차수))
  } else {
    const editId = 기성폼모드 as number
    const { error } = await (supabase.from('기성') as any)
      .update({ 기성일: 기성폼값.기성일 || null, 기성액_공급가: 기성폼값.기성액_공급가 ?? null })
      .eq('id', editId)
    set기성처리중(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    set기성목록((prev) =>
      prev.map((g) =>
        g.id === editId ? { ...g, 기성일: 기성폼값.기성일 || null, 기성액_공급가: 기성폼값.기성액_공급가 } : g
      )
    )
  }
  set기성폼모드('none')
  showToast(true, 기성폼모드 === 'add' ? '기성이 등록되었습니다.' : '수정되었습니다.')
  router.refresh()
}

const handle기성삭제 = async (id: number) => {
  if (!window.confirm('이 기성 항목을 삭제하시겠습니까?')) return
  set기성처리중(true)
  const supabase = createClient()
  const { error } = await (supabase.from('기성') as any).delete().eq('id', id)
  set기성처리중(false)
  if (error) { showToast(false, '삭제에 실패했습니다.'); return }
  set기성목록((prev) => prev.filter((g) => g.id !== id))
  showToast(true, '삭제되었습니다.')
  router.refresh()
}
```

- [ ] **Step 3: 기성 탭 JSX 추가 (준공 탭 블록 바로 다음)**

```tsx
{/* 기성 탭 */}
{mode === 'edit' && activeTab === '기성' && (
  <div className="flex-1 overflow-y-auto p-6">
    {기성목록.length > 0 ? (
      <table className="w-full border-collapse text-sm mb-4">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left border border-gray-200 text-gray-500 font-medium w-14">차수</th>
            <th className="px-3 py-2 text-left border border-gray-200 text-gray-500 font-medium">기성일</th>
            <th className="px-3 py-2 text-right border border-gray-200 text-gray-500 font-medium">공급가</th>
            <th className="px-3 py-2 text-right border border-gray-200 text-gray-500 font-medium">부가세</th>
            <th className="px-3 py-2 text-right border border-gray-200 text-[#1e2d5a] font-semibold">합계</th>
            <th className="px-3 py-2 border border-gray-200 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {기성목록.map((g) => (
            <tr key={g.id}>
              <td className="px-3 py-2 border border-gray-200 font-medium text-gray-500">{g.차수}차</td>
              <td className="px-3 py-2 border border-gray-200">{g.기성일 ?? '—'}</td>
              <td className="px-3 py-2 text-right border border-gray-200">{formatKRW(g.기성액_공급가 ?? 0)}</td>
              <td className="px-3 py-2 text-right border border-gray-200 text-gray-400">
                {formatKRW((g.기성액_공급가 ?? 0) * 0.1)}
              </td>
              <td className="px-3 py-2 text-right border border-gray-200 font-semibold text-[#1e2d5a]">
                {formatKRW((g.기성액_공급가 ?? 0) * 1.1)}
              </td>
              <td className="px-3 py-2 border border-gray-200 text-center space-x-2">
                <button
                  type="button"
                  className="text-[#3d5af1] text-xs hover:underline"
                  onClick={() => handle기성수정시작(g)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="text-red-500 text-xs hover:underline"
                  onClick={() => handle기성삭제(g.id)}
                  disabled={기성처리중}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
          <tr className="bg-blue-50">
            <td colSpan={2} className="px-3 py-2 border border-blue-200 font-bold text-[#1e2d5a]">
              누계
            </td>
            <td className="px-3 py-2 text-right border border-blue-200 font-bold">
              {formatKRW(기성누계공급가)}
            </td>
            <td className="px-3 py-2 text-right border border-blue-200 font-bold text-gray-500">
              {formatKRW(기성누계공급가 * 0.1)}
            </td>
            <td className="px-3 py-2 text-right border border-blue-200 font-bold text-[#1e2d5a]">
              {formatKRW(기성누계공급가 * 1.1)}
            </td>
            <td className="border border-blue-200" />
          </tr>
        </tbody>
      </table>
    ) : (
      <p className="text-sm text-gray-400 mb-4">등록된 기성이 없습니다.</p>
    )}

    {기성폼모드 !== 'none' ? (
      <div className="border border-blue-200 rounded-lg bg-blue-50 p-4">
        <p className="text-sm font-semibold text-[#1e2d5a] mb-3">
          {기성폼모드 === 'add'
            ? `${다음차수}차 기성 추가`
            : `${기성목록.find((g) => g.id === 기성폼모드)?.차수}차 기성 수정`}
        </p>
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">기성일</label>
            <Input
              type="date"
              className="h-9 text-sm w-36"
              value={기성폼값.기성일}
              onChange={(e) => set기성폼값((v) => ({ ...v, 기성일: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">기성액 (공급가)</label>
            <MoneyInput
              value={기성폼값.기성액_공급가}
              onChange={(v) => set기성폼값((prev) => ({ ...prev, 기성액_공급가: v }))}
              className="h-9 text-sm w-44"
            />
          </div>
          {기성폼값.기성액_공급가 != null && (
            <>
              <div className="bg-blue-100 rounded-lg px-3 py-2 text-sm">
                <div className="text-[10px] text-gray-500 mb-0.5">부가세</div>
                <div className="font-semibold text-[#1e2d5a]">{formatKRW(기성폼값.기성액_공급가 * 0.1)}</div>
              </div>
              <div className="bg-[#1e2d5a] rounded-lg px-3 py-2 text-sm">
                <div className="text-[10px] text-blue-300 mb-0.5">합계</div>
                <div className="font-bold text-white">{formatKRW(기성폼값.기성액_공급가 * 1.1)}</div>
              </div>
            </>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              size="sm"
              className="h-9 bg-[#3d5af1] hover:bg-[#2d45a8]"
              onClick={handle기성저장}
              disabled={기성처리중}
            >
              {기성처리중 ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
              저장
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => set기성폼모드('none')}
            >
              취소
            </Button>
          </div>
        </div>
      </div>
    ) : (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-[#3d5af1] text-[#3d5af1] hover:bg-blue-50"
        onClick={handle기성추가시작}
      >
        <Plus className="size-4 mr-1.5" />
        기성 추가
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 4: 타입 검사 + 개발 서버 확인**

```bash
npx tsc --noEmit
npm run dev
```

확인 항목:
- 기성 탭 클릭 → 기성 목록 표시
- `+ 기성 추가` → 인라인 폼 펼쳐짐
- 금액 입력 → 부가세/합계 실시간 표시
- 저장 → 목록에 추가됨
- 수정/삭제 동작

- [ ] **Step 5: 커밋**

```bash
git add src/app/(dashboard)/orders/_components/OrderForm.tsx
git commit -m "feat: 수주 Dialog에 기성 탭 추가 (CRUD)"
```

---

## Task 6: 공사이력 페이지 — 타입 + 서버 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/progress/_types.ts`
- Create: `src/app/(dashboard)/progress/page.tsx`

- [ ] **Step 1: `_types.ts` 생성**

```typescript
import type { 수주Row, 공사이력Row } from '@/types/database'

export type 수주목록항목 = Pick<
  수주Row,
  'id' | '지중no' | '공사명' | '수주금액_공급가' | '보험료율' | '하도전용율'
>

export type 공사이력행 = Pick<공사이력Row, 'id' | '작업일자' | '성과금액' | '수주_id'> & {
  수주: { 지중no: string; 공사명: string } | null
}
```

- [ ] **Step 2: `page.tsx` 생성**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { 수주목록항목 } from './_types'
import { ProgressInputForm } from './_components/ProgressInputForm'
import { ProgressHistoryTable } from './_components/ProgressHistoryTable'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = { title: '공사이력 | 영전사 ERP' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date_from?: string; date_to?: string }>
}) {
  const params = await searchParams
  const tab = params.tab ?? 'input'

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const mm = String(m).padStart(2, '0')
  const lastDay = new Date(y, m, 0).getDate()
  const defaultFrom = `${y}-${mm}-01`
  const defaultTo   = `${y}-${mm}-${lastDay}`

  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const date_from = dateRe.test(params.date_from ?? '') ? params.date_from! : defaultFrom
  const date_to   = dateRe.test(params.date_to ?? '')   ? params.date_to!   : defaultTo

  const supabase = await createClient()

  const { data: 수주raw } = await supabase
    .from('수주')
    .select('id, 지중no, 공사명, 수주금액_공급가, 보험료율, 하도전용율')
    .order('지중no', { ascending: true })
  const 수주목록 = (수주raw ?? []) as 수주목록항목[]

  const historyHref = `/progress?tab=history&date_from=${date_from}&date_to=${date_to}`

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공사이력</h1>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <Link
          href="/progress"
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab !== 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          입력
        </Link>
        <Link
          href={historyHref}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          현황
        </Link>
      </div>

      {tab === 'history' ? (
        <ProgressHistoryTable date_from={date_from} date_to={date_to} />
      ) : (
        <ProgressInputForm 수주목록={수주목록} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: 타입 검사 (컴포넌트 파일 없어 에러 예상 — 다음 Task에서 해소)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/(dashboard)/progress/
git commit -m "feat: 공사이력 페이지 기반 구조 (타입 + 서버 컴포넌트)"
```

---

## Task 7: ProgressInputForm — 공사이력 입력 탭

**Files:**
- Create: `src/app/(dashboard)/progress/_components/ProgressInputForm.tsx`

- [ ] **Step 1: 컴포넌트 파일 생성**

```typescript
'use client'

import { useState, useRef, useEffect, useDeferredValue } from 'react'
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Search, ChevronDown, X as XIcon, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 수주목록항목 } from '../_types'
import type { 공사이력Row } from '@/types/database'

type Props = { 수주목록: 수주목록항목[] }

// 공사 검색 드롭다운 — OrderForm의 SearchableSelect와 동일 패턴
function 공사SearchableSelect({
  options,
  value,
  onChange,
}: {
  options: 수주목록항목[]
  value: number | null
  onChange: (id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selected = options.find((o) => o.id === value)
  const deferredQuery = useDeferredValue(query)
  const filtered = deferredQuery
    ? options.filter(
        (o) =>
          o.지중no.toLowerCase().includes(deferredQuery.toLowerCase()) ||
          o.공사명.toLowerCase().includes(deferredQuery.toLowerCase()),
      )
    : options

  const openDrop = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    setOpen(true)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('scroll', close, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [open])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected ? `${selected.지중no} · ${selected.공사명}` : '')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openDrop}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="지중No 또는 공사명으로 검색..."
          autoComplete="off"
          className={cn(
            'h-10 w-full rounded-lg border border-input bg-background text-sm pl-9 pr-8 outline-none',
            'focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors',
            open && 'border-ring ring-3 ring-ring/50',
          )}
        />
        {value != null ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); inputRef.current?.focus() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <XIcon className="size-4" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <DismissableLayerBranch>
            <div
              ref={dropRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, pointerEvents: 'auto' }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">검색 결과 없음</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(o.id); setOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors',
                      o.id === value && 'bg-blue-50 text-blue-700 font-medium',
                    )}
                  >
                    <span className="font-mono text-xs text-gray-400 mr-2">{o.지중no}</span>
                    {o.공사명}
                  </button>
                ))
              )}
            </div>
          </DismissableLayerBranch>,
          document.body,
        )}
    </div>
  )
}

// 천단위 콤마 금액 입력 — OrderForm의 MoneyInput과 동일
function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('ko-KR') : '')
  useEffect(() => {
    setDisplay(value != null ? value.toLocaleString('ko-KR') : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') { setDisplay(''); onChange(null) }
    else {
      const num = parseInt(raw, 10)
      setDisplay(num.toLocaleString('ko-KR'))
      onChange(num)
    }
  }

  return (
    <Input
      value={display}
      onChange={handleChange}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      className={className}
    />
  )
}

export function ProgressInputForm({ 수주목록 }: Props) {
  const [선택수주Id, set선택수주Id] = useState<number | null>(null)
  const [작업일자, set작업일자] = useState(() => new Date().toISOString().slice(0, 10))
  const [성과금액, set성과금액] = useState<number | null>(null)
  const [누계성과금액, set누계성과금액] = useState<number>(0)
  const [최근작업일자, set최근작업일자] = useState<string | null>(null)
  const [로딩중, set로딩중] = useState(false)
  const [저장중, set저장중] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ ok, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const 선택수주 = 수주목록.find((s) => s.id === 선택수주Id) ?? null

  // 하도적용금액 계산
  const 하도적용금액 = (() => {
    if (!선택수주) return null
    const { 수주금액_공급가: 공급가, 보험료율, 하도전용율 } = 선택수주
    if (공급가 == null || 보험료율 == null || 하도전용율 == null) return null
    return 공급가 * (1 - 보험료율) * 하도전용율
  })()

  // 공사 선택 시 최근 기록 + 누계 불러오기
  const handle공사선택 = async (id: number | null) => {
    set선택수주Id(id)
    set성과금액(null)
    set누계성과금액(0)
    set최근작업일자(null)
    if (id == null) return

    set로딩중(true)
    const supabase = createClient()
    const { data } = await (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액')
      .eq('수주_id', id)
      .order('작업일자', { ascending: false }) as { data: Pick<공사이력Row, 'id' | '작업일자' | '성과금액'>[] | null }
    set로딩중(false)

    const records = data ?? []
    const 누계 = records.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0)
    set누계성과금액(누계)
    if (records.length > 0) set최근작업일자(records[0].작업일자)
  }

  // 실시간 계산
  const delta달성율 = (성과금액 != null && 하도적용금액 != null && 하도적용금액 > 0)
    ? (성과금액 / 하도적용금액) * 100
    : null
  const 저장후누계 = 누계성과금액 + (성과금액 ?? 0)
  const 저장후달성율 = (하도적용금액 != null && 하도적용금액 > 0)
    ? (저장후누계 / 하도적용금액) * 100
    : null
  const 현재달성율 = (하도적용금액 != null && 하도적용금액 > 0)
    ? (누계성과금액 / 하도적용금액) * 100
    : null

  const handleSave = async () => {
    if (!선택수주Id || !작업일자 || 성과금액 == null) {
      showToast(false, '공사, 작업일자, 성과금액을 모두 입력해주세요.')
      return
    }
    set저장중(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any).insert({
      수주_id: 선택수주Id,
      작업일자,
      성과금액,
    })
    set저장중(false)
    if (error) {
      const msg = error.message?.includes('unique') ? '해당 날짜에 이미 등록된 이력이 있습니다.' : '저장에 실패했습니다.'
      showToast(false, msg)
      return
    }
    showToast(true, '저장되었습니다.')
    set누계성과금액((prev) => prev + (성과금액 ?? 0))
    set최근작업일자(작업일자)
    set성과금액(null)
    set작업일자(new Date().toISOString().slice(0, 10))
  }

  return (
    <div className="flex gap-0 max-w-4xl">
      {/* 좌측 입력 폼 */}
      <div className="flex-1 space-y-5 pr-6">
        {/* Toast */}
        {toast && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border',
            toast.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200',
          )}>
            {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* 공사 선택 */}
        <div>
          <Label className="text-xs text-gray-600 mb-1.5 block">공사 선택 (지중No / 공사명)</Label>
          <공사SearchableSelect
            options={수주목록}
            value={선택수주Id}
            onChange={handle공사선택}
          />
        </div>

        {/* 최근 기록 */}
        {선택수주Id != null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">
              {로딩중 ? '불러오는 중...' : '마지막 등록 기록'}
            </p>
            {!로딩중 && (
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-400 text-xs block">작업일자</span>
                  <span className="font-semibold text-gray-800">{최근작업일자 ?? '없음'}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">누계 성과금액</span>
                  <span className="font-semibold text-green-700">{formatKRW(누계성과금액)}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">현재 달성율</span>
                  <span className="font-semibold text-amber-600">
                    {현재달성율 != null ? `${현재달성율.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 입력 필드 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
            <Input
              type="date"
              className="h-10 text-sm"
              value={작업일자}
              onChange={(e) => set작업일자(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">성과금액 (이번 증분)</Label>
            <MoneyInput
              value={성과금액}
              onChange={set성과금액}
              className="h-10 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <Button
          type="button"
          className="w-full h-10 text-sm bg-[#f59e0b] hover:bg-[#d97706] text-white"
          onClick={handleSave}
          disabled={저장중 || !선택수주Id || 성과금액 == null}
        >
          {저장중 ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
          저장
        </Button>
      </div>

      {/* 우측 계산 패널 */}
      <div className="w-60 shrink-0 border-l border-gray-100 pl-6 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">자동 계산</p>

        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 mb-1">이번 Δ달성율</p>
          <p className="text-2xl font-bold text-amber-500">
            {delta달성율 != null ? `+${delta달성율.toFixed(2)}%` : '—'}
          </p>
          {delta달성율 != null && 하도적용금액 != null && (
            <p className="text-[10px] text-gray-400 mt-1">
              {formatKRW(성과금액!)} ÷ {formatKRW(하도적용금액)} × 100
            </p>
          )}
        </div>

        <div className="bg-[#1e2d5a] rounded-xl p-4">
          <p className="text-[10px] text-blue-300 mb-3">저장 후 누계</p>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-blue-200">성과금액</span>
            <span className="text-white font-semibold">{formatKRW(저장후누계)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-200 text-sm">달성율</span>
            <span className="text-amber-300 font-bold text-xl">
              {저장후달성율 != null ? `${저장후달성율.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>

        {하도적용금액 != null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-gray-500">
              <span>하도적용금액</span>
              <span className="font-medium">{formatKRW(하도적용금액)}</span>
            </div>
            {선택수주?.수주금액_공급가 && (
              <div className="flex justify-between text-gray-400">
                <span>수주금액</span>
                <span>{formatKRW(선택수주.수주금액_공급가)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 검사**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 개발 서버 확인**

```bash
npm run dev
```

확인 항목:
- `/progress` 접근 가능
- 공사 검색 → 드롭다운 표시
- 공사 선택 → 최근 기록 로드
- 성과금액 입력 → 우측 패널 실시간 계산
- 저장 → 성공 토스트, 최근 기록 업데이트

- [ ] **Step 4: 커밋**

```bash
git add src/app/(dashboard)/progress/_components/ProgressInputForm.tsx
git commit -m "feat: 공사이력 입력 탭 구현"
```

---

## Task 8: ProgressHistoryTable — 공사이력 현황 탭

**Files:**
- Create: `src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx`

- [ ] **Step 1: 컴포넌트 파일 생성**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKRW } from '@/lib/format'
import type { 공사이력행 } from '../_types'
import type { 공사이력Row } from '@/types/database'

// 천단위 콤마 금액 입력
function MoneyInput({
  value, onChange, className,
}: { value: number | null; onChange: (v: number | null) => void; className?: string }) {
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('ko-KR') : '')
  useEffect(() => { setDisplay(value != null ? value.toLocaleString('ko-KR') : '') }, [value])
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') { setDisplay(''); onChange(null) }
    else { const n = parseInt(raw, 10); setDisplay(n.toLocaleString('ko-KR')); onChange(n) }
  }
  return <Input value={display} onChange={handleChange} inputMode="numeric" className={className} />
}

type Props = { date_from: string; date_to: string }

export function ProgressHistoryTable({ date_from: initFrom, date_to: initTo }: Props) {
  const [dateFrom, setDateFrom] = useState(initFrom)
  const [dateTo, setDateTo]     = useState(initTo)
  const [rows, setRows]         = useState<공사이력행[]>([])
  const [loading, setLoading]   = useState(false)

  // Sheet 수정 상태
  const [editRow, setEditRow]       = useState<공사이력행 | null>(null)
  const [editDate, setEditDate]     = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [toast, setToast]           = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await (supabase.from('공사이력') as any)
      .select('id, 작업일자, 성과금액, 수주_id, 수주!수주_id(지중no, 공사명)')
      .gte('작업일자', dateFrom)
      .lte('작업일자', dateTo)
      .order('작업일자', { ascending: false }) as { data: 공사이력행[] | null }
    setRows(data ?? [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const openEdit = (row: 공사이력행) => {
    setEditRow(row)
    setEditDate(row.작업일자)
    setEditAmount(row.성과금액)
  }

  const handleSave = async () => {
    if (!editRow) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any)
      .update({ 작업일자: editDate, 성과금액: editAmount })
      .eq('id', editRow.id)
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    showToast(true, '수정되었습니다.')
    setEditRow(null)
    fetchData()
  }

  const handleDelete = async () => {
    if (!editRow) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase.from('공사이력') as any).delete().eq('id', editRow.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    showToast(true, '삭제되었습니다.')
    setEditRow(null)
    fetchData()
  }

  const total = rows.reduce((sum, r) => sum + (r.성과금액 ?? 0), 0)

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border mb-4 w-fit',
          toast.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200',
        )}>
          {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-3 mb-4 items-end">
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">시작일</Label>
          <Input type="date" className="h-9 text-sm w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">종료일</Label>
          <Input type="date" className="h-9 text-sm w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="h-9" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : '조회'}
        </Button>
      </div>

      {/* 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2.5 text-left text-gray-500 font-medium border-b border-gray-200">공사명</th>
              <th className="px-4 py-2.5 text-left text-gray-500 font-medium border-b border-gray-200 w-28">작업일자</th>
              <th className="px-4 py-2.5 text-right text-gray-700 font-semibold border-b border-gray-200 w-36">성과금액</th>
              <th className="px-4 py-2.5 border-b border-gray-200 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {loading ? '불러오는 중...' : '조회 결과가 없습니다.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-400 mr-2">{row.수주?.지중no}</span>
                    <span className="text-gray-800">{row.수주?.공사명}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{row.작업일자}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                    {formatKRW(row.성과금액 ?? 0)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      className="text-[#3d5af1] text-xs hover:underline"
                      onClick={() => openEdit(row)}
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-600">
                  합계 ({rows.length}건)
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[#1e2d5a]">
                  {formatKRW(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 수정 Sheet */}
      <Sheet open={editRow != null} onOpenChange={(open) => { if (!open) setEditRow(null) }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>공사이력 수정</SheetTitle>
            <SheetDescription>{editRow?.수주?.공사명}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
              <Input type="date" className="h-9 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1.5 block">성과금액</Label>
              <MoneyInput value={editAmount} onChange={setEditAmount} className="h-9 text-sm" />
            </div>
            <Button className="w-full bg-[#1e2d5a] hover:bg-[#2d45a8]" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              저장
            </Button>
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              삭제
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: 타입 검사**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 개발 서버 확인**

```bash
npm run dev
```

확인 항목:
- `/progress?tab=history` 접근
- 기간 필터 조회
- 행 "수정" 클릭 → Sheet 표시
- 저장/삭제 동작

- [ ] **Step 4: 커밋**

```bash
git add src/app/(dashboard)/progress/_components/ProgressHistoryTable.tsx
git commit -m "feat: 공사이력 현황 탭 구현 (조회·수정·삭제)"
```

---

## Self-Review

**스펙 커버리지:**
| 스펙 요구사항 | 커버 Task |
|---|---|
| 공사이력 전용 페이지 입력 탭 | Task 6, 7 |
| 공사 검색 시 최근 기록 자동 로드 | Task 7 |
| 성과금액 입력 → 달성율 역산 | Task 7 |
| 현황 탭 (조회·수정·삭제) | Task 8 |
| 사이드바 공사이력 메뉴 | Task 3 |
| 수주 Dialog 탭 구조 | Task 4 |
| 기성 탭 (CRUD) | Task 5 |
| 준공 탭 (VAT 합계 + 별도 저장) | Task 4 |

**타입 일관성:**
- `기성항목`에 `id` 추가 (Task 2) → Task 5의 `handle기성삭제(g.id)` 정상
- `공사이력Row` export (Task 1) → Task 7, 8의 타입 캐스팅에서 사용
- `공사이력행` 타입 (Task 6) → Task 8의 `rows` 상태 타입과 일치
