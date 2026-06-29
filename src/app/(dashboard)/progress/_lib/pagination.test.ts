import { describe, it, expect } from 'vitest'
import { paginate } from './pagination'

describe('paginate (클라이언트 페이지 분할)', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1) // 1..25

  it('빈 배열이면 빈 페이지·totalPages 1·page 1', () => {
    expect(paginate([], 1, 10)).toEqual({ pageItems: [], totalPages: 1, page: 1 })
  })

  it('첫 페이지는 앞에서 pageSize개', () => {
    const r = paginate(items, 1, 10)
    expect(r.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(r.totalPages).toBe(3)
    expect(r.page).toBe(1)
  })

  it('마지막 페이지는 남은 개수만', () => {
    const r = paginate(items, 3, 10)
    expect(r.pageItems).toEqual([21, 22, 23, 24, 25])
    expect(r.totalPages).toBe(3)
  })

  it('정확히 나누어떨어지면 totalPages가 딱 맞는다', () => {
    expect(paginate(items.slice(0, 20), 2, 10).totalPages).toBe(2)
  })

  it('page가 1보다 작으면 1로 보정', () => {
    expect(paginate(items, 0, 10).page).toBe(1)
    expect(paginate(items, -5, 10).page).toBe(1)
  })

  it('page가 totalPages를 넘으면 마지막 페이지로 보정', () => {
    const r = paginate(items, 999, 10)
    expect(r.page).toBe(3)
    expect(r.pageItems).toEqual([21, 22, 23, 24, 25])
  })
})
