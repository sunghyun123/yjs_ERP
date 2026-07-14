'use client'

import type { 자재_선종Row } from '@/types/database'
import type { Derived드럼 } from '../_lib/derive'

export function StockTab(_props: {
  선종들: 자재_선종Row[]
  드럼들: Derived드럼[]
  전압: '고압' | '저압'
  set전압: (v: '고압' | '저압') => void
  openIn: () => void
  openOut: () => void
  openHist: (드럼ids: number[]) => void
}) {
  return <p className="text-sm text-slate-500">준비 중</p>
}
