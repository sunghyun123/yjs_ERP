'use client'

import type { 자재_선종Row } from '@/types/database'

export function InSheet(_props: {
  onClose: () => void
  선종들: 자재_선종Row[]
  초기전압: '고압' | '저압'
  공사명목록: string[]
}) {
  return <p className="text-sm text-slate-500">준비 중</p>
}
