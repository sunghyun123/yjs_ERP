// src/app/(dashboard)/materials/_lib/derive.test.ts
import { describe, it, expect } from 'vitest'
import { derive드럼, derive품목, group칩, calc스탯, buildFeed, build타임라인 } from './derive'
import { fetchAll } from './fetch-all'
import type { 자재_드럼Row, 자재_드럼기록Row, 자재_선종Row, 자재_품목Row, 자재_품목기록Row } from '@/types/database'

const 선종들: 자재_선종Row[] = [
  { id: 1, 코드: 'CA95', 전압: '고압', 정렬: 2 },
  { id: 2, 코드: '35SQ', 전압: '저압', 정렬: 1 },
]

function 드럼(over: Partial<자재_드럼Row> & { id: number }): 자재_드럼Row {
  return { 선종_id: 1, 초기길이: 500, 제조표기: '대일 26.02', 입고일: '2026-07-01',
    사용처공사: null, 입고묶음: 'b1', 생성일: '2026-07-01T00:00:00Z', 작성자: null, ...over }
}
function 기록(over: Partial<자재_드럼기록Row> & { id: number; 드럼_id: number }): 자재_드럼기록Row {
  return { 출고일: '2026-07-05', 공사명: '군포중 지중화공사', 사용량: null, 복귀일: null,
    출고묶음: 'o1', 생성일: '2026-07-05T00:00:00Z', 작성자: null, ...over }
}

describe('derive드럼 — 잔량·상태는 기록에서 파생', () => {
  it('기록 없는 새 드럼: 잔량=초기길이, 상태=재고, 잔재 아님', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [])
    expect(d.잔량).toBe(500)
    expect(d.상태).toBe('재고')
    expect(d.잔재).toBe(false)
  })
  it('사용량 기입된 출고: 잔량 차감, 잔재=true', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [기록({ id: 1, 드럼_id: 1, 사용량: 430, 복귀일: '2026-07-05' })])
    expect(d.잔량).toBe(70)
    expect(d.상태).toBe('재고')
    expect(d.잔재).toBe(true)
  })
  it('사용량 null 출고 = 출고 중', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [기록({ id: 1, 드럼_id: 1 })])
    expect(d.상태).toBe('출고중')
  })
  it('누적 사용량 = 초기길이 → 소진', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [
       기록({ id: 1, 드럼_id: 1, 사용량: 300, 복귀일: '2026-07-05' }),
      기록({ id: 2, 드럼_id: 1, 사용량: 200, 복귀일: '2026-07-08' }),
    ])
    expect(d.잔량).toBe(0)
    expect(d.상태).toBe('소진')
  })
})

describe('group칩 — 같은 (잔량·표기·상태) 드럼을 ×n 칩으로', () => {
  it('동일 드럼 3개 → 칩 1개 ×3, 소진 드럼은 제외', () => {
    const 드럼들 = derive드럼(
      [드럼({ id: 1 }), 드럼({ id: 2 }), 드럼({ id: 3 }), 드럼({ id: 4, 초기길이: 100 })],
      [기록({ id: 1, 드럼_id: 4, 사용량: 100, 복귀일: '2026-07-05' })],
    )
    const 칩들 = group칩(드럼들)
    expect(칩들).toHaveLength(1)
    expect(칩들[0].개수).toBe(3)
    expect(칩들[0].드럼ids).toEqual([1, 2, 3])
  })
})

describe('calc스탯', () => {
  it('전압별 재고 합계(출고중 제외) + 잔재 드럼 수', () => {
    const 드럼들 = derive드럼(
      [드럼({ id: 1 }), 드럼({ id: 2, 선종_id: 2, 초기길이: 300 }), 드럼({ id: 3 })],
      [
        기록({ id: 1, 드럼_id: 1, 사용량: 100, 복귀일: '2026-07-05' }), // 고압 잔재 400
        기록({ id: 2, 드럼_id: 3 }),                                    // 출고 중 → 제외
      ],
    )
    const s = calc스탯(드럼들, 선종들)
    expect(s.고압재고).toBe(400)
    expect(s.저압재고).toBe(300)
    expect(s.잔재드럼수).toBe(1)
  })
})

describe('buildFeed', () => {
  it('입고묶음 그룹핑 + 복귀 항목(잔량>0) 생성 + 품목 기록 합산', () => {
    const 드럼들raw = [드럼({ id: 1 }), 드럼({ id: 2 }), 드럼({ id: 3, 초기길이: 100, 입고묶음: 'b2', 입고일: '2026-06-20' })]
    const 기록들 = [기록({ id: 1, 드럼_id: 3, 사용량: 80, 복귀일: '2026-07-02' })]
    const 품목들: 자재_품목Row[] = [{ id: 1, 분류: '개폐기', 품명: '3DM', 단위: '대', 정렬: 1 }]
    const 품목기록들: 자재_품목기록Row[] = [
      { id: 1, 품목_id: 1, 변화량: 2, 일자: '2026-07-03', 공사명: null, 생성일: '2026-07-03T00:00:00Z', 작성자: null },
      { id: 2, 품목_id: 1, 변화량: 1, 일자: '2026-07-03', 공사명: null, 생성일: '2026-07-03T01:00:00Z', 작성자: null },
    ]
    const feed = buildFeed(derive드럼(드럼들raw, 기록들), 기록들, 선종들, 품목들, 품목기록들)
    // 입고 2건(b1: 500m×2, b2: 100m×1) + 출고 1건 + 복귀 1건 + 품목입고 1건(+3 합산)
    expect(feed.filter((f) => f.type === '입고')).toHaveLength(3)
    expect(feed.filter((f) => f.type === '출고')).toHaveLength(1)
    const 복귀 = feed.filter((f) => f.type === '복귀')
    expect(복귀).toHaveLength(1)
    expect(복귀[0].line1).toContain('20m')      // 100 - 80 = 잔량 20 복귀
    expect(feed.find((f) => f.line1.includes('3DM'))!.line1).toContain('3대')
    // 최신 일자가 먼저
    expect(feed[0].일자 >= feed[feed.length - 1].일자).toBe(true)
  })
})

describe('build타임라인', () => {
  it('입고→출고→복귀 순서, 잔량 누적 계산', () => {
    const [d] = derive드럼([드럼({ id: 1, 초기길이: 189, 입고일: '2025-12-26' })],
      [기록({ id: 1, 드럼_id: 1, 출고일: '2026-01-15', 사용량: 76, 복귀일: '2026-01-15' })])
    const tl = build타임라인(d, [기록({ id: 1, 드럼_id: 1, 출고일: '2026-01-15', 사용량: 76, 복귀일: '2026-01-15' })])
    expect(tl[0].종류).toBe('입고')
    expect(tl[1].종류).toBe('출고')
    expect(tl[1].상세).toContain('113')        // 189 - 76
    expect(tl[2].종류).toBe('복귀')
  })
  it('미복귀 출고는 미복귀 플래그 + 기록id 노출(복귀 기입용)', () => {
    const recs = [기록({ id: 7, 드럼_id: 1 })]
    const [d] = derive드럼([드럼({ id: 1 })], recs)
    const tl = build타임라인(d, recs)
    expect(tl[1].미복귀).toBe(true)
    expect(tl[1].기록id).toBe(7)
  })
})

describe('derive품목', () => {
  it('수량 = Σ변화량', () => {
    const 품목들: 자재_품목Row[] = [{ id: 1, 분류: '개폐기', 품명: '3DM', 단위: '대', 정렬: 1 }]
    const 기록들: 자재_품목기록Row[] = [
      { id: 1, 품목_id: 1, 변화량: 5, 일자: '2026-07-01', 공사명: null, 생성일: '', 작성자: null },
      { id: 2, 품목_id: 1, 변화량: -2, 일자: '2026-07-02', 공사명: '군포중', 생성일: '', 작성자: null },
    ]
    expect(derive품목(품목들, 기록들)[0].수량).toBe(3)
  })
})

describe('derive드럼 — 초과 사용 방어', () => {
  it('Σ사용량 > 초기길이: 잔량 0으로 클램프, 상태=소진', () => {
    const [d] = derive드럼([드럼({ id: 1 })], [
      기록({ id: 1, 드럼_id: 1, 사용량: 400, 복귀일: '2026-07-05' }),
      기록({ id: 2, 드럼_id: 1, 사용량: 200, 복귀일: '2026-07-08' }),
    ])
    expect(d.잔량).toBe(0)
    expect(d.상태).toBe('소진')
  })
})

describe('fetchAll — 1000행 페이징', () => {
  function fetcherOf(total: number, fail = false) {
    const rows = Array.from({ length: total }, (_, i) => i)
    return (from: number, to: number) =>
      Promise.resolve(
        fail
          ? { data: null, error: { message: '연결 실패' } }
          : { data: rows.slice(from, to + 1), error: null },
      )
  }
  it('마지막 페이지가 짧으면 전량 반환 후 종료', async () => {
    await expect(fetchAll(fetcherOf(1500))).resolves.toHaveLength(1500)
  })
  it('총량이 정확히 1000의 배수여도 종료한다(무한루프 방어)', async () => {
    await expect(fetchAll(fetcherOf(2000))).resolves.toHaveLength(2000)
  })
  it('에러는 조용히 삼키지 않고 throw', async () => {
    await expect(fetchAll(fetcherOf(0, true))).rejects.toThrow('자재 데이터 조회 실패')
  })
})
