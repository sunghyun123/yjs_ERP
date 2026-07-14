'use client'

import type { 자재_선종Row } from '@/types/database'
import type { Derived드럼 } from '../_lib/derive'

export function OutSheet(_props: {
  onClose: () => void
  선종들: 자재_선종Row[]
  드럼들: Derived드럼[]
  초기전압: '고압' | '저압'
  공사명목록: string[]
}) {
  return <p className="text-sm text-slate-500">준비 중</p>
}
