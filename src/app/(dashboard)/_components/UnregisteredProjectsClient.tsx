'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteUnregisteredProject } from '../_actions/dashboard'
import type { ProjectStatus } from './UnregisteredProjects'

const PAGE_SIZE = 10

function StatusBadge({ has공사이력, has투입실적 }: { has공사이력: boolean; has투입실적: boolean }) {
  if (!has공사이력 && !has투입실적) {
    return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 whitespace-nowrap">
        ✗ 이력·실적 미입력
      </span>
    )
  }
  if (!has투입실적) {
    return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        ⚠ 실적 미입력
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      ⚠ 이력 미입력
    </span>
  )
}

export function UnregisteredProjectsClient({ items }: { items: ProjectStatus[] }) {
  const [page, setPage] = useState(0)
  const [pending, startTransition] = useTransition()

  // 페이지 overflow 방지: items가 줄었을 때 현재 page가 유효한지 확인
  useEffect(() => {
    const newTotalPages = Math.ceil(items.length / PAGE_SIZE)
    if (page >= newTotalPages && newTotalPages > 0) {
      setPage(newTotalPages - 1)
    }
  }, [items.length, page])

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleDelete = (id: number) => {
    startTransition(async () => {
      await deleteUnregisteredProject(id)
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">미입력 공사가 없습니다.</p>
  }

  return (
    <div className="space-y-2">
      {pageItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {item.지중no} · {item.공사명}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">진행일 {item.진행날짜}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <StatusBadge has공사이력={item.has공사이력} has투입실적={item.has투입실적} />
            {!item.has공사이력 && item.수주_id && (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 border-blue-400 text-blue-600">
                <Link href={`/progress?수주_id=${item.수주_id}&날짜=${item.진행날짜}`}>
                  이력 입력
                </Link>
              </Button>
            )}
            {!item.has투입실적 && item.수주_id && (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 border-blue-400 text-blue-600">
                <Link href={`/input?수주_id=${item.수주_id}&날짜=${item.진행날짜}`}>
                  실적 입력
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 border-slate-300 text-slate-400"
              onClick={() => handleDelete(item.id)}
              disabled={pending}
            >
              ✕
            </Button>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                i === page
                  ? 'bg-[#1e2d5a] text-white border-[#1e2d5a]'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
