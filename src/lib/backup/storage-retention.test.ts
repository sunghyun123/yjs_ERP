import { describe, it, expect } from 'vitest'
import { selectForRetention } from './storage-retention'

const POLICY = { dailyDays: 7, weeklyCount: 4 }
const f = (d: string) => `${d}-030000-db.sql.gz`

describe('selectForRetention', () => {
  // 기준일 2026-06-19은 금요일. 2026-06-07/05-31/05-24/05-17/05-10은 모두 일요일.
  it('일별 보관 윈도우(7일) 안의 파일은 전부 보관한다', () => {
    const now = new Date(2026, 5, 19)
    const names = ['2026-06-19', '2026-06-18', '2026-06-15', '2026-06-13'].map(f)
    const { keep, delete: del } = selectForRetention(names, now, POLICY)
    expect(del).toEqual([])
    expect(keep).toHaveLength(4)
  })

  it('일별 윈도우 밖의 일요일 파일은 주간 백업으로 보관한다', () => {
    const now = new Date(2026, 5, 19)
    const sunday = f('2026-06-07') // 12일 전, 일요일
    const { keep } = selectForRetention([sunday], now, POLICY)
    expect(keep).toContain(sunday)
  })

  it('일별 윈도우 밖의 비(非)일요일 파일은 삭제한다', () => {
    const now = new Date(2026, 5, 19)
    const monday = f('2026-06-08') // 11일 전, 월요일
    const { delete: del } = selectForRetention([monday], now, POLICY)
    expect(del).toContain(monday)
  })

  it('주간(일요일) 백업은 최신 N개만 보관한다', () => {
    const now = new Date(2026, 5, 19)
    const sundays = ['2026-06-07', '2026-05-31', '2026-05-24', '2026-05-17', '2026-05-10'].map(f)
    // keep는 정렬 후 최신순(newest-first)이어야 한다 — 입력 순서 보존이 아님
    const { keep, delete: del } = selectForRetention(sundays, now, POLICY)
    expect(keep).toEqual(sundays.slice(0, 4))
    expect(del).toEqual([sundays[4]])
  })

  it('파싱 불가한 파일명은 절대 삭제하지 않는다', () => {
    const now = new Date(2026, 5, 19)
    const names = ['README.md', 'random.txt']
    const { keep, delete: del } = selectForRetention(names, now, POLICY)
    expect(del).toEqual([])
    expect(keep).toEqual(names)
  })

  it('빈 입력은 빈 결과를 반환한다', () => {
    expect(selectForRetention([], new Date(), POLICY)).toEqual({ keep: [], delete: [] })
  })

  it('dailyDays 경계(정확히 7일 전)는 일별 윈도우에 포함되지 않는다', () => {
    const now = new Date(2026, 5, 19)
    const edge = f('2026-06-12') // diff=7, 금요일 → 일별 윈도우 밖, 비일요일 → 삭제
    const { delete: del } = selectForRetention([edge], now, POLICY)
    expect(del).toContain(edge)
  })

  it('정규식엔 맞지만 달력상 불가능한 날짜는 파싱 불가로 보존한다', () => {
    const now = new Date(2026, 5, 19)
    const bogus = '2026-13-40-030000-db.sql.gz'
    const { keep, delete: del } = selectForRetention([bogus], now, POLICY)
    expect(del).toEqual([])
    expect(keep).toEqual([bogus])
  })
})
