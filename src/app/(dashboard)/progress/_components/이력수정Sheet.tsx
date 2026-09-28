'use client'

import { useState, useMemo } from 'react'
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
import { delete공사이력, update공사이력, 저장실패메시지 } from '../_lib/update-공사이력'

export type 이력레코드 = { id: number; 작업일자: string; 성과금액: number | null; 담당공무_id: number | null }

// 이력수정 시트 (컴포넌트 함수명은 ASCII 대문자 시작 — react-hooks 린트가 훅 검사를 하는 조건)
export function HistoryEditSheet({
  open,
  onOpenChange,
  row,
  records,
  loading,
  공무담당자목록,
  onSaved,
  onDeleted,
  showToast,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: 공사이력행 | null
  records: 이력레코드[]          // 그 공사 전체 이력(직전누계 계산용). 호출부가 준비해 넘긴다.
  loading: boolean               // records 불러오는 중이면 % 입력 자리에 스피너
  공무담당자목록: { id: number; 이름: string }[]
  onSaved: () => void            // 저장 성공 → 호출부가 재조회/닫기
  onDeleted: () => void          // 삭제 성공 → 호출부가 재조회/닫기
  showToast: (ok: boolean, msg: string) => void
}) {
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState<number | null>(null)
  const [edit담당공무Id, setEdit담당공무Id] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // row 변경 감지용 기억. effect 동기화는 이전 행 값이 한 프레임 그려진 뒤 재렌더되므로
  // (틀린 프레임 + 낭비 렌더), 렌더 중 조정으로 커밋 전에 새 값으로 바로잡는다.
  const [prevRow, setPrevRow] = useState(row)
  if (row !== prevRow) {
    setPrevRow(row)
    if (row) {
      setEditDate(row.작업일자)
      setEditAmount(row.성과금액)
      // DB 값으로 출발해야 한다 — 저장이 담당공무_id를 항상 보내므로, 여기서 null로 출발하면
      // 날짜만 고친 저장이 기존 담당을 지운다.
      setEdit담당공무Id(row.담당공무_id)
    }
  }

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

  // 목록에 없는 담당(삭제된 담당자)이 걸린 행이면 드롭다운에 그 값을 따로 보여준다 —
  // 안 보여주면 select가 "미지정"처럼 보이는데 저장은 옛 id를 그대로 보내 화면과 저장값이 어긋난다.
  const 목록에없는담당 =
    edit담당공무Id != null && !공무담당자목록.some((g) => g.id === edit담당공무Id) ? edit담당공무Id : null

  const handleSave = async () => {
    if (!row) return
    setSaving(true)
    const 결과 = await update공사이력(createClient(), row.id, {
      작업일자: editDate,
      성과금액: editAmount,
      담당공무_id: edit담당공무Id,
    })
    setSaving(false)
    if (!결과.ok) { showToast(false, 저장실패메시지(결과.reason)); return }
    showToast(true, '수정되었습니다.')
    onSaved()
  }

  const handleDelete = async () => {
    if (!row) return
    setDeleting(true)
    const 결과 = await delete공사이력(createClient(), row.id)
    setDeleting(false)
    if (!결과.ok) {
      showToast(false, 결과.reason === 'not-updated' ? '삭제되지 않았습니다 (권한이 없거나 이미 삭제된 이력).' : '삭제에 실패했습니다.')
      return
    }
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
          <div>
            <Label className="text-xs text-gray-600 mb-1.5 block">담당 공무</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background text-sm px-3 outline-none focus:border-ring"
              value={edit담당공무Id ?? ''}
              onChange={(e) => setEdit담당공무Id(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">미지정</option>
              {목록에없는담당 != null && (
                <option value={목록에없는담당}>삭제된 담당자 #{목록에없는담당}</option>
              )}
              {공무담당자목록.map((g) => (
                <option key={g.id} value={g.id}>{g.이름}</option>
              ))}
            </select>
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
