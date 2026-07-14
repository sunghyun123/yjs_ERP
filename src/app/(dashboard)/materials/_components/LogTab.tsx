'use client'

import type { FeedItem } from '../_lib/derive'

export function LogTab(_props: { feed: FeedItem[]; openIn: () => void; openOut: () => void }) {
  return <p className="text-sm text-slate-500">준비 중</p>
}
