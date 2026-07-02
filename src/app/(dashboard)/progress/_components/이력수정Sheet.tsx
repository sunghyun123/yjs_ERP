'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Trash2 } from 'lucide-react'
import type { 공사이력행 } from '../_types'
import { PerformanceInput } from './성과Input'
import { 직전누계 } from '../_lib/percent'

export type 이력레코드 = { id: number; 작업일자: string; 성과금액: number | null }

// 이력수정 시트 (컴포넌트 함수명은 ASCII 대문자 시작 — react-hooks 린트가 훅 검사를 하는 조건)
export function HistoryEditSheet({
  open,
  onOpenChange,
  row,
  records,
  loading,
  onSaved,
  onDeleted,
  showToast,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: 공사이력행 | null
  records: 이력레코드[]          // 그 공사 전체 이력(직전누계 계산용). 호출부가 준비해 넘긴다.
  loading: boolean               // records 불러오는 중이면 % 입력 자리에 스피너
  onSaved: () => void            // 저장 성공 → 호출부가 재조회/닫기
  onDeleted: () => void          // 삭제 성공 → 호출부가 재조회/닫기
  showToast: (ok: boolean, msg: string) => void
}) {
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // row가 바뀌면(다른 행 클릭) 편집 필드를 그 행 값으로 1회 동기화. 반복 cascade가 아니라 규칙 부적용.
  useEffect(() => {
    if (!row) return
    setEditDate(row.작업일자)
    setEditAmount(row.성과금액)
  }, [row])

  // 수정 대상 수주의 하도적용금액(=환산 base). 조인된 원자료로 계산.
  const editBase = useMemo(() => {
    const s = row?.수주
    if (!s || s.수주금액_공급가 == null || s.보험료율 == null || s.하도전용율 == null) return null
    return s.수주금액_공급가 * (1 - s.보험료율) * s.하도전용율
  }, [row])

  // 수정 중 레코드의 % 기준: 자기 자신을 뺀 "그 작업일자 직전" 누계.
  // strict <(직전누계) + id 필터 이중안전. editDate(작업일자 변경)를 바꿔도 자기 자신은 빠진다.
  const edit직전누계 = useMemo(
    () => 직전누계(records.filter((r) => r.id !== row?.id), editDate),
    [records, editDate, row],
  )

  const handleSave = async () => {
    if (!row) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('공사이력')
      .update({ 작업일자: editDate, 성과금액: editAmount })
      .eq('id', row.id)
    setSaving(false)
    if (error) { showToast(false, '저장에 실패했습니다.'); return }
    showToast(true, '수정되었습니다.')
    onSaved()
  }

  const handleDelete = async () => {
    if (!row) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('공사이력').delete().eq('id', row.id)
    setDeleting(false)
    if (error) { showToast(false, '삭제에 실패했습니다.'); return }
    showToast(true, '삭제되었습니다.')
    onDeleted()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-start gap-2 pr-8">
            <span className="font-mono text-xs text-gray-400 mt-0.5 shrink-0">{row?.수주?.지중no}</span>
            <SheetTitle className="text-base font-semibold text-left leading-snug">{row?.수주?.공사명}</SheetTitle>
          </div>
          <SheetDescription className="text-left">공사이력 수정</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">작업일자</Label>
            <Input type="date" className="h-9 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="size-4 animate-spin" /> 이력 불러오는 중...
              </div>
            ) : (
              <PerformanceInput
                value={editAmount}
                onChange={setEditAmount}
                하도적용금액={records.length > 0 ? editBase : null}
                직전누계={edit직전누계}
              />
            )}
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
  )
}
