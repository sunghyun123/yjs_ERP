'use client'

import type { 자재_드럼기록Row, 자재_선종Row } from '@/types/database'
import type { Derived드럼 } from '../_lib/derive'

export function HistSheet(_props: {
  onClose: () => void
  드럼ids: number[]
  드럼들: Derived드럼[]
  기록들: 자재_드럼기록Row[]
  선종들: 자재_선종Row[]
}) {
  return <p className="text-sm text-slate-500">준비 중</p>
}
