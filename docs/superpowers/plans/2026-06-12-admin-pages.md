# 관리자 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `(protected)` dead code 삭제 후 거래처 관리 + 공사단가 관리 관리자 페이지 구현

**Architecture:** 서버 컴포넌트가 Supabase에서 초기 데이터를 fetch해 클라이언트 컴포넌트에 props로 전달. 클라이언트 컴포넌트 내부에서 로컬 state로 CRUD 후 낙관적 업데이트 (router.refresh 없음). 거래처는 Sheet 패널, 공사단가는 인라인 편집.

**Tech Stack:** Next.js 16 App Router · TypeScript · Supabase JS (browser client) · shadcn/ui (Sheet, Button, Input, Label, Textarea) · Tailwind CSS v4

---

## 파일 구조

```
삭제:
  src/app/(protected)/               ← dead code 전체

생성:
  src/app/(dashboard)/admin/clients/
    page.tsx                         ← 서버 컴포넌트, 거래처 목록 fetch
    _components/ClientsClient.tsx    ← 클라이언트 CRUD + Sheet

  src/app/(dashboard)/admin/rates/
    page.tsx                         ← 서버 컴포넌트, 현행 단가 fetch
    _components/RatesClient.tsx      ← 클라이언트 인라인 편집 CRUD
```

---

## Task 1: `(protected)` dead code 삭제

**Files:**
- Delete: `src/app/(protected)/` (전체 폴더)

- [ ] **Step 1: 폴더 삭제**

```powershell
Remove-Item -Recurse -Force "src\app\(protected)"
```

- [ ] **Step 2: 삭제 확인**

```powershell
Test-Path "src\app\(protected)"
# Expected: False
```

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "chore: remove unused (protected) route group"
```

---

## Task 2: 거래처 관리 — 서버 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/admin/clients/page.tsx`

- [ ] **Step 1: 폴더 생성 및 파일 작성**

`src/app/(dashboard)/admin/clients/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import type { 거래처Row } from '@/types/database'
import { ClientsClient } from './_components/ClientsClient'

export const metadata = { title: '거래처 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('거래처').select().order('거래처명')
  const rows = (data ?? []) as 거래처Row[]
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">거래처 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">거래처 등록 · 수정 · 삭제</p>
      </div>
      <ClientsClient initialRows={rows} />
    </div>
  )
}
```

---

## Task 3: 거래처 관리 — 클라이언트 CRUD

**Files:**
- Create: `src/app/(dashboard)/admin/clients/_components/ClientsClient.tsx`

**중요 — 보험료제외율 / 하도전용율 저장 형식:**
- DB에는 소수 비율로 저장 (예: 2.5% → `0.025`)
- 폼 표시는 % 값 (예: `2.5`)
- 저장 시: `parseFloat(입력값) / 100`
- 조회 시: `값 * 100` 으로 표시

- [ ] **Step 1: `_components` 폴더 생성 및 ClientsClient 작성**

`src/app/(dashboard)/admin/clients/_components/ClientsClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, AlertCircle, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 거래처Row } from '@/types/database'

type FormState = {
  거래처코드: string
  거래처명: string
  법인: string
  보험료제외율: string
  하도전용율: string
  비고: string
}

const emptyForm: FormState = {
  거래처코드: '', 거래처명: '', 법인: '', 보험료제외율: '', 하도전용율: '', 비고: '',
}

function rowToForm(row: 거래처Row): FormState {
  return {
    거래처코드: row.거래처코드,
    거래처명: row.거래처명,
    법인: row.법인 ?? '',
    보험료제외율: row.보험료제외율 != null ? String(row.보험료제외율 * 100) : '',
    하도전용율: row.하도전용율 != null ? String(row.하도전용율 * 100) : '',
    비고: row.비고 ?? '',
  }
}

export function ClientsClient({ initialRows }: { initialRows: 거래처Row[] }) {
  const [rows, setRows] = useState(initialRows)
  const [query, setQuery] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editRow, setEditRow] = useState<거래처Row | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const openNew = () => {
    setEditRow(null)
    setForm(emptyForm)
    setSheetOpen(true)
  }

  const openEdit = (row: 거래처Row) => {
    setEditRow(row)
    setForm(rowToForm(row))
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setEditRow(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.거래처코드.trim()) { showToast(false, '거래처코드를 입력하세요.'); return }
    if (!form.거래처명.trim()) { showToast(false, '거래처명을 입력하세요.'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      거래처코드: form.거래처코드.trim(),
      거래처명: form.거래처명.trim(),
      법인: form.법인.trim() || null,
      보험료제외율: form.보험료제외율 !== '' ? parseFloat(form.보험료제외율) / 100 : null,
      하도전용율: form.하도전용율 !== '' ? parseFloat(form.하도전용율) / 100 : null,
      비고: form.비고.trim() || null,
    }

    if (editRow) {
      const { data, error } = await (supabase.from('거래처') as any)
        .update(payload)
        .eq('id', editRow.id)
        .select()
        .single()
      setSaving(false)
      if (error) { showToast(false, '저장에 실패했습니다.'); return }
      setRows(prev => prev.map(r => r.id === editRow.id ? (data as 거래처Row) : r))
      showToast(true, '수정되었습니다.')
      closeSheet()
    } else {
      const { data, error } = await (supabase.from('거래처') as any)
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (error) {
        const msg = error.message?.includes('거래처코드') ? '이미 등록된 코드입니다.' : '저장에 실패했습니다.'
        showToast(false, msg)
        return
      }
      setRows(prev =>
        [...prev, data as 거래처Row].sort((a, b) => a.거래처명.localeCompare(b.거래처명, 'ko'))
      )
      showToast(true, '등록되었습니다.')
      closeSheet()
    }
  }

  const handleDelete = async () => {
    if (!editRow) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase.from('거래처') as any).delete().eq('id', editRow.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    setRows(prev => prev.filter(r => r.id !== editRow.id))
    showToast(true, '삭제되었습니다.')
    closeSheet()
  }

  const filtered = query.trim()
    ? rows.filter(r =>
        r.거래처명.toLowerCase().includes(query.toLowerCase()) ||
        r.거래처코드.toLowerCase().includes(query.toLowerCase())
      )
    : rows

  return (
    <>
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
          toast.ok ? 'bg-green-500' : 'bg-red-500',
        )}>
          {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="거래처명 또는 코드 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={openNew}>+ 새 거래처</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">거래처코드</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">거래처명</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">법인</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">보험료제외율</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">하도전용율</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">비고</th>
              <th className="py-2.5 px-4 bg-gray-50" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-gray-50 hover:bg-blue-50/40',
                  i % 2 === 1 && 'bg-gray-50/50',
                )}
              >
                <td className="py-2.5 px-4">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.거래처코드}</code>
                </td>
                <td className="py-2.5 px-4 font-medium">{row.거래처명}</td>
                <td className="py-2.5 px-4 text-gray-500">{row.법인 ?? '—'}</td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {row.보험료제외율 != null ? `${(row.보험료제외율 * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="py-2.5 px-4 text-right text-gray-600 tabular-nums">
                  {row.하도전용율 != null ? `${(row.하도전용율 * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{row.비고 ?? ''}</td>
                <td className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-xs border border-gray-200 rounded-md px-2.5 py-1 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    수정
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-gray-400">
                  거래처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">총 {rows.length}개 거래처</p>

      <Sheet open={sheetOpen} onOpenChange={open => { if (!open) closeSheet() }}>
        <SheetContent className="w-[380px] sm:max-w-[380px] flex flex-col p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{editRow ? '거래처 수정' : '새 거래처'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                거래처코드 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.거래처코드}
                onChange={e => setForm(f => ({ ...f, 거래처코드: e.target.value }))}
                disabled={!!editRow}
                className={cn(!!editRow && 'bg-gray-50 text-gray-400')}
              />
              {editRow && <p className="text-xs text-gray-400">등록 후 변경 불가</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                거래처명 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.거래처명}
                onChange={e => setForm(f => ({ ...f, 거래처명: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">법인</Label>
              <Input
                value={form.법인}
                onChange={e => setForm(f => ({ ...f, 법인: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  보험료제외율 (%)
                </Label>
                <Input
                  value={form.보험료제외율}
                  onChange={e => setForm(f => ({ ...f, 보험료제외율: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  하도전용율 (%)
                </Label>
                <Input
                  value={form.하도전용율}
                  onChange={e => setForm(f => ({ ...f, 하도전용율: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">비고</Label>
              <Textarea
                value={form.비고}
                onChange={e => setForm(f => ({ ...f, 비고: e.target.value }))}
                className="resize-none h-20"
              />
            </div>
          </div>
          <SheetFooter className="border-t px-6 py-4">
            <div className="flex w-full gap-2">
              {editRow && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={closeSheet}>
                  취소
                </Button>
                <Button size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: TypeScript 확인**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/clients" | Select-Object -First 5
```

Expected: 0 errors for admin/clients files

- [ ] **Step 3: 커밋**

```bash
git add src/app/'(dashboard)'/admin/clients/
git commit -m "feat: 거래처 관리 페이지 (/admin/clients) — DataTable + Sheet CRUD"
```

---

## Task 4: 공사단가 관리 — 서버 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/admin/rates/page.tsx`

**참고 — 현행 단가 조회:** Supabase JS는 `DISTINCT ON`을 지원하지 않으므로, 전체 레코드를 `적용시작일 DESC`로 가져온 뒤 JS에서 투입구분별 첫 번째(최신)만 남긴다.

- [ ] **Step 1: 파일 작성**

`src/app/(dashboard)/admin/rates/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import type { 공사단가Row } from '@/types/database'
import { RatesClient } from './_components/RatesClient'

export const metadata = { title: '공사단가 관리 | 영전사 ERP' }

export default async function Page() {
  const supabase = await createClient()
  const { data: ratesRaw } = await supabase
    .from('공사단가')
    .select()
    .order('적용시작일', { ascending: false })

  const seen = new Set<string>()
  const currentRates = ((ratesRaw ?? []) as 공사단가Row[]).filter(r => {
    if (seen.has(r.투입구분)) return false
    seen.add(r.투입구분)
    return true
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">공사단가 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">투입구분별 현행 단가 · 수정 시 해당 레코드 직접 UPDATE</p>
      </div>
      <RatesClient initialRows={currentRates} />
    </div>
  )
}
```

---

## Task 5: 공사단가 관리 — 클라이언트 인라인 편집

**Files:**
- Create: `src/app/(dashboard)/admin/rates/_components/RatesClient.tsx`

- [ ] **Step 1: `_components` 폴더 생성 및 RatesClient 작성**

`src/app/(dashboard)/admin/rates/_components/RatesClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 공사단가Row } from '@/types/database'

type EditValues = { 주간단가: string; 야간단가: string; 적용시작일: string }
type AddValues  = { 투입구분: string; 주간단가: string; 야간단가: string; 적용시작일: string }

function today() { return new Date().toISOString().slice(0, 10) }

export function RatesClient({ initialRows }: { initialRows: 공사단가Row[] }) {
  const [rows, setRows]           = useState(initialRows)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<EditValues>({ 주간단가: '', 야간단가: '', 적용시작일: '' })
  const [adding, setAdding]       = useState(false)
  const [addValues, setAddValues] = useState<AddValues>({
    투입구분: '', 주간단가: '', 야간단가: '', 적용시작일: today(),
  })
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<{ ok: boolean; msg: string } | null>(null)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const startEdit = (row: 공사단가Row) => {
    setEditingId(row.id)
    setEditValues({
      주간단가:  String(row.주간단가),
      야간단가:  row.야간단가 != null ? String(row.야간단가) : '',
      적용시작일: row.적용시작일,
    })
    setAdding(false)
  }

  const handleSaveEdit = async (row: 공사단가Row) => {
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await (supabase.from('공사단가') as any)
      .update({
        주간단가:   parseInt(editValues.주간단가.replace(/,/g, ''), 10) || 0,
        야간단가:   editValues.야간단가 !== '' ? parseInt(editValues.야간단가.replace(/,/g, ''), 10) : null,
        적용시작일: editValues.적용시작일,
      })
      .eq('id', row.id)
      .select()
      .single()
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    setRows(prev => prev.map(r => r.id === row.id ? (data as 공사단가Row) : r))
    setEditingId(null)
    showToast(true, '수정되었습니다.')
  }

  const handleDelete = async (row: 공사단가Row) => {
    const supabase = createClient()
    const { error } = await (supabase.from('공사단가') as any).delete().eq('id', row.id)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    setRows(prev => prev.filter(r => r.id !== row.id))
    showToast(true, '삭제되었습니다.')
  }

  const handleAdd = async () => {
    if (!addValues.투입구분.trim()) { showToast(false, '투입구분을 입력하세요.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await (supabase.from('공사단가') as any)
      .insert({
        투입구분:   addValues.투입구분.trim(),
        주간단가:   parseInt(addValues.주간단가.replace(/,/g, ''), 10) || 0,
        야간단가:   addValues.야간단가 !== '' ? parseInt(addValues.야간단가.replace(/,/g, ''), 10) : null,
        적용시작일: addValues.적용시작일,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    setRows(prev => [...prev, data as 공사단가Row])
    setAdding(false)
    setAddValues({ 투입구분: '', 주간단가: '', 야간단가: '', 적용시작일: today() })
    showToast(true, '추가되었습니다.')
  }

  const busy = editingId !== null || adding

  return (
    <>
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
          toast.ok ? 'bg-green-500' : 'bg-red-500',
        )}>
          {toast.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
          {toast.msg}
          <button type="button" onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-center mb-4">
        <Button
          size="sm"
          onClick={() => { setAdding(true); setEditingId(null) }}
          disabled={adding}
        >
          + 항목 추가
        </Button>
        <span className="text-xs text-gray-400">수정 버튼 클릭 → 인라인 편집</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-3xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">투입구분</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">주간단가</th>
              <th className="py-2.5 px-4 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">야간단가</th>
              <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">적용시작일</th>
              <th className="py-2.5 px-4" colSpan={2} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) =>
              editingId === row.id ? (
                <tr key={row.id} className="bg-blue-50/60 border-b border-blue-100">
                  <td className="py-2 px-4">
                    <span className="inline-block bg-gray-100 text-gray-600 rounded-md px-2.5 py-0.5 text-sm font-medium">
                      {row.투입구분}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      className="h-8 text-sm text-right w-32 ml-auto"
                      value={editValues.주간단가}
                      onChange={e => setEditValues(v => ({ ...v, 주간단가: e.target.value }))}
                      inputMode="numeric"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      className="h-8 text-sm text-right w-32 ml-auto"
                      value={editValues.야간단가}
                      onChange={e => setEditValues(v => ({ ...v, 야간단가: e.target.value }))}
                      inputMode="numeric"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <Input
                      type="date"
                      className="h-8 text-sm w-36"
                      value={editValues.적용시작일}
                      onChange={e => setEditValues(v => ({ ...v, 적용시작일: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 px-4" colSpan={2}>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => handleSaveEdit(row)}>
                        {saving ? '...' : '저장'}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                        취소
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className={cn('border-b border-gray-50 hover:bg-blue-50/40', i % 2 === 1 && 'bg-gray-50/50')}>
                  <td className="py-2.5 px-4">
                    <span className="inline-block bg-gray-100 text-gray-600 rounded-md px-2.5 py-0.5 text-sm font-medium">
                      {row.투입구분}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                    {row.주간단가.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-gray-500">
                    {row.야간단가 != null ? row.야간단가.toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{row.적용시작일}</td>
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      disabled={busy}
                      className="text-xs border border-gray-200 rounded-md px-2.5 py-1 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      수정
                    </button>
                  </td>
                  <td className="py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              )
            )}

            {adding && (
              <tr className="bg-green-50/50 border-b border-green-100">
                <td className="py-2 px-4">
                  <Input
                    className="h-8 text-sm w-28"
                    placeholder="투입구분"
                    value={addValues.투입구분}
                    onChange={e => setAddValues(v => ({ ...v, 투입구분: e.target.value }))}
                  />
                </td>
                <td className="py-2 px-4">
                  <Input
                    className="h-8 text-sm text-right w-32 ml-auto"
                    placeholder="0"
                    value={addValues.주간단가}
                    onChange={e => setAddValues(v => ({ ...v, 주간단가: e.target.value }))}
                    inputMode="numeric"
                  />
                </td>
                <td className="py-2 px-4">
                  <Input
                    className="h-8 text-sm text-right w-32 ml-auto"
                    placeholder="—"
                    value={addValues.야간단가}
                    onChange={e => setAddValues(v => ({ ...v, 야간단가: e.target.value }))}
                    inputMode="numeric"
                  />
                </td>
                <td className="py-2 px-4">
                  <Input
                    type="date"
                    className="h-8 text-sm w-36"
                    value={addValues.적용시작일}
                    onChange={e => setAddValues(v => ({ ...v, 적용시작일: e.target.value }))}
                  />
                </td>
                <td className="py-2 px-4" colSpan={2}>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={handleAdd}>
                      {saving ? '...' : '추가'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>
                      취소
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {rows.length === 0 && !adding && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  등록된 단가가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        투입구분별 현행 단가 (최신 레코드 기준) · 수정 시 해당 레코드 직접 UPDATE
      </p>
    </>
  )
}
```

- [ ] **Step 2: TypeScript 확인**

```powershell
npx tsc --noEmit 2>&1 | Select-String "admin/rates" | Select-Object -First 5
```

Expected: 0 errors for admin/rates files

- [ ] **Step 3: 커밋**

```bash
git add src/app/'(dashboard)'/admin/rates/
git commit -m "feat: 공사단가 관리 페이지 (/admin/rates) — 인라인 편집 CRUD"
```

---

## Task 6: 전체 타입 검사 및 최종 커밋

**Files:** 없음 (검증 단계)

- [ ] **Step 1: 전체 TypeScript 검사**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error TS" | Select-Object -First 10
```

Expected: 0 errors

- [ ] **Step 2: 개발 서버 확인**

```bash
npm run dev
```

브라우저에서 확인:
- `http://localhost:3000/admin/clients` — 거래처 목록 표시, 수정 버튼 클릭 시 Sheet 열림
- `http://localhost:3000/admin/rates` — 공사단가 12개 표시, 수정 버튼 클릭 시 인라인 편집 전환
- 사이드바 "관리자 > 거래처 관리 / 공사단가 관리" 링크 동작 확인

- [ ] **Step 3: 설계문서 업데이트 (ERP_설계문서.md §5 화면 목록)**

`ERP_설계문서.md` §5 "구현 완료" 테이블에 아래 2행 추가:

```markdown
| `/admin/clients` | 거래처 관리 (목록·등록·수정·삭제) | ✅ |
| `/admin/rates` | 공사단가 관리 (현행 단가·인라인 수정·추가·삭제) | ✅ |
```

- [ ] **Step 4: PROGRESS.md 업데이트**

"남은 작업" 테이블에서 두 행을 제거하고, "완료된 작업" 테이블에 추가:

```markdown
| 35 | 거래처 관리 (`/admin/clients`) — DataTable + Sheet CRUD | ✅ |
| 36 | 공사단가 관리 (`/admin/rates`) — 인라인 편집 CRUD | ✅ |
```

- [ ] **Step 5: 최종 커밋**

```bash
git add ERP_설계문서.md PROGRESS.md
git commit -m "docs: 거래처·공사단가 관리 완료 — 설계문서 + PROGRESS 업데이트"
```
